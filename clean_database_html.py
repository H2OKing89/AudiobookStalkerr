#!/usr/bin/env python3
"""
One-time script to clean HTML tags from existing database records.
This will update all merchandising_summary and description fields to remove HTML tags.
"""

import sys
import os
from pathlib import Path

# Add the source directory to Python path
src_dir = Path(__file__).parent / "src"
sys.path.insert(0, str(src_dir))

from audiostracker.database import get_connection
from audiostracker.utils import clean_html_text
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def clean_database_html():
    """Clean HTML tags from all merchandising_summary fields in the database"""
    
    logger.info("Starting HTML cleanup for database records...")
    
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            
            # Get all records that have merchandising_summary
            cursor.execute("""
                SELECT asin, merchandising_summary 
                FROM audiobooks 
                WHERE merchandising_summary IS NOT NULL 
                AND merchandising_summary != ''
            """)
            
            records = cursor.fetchall()
            logger.info(f"Found {len(records)} records with merchandising_summary to process")
            
            updated_count = 0
            skipped_count = 0
            
            for record in records:
                asin = record['asin']
                original_summary = record['merchandising_summary']
                
                # Clean the HTML from the summary
                cleaned_summary = clean_html_text(original_summary)
                
                # Only update if the cleaned version is different
                if cleaned_summary != original_summary:
                    cursor.execute("""
                        UPDATE audiobooks 
                        SET merchandising_summary = ?
                        WHERE asin = ?
                    """, (cleaned_summary, asin))
                    
                    updated_count += 1
                    logger.info(f"Updated record {asin}")
                    logger.debug(f"  Original: {original_summary[:100]}...")
                    logger.debug(f"  Cleaned:  {cleaned_summary[:100]}...")
                else:
                    skipped_count += 1
            
            # Commit the changes
            conn.commit()
            
            logger.info(f"HTML cleanup completed!")
            logger.info(f"  Records updated: {updated_count}")
            logger.info(f"  Records skipped (no changes): {skipped_count}")
            logger.info(f"  Total records processed: {len(records)}")
            
    except Exception as e:
        logger.error(f"Error during HTML cleanup: {e}")
        raise

def main():
    """Main function"""
    print("AudiobookStalkerr Database HTML Cleanup")
    print("=" * 50)
    print()
    print("This script will remove HTML tags from all merchandising_summary")
    print("fields in the database. This is a one-time cleanup operation.")
    print()
    
    # Ask for confirmation
    response = input("Do you want to proceed? (y/N): ").strip().lower()
    if response not in ['y', 'yes']:
        print("Operation cancelled.")
        return
    
    print()
    try:
        clean_database_html()
        print("\n✅ Database cleanup completed successfully!")
    except Exception as e:
        print(f"\n❌ Error during cleanup: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
