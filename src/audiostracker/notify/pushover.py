import requests
import logging
import os
from typing import List, Dict, Any, Optional
from datetime import datetime

class PushoverNotifier:
    """Pushover notification implementation"""
    
    PUSHOVER_API_URL = "https://api.pushover.net/1/messages.json"
    MAX_MESSAGE_LENGTH = 1024
    MAX_TITLE_LENGTH = 250
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.user_key = os.getenv('PUSHOVER_USER_KEY')
        self.api_token = os.getenv('PUSHOVER_API_TOKEN')
        
        if not self.user_key or not self.api_token:
            raise ValueError("Missing PUSHOVER_USER_KEY or PUSHOVER_API_TOKEN environment variables")
        
        self.sound = config.get('sound', 'pushover')
        self.priority = config.get('priority', 0)
        self.device = config.get('device', '')
    
    def _format_audiobook_line(self, audiobook: Dict[str, Any]) -> str:
        """Format a single audiobook for notification"""
        title = audiobook.get('title', 'Unknown Title')
        author = audiobook.get('author', 'Unknown Author')
        release_date = audiobook.get('release_date', 'Unknown Date')
        
        return f"{title} — {release_date}\nAuthor: {author}"
    
    def _create_message(self, audiobooks: List[Dict[str, Any]]) -> tuple[str, str, str]:
        """
        Create title, message, and URL for Pushover notification
        
        Returns:
            tuple: (title, message, url)
        """
        count = len(audiobooks)
        
        # Title
        if count == 1:
            title = f"New audiobook: {audiobooks[0].get('title', 'Unknown')}"
        else:
            title = f"{count} new audiobooks found!"
        
        # Truncate title if too long
        if len(title) > self.MAX_TITLE_LENGTH:
            title = title[:self.MAX_TITLE_LENGTH-3] + "..."
        
        # Message body
        message_lines = []
        remaining_length = self.MAX_MESSAGE_LENGTH
        
        for i, audiobook in enumerate(audiobooks):
            line = self._format_audiobook_line(audiobook)
            
            # Check if we have room for this line
            if len(line) + 1 > remaining_length:  # +1 for newline
                # If this is the first item and it's too long, truncate it
                if i == 0:
                    line = line[:remaining_length-4] + "..."
                    message_lines.append(line)
                else:
                    # Add "...and X more" if there are remaining items
                    remaining_count = count - i
                    more_text = f"...and {remaining_count} more"
                    if len(more_text) <= remaining_length:
                        message_lines.append(more_text)
                break
            
            message_lines.append(line)
            remaining_length -= len(line) + 1  # +1 for newline
        
        message = "\n\n".join(message_lines)
        
        # URL (use first audiobook's link)
        url = audiobooks[0].get('link', '') if audiobooks else ''
        
        return title, message, url
    
    def send_digest(self, audiobooks: List[Dict[str, Any]], ical_files: Optional[List[str]] = None) -> bool:
        """
        Send a digest notification for multiple audiobooks
        
        Args:
            audiobooks: List of audiobook dictionaries
            ical_files: Optional list of iCal file paths to attach
            
        Returns:
            bool: True if notification was sent successfully
        """
        if not audiobooks:
            logging.debug("No audiobooks to send via Pushover")
            return True
        
        try:
            title, message, url = self._create_message(audiobooks)
            
            payload = {
                'token': self.api_token,
                'user': self.user_key,
                'title': title,
                'message': message,
                'priority': self.priority,
                'sound': self.sound
            }
            
            # Add optional fields
            if url:
                payload['url'] = url
                payload['url_title'] = "Open on Audible"
            
            if self.device:
                payload['device'] = self.device
            
            # Prepare files for attachment if provided
            files = None
            if ical_files and len(ical_files) > 0:
                # Pushover supports one attachment per message, use the first iCal file
                ical_file = ical_files[0]
                if os.path.exists(ical_file):
                    try:
                        files = {'attachment': (os.path.basename(ical_file), open(ical_file, 'rb'), 'text/calendar')}
                        logging.debug(f"Attaching iCal file: {ical_file}")
                    except Exception as e:
                        logging.warning(f"Failed to attach iCal file {ical_file}: {e}")
                        files = None
            
            logging.debug(f"Sending Pushover notification: {title}")
            
            response = requests.post(
                self.PUSHOVER_API_URL,
                data=payload,
                files=files,
                timeout=10
            )
            
            # Close file handle if opened
            if files:
                files['attachment'][1].close()
            
            response.raise_for_status()
            
            result = response.json()
            if result.get('status') == 1:
                logging.info(f"Pushover notification sent successfully for {len(audiobooks)} audiobooks" + 
                           (f" with iCal attachment" if files else ""))
                return True
            else:
                errors = result.get('errors', ['Unknown error'])
                logging.error(f"Pushover API error: {errors}")
                return False
                
        except requests.RequestException as e:
            logging.error(f"Network error sending Pushover notification: {e}")
            return False
        except Exception as e:
            logging.error(f"Unexpected error sending Pushover notification: {e}")
            return False
    
    def send_single(self, audiobook: Dict[str, Any]) -> bool:
        """
        Send notification for a single audiobook
        
        Args:
            audiobook: Single audiobook dictionary
            
        Returns:
            bool: True if notification was sent successfully
        """
        return self.send_digest([audiobook])
    
    def test_connection(self) -> bool:
        """
        Test Pushover connection by sending a test message
        
        Returns:
            bool: True if test message was sent successfully
        """
        test_audiobook = {
            'title': 'AudioStacker Test Notification',
            'author': 'System',
            'release_date': datetime.now().strftime('%Y-%m-%d'),
            'link': 'https://github.com'
        }
        
        return self.send_single(test_audiobook)