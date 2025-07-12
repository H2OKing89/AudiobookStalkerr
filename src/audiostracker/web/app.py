#!/usr/bin/env python3
"""
Audiobook Stalkerr Web UI - FastAPI Application
A modern, modular web interface for managing new audiobook feeds.
"""

from fastapi import FastAPI, HTTPException, Request, Form
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pathlib import Path
import json
import logging
from typing import Dict, List, Optional
from pydantic import BaseModel, field_validator
import os
import shutil
from datetime import datetime
import yaml
import sqlite3
import sys
import io

# Add the parent directory to the path so we can import from audiostracker
sys.path.append(str(Path(__file__).parent.parent))
from database import get_connection, init_db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Try to import iCal exporter, handle if dependencies are missing
try:
    from ..ical_export import ICalExporter
    ICAL_AVAILABLE = True
except ImportError as e:
    try:
        # Fallback: try importing from the parent directory
        import sys
        import os
        parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sys.path.insert(0, parent_dir)
        from ical_export import ICalExporter
        ICAL_AVAILABLE = True
    except ImportError as e2:
        logger.warning(f"iCal export not available: {e2}")
        ICalExporter = None
        ICAL_AVAILABLE = False

def create_simple_ical_event(audiobook: dict) -> str:
    """Create a simple iCal event for an audiobook at 00:00 America/Los_Angeles"""
    title = audiobook.get('title', 'Unknown Title')
    author = audiobook.get('author', 'Unknown Author')
    series = audiobook.get('series', '')
    series_number = audiobook.get('series_number', '')
    narrator = audiobook.get('narrator', 'Unknown Narrator')
    publisher = audiobook.get('publisher', 'Unknown Publisher')
    release_date = audiobook.get('release_date', '')
    asin = audiobook.get('asin', '')
    
    # Create event title
    event_title = f"📚 {title}"
    if series and series_number:
        event_title += f" ({series} #{series_number})"
    elif series:
        event_title += f" ({series})"
    
    # Create description
    description = f"New audiobook release\\n\\n"
    description += f"Title: {title}\\n"
    description += f"Author: {author}\\n"
    description += f"Narrator: {narrator}\\n"
    description += f"Publisher: {publisher}\\n"
    if series:
        description += f"Series: {series}"
        if series_number:
            description += f" (#{series_number})"
        description += "\\n"
    description += f"ASIN: {asin}\\n"
    if asin:
        description += f"Audible Link: https://www.audible.com/pd/{asin}\\n"
    
    # Parse release date and set to midnight California time
    try:
        from datetime import datetime
        import pytz
        ca_tz = pytz.timezone('America/Los_Angeles')
        release_dt = datetime.strptime(release_date, '%Y-%m-%d')
        release_dt = ca_tz.localize(release_dt.replace(hour=0, minute=0, second=0, microsecond=0))
        dtstart = release_dt.strftime('%Y%m%dT%H%M%S')
        dtend = release_dt.strftime('%Y%m%dT%H%M%S')
    except Exception:
        from datetime import datetime
        now = datetime.now()
        dtstart = now.strftime('%Y%m%dT000000')
        dtend = now.strftime('%Y%m%dT000000')
    
    # Generate unique ID
    from datetime import datetime
    uid = f"audiobook-{asin}-{datetime.now().strftime('%Y%m%d%H%M%S')}@audiobookstalkerr"
    
    # Create timestamp
    timestamp = datetime.utcnow().strftime('%Y%m%dT%H%M%SZ')
    
    # VTIMEZONE block for America/Los_Angeles
    vtimezone = """BEGIN:VTIMEZONE
TZID:America/Los_Angeles
BEGIN:DAYLIGHT
TZOFFSETFROM:-0800
TZOFFSETTO:-0700
TZNAME:PDT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
END:DAYLIGHT
BEGIN:STANDARD
TZOFFSETFROM:-0700
TZOFFSETTO:-0800
TZNAME:PST
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
END:STANDARD
END:VTIMEZONE"""
    
    ical_content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Audiobook Stalkerr//Audiobook Stalkerr//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:Audiobook Stalkerr - New Releases
X-WR-CALDESC:New audiobook releases tracked by Audiobook Stalkerr
{vtimezone}
BEGIN:VEVENT
UID:{uid}
DTSTART;TZID=America/Los_Angeles:{dtstart}
DTEND;TZID=America/Los_Angeles:{dtend}
DTSTAMP:{timestamp}
SUMMARY:{event_title}
DESCRIPTION:{description}
CATEGORIES:Audiobooks,Entertainment
STATUS:CONFIRMED
TRANSP:OPAQUE
END:VEVENT
END:VCALENDAR"""
    
    return ical_content

# Initialize FastAPI app
app = FastAPI(
    title="Audiobook Stalkerr Web UI",
    description="A modern web interface for managing audiobook collections",
    version="1.0.0"
)

# Paths
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"
CONFIG_DIR = BASE_DIR.parent / "config"
AUDIOBOOKS_FILE = CONFIG_DIR / "audiobooks.json"
CONFIG_FILE = CONFIG_DIR / "config.yaml"

# Load configuration
def load_config() -> dict:
    """Load configuration from config.yaml"""
    try:
        if CONFIG_FILE.exists():
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                logger.info(f"Loaded configuration from {CONFIG_FILE}")
                return config
        else:
            logger.warning(f"Config file not found: {CONFIG_FILE}")
            return {}
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {}

# Load config
config = load_config()
web_config = config.get('web_ui', {})

# Web UI configuration with defaults
WEB_HOST = web_config.get('host', '0.0.0.0')  # Default to all interfaces
WEB_PORT = web_config.get('port', 5005)
WEB_RELOAD = web_config.get('reload', True)

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Jinja2 templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

# Pydantic models for data validation
class Audiobook(BaseModel):
    title: str = ""
    series: str = ""
    publisher: str = ""
    narrator: List[str] = []

    @field_validator('narrator', mode='before')
    @classmethod
    def ensure_narrator_list(cls, v):
        if isinstance(v, str):
            return [v] if v else []
        return v or []

class AuthorBooks(BaseModel):
    books: List[Audiobook]

class AudiobookCollection(BaseModel):
    audiobooks: Dict[str, Dict[str, List[Audiobook]]]

# Data management functions
def load_audiobooks() -> dict:
    """Load audiobooks data from JSON file"""
    try:
        if AUDIOBOOKS_FILE.exists():
            with open(AUDIOBOOKS_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                logger.info(f"Loaded audiobooks data from {AUDIOBOOKS_FILE}")
                return data
        else:
            logger.warning(f"Audiobooks file not found: {AUDIOBOOKS_FILE}")
            return {"audiobooks": {"author": {}}}
    except Exception as e:
        logger.error(f"Error loading audiobooks: {e}")
        return {"audiobooks": {"author": {}}}

def save_audiobooks(data: dict) -> bool:
    """Save audiobooks data to JSON file with backup"""
    try:
        # Create backup
        if AUDIOBOOKS_FILE.exists():
            backup_path = AUDIOBOOKS_FILE.with_suffix(f'.backup_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
            shutil.copy2(AUDIOBOOKS_FILE, backup_path)
            logger.info(f"Created backup: {backup_path}")
        
        # Ensure directory exists
        AUDIOBOOKS_FILE.parent.mkdir(parents=True, exist_ok=True)
        
        # Save data
        with open(AUDIOBOOKS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved audiobooks data to {AUDIOBOOKS_FILE}")
        return True
    except Exception as e:
        logger.error(f"Error saving audiobooks: {e}")
        return False

def get_stats(data: dict) -> dict:
    """Calculate collection statistics for configuration"""
    authors = data.get("audiobooks", {}).get("author", {})
    total_books = sum(len(books) for books in authors.values())
    total_authors = len(authors)
    
    # Calculate publisher and narrator stats for reference
    all_publishers = set()
    all_narrators = set()
    
    for author_books in authors.values():
        for book in author_books:
            if book.get("publisher"):
                all_publishers.add(book["publisher"])
            if book.get("narrator"):
                for narrator in book["narrator"]:
                    if narrator.strip():
                        all_narrators.add(narrator.strip())
    
    return {
        "total_books": total_books,
        "total_authors": total_authors,
        "total_publishers": len(all_publishers),
        "total_narrators": len(all_narrators),
        "publishers": sorted(list(all_publishers)),
        "narrators": sorted(list(all_narrators))
    }

def get_upcoming_audiobooks() -> List[dict]:
    """Get upcoming audiobooks from the database"""
    try:
        # Initialize database if it doesn't exist
        init_db()
        
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT asin, title, author, narrator, publisher, series, series_number, 
                       release_date, link, image_url, merchandising_summary, publisher_name,
                       last_checked, notified_channels
                FROM audiobooks 
                WHERE release_date >= date('now')
                ORDER BY release_date ASC, author ASC, series ASC, series_number ASC
            """)
            
            audiobooks = []
            for row in cursor.fetchall():
                audiobook = {
                    "asin": row["asin"],
                    "title": row["title"],
                    "author": row["author"],
                    "narrator": row["narrator"],
                    "publisher": row["publisher"],
                    "series": row["series"],
                    "series_number": row["series_number"],
                    "release_date": row["release_date"],
                    "link": row["link"],
                    "image_url": row["image_url"],
                    "merchandising_summary": row["merchandising_summary"],
                    "publisher_name": row["publisher_name"],
                    "last_checked": row["last_checked"],
                    "notified_channels": json.loads(row["notified_channels"]) if row["notified_channels"] else {}
                }
                audiobooks.append(audiobook)
            
            return audiobooks
    except Exception as e:
        logger.error(f"Error getting upcoming audiobooks: {e}")
        return []

def get_database_stats() -> dict:
    """Get statistics from the database"""
    try:
        init_db()
        
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Total upcoming books
            cursor.execute("SELECT COUNT(*) FROM audiobooks WHERE release_date >= date('now')")
            upcoming_books = cursor.fetchone()[0]
            
            # Total authors
            cursor.execute("SELECT COUNT(DISTINCT author) FROM audiobooks WHERE release_date >= date('now')")
            total_authors = cursor.fetchone()[0]
            
            # Total publishers
            cursor.execute("SELECT COUNT(DISTINCT publisher) FROM audiobooks WHERE release_date >= date('now')")
            total_publishers = cursor.fetchone()[0]
            
            # Books by month
            cursor.execute("""
                SELECT strftime('%Y-%m', release_date) as month, COUNT(*) as count
                FROM audiobooks 
                WHERE release_date >= date('now')
                GROUP BY strftime('%Y-%m', release_date)
                ORDER BY month
                LIMIT 12
            """)
            monthly_releases = [{"month": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            # Recent additions (books added to DB in last 7 days)
            cursor.execute("""
                SELECT COUNT(*) FROM audiobooks 
                WHERE last_checked >= datetime('now', '-7 days')
            """)
            recent_additions = cursor.fetchone()[0]
            
            return {
                "upcoming_books": upcoming_books,
                "total_authors": total_authors,
                "total_publishers": total_publishers,
                "monthly_releases": monthly_releases,
                "recent_additions": recent_additions
            }
    except Exception as e:
        logger.error(f"Error getting database stats: {e}")
        return {
            "upcoming_books": 0,
            "total_authors": 0,
            "total_publishers": 0,
            "monthly_releases": [],
            "recent_additions": 0
        }

# API Routes
@app.get("/")
async def api_root():
    """Root API endpoint - redirect to Vue frontend or return API info"""
    return {
        "message": "AudiobookStalkerr API Server",
        "version": "1.0.0",
        "frontend_url": "http://localhost:3000",
        "api_docs": "/docs",
        "endpoints": {
            "upcoming": "/api/upcoming",
            "stats": "/api/database/stats", 
            "authors": "/api/audiobooks",
            "analytics": "/api/analytics/release-trends"
        }
    }

# Template-based routes commented out - using Vue frontend instead
# @app.get("/analytics", response_class=HTMLResponse)
# async def analytics(request: Request):
#     """Analytics dashboard page"""
#     return templates.TemplateResponse("analytics.html", {
#         "request": request
#     })

# Legacy redirect for backward compatibility - redirect to Vue frontend
@app.get("/config")
async def config_redirect():
    """Redirect old config route to Vue frontend authors page"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="http://localhost:3000/authors", status_code=301)

# Legacy redirect for backward compatibility  
@app.get("/config/author/{author_name}")
async def config_author_redirect(author_name: str):
    """Redirect old config author route to Vue frontend"""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url=f"http://localhost:3000/authors", status_code=301)

# @app.get("/authors", response_class=HTMLResponse)
# async def authors_page(request: Request):
#     """Authors management page for managing JSON watchlist"""
#     data = load_audiobooks()
#     authors_list = transform_audiobooks_for_frontend(data)
#     stats = get_stats(data)
#     return templates.TemplateResponse("authors.html", {
#         "request": request,
#         "audiobooks": authors_list,
#         "stats": stats
#     })

@app.get("/api/upcoming")
async def get_upcoming():
    """Get upcoming audiobooks from database"""
    return get_upcoming_audiobooks()

@app.get("/api/database/stats")
async def get_database_stats_api():
    """Get database statistics"""
    return get_database_stats()

# Analytics API endpoints
@app.get("/api/analytics/release-trends")
async def get_release_trends():
    """Get release trends data for analytics dashboard"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # Get releases grouped by month for the next 12 months
        cursor.execute("""
            SELECT 
                strftime('%Y-%m', release_date) as month,
                COUNT(*) as count
            FROM audiobooks 
            WHERE release_date IS NOT NULL 
                AND release_date >= date('now')
                AND release_date <= date('now', '+12 months')
            GROUP BY month
            ORDER BY month
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        labels = [result[0] for result in results]
        values = [result[1] for result in results]
        
        return {"labels": labels, "values": values}
    except Exception as e:
        logger.error(f"Error getting release trends: {e}")
        return {"labels": [], "values": []}

@app.get("/api/analytics/top-authors")
async def get_top_authors():
    """Get top authors by number of upcoming releases"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                author,
                COUNT(*) as count
            FROM audiobooks 
            WHERE release_date IS NOT NULL 
                AND release_date >= date('now')
            GROUP BY author
            ORDER BY count DESC
            LIMIT 6
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        labels = [result[0] for result in results]
        values = [result[1] for result in results]
        
        return {"labels": labels, "values": values}
    except Exception as e:
        logger.error(f"Error getting top authors: {e}")
        return {"labels": [], "values": []}

@app.get("/api/analytics/upcoming-count")
async def get_upcoming_count():
    """Get upcoming releases count by month"""
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT 
                strftime('%Y-%m', release_date) as month,
                COUNT(*) as count
            FROM audiobooks 
            WHERE release_date IS NOT NULL 
                AND release_date >= date('now')
                AND release_date <= date('now', '+6 months')
            GROUP BY month
            ORDER BY month
        """)
        
        results = cursor.fetchall()
        conn.close()
        
        labels = [result[0] for result in results]
        values = [result[1] for result in results]
        
        return {"labels": labels, "values": values}
    except Exception as e:
        logger.error(f"Error getting upcoming count: {e}")
        return {"labels": [], "values": []}

@app.get("/api/audiobooks")
async def get_audiobooks():
    """Get all audiobooks data"""
    data = load_audiobooks()
    authors_list = transform_audiobooks_for_frontend(data)
    stats = get_stats(data)
    return {"data": authors_list, "stats": stats}

@app.get("/api/config")
async def get_config():
    """Get authors configuration data (alias for audiobooks)"""
    data = load_audiobooks()
    authors_list = transform_audiobooks_for_frontend(data)
    return authors_list

@app.post("/api/audiobooks")
async def save_audiobooks_api(request: Request):
    """Save audiobooks data"""
    try:
        audiobooks = await request.json()
        
        # Validate the structure
        if "audiobooks" not in audiobooks or "author" not in audiobooks["audiobooks"]:
            logger.error(f"Invalid structure - expected audiobooks.author, got keys: {list(audiobooks.keys())}")
            raise HTTPException(status_code=400, detail="Invalid audiobook data structure")
        
        if save_audiobooks(audiobooks):
            stats = get_stats(audiobooks)
            return {"success": True, "message": "Audiobooks saved successfully", "stats": stats}
        else:
            raise HTTPException(status_code=500, detail="Failed to save audiobooks")
    except Exception as e:
        logger.error(f"Error in save_audiobooks_api: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/authors")
async def add_author(author_name: str = Form(...)):
    """Add a new author"""
    try:
        data = load_audiobooks()
        authors = data["audiobooks"]["author"]
        
        if author_name in authors:
            raise HTTPException(status_code=400, detail="Author already exists")
        
        authors[author_name] = []
        
        if save_audiobooks(data):
            return {"success": True, "message": f"Author '{author_name}' added successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to save changes")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding author: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/authors/{author_name}")
async def delete_author(author_name: str):
    """Delete an author and all their books"""
    try:
        logger.debug(f"=== DELETE_AUTHOR API START ===")
        logger.debug(f"Request to delete author: {author_name}")
        
        data = load_audiobooks()
        logger.debug(f"Loaded current audiobooks data")
        
        authors = data["audiobooks"]["author"]
        
        if author_name not in authors:
            logger.warning(f"Author not found: {author_name}")
            logger.debug(f"Available authors: {list(authors.keys())}")
            raise HTTPException(status_code=404, detail="Author not found")
        
        # Get book count for logging
        book_count = len(authors[author_name])
        logger.debug(f"Author '{author_name}' has {book_count} books")
        
        del authors[author_name]
        logger.debug(f"Removed author '{author_name}' from data structure")
        
        logger.debug(f"Calling save_audiobooks...")
        if save_audiobooks(data):
            logger.info(f"Successfully deleted author '{author_name}' with {book_count} books")
            logger.debug(f"=== DELETE_AUTHOR API SUCCESS ===")
            return {"success": True, "message": f"Author '{author_name}' deleted successfully"}
        else:
            logger.error(f"save_audiobooks function returned False for author deletion")
            logger.debug(f"=== DELETE_AUTHOR API FAILED ===")
            raise HTTPException(status_code=500, detail="Failed to save changes")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting author: {e}")
        logger.error(f"Exception type: {type(e)}")
        logger.debug(f"=== DELETE_AUTHOR API EXCEPTION ===")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/authors/{author_name}/books")
async def add_book(author_name: str, book: Audiobook):
    """Add a book to an author"""
    try:
        data = load_audiobooks()
        authors = data["audiobooks"]["author"]
        
        if author_name not in authors:
            authors[author_name] = []
        
        book_dict = book.dict()
        authors[author_name].append(book_dict)
        
        if save_audiobooks(data):
            return {"success": True, "message": f"Book added to {author_name}", "book": book_dict}
        else:
            raise HTTPException(status_code=500, detail="Failed to save changes")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding book: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/authors/{author_name}/books/{book_index}")
async def update_book(author_name: str, book_index: int, book: Audiobook):
    """Update a specific book"""
    try:
        data = load_audiobooks()
        authors = data["audiobooks"]["author"]
        
        if author_name not in authors:
            raise HTTPException(status_code=404, detail="Author not found")
        
        if book_index >= len(authors[author_name]):
            raise HTTPException(status_code=404, detail="Book not found")
        
        book_dict = book.dict()
        authors[author_name][book_index] = book_dict
        
        if save_audiobooks(data):
            return {"success": True, "message": "Book updated successfully", "book": book_dict}
        else:
            raise HTTPException(status_code=500, detail="Failed to save changes")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating book: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/authors/{author_name}/books/{book_index}")
async def delete_book(author_name: str, book_index: int):
    """Delete a specific book"""
    try:
        data = load_audiobooks()
        authors = data["audiobooks"]["author"]
        
        if author_name not in authors:
            raise HTTPException(status_code=404, detail="Author not found")
        
        if book_index >= len(authors[author_name]):
            raise HTTPException(status_code=404, detail="Book not found")
        
        deleted_book = authors[author_name].pop(book_index)
        
        if save_audiobooks(data):
            return {"success": True, "message": "Book deleted successfully", "deleted_book": deleted_book}
        else:
            raise HTTPException(status_code=500, detail="Failed to save changes")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting book: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_collection_stats():
    """Get collection statistics"""
    data = load_audiobooks()
    stats = get_stats(data)
    return stats

@app.post("/api/export")
async def export_collection():
    """Export the current collection as JSON file"""
    try:
        data = load_audiobooks()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audiobooks_export_{timestamp}.json"
        json_bytes = json.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
        return StreamingResponse(
            iter([json_bytes]),
            media_type="application/json",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"Error exporting collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/import")
async def import_collection(import_data: dict):
    """Import audiobook collection data"""
    try:
        # Validate structure
        if "audiobooks" not in import_data or "author" not in import_data["audiobooks"]:
            raise HTTPException(status_code=400, detail="Invalid import data structure")
        
        # Create backup before import
        current_data = load_audiobooks()
        backup_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = AUDIOBOOKS_FILE.with_suffix(f'.pre_import_backup_{backup_timestamp}.json')
        
        with open(backup_path, 'w', encoding='utf-8') as f:
            json.dump(current_data, f, indent=2, ensure_ascii=False)
        
        # Save imported data
        if save_audiobooks(import_data):
            stats = get_stats(import_data)
            return {
                "success": True,
                "message": "Collection imported successfully",
                "stats": stats,
                "backup_created": str(backup_path)
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to save imported data")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error importing collection: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/manual-start")
async def manual_start():
    """Manually trigger the audiobook search process"""
    try:
        import subprocess
        import threading
        from pathlib import Path
        
        # Path to the main.py script
        main_script = Path(__file__).parent.parent / "main.py"
        
        if not main_script.exists():
            raise HTTPException(status_code=500, detail="Main script not found")
        
        # Function to run the script in background
        def run_script():
            try:
                # Get the project root directory
                project_root = Path(__file__).parent.parent.parent  # /home/quentin/dev/audiobook_feed
                logger.info(f"Running manual search from directory: {project_root}")
                
                # Run the main.py script directly (it now handles imports properly)
                result = subprocess.run(
                    [sys.executable, str(main_script)],
                    cwd=str(project_root),
                    capture_output=True,
                    text=True,
                    timeout=600  # 10 minute timeout
                )
                
                if result.returncode == 0:
                    logger.info("Manual search completed successfully")
                    logger.info(f"Output: {result.stdout}")
                else:
                    logger.error(f"Manual search failed with return code {result.returncode}")
                    logger.error(f"Error: {result.stderr}")
                
            except subprocess.TimeoutExpired:
                logger.error("Manual search timed out after 10 minutes")
            except Exception as e:
                logger.error(f"Error running manual search: {e}")
        
        # Start the script in a background thread
        thread = threading.Thread(target=run_script, daemon=True)
        thread.start()
        
        return {
            "success": True,
            "message": "Manual audiobook search started successfully. Check the logs for progress."
        }
        
    except Exception as e:
        logger.error(f"Error starting manual search: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/manual-start/test")
async def manual_start_test():
    """Test endpoint to verify manual start API is working"""
    try:
        from pathlib import Path
        main_script = Path(__file__).parent.parent / "main.py"
        
        return {
            "success": True,
            "message": "Manual start API is working",
            "main_script_exists": main_script.exists(),
            "main_script_path": str(main_script)
        }
    except Exception as e:
        logger.error(f"Error in manual start test: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/authors/{author_name}", response_class=HTMLResponse)
async def author_detail_page(request: Request, author_name: str):
    """Author detail page for managing individual author's books"""
    try:
        # URL decode the author name
        from urllib.parse import unquote
        author_name = unquote(author_name)
        
        # Load all audiobooks data
        data = load_audiobooks()
        
        # Get books for this specific author (fix data structure)
        authors_data = data.get("audiobooks", {}).get("author", {})
        author_books = authors_data.get(author_name, [])
        
        if not author_books:
            raise HTTPException(status_code=404, detail=f"Author '{author_name}' not found")
        
        # Calculate author-specific stats
        total_books = len(author_books)
        complete_books = sum(1 for book in author_books if is_book_complete(book))
        completion_percentage = round((complete_books / total_books) * 100) if total_books > 0 else 0
        
        # Get unique publishers and narrators
        publishers = list(set(book.get('publisher', '') for book in author_books if book.get('publisher')))
        narrators = []
        for book in author_books:
            if book.get('narrator'):
                if isinstance(book['narrator'], list):
                    narrators.extend(book['narrator'])
                else:
                    narrators.append(book['narrator'])
        unique_narrators = list(set(filter(None, narrators)))
        
        # Get series information
        series_data = {}
        for book in author_books:
            series_name = book.get('series', '')
            if series_name:
                if series_name not in series_data:
                    series_data[series_name] = []
                series_data[series_name].append(book)
        
        author_stats = {
            'total_books': total_books,
            'complete_books': complete_books,
            'incomplete_books': total_books - complete_books,
            'completion_percentage': completion_percentage,
            'total_series': len(series_data),
            'total_publishers': len(publishers),
            'total_narrators': len(unique_narrators)
        }
        
        return templates.TemplateResponse("author_detail.html", {
            "request": request,
            "author_name": author_name,
            "author_books": author_books,
            "series_data": series_data,
            "publishers": publishers,
            "narrators": unique_narrators,
            "stats": author_stats
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error loading author detail for '{author_name}': {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error loading author detail: {str(e)}")

def is_book_complete(book: dict) -> bool:
    """Check if a book has all required fields completed"""
    return bool(
        book.get('title') and
        book.get('series') and
        book.get('publisher') and
        book.get('narrator') and
        len(book.get('narrator', [])) > 0 and
        all(n and n.strip() for n in book.get('narrator', []))
    )

def transform_audiobooks_for_frontend(data):
    """Transform the nested audiobooks data structure into a flat array for frontend consumption"""
    if not data or 'audiobooks' not in data or 'author' not in data['audiobooks']:
        return []
    
    authors_list = []
    authors_data = data['audiobooks']['author']
    
    for author_name, books in authors_data.items():
        author_obj = {
            'name': author_name,
            'books': books if isinstance(books, list) else []
        }
        authors_list.append(author_obj)
    
    return authors_list

@app.get("/api/ical/download/{asin}")
async def download_ical(asin: str):
    """Download iCal file for a specific audiobook by ASIN"""
    try:
        # Get upcoming audiobooks data
        upcoming_audiobooks = get_upcoming_audiobooks()
        
        # Find the audiobook by ASIN
        audiobook = None
        for book in upcoming_audiobooks:
            if book.get('asin') == asin:
                audiobook = book
                break
        
        if not audiobook:
            raise HTTPException(status_code=404, detail=f"Audiobook with ASIN {asin} not found")
        
        # Create iCal content using the simple function
        ical_content = create_simple_ical_event(audiobook)
        
        # Prepare filename
        title = audiobook.get('title', 'audiobook').replace(' ', '_').replace('/', '_')
        filename = f"{title}_{asin}.ics"
        
        return Response(
            ical_content,
            media_type="text/calendar",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating iCal for {asin}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
