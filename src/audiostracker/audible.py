import requests
import logging
import time
import json
import os
import hashlib
from datetime import datetime, timedelta
from threading import Lock
from difflib import SequenceMatcher
import re
from .utils import retry_with_exponential_backoff
from typing import Dict, List, Any, Optional

# Global rate limit state
_last_api_call = 0
_api_lock = Lock()
_api_min_interval = 6  # default: 10 calls/minute = 6s between calls

# Cache settings
_cache_dir = os.path.join(os.path.dirname(__file__), 'data', 'cache')
_cache_ttl = 24 * 60 * 60  # 24 hours in seconds

def set_audible_rate_limit(calls_per_minute: int) -> None:
    """
    Configure the rate limiting for Audible API calls.
    
    Args:
        calls_per_minute: Maximum number of API calls allowed per minute
    """
    global _api_min_interval
    _api_min_interval = 60.0 / max(1, calls_per_minute)

def set_cache_ttl(hours: int) -> None:
    """
    Set the time-to-live for cached results in hours
    
    Args:
        hours: Number of hours to keep cached results
    """
    global _cache_ttl
    _cache_ttl = hours * 60 * 60

def _get_cache_key(query: str, search_field: str, page: int, results_per_page: int) -> str:
    """
    Generate a cache key for an API request
    
    Args:
        query: Search query
        search_field: Field to search (title, author, etc.)
        page: Page number
        results_per_page: Results per page
        
    Returns:
        str: Cache key (MD5 hash)
    """
    # Create a string representing the query parameters
    param_str = f"{query.lower()}:{search_field}:{page}:{results_per_page}"
    
    # Return an MD5 hash of the parameter string
    return hashlib.md5(param_str.encode('utf-8')).hexdigest()

def _get_cached_results(cache_key: str) -> Optional[List[Dict[str, Any]]]:
    """
    Try to get cached results for a query
    
    Args:
        cache_key: Cache key
        
    Returns:
        Optional[List[Dict[str, Any]]]: Cached results or None if not found or expired
    """
    if not os.path.exists(_cache_dir):
        os.makedirs(_cache_dir, exist_ok=True)
        return None
    
    cache_file = os.path.join(_cache_dir, f"{cache_key}.json")
    
    if not os.path.exists(cache_file):
        return None
    
    # Check if cache is expired
    file_mtime = os.path.getmtime(cache_file)
    if time.time() - file_mtime > _cache_ttl:
        logging.debug(f"Cache expired for key {cache_key}")
        return None
    
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            cached_data = json.load(f)
            logging.debug(f"Using cached results for key {cache_key}")
            return cached_data
    except (json.JSONDecodeError, IOError) as e:
        logging.warning(f"Failed to read cache file {cache_file}: {e}")
        return None

def _cache_results(cache_key: str, results: List[Dict[str, Any]]) -> None:
    """
    Cache results for a query
    
    Args:
        cache_key: Cache key
        results: Results to cache
    """
    if not os.path.exists(_cache_dir):
        os.makedirs(_cache_dir, exist_ok=True)
    
    cache_file = os.path.join(_cache_dir, f"{cache_key}.json")
    
    try:
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(results, f)
            logging.debug(f"Cached results for key {cache_key}")
    except IOError as e:
        logging.warning(f"Failed to write cache file {cache_file}: {e}")

def audible_rate_limited(func):
    """
    Decorator that enforces rate limiting for Audible API calls.
    
    This decorator ensures that API calls are spaced according to 
    the configured _api_min_interval to avoid hitting API rate limits.
    
    Args:
        func: The function to be rate-limited
        
    Returns:
        A wrapped function that respects the rate limit
    """
    def wrapper(*args, **kwargs):
        global _last_api_call
        with _api_lock:
            now = time.time()
            wait = _last_api_call + _api_min_interval - now
            if wait > 0:
                logging.debug(f"Rate limiting: sleeping {wait:.2f}s before next Audible API call.")
                time.sleep(wait)
            result = func(*args, **kwargs)
            _last_api_call = time.time()
            return result
    return wrapper

@audible_rate_limited
@retry_with_exponential_backoff(max_retries=3, retry_on_exceptions=(requests.RequestException, requests.HTTPError, requests.Timeout))
def _fetch_audible_page(query: str, search_field: str, page: int, results_per_page: int) -> List[Dict[str, Any]]:
    """
    Fetch a single page of results from Audible API
    
    Args:
        query: Search query
        search_field: Field to search (title, author, etc.)
        page: Page number
        results_per_page: Results per page
        
    Returns:
        List[Dict[str, Any]]: Normalized results
    """
    base_url = "https://api.audible.com/1.0/catalog/products"
    base_params = {
        search_field: query,
        'num_results': results_per_page,
        'products_sort_by': '-ReleaseDate',
        'response_groups': 'product_desc,media,contributors,series',
        'marketplace': 'US',  # Ensure consistent US marketplace
    }
    
    headers = {
        'User-Agent': 'curl/8.5.0',
    }
    
    if page > 0:
        base_params['page'] = page
    
    response = requests.get(base_url, params=base_params, headers=headers, timeout=10)
    response.raise_for_status()
    data = response.json()
    
    products = data.get('products', [])
    normalized = []
    
    for product in products:
        asin = product.get('asin', '')
        title = product.get('title', '')
        
        # Author processing
        authors = []
        for author in product.get('authors', []):
            authors.append(author.get('name', ''))
        author_str = ', '.join(authors) if authors else ''
        
        # Narrator processing
        narrators = []
        for narrator in product.get('narrators', []):
            narrators.append(narrator.get('name', ''))
        narrator_str = ', '.join(narrators) if narrators else ''
        
        # Publisher
        publisher = product.get('publisher_name', '')
        
        # Series information
        series_name = ''
        series_position = ''
        series_info = product.get('series', [])
        if series_info:
            # Use the first series entry
            series = series_info[0]
            series_name = series.get('title', '')
            sequence = series.get('sequence', '')
            if sequence and isinstance(sequence, str) and sequence.replace('.', '', 1).isdigit():
                series_position = sequence
        
        # Get release date from the most reliable source
        release_date = ''
        if 'release_date' in product:
            release_date = product['release_date']
        elif 'issue_date' in product:
            release_date = product['issue_date']
        
        # Product URL
        url = f"https://www.audible.com/pd/{asin}"
        
        normalized.append({
            'asin': asin,
            'title': title,
            'author': author_str,
            'narrator': narrator_str,
            'publisher': publisher,
            'series': series_name,
            'series_number': series_position,
            'release_date': release_date,
            'link': url
        })
    
    return normalized

def search_audible(query: str, search_field: str = "title", max_pages: int = 4, results_per_page: int = 50) -> List[Dict[str, Any]]:
    """
    Search Audible API for audiobooks matching the query.
    Uses caching to minimize API calls for repeated searches.
    
    Args:
        query: Search query
        search_field: 'title', 'author', or 'series'
        max_pages: Maximum number of pages to fetch
        results_per_page: Number of results per page
        
    Returns:
        List[Dict[str, Any]]: Normalized audiobook results
    """
    all_results = []
    
    # Try to get page 0 from cache first
    cache_key = _get_cache_key(query, search_field, 0, results_per_page)
    cached_results = _get_cached_results(cache_key)
    
    if cached_results is not None:
        # Use cached results for page 0
        all_results.extend(cached_results)
        logging.info(f"Found {len(cached_results)} cached results for query '{query}'")
    else:
        # Fetch page 0 from API
        try:
            page_results = _fetch_audible_page(query, search_field, 0, results_per_page)
            all_results.extend(page_results)
            
            # Cache the results
            _cache_results(cache_key, page_results)
            
            logging.info(f"Fetched {len(page_results)} results from API for query '{query}'")
        except Exception as e:
            logging.error(f"Failed to fetch page 0 for query '{query}': {e}")
    
    # Fetch additional pages if needed
    for page in range(1, max_pages):
        # Check if we need more results
        if len(all_results) < page * results_per_page:
            # We got fewer results than expected, no need to fetch more
            break
            
        # Try cache first
        cache_key = _get_cache_key(query, search_field, page, results_per_page)
        cached_results = _get_cached_results(cache_key)
        
        if cached_results is not None:
            all_results.extend(cached_results)
            logging.info(f"Found {len(cached_results)} cached results for query '{query}' page {page}")
        else:
            # Fetch from API
            try:
                page_results = _fetch_audible_page(query, search_field, page, results_per_page)
                all_results.extend(page_results)
                
                # Cache the results
                _cache_results(cache_key, page_results)
                
                logging.info(f"Fetched {len(page_results)} results from API for query '{query}' page {page}")
                
                # If we got fewer results than requested, we've reached the end
                if len(page_results) < results_per_page:
                    break
            except Exception as e:
                logging.error(f"Failed to fetch page {page} for query '{query}': {e}")
                break
    
    return all_results

def normalize_string(s):
    """Normalize a string for comparison by removing punctuation, extra spaces, and lowercasing"""
    if not s:
        return ""
    # Convert to lowercase
    s = s.lower()
    # Remove punctuation and extra spaces
    s = re.sub(r'[^\w\s]', '', s)
    # Replace multiple spaces with single space
    s = re.sub(r'\s+', ' ', s)
    # Remove leading/trailing whitespace
    s = s.strip()
    return s

def normalize_list(items):
    """Normalize a list of strings for comparison"""
    if not items:
        return []
    return [normalize_string(item) for item in items if item]

def fuzzy_ratio(s1, s2):
    """Calculate fuzzy match ratio between two strings"""
    if not s1 or not s2:
        return 0.0
    return SequenceMatcher(None, normalize_string(s1), normalize_string(s2)).ratio()

def narrator_match(narrators_result, narrators_wanted):
    """Check if any narrator in the result matches any in the wanted list"""
    if not narrators_result or not narrators_wanted:
        return False
    
    # Normalize both lists
    norm_result = normalize_list(narrators_result)
    norm_wanted = normalize_list(narrators_wanted)
    
    # If either list is empty after normalization, return False
    if not norm_result or not norm_wanted:
        return False
    
    # Check for direct matches first
    for nr in norm_result:
        for nw in norm_wanted:
            if nr == nw:
                return True
            # Use a high threshold for narrator matching
            if fuzzy_ratio(nr, nw) >= 0.9:  # 90% similarity
                logging.debug(f"Fuzzy narrator match: '{nr}' ~ '{nw}'")
                return True
    
    return False

def confidence(result, wanted):
    """
    Calculate a confidence score for how well a search result matches wanted criteria
    
    The confidence score is calculated based on the following weights:
    - Title: 40% (0.4)
    - Author: 20% (0.2)
    - Series: 20% (0.2)
    - Publisher: 10% (0.1)
    - Narrator: 10% (0.1)
    
    Args:
        result: Dictionary containing audiobook data from Audible API
        wanted: Dictionary containing the desired audiobook criteria
        
    Returns:
        float: Confidence score between 0 and 1
    """
    # Define weights and thresholds for different fields
    weights = {
        'title': 0.4,
        'series': 0.2,
        'author': 0.2,
        'publisher': 0.1,
        'narrator': 0.1
    }
    
    thresholds = {
        'title': {'exact': 1.0, 'high': 0.85, 'medium': 0.70},
        'series': {'exact': 1.0, 'high': 0.85, 'medium': 0.70},
        'author': {'exact': 1.0, 'high': 0.90, 'medium': 0.75},
        'publisher': {'exact': 1.0, 'high': 0.95, 'medium': 0.80}
    }
    
    # Partial credit multipliers for different match quality levels
    credit = {
        'exact': 1.0,    # Full credit for exact matches
        'high': 0.9,     # 90% credit for high quality fuzzy matches
        'medium': 0.6,   # 60% credit for medium quality matches
        'low': 0.0       # No credit for poor matches
    }
    
    score = 0.0
    log_parts = []
    
    # Title matching
    norm_title_result = normalize_string(result['title'])
    norm_title_wanted = normalize_string(wanted.get('title', ''))
    title_ratio = fuzzy_ratio(result['title'], wanted.get('title', ''))
    
    if norm_title_result and norm_title_wanted:
        if norm_title_result == norm_title_wanted:
            score += weights['title'] * credit['exact']
        elif title_ratio >= thresholds['title']['high']:
            score += weights['title'] * credit['high']
            log_parts.append(f"Fuzzy title match: '{norm_title_result}' ~ '{norm_title_wanted}' ({title_ratio:.2f})")
        elif title_ratio >= thresholds['title']['medium']:
            score += weights['title'] * credit['medium']
            log_parts.append(f"Partial title match: '{norm_title_result}' ~ '{norm_title_wanted}' ({title_ratio:.2f})")
        else:
            log_parts.append(f"Title mismatch: '{norm_title_result}' vs '{norm_title_wanted}' ({title_ratio:.2f})")
    
    # Series matching
    norm_series_result = normalize_string(result['series'])
    norm_series_wanted = normalize_string(wanted.get('series', ''))
    series_ratio = fuzzy_ratio(result['series'], wanted.get('series', ''))
    
    if norm_series_result and norm_series_wanted:
        if norm_series_result == norm_series_wanted:
            score += weights['series'] * credit['exact']
        elif series_ratio >= thresholds['series']['high']:
            score += weights['series'] * credit['high']
            log_parts.append(f"Fuzzy series match: '{norm_series_result}' ~ '{norm_series_wanted}' ({series_ratio:.2f})")
        elif series_ratio >= thresholds['series']['medium']:
            score += weights['series'] * credit['medium']
            log_parts.append(f"Partial series match: '{norm_series_result}' ~ '{norm_series_wanted}' ({series_ratio:.2f})")
        else:
            log_parts.append(f"Series mismatch: '{norm_series_result}' vs '{norm_series_wanted}' ({series_ratio:.2f})")
    
    # Author matching - handle multiple authors
    norm_author_result = normalize_string(result['author'])
    norm_author_wanted = normalize_string(wanted.get('author', ''))
    
    # Check if any author in the result matches the wanted author
    result_authors = [a.strip() for a in result['author'].split(',') if a.strip()]
    wanted_author = wanted.get('author', '')
    
    best_author_ratio = 0.0
    for res_author in result_authors:
        ratio = fuzzy_ratio(res_author, wanted_author)
        best_author_ratio = max(best_author_ratio, ratio)
    
    if norm_author_result and norm_author_wanted:
        if norm_author_result == norm_author_wanted:
            score += weights['author'] * credit['exact']
        elif best_author_ratio >= thresholds['author']['high']:
            score += weights['author'] * credit['high']
            log_parts.append(f"Fuzzy author match: '{norm_author_result}' ~ '{norm_author_wanted}' ({best_author_ratio:.2f})")
        elif best_author_ratio >= thresholds['author']['medium']:
            score += weights['author'] * credit['medium']
            log_parts.append(f"Partial author match: '{norm_author_result}' ~ '{norm_author_wanted}' ({best_author_ratio:.2f})")
        else:
            log_parts.append(f"Author mismatch: '{norm_author_result}' vs '{norm_author_wanted}' ({best_author_ratio:.2f})")
    
    # Publisher matching
    norm_publisher_result = normalize_string(result['publisher'])
    norm_publisher_wanted = normalize_string(wanted.get('publisher', ''))
    publisher_ratio = fuzzy_ratio(result['publisher'], wanted.get('publisher', ''))
    
    if norm_publisher_result and norm_publisher_wanted:
        if norm_publisher_result == norm_publisher_wanted:
            score += weights['publisher'] * credit['exact']
        elif publisher_ratio >= thresholds['publisher']['high']:
            score += weights['publisher'] * credit['high']
            log_parts.append(f"Fuzzy publisher match: '{norm_publisher_result}' ~ '{norm_publisher_wanted}' ({publisher_ratio:.2f})")
        else:
            log_parts.append(f"Publisher mismatch: '{norm_publisher_result}' vs '{norm_publisher_wanted}' ({publisher_ratio:.2f})")
    
    # Narrator matching - special case since it's an array comparison
    narrators_result = [result['narrator']] if isinstance(result['narrator'], str) else (result['narrator'] or [])
    narrators_wanted = wanted.get('narrator', [])
    
    if narrator_match(narrators_result, narrators_wanted):
        score += weights['narrator'] * credit['exact']
    else:
        log_parts.append(f"Narrator mismatch: {normalize_list(narrators_result)} vs {normalize_list(narrators_wanted)}")
    
    # Log detailed match information for debugging
    if log_parts:
        log_level = logging.DEBUG if score >= 0.7 else logging.INFO
        logging.log(log_level, f"Match score: {score:.2f}; " + "; ".join(log_parts))
    
    return score

if __name__ == "__main__":
    import sys
    logging.basicConfig(level=logging.DEBUG)
    authors = {
        "Patora Fuyuhara": [],
        "Another Author": [],
    }
    for author_name, books in authors.items():
        for book in books:
            if book.get('title'):
                query = book['title']
                search_field = 'title'
            elif book.get('series'):
                query = book['series']
                search_field = 'series'
            else:
                query = author_name
                search_field = 'author'
            logging.info(f"Searching Audible for: {query} (field: {search_field})")
            results = search_audible(query, search_field=search_field)
            print(f"Results for {search_field}='{query}': {len(results)}")
            for r in results:
                print(r)
