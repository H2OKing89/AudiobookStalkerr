#!/usr/bin/env python3
"""
AudiobookStalkerr Web UI Startup Script
Loads configuration and starts both the FastAPI backend and Vue frontend.
"""

import sys
import os
import subprocess
import threading
import time
import signal
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

def start_vue_frontend():
    """Start the Vue.js frontend development server"""
    vue_dir = Path(__file__).parent / "src" / "audiostracker" / "web" / "static"
    
    print("🎨 Starting Vue.js frontend...")
    print(f"📁 Vue directory: {vue_dir}")
    
    try:
        # Check if node_modules exists
        if not (vue_dir / "node_modules").exists():
            print("📦 Installing npm dependencies...")
            subprocess.run(["npm", "install"], cwd=vue_dir, check=True)
        
        # Start Vue dev server
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=vue_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Monitor Vue server output in a separate thread
        vue_port = "3000"  # Default port
        def monitor_output():
            nonlocal vue_port
            if process.stdout:
                for line in process.stdout:
                    if "local:" in line.lower() and "http://localhost:" in line:
                        # Extract port from Vue output
                        import re
                        port_match = re.search(r'http://localhost:(\d+)', line)
                        if port_match:
                            vue_port = port_match.group(1)
                        print(f"✅ Vue frontend: {line.strip()}")
                    elif "ready in" in line.lower():
                        print(f"✅ Vue frontend: {line.strip()}")
                    elif "error" in line.lower():
                        print(f"❌ Vue error: {line.strip()}")
        
        output_thread = threading.Thread(target=monitor_output, daemon=True)
        output_thread.start()
        
        # Give a moment for port detection
        time.sleep(1)
        
        return (process, vue_port)
        
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to start Vue frontend: {e}")
        return (None, "3000")
    except FileNotFoundError:
        print("❌ npm not found. Please install Node.js and npm.")
        return (None, "3000")

def start_fastapi_backend(config):
    """Start the FastAPI backend server"""
    import uvicorn
    
    web_config = config.get('web_ui', {})
    
    # Backend settings with defaults
    host = web_config.get('host', '127.0.0.1')
    port = web_config.get('port', 5005)
    reload = web_config.get('reload', True)
    
    print(f"🚀 Starting FastAPI backend...")
    print(f"📍 Host: {host}")
    print(f"🔌 Port: {port}")
    print(f"🔄 Reload: {reload}")
    print(f"🌐 API URL: http://{host}:{port}")
    
    # Start the FastAPI server
    uvicorn.run(
        "audiostracker.web.app:app",
        host=host,
        port=port,
        reload=reload,
        log_level="info"
    )

def main():
    """Main startup function - starts both frontend and backend"""
    print("=" * 60)
    print("🎵 AudiobookStalkerr Development Environment")
    print("=" * 60)
    
    # Load configuration
    config = load_config()
    
    # Store process references for cleanup
    processes = []
    
    def signal_handler(signum, frame):
        """Handle Ctrl+C gracefully"""
        print("\n🛑 Shutting down servers...")
        for process in processes:
            if process and process.poll() is None:
                process.terminate()
        sys.exit(0)
    
    # Register signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    try:
        # Start Vue frontend in a separate thread
        vue_process = None
        vue_port = "3000"
        
        def start_vue():
            nonlocal vue_process, vue_port
            result = start_vue_frontend()
            if result:
                vue_process, vue_port = result
        
        vue_thread = threading.Thread(target=start_vue, daemon=True)
        vue_thread.start()
        
        # Give Vue a moment to start and detect port
        time.sleep(4)
        
        if vue_process:
            processes.append(vue_process)
        
        print("\n" + "=" * 60)
        print("🌐 Development servers starting...")
        print(f"📱 Vue Frontend: http://localhost:{vue_port}")
        print("🔗 FastAPI Backend: http://localhost:5005")
        print("📖 API Docs: http://localhost:5005/docs")
        print("=" * 60)
        print("💡 Press Ctrl+C to stop both servers")
        print("=" * 60)
        
        # Start FastAPI backend (this will block)
        start_fastapi_backend(config)
        
    except KeyboardInterrupt:
        print("\n🛑 Shutting down servers...")
        for process in processes:
            if process and process.poll() is None:
                process.terminate()
    except Exception as e:
        print(f"❌ Error starting servers: {e}")
        for process in processes:
            if process and process.poll() is None:
                process.terminate()
        sys.exit(1)

if __name__ == "__main__":
    main()
