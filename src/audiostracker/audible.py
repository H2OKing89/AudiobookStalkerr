import requests
import logging
import time
from threading import Lock
from difflib import SequenceMatcher
import re
from .utils import retry_with_exponential_backoff

# Global rate limit state
_last_api_call = 0
_api_lock = Lock()
_api_min_interval = 6  # default: 10 calls/minute = 6s between calls

def set_audible_rate_limit(calls_per_minute):
    global _api_min_interval
    _api_min_interval = 60.0 / max(1, calls_per_minute)

def audible_rate_limited(func):
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
def search_audible(query, search_field="title", max_pages=4, results_per_page=50):
    """
    Search Audible API for audiobooks matching the query.
    search_field: 'title', 'author', or 'series'
    Returns a list of normalized dicts identical to cURL+jq output.
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
        'Accept': '*/*',
    }
    
    # Debug logging to see actual parameters
    logging.debug(f"Search parameters: {base_params}")
    
    all_books = []
    for page in range(max_pages):
        # Copy base params to avoid mutation
        params = base_params.copy()
        if page > 0:  # Only add page parameter after first request (0-based pagination)
            params['page'] = page
        
        page_display = page + 1  # For human-readable logging
        logging.debug(f"Requesting Audible API: {search_field}='{query}', page={page_display}")
        try:
            resp = requests.get(base_url, params=params, headers=headers, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            # Debug log the actual URL and response count for verification
            logging.debug(f"Actual URL: {resp.url} → {len(data.get('products', []))} items")
        except Exception as e:
            logging.warning(f"Audible API error on page {page_display}: {e}")
            break
        products = data.get('products', [])
        logging.debug(f"Page {page_display}: {len(products)} products returned.")
        if not products:
            break
        for prod in products:
            # Filter out podcasts (exact match to jq logic)
            ct = (prod.get('content_type') or '').lower()
            cdt = (prod.get('content_delivery_type') or '').lower()
            if ct == 'podcast' or 'podcast' in cdt:
                logging.debug(f"Filtered out podcast: {prod.get('title', 'N/A')} (ASIN: {prod.get('asin', 'N/A')})")
                continue
            # Normalize fields to match jq output exactly
            book = {
                'asin': prod.get('asin'),
                'title': prod.get('title', 'N/A'),
                'author': (prod.get('authors') or [{}])[0].get('name', 'N/A'),
                'series': (prod.get('series') or [{}])[0].get('title', 'N/A'),
                'series_number': (prod.get('series') or [{}])[0].get('sequence', 'N/A'),
                'release_date': prod.get('release_date', 'N/A'),
                'narrator': (prod.get('narrators') or [{}])[0].get('name', 'N/A'),
                'publisher': prod.get('publisher_name', 'N/A'),
                'link': f"https://www.audible.com/pd/{prod.get('asin', '')}"
            }
            logging.debug(f"Normalized book: {book['title']} (ASIN: {book['asin']}) by {book['author']}")
            all_books.append(book)
        if len(products) < results_per_page:
            break  # No more pages
    logging.info(f"Total books found for {search_field}='{query}': {len(all_books)}")
    return all_books

def fuzzy_match(a, b):
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def normalize_string(s):
    if not s:
        return ""
    s = s.lower().strip()
    # Remove common series suffixes that can cause mismatches
    s = re.sub(r'\bseries\b', '', s)
    s = re.sub(r'\(light novel\)', '', s)
    # Remove more punctuation as recommended: commas, periods, hyphens, colons, etc.
    s = re.sub(r'[^\w\s]', '', s)  # Remove all punctuation, keep letters/numbers/spaces
    # Collapse multiple spaces into single spaces
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def normalize_list(lst):
    return sorted([normalize_string(x) for x in lst or []])

def fuzzy_ratio(a, b):
    return SequenceMatcher(None, normalize_string(a), normalize_string(b)).ratio()

def narrator_match(a, b):
    a_set = set(normalize_list(a))
    b_set = set(normalize_list(b))
    if not a_set or not b_set:
        return True  # Don't penalize if missing
    return bool(a_set & b_set)

def confidence(result, wanted):
    score = 0.0
    log_parts = []
    
    # Title (0.4) - Use 85% threshold as recommended
    norm_title_result = normalize_string(result['title'])
    norm_title_wanted = normalize_string(wanted.get('title', ''))
    title_ratio = fuzzy_ratio(result['title'], wanted.get('title', ''))
    if norm_title_result and norm_title_wanted:
        if norm_title_result == norm_title_wanted:
            score += 0.4
        elif title_ratio >= 0.85:  # Lowered from 0.85 to be more lenient
            score += 0.35  # Give almost full credit for good fuzzy matches
            log_parts.append(f"Fuzzy title match: '{norm_title_result}' ~ '{norm_title_wanted}' ({title_ratio:.2f})")
        elif title_ratio >= 0.70:  # Partial credit for decent matches
            score += 0.25
            log_parts.append(f"Partial title match: '{norm_title_result}' ~ '{norm_title_wanted}' ({title_ratio:.2f})")
        else:
            log_parts.append(f"Title mismatch: '{norm_title_result}' vs '{norm_title_wanted}' ({title_ratio:.2f})")
    
    # Series (0.2) - Use 85% threshold as recommended
    norm_series_result = normalize_string(result['series'])
    norm_series_wanted = normalize_string(wanted.get('series', ''))
    series_ratio = fuzzy_ratio(result['series'], wanted.get('series', ''))
    if norm_series_result and norm_series_wanted:
        if norm_series_result == norm_series_wanted:
            score += 0.2
        elif series_ratio >= 0.85:
            score += 0.18  # Almost full credit for good fuzzy matches
            log_parts.append(f"Fuzzy series match: '{norm_series_result}' ~ '{norm_series_wanted}' ({series_ratio:.2f})")
        elif series_ratio >= 0.70:  # Partial credit for decent matches
            score += 0.12
            log_parts.append(f"Partial series match: '{norm_series_result}' ~ '{norm_series_wanted}' ({series_ratio:.2f})")
        else:
            log_parts.append(f"Series mismatch: '{norm_series_result}' vs '{norm_series_wanted}' ({series_ratio:.2f})")
    
    # Author (0.2) - Use 90% threshold as recommended
    norm_author_result = normalize_string(result['author'])
    norm_author_wanted = normalize_string(wanted.get('author', ''))
    author_ratio = fuzzy_ratio(result['author'], wanted.get('author', ''))
    if norm_author_result and norm_author_wanted:
        if norm_author_result == norm_author_wanted:
            score += 0.2
        elif author_ratio >= 0.90:  # Higher threshold for authors
            score += 0.18
            log_parts.append(f"Fuzzy author match: '{norm_author_result}' ~ '{norm_author_wanted}' ({author_ratio:.2f})")
        elif author_ratio >= 0.75:  # Partial credit for decent matches
            score += 0.10
            log_parts.append(f"Partial author match: '{norm_author_result}' ~ '{norm_author_wanted}' ({author_ratio:.2f})")
        else:
            log_parts.append(f"Author mismatch: '{norm_author_result}' vs '{norm_author_wanted}' ({author_ratio:.2f})")
    
    # Publisher (0.1) - Use 95% threshold as recommended
    norm_publisher_result = normalize_string(result['publisher'])
    norm_publisher_wanted = normalize_string(wanted.get('publisher', ''))
    publisher_ratio = fuzzy_ratio(result['publisher'], wanted.get('publisher', ''))
    if norm_publisher_result and norm_publisher_wanted:
        if norm_publisher_result == norm_publisher_wanted:
            score += 0.1
        elif publisher_ratio >= 0.95:  # Very high threshold for publishers
            score += 0.08
            log_parts.append(f"Fuzzy publisher match: '{norm_publisher_result}' ~ '{norm_publisher_wanted}' ({publisher_ratio:.2f})")
        else:
            log_parts.append(f"Publisher mismatch: '{norm_publisher_result}' vs '{norm_publisher_wanted}' ({publisher_ratio:.2f})")
    
    # Narrator (0.1) - Keep existing logic for narrator matching
    narrators_result = [result['narrator']] if isinstance(result['narrator'], str) else (result['narrator'] or [])
    narrators_wanted = wanted.get('narrator', [])
    if narrator_match(narrators_result, narrators_wanted):
        score += 0.1
    else:
        log_parts.append(f"Narrator mismatch: {normalize_list(narrators_result)} vs {normalize_list(narrators_wanted)}")
    
    if log_parts and score < 0.7:
        logging.debug("; ".join(log_parts))
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
