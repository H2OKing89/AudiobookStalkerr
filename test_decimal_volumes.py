#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from audiostracker.utils import extract_volume_number
from audiostracker.audible import get_title_volume_key, check_for_volume_duplicates

def test_volume_extraction():
    """Test volume number extraction with decimal support"""
    print("=== Volume Number Extraction ===")
    
    test_titles = [
        "Alya Sometimes Hides Her Feelings in Russian, Vol. 5",
        "Alya Sometimes Hides Her Feelings in Russian, Vol. 4.5",  
        "That Time I Got Reincarnated as a Slime, Vol. 5 (Light Novel)",
        "That Time I Got Reincarnated as a Slime, Vol. 4",
        "Some Series, Volume 3.25",
        "Another Book 7.75",
        "Test Vol. 10.5",
        "Book 2.33",
    ]
    
    for title in test_titles:
        volume = extract_volume_number(title)
        key = get_title_volume_key(title)
        print(f"Title: {title}")
        print(f"  Volume: {volume} (type: {type(volume)})")
        print(f"  Key: {key}")
        print()

def test_deduplication_with_decimals():
    """Test deduplication logic with decimal volumes"""
    print("=== Deduplication Test with Decimals ===")
    
    # Create mock results with decimal volumes - now they should NOT deduplicate
    mock_results = [
        {
            'title': 'Alya Sometimes Hides Her Feelings in Russian, Vol. 4',
            'series': 'Alya Sometimes Hides Her Feelings in Russian',
            'release_date': '2024-01-05',
            'asin': 'TEST001'
        },
        {
            'title': 'Alya Sometimes Hides Her Feelings in Russian, Vol. 4.5',
            'series': 'Alya Sometimes Hides Her Feelings in Russian',
            'release_date': '2024-01-10', 
            'asin': 'TEST002'
        },
        {
            'title': 'Alya Sometimes Hides Her Feelings in Russian, Vol. 5',
            'series': 'Alya Sometimes Hides Her Feelings in Russian',
            'release_date': '2024-01-15',
            'asin': 'TEST003'
        },
        {
            'title': 'That Time I Got Reincarnated as a Slime, Vol. 4',
            'series': 'That Time I Got Reincarnated as a Slime', 
            'release_date': '2024-01-05',
            'asin': 'TEST004'
        },
        {
            'title': 'That Time I Got Reincarnated as a Slime, Vol. 5 (Light Novel)',
            'series': 'That Time I Got Reincarnated as a Slime',
            'release_date': '2024-01-20',
            'asin': 'TEST005'
        }
    ]
    
    print(f"Before deduplication: {len(mock_results)} results")
    for result in mock_results:
        print(f"  - {result['title']}")
    
    deduplicated = check_for_volume_duplicates(mock_results)
    
    print(f"\nAfter deduplication: {len(deduplicated)} results")
    for result in deduplicated:
        volume = result.get('extracted_volume', 'None')
        print(f"  - {result['title']} (volume: {volume})")

def test_exact_duplicates():
    """Test exact duplicate detection (same series + same volume)"""
    print("\n=== Test Exact Duplicates ===")
    
    exact_duplicates = [
        {
            'title': 'Alya Sometimes Hides Her Feelings in Russian, Vol. 4.5',
            'series': 'Alya Sometimes Hides Her Feelings in Russian',
            'release_date': '2024-01-10',
            'asin': 'TEST001'
        },
        {
            'title': 'Alya Sometimes Hides Her Feelings in Russian, Volume 4.5',  # Different format but same volume
            'series': 'Alya Sometimes Hides Her Feelings in Russian',
            'release_date': '2024-01-15',  # More recent
            'asin': 'TEST002'
        }
    ]
    
    print(f"Exact duplicates test - Before: {len(exact_duplicates)} results")
    for result in exact_duplicates:
        print(f"  - {result['title']} (date: {result['release_date']})")
    
    deduplicated = check_for_volume_duplicates(exact_duplicates)
    
    print(f"Exact duplicates test - After: {len(deduplicated)} results")
    for result in deduplicated:
        volume = result.get('extracted_volume', 'None')
        print(f"  - {result['title']} (volume: {volume}, date: {result['release_date']})")

if __name__ == "__main__":
    test_volume_extraction()
    test_deduplication_with_decimals()
    test_exact_duplicates()
