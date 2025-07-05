#!/usr/bin/env python3
"""
Test script to verify the database schema migration and new fields
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from audiostracker.database import init_db, insert_or_update_audiobook, get_upcoming_audiobooks, get_connection

def test_database_schema():
    """Test the new database schema with all fields"""
    print("Initializing database...")
    init_db()
    
    # Test inserting a book with all new fields
    print("Testing insert with all new fields...")
    result = insert_or_update_audiobook(
        asin="TEST123",
        title="Test Book", 
        author="Test Author",
        narrator="Test Narrator",
        publisher="Test Publisher",
        series="Test Series",
        series_number="1",
        release_date="2024-12-31",
        link="https://audible.com/pd/TEST123",
        image_url="https://example.com/cover.jpg",
        merchandising_summary="A test book for testing purposes",
        publisher_name="Test Publisher Full Name"
    )
    print(f"Insert result: {result}")
    
    # Test getting upcoming audiobooks
    print("Testing get_upcoming_audiobooks...")
    upcoming = get_upcoming_audiobooks(limit=5)
    print(f"Found {len(upcoming)} upcoming audiobooks")
    for book in upcoming:
        print(f"  - {book.get('title', 'No title')} by {book.get('author', 'Unknown')}")
        print(f"    Image URL: {book.get('image_url', 'None')}")
        print(f"    Publisher: {book.get('publisher_name', 'None')}")
        print(f"    Link: {book.get('link', 'None')}")
        print()
    
    # Test schema by checking column names
    print("Checking database schema...")
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(audiobooks)")
        columns = cursor.fetchall()
        print("Database columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")

if __name__ == "__main__":
    test_database_schema()
