import pytest
import tempfile
import os
import sys
import json
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'audiostracker'))

from database import (
    init_db, insert_or_update_audiobook, 
    is_notified_for_channel, mark_notified_for_channel,
    get_unnotified_for_channel, prune_released
)
from notify.notify import NotificationDispatcher
from notify.pushover import PushoverNotifier
from notify.discord import DiscordNotifier
from notify.email import EmailNotifier
from ical_export import ICalExporter

class TestMultiChannelNotifications:
    """Test multi-channel notification support"""
    
    def setup_method(self):
        """Set up test database"""
        # Use in-memory database for testing
        import database
        self.original_db_file = database.DB_FILE
        database.DB_FILE = ':memory:'
        init_db()
    
    def teardown_method(self):
        """Clean up after tests"""
        import database
        database.DB_FILE = self.original_db_file
    
    def test_notification_channel_tracking(self):
        """Test that notification channels are tracked correctly"""
        # Insert a test audiobook
        insert_or_update_audiobook(
            asin="TEST123",
            title="Test Book",
            author="Test Author",
            narrator="Test Narrator",
            publisher="Test Publisher",
            series="Test Series",
            series_number="1",
            release_date="2025-12-01"
        )
        
        # Initially not notified for any channel
        assert not is_notified_for_channel("TEST123", "pushover")
        assert not is_notified_for_channel("TEST123", "discord")
        assert not is_notified_for_channel("TEST123", "email")
        
        # Mark as notified for pushover
        mark_notified_for_channel("TEST123", "pushover")
        assert is_notified_for_channel("TEST123", "pushover")
        assert not is_notified_for_channel("TEST123", "discord")
        assert not is_notified_for_channel("TEST123", "email")
        
        # Mark as notified for discord
        mark_notified_for_channel("TEST123", "discord")
        assert is_notified_for_channel("TEST123", "pushover")
        assert is_notified_for_channel("TEST123", "discord")
        assert not is_notified_for_channel("TEST123", "email")
    
    def test_get_unnotified_for_channel(self):
        """Test getting unnotified audiobooks for specific channels"""
        # Insert test audiobooks
        insert_or_update_audiobook(
            asin="TEST1",
            title="Test Book 1",
            author="Test Author",
            narrator="Test Narrator",
            publisher="Test Publisher",
            series="",
            series_number="",
            release_date="2025-12-01"
        )
        
        insert_or_update_audiobook(
            asin="TEST2",
            title="Test Book 2",
            author="Test Author",
            narrator="Test Narrator",
            publisher="Test Publisher",
            series="",
            series_number="",
            release_date="2025-12-02"
        )
        
        # Initially both should be unnotified for all channels
        pushover_unnotified = get_unnotified_for_channel("pushover")
        discord_unnotified = get_unnotified_for_channel("discord")
        
        assert len(pushover_unnotified) == 2
        assert len(discord_unnotified) == 2
        
        # Mark one as notified for pushover
        mark_notified_for_channel("TEST1", "pushover")
        
        pushover_unnotified = get_unnotified_for_channel("pushover")
        discord_unnotified = get_unnotified_for_channel("discord")
        
        assert len(pushover_unnotified) == 1  # Only TEST2
        assert len(discord_unnotified) == 2   # Both still unnotified for discord
        assert pushover_unnotified[0]['asin'] == "TEST2"

class TestNotificationDispatcher:
    """Test the notification dispatcher"""
    
    def test_initialize_channels(self):
        """Test channel initialization"""
        config = {
            'pushover': {'enabled': True, 'user_key': 'test', 'api_token': 'test'},
            'discord': {'enabled': True, 'webhook_url': 'https://discord.com/webhook'},
            'email': {'enabled': False}
        }
        
        with patch('notify.pushover.PushoverNotifier'), \
             patch('notify.discord.DiscordNotifier'):
            dispatcher = NotificationDispatcher(config)
            enabled_channels = dispatcher.get_enabled_channels()
            
            assert 'pushover' in enabled_channels
            assert 'discord' in enabled_channels
            assert 'email' not in enabled_channels
    
    @patch('notify.pushover.PushoverNotifier')
    def test_send_notification_success(self, mock_pushover):
        """Test successful notification sending"""
        config = {
            'pushover': {'enabled': True, 'user_key': 'test', 'api_token': 'test'}
        }
        
        mock_notifier = MagicMock()
        mock_notifier.send_digest.return_value = True
        mock_pushover.return_value = mock_notifier
        
        dispatcher = NotificationDispatcher(config)
        audiobooks = [{'title': 'Test Book', 'author': 'Test Author'}]
        
        result = dispatcher.send_notification('pushover', audiobooks)
        assert result is True
        mock_notifier.send_digest.assert_called_once_with(audiobooks)

class TestICalExport:
    """Test iCal export functionality"""
    
    def test_ical_export_creation(self):
        """Test basic iCal export functionality"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = {
                'ical': {
                    'enabled': True,
                    'file_path': temp_dir,
                    'batch': {'enabled': False, 'max_books': 10}
                }
            }
            
            exporter = ICalExporter(config)
            
            audiobooks = [{
                'title': 'Test Book',
                'author': 'Test Author',
                'narrator': 'Test Narrator',
                'publisher': 'Test Publisher',
                'series': 'Test Series',
                'series_number': '1',
                'release_date': '2025-12-01',
                'asin': 'TEST123'
            }]
            
            file_path = exporter.export_audiobooks(audiobooks, 'test_export')
            
            assert os.path.exists(file_path)
            assert file_path.endswith('test_export.ics')
            
            # Check file contents
            with open(file_path, 'r') as f:
                content = f.read()
                assert 'BEGIN:VCALENDAR' in content
                assert 'END:VCALENDAR' in content
                assert 'Test Book' in content
                assert 'Test Author' in content
                assert 'audiobook-TEST123' in content
    
    def test_ical_batch_export(self):
        """Test batch export functionality"""
        with tempfile.TemporaryDirectory() as temp_dir:
            config = {
                'ical': {
                    'enabled': True,
                    'file_path': temp_dir,
                    'batch': {'enabled': True, 'max_books': 2}
                }
            }
            
            exporter = ICalExporter(config)
            
            # Create 5 audiobooks to test batching
            audiobooks = []
            for i in range(5):
                audiobooks.append({
                    'title': f'Test Book {i+1}',
                    'author': 'Test Author',
                    'narrator': 'Test Narrator',
                    'publisher': 'Test Publisher',
                    'series': '',
                    'series_number': '',
                    'release_date': f'2025-12-0{i+1}',
                    'asin': f'TEST{i+1}'
                })
            
            # Mock database connection for batch export
            with patch('ical_export.get_connection') as mock_conn:
                mock_cursor = MagicMock()
                mock_cursor.fetchall.return_value = [tuple(book.values()) for book in audiobooks]
                mock_cursor.description = [(key, None) for key in audiobooks[0].keys()]
                mock_conn.return_value.__enter__.return_value.cursor.return_value = mock_cursor
                
                exported_files = exporter.export_batches()
                
                # Should create 3 batches (2, 2, 1)
                assert len(exported_files) == 3
                
                # Check that files exist
                for file_path in exported_files:
                    assert os.path.exists(file_path)

class TestRetryLogic:
    """Test retry logic and error handling"""
    
    @patch('requests.post')
    def test_pushover_retry_on_failure(self, mock_post):
        """Test that Pushover retries on failure"""
        config = {
            'user_key': 'test_user',
            'api_token': 'test_token'
        }
        
        # Simulate failure followed by success
        mock_post.side_effect = [
            Exception("Network error"),
            Exception("Network error"),
            MagicMock(status_code=200, json=lambda: {'status': 1})
        ]
        
        notifier = PushoverNotifier(config)
        audiobooks = [{'title': 'Test Book', 'author': 'Test Author'}]
        
        # Should succeed after retries
        result = notifier.send_digest(audiobooks)
        assert result is True
        assert mock_post.call_count == 3
    
    @patch('requests.post')
    def test_discord_retry_on_failure(self, mock_post):
        """Test that Discord retries on failure"""
        config = {
            'webhook_url': 'https://discord.com/webhook'
        }
        
        # Simulate failure followed by success
        mock_post.side_effect = [
            Exception("Network error"),
            MagicMock(status_code=200)
        ]
        
        notifier = DiscordNotifier(config)
        audiobooks = [{'title': 'Test Book', 'author': 'Test Author'}]
        
        result = notifier.send_digest(audiobooks)
        assert result is True
        assert mock_post.call_count == 2

class TestDatabasePruning:
    """Test database pruning functionality"""
    
    def setup_method(self):
        """Set up test database"""
        import database
        self.original_db_file = database.DB_FILE
        database.DB_FILE = ':memory:'
        init_db()
    
    def teardown_method(self):
        """Clean up after tests"""
        import database
        database.DB_FILE = self.original_db_file
    
    def test_prune_released_audiobooks(self):
        """Test that released audiobooks are pruned correctly"""
        # Insert audiobooks with different release dates
        yesterday = (datetime.now() - timedelta(days=1)).strftime('%Y-%m-%d')
        today = datetime.now().strftime('%Y-%m-%d')
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        
        # Old audiobook (should be pruned)
        insert_or_update_audiobook(
            asin="OLD1",
            title="Old Book",
            author="Test Author",
            narrator="Test Narrator",
            publisher="Test Publisher",
            series="",
            series_number="",
            release_date=yesterday
        )
        
        # Today's audiobook (should be pruned)
        insert_or_update_audiobook(
            asin="TODAY1",
            title="Today Book",
            author="Test Author",
            narrator="Test Narrator",
            publisher="Test Publisher",
            series="",
            series_number="",
            release_date=today
        )
        
        # Future audiobook (should be kept)
        insert_or_update_audiobook(
            asin="FUTURE1",
            title="Future Book",
            author="Test Author",
            narrator="Test Narrator",
            publisher="Test Publisher",
            series="",
            series_number="",
            release_date=tomorrow
        )
        
        # Run pruning
        deleted_count = prune_released()
        
        # Should delete 2 books (yesterday and today, keeping tomorrow)
        assert deleted_count == 2
        
        # Verify the future book is still there
        future_books = get_unnotified_for_channel("pushover")
        assert len(future_books) == 1
        assert future_books[0]['asin'] == "FUTURE1"

if __name__ == "__main__":
    pytest.main([__file__])
