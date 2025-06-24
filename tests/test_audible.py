import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from src.audiostracker.audible import confidence

def test_confidence_exact_match():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley']
    }
    result = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': 'Josh Hurley',
        'asin': 'B0XXXX',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score >= 7  # Should be a high score for exact match

def test_confidence_fuzzy_match():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley']
    }
    result = {
        'title': 'Reincarnated as a Sword Vol. 1',
        'series': 'Reincarnated as a Sword',
        'author': 'Y Tanaka',
        'publisher': 'Seven Seas',
        'narrator': 'Josh Hurley',
        'asin': 'B0XXXX',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score >= 4  # Should be a moderate score for fuzzy match

def test_confidence_no_match():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley']
    }
    result = {
        'title': 'Completely Different Book',
        'series': 'Other Series',
        'author': 'Someone Else',
        'publisher': 'Other Pub',
        'narrator': 'Other Narrator',
        'asin': 'B0YYYY',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score == 0

def test_confidence_case_insensitivity():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley']
    }
    result = {
        'title': 'reincarnated as a sword',
        'series': 'REINCARNATED AS A SWORD',
        'author': 'yuu tanaka',
        'publisher': 'SEVEN SEAS SIREN',
        'narrator': 'josh hurley',
        'asin': 'B0ZZZZ',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score >= 7  # Should be a high score for case-insensitive match

def test_confidence_partial_author_match():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley']
    }
    result = {
        'title': 'Completely Different Book',
        'series': 'Other Series',
        'author': 'Yuu Tanaka',
        'publisher': 'Other Pub',
        'narrator': 'Other Narrator',
        'asin': 'B0AAAA',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score == 2  # Only author matches

def test_confidence_missing_fields():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley']
    }
    result = {
        'title': 'Reincarnated as a Sword',
        'series': None,
        'author': 'Yuu Tanaka',
        'publisher': None,
        'narrator': None,
        'asin': 'B0BBBB',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score == 5  # Title + author only

def test_confidence_multiple_narrators():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley', 'Jane Doe']
    }
    result = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': 'Jane Doe',
        'asin': 'B0CCCC',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score >= 7  # Should match on narrator (Jane Doe)

def test_confidence_publisher_fuzzy():
    wanted = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas Siren',
        'narrator': ['Josh Hurley']
    }
    result = {
        'title': 'Reincarnated as a Sword',
        'series': 'Reincarnated as a Sword',
        'author': 'Yuu Tanaka',
        'publisher': 'Seven Seas',  # Fuzzy but not exact
        'narrator': 'Josh Hurley',
        'asin': 'B0DDDD',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score >= 6  # Should not get publisher point, but all others

def test_confidence_empty_strings():
    wanted = {
        'title': '',
        'series': '',
        'author': '',
        'publisher': '',
        'narrator': ['']
    }
    result = {
        'title': '',
        'series': '',
        'author': '',
        'publisher': '',
        'narrator': '',
        'asin': 'B0EEEE',
        'series_number': '1',
        'release_date': '2025-07-01',
        'link': ''
    }
    score = confidence(result, wanted)
    assert score == 0  # No info, no score
