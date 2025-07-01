#!/usr/bin/env python3

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from audiostracker.utils import extract_volume_number
from audiostracker.audible import get_title_volume_key, check_for_volume_duplicates

# Test the missing titles
test_titles = [
    "Alya Sometimes Hides Her Feelings in Russian, Vol. 5",
    "Alya Sometimes Hides Her Feelings in Russian, Vol. 4.5", 
    "That Time I Got Reincarnated as a Slime, Vol. 5 (Light Novel)",
    "That Time I Got Reincarnated as a Slime, Vol. 4",
]

print("=== Volume Number Extraction ===")
for title in test_titles:
    volume = extract_volume_number(title)
    key = get_title_volume_key(title)
    print(f"Title: {title}")
    print(f"  Volume: {volume}")
    print(f"  Key: {key}")
    print()

print("=== Deduplication Test ===")
# Create mock results that would cause deduplication issues
mock_results = []
for i, title in enumerate(test_titles):
    mock_results.append({
        'title': title,
        'asin': f'ASIN{i}',
        'author': 'Test Author',
        'series': 'Test Series' if 'Alya' in title or 'Slime' in title else '',
        'release_date': '2024-12-30',
        'narrator': 'Test Narrator',
        'publisher': 'Test Publisher',
        'series_number': ''
    })

print(f"Before deduplication: {len(mock_results)} results")
for result in mock_results:
    print(f"  - {result['title']}")

deduplicated = check_for_volume_duplicates(mock_results)
print(f"\nAfter deduplication: {len(deduplicated)} results")
for result in deduplicated:
    print(f"  - {result['title']} (volume: {result.get('extracted_volume', 'None')})")

print("\n=== Test with different series ===")
# Test what happens when volumes have different series names
mixed_results = [
    {
        'title': 'Alya Sometimes Hides Her Feelings in Russian, Vol. 5',
        'asin': 'ASIN1',
        'series': 'Alya Sometimes Hides Her Feelings in Russian',
        'release_date': '2024-12-30',
        'author': 'Author1',
        'narrator': 'Narrator1',
        'publisher': 'Publisher1',
        'series_number': '5'
    },
    {
        'title': 'Alya Sometimes Hides Her Feelings in Russian, Vol. 4.5',
        'asin': 'ASIN2',
        'series': '',  # No series info - this could cause issues
        'release_date': '2024-12-30',
        'author': 'Author1',
        'narrator': 'Narrator1',
        'publisher': 'Publisher1',
        'series_number': ''
    }
]

print(f"Mixed series test - Before: {len(mixed_results)} results")
for result in mixed_results:
    print(f"  - {result['title']} (series: '{result['series']}')")

mixed_deduplicated = check_for_volume_duplicates(mixed_results)
print(f"Mixed series test - After: {len(mixed_deduplicated)} results")
for result in mixed_deduplicated:
    print(f"  - {result['title']} (series: '{result['series']}', volume: {result.get('extracted_volume', 'None')})")
