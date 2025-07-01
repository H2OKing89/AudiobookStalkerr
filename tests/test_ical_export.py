import os
import pytest
from datetime import datetime
from src.audiostracker.ical_export import ICalExporter

@pytest.fixture
def mock_config():
    return {
        'ical': {
            'enabled': True,
            'file_path': 'data/test_ical_export/',
            'batch': {
                'enabled': True,
                'max_books': 2
            }
        }
    }

@pytest.fixture
def mock_audiobooks():
    return [
        {
            'asin': 'B01234567',
            'title': 'Test Book 1',
            'author': 'Test Author',
            'narrator': 'Test Narrator',
            'publisher': 'Test Publisher',
            'series': 'Test Series',
            'series_number': '1',
            'release_date': datetime.now().strftime('%Y-%m-%d')
        },
        {
            'asin': 'B7654321',
            'title': 'Test Book 2',
            'author': 'Test Author',
            'narrator': 'Test Narrator',
            'publisher': 'Test Publisher',
            'series': 'Test Series',
            'series_number': '2',
            'release_date': datetime.now().strftime('%Y-%m-%d')
        }
    ]

def test_ical_exporter_init(mock_config):
    exporter = ICalExporter(mock_config)
    assert exporter.enabled is True
    assert exporter.export_path == 'data/test_ical_export/'
    assert exporter.batch_size == 2
    assert exporter.batch_enabled is True

def test_ical_export(mock_config, mock_audiobooks):
    exporter = ICalExporter(mock_config)
    file_path = exporter.export_audiobooks(mock_audiobooks, "test_export")
    
    try:
        assert os.path.exists(file_path)
        
        # Check file contents
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Check for expected content
        assert 'BEGIN:VCALENDAR' in content
        assert 'SUMMARY:📚 Test Book 1 (Test Series #1)' in content
        assert 'SUMMARY:📚 Test Book 2 (Test Series #2)' in content
        assert 'END:VCALENDAR' in content
        
    finally:
        # Clean up test file
        if os.path.exists(file_path):
            os.remove(file_path)
        
        # Try to remove directory
        try:
            os.rmdir(os.path.dirname(file_path))
        except OSError:
            pass

def test_export_batches(mock_config, mock_audiobooks):
    exporter = ICalExporter(mock_config)
    # Create 3 audiobooks to force 2 batches (with batch_size=2)
    audiobooks = mock_audiobooks + [{
        'asin': 'B9999999',
        'title': 'Test Book 3',
        'author': 'Test Author',
        'narrator': 'Test Narrator',
        'publisher': 'Test Publisher',
        'series': 'Test Series',
        'series_number': '3',
        'release_date': datetime.now().strftime('%Y-%m-%d')
    }]
    
    # Call export_new_audiobooks which should create batches
    result_files = exporter.export_new_audiobooks(audiobooks)
    
    try:
        # Verify we got 2 batches (with batch_size=2 and 3 audiobooks)
        assert len(result_files) == 2
        assert all(os.path.exists(f) for f in result_files)
        
        # Check content of first batch
        with open(result_files[0], 'r', encoding='utf-8') as f:
            content = f.read()
            assert 'BEGIN:VCALENDAR' in content
            assert 'SUMMARY:📚 Test Book 1' in content
            assert 'SUMMARY:📚 Test Book 2' in content
            assert 'END:VCALENDAR' in content
            
        # Check content of second batch (should only contain Book 3)
        with open(result_files[1], 'r', encoding='utf-8') as f:
            content = f.read()
            assert 'BEGIN:VCALENDAR' in content
            assert 'SUMMARY:📚 Test Book 3' in content
            assert 'END:VCALENDAR' in content
            
    finally:
        # Clean up test files
        for file_path in result_files:
            if os.path.exists(file_path):
                os.remove(file_path)
        
        # Try to remove directory
        try:
            if result_files:
                os.rmdir(os.path.dirname(result_files[0]))
        except OSError:
            pass
