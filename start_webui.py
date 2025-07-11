#!/usr/bin/env python3
"""
AudiobookStalkerr Web UI Startup Script
Loads configuration and starts the web interface with proper settings.
"""

import sys
import os
from pathlib import Path
import yaml
import logging

# Add the source directory to Python path
src_dir = Path(__file__).parent / "src"
sys.path.insert(0, str(src_dir))

def load_config():
    """Load configuration from config.yaml"""
    config_file = Path(__file__).parent / "src" / "audiostracker" / "config" / "config.yaml"
    
    try:
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                return yaml.safe_load(f)
        else:
            print(f"Warning: Config file not found at {config_file}")
            return {}
    except Exception as e:
        print(f"Error loading config: {e}")
        return {}

def main():
    """Main startup function"""
    import uvicorn
    
    # Load configuration
    config = load_config()
    web_config = config.get('web_ui', {})
    
    # Web UI settings with defaults
    host = web_config.get('host', '127.0.0.1')
    port = web_config.get('port', 5005)
    reload = web_config.get('reload', True)
    
    print(f"🚀 Starting AudiobookStalkerr Web UI")
    print(f"📍 Host: {host}")
    print(f"🔌 Port: {port}")
    print(f"🔄 Reload: {reload}")
    print(f"🌐 URL: http://{host}:{port}")
    print("-" * 50)
    
    # Start the web server
    uvicorn.run(
        "audiostracker.web.app:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )

if __name__ == "__main__":
    main()
