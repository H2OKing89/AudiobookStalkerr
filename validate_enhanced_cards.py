#!/usr/bin/env python3
"""
Simple validation script to test the enhanced card features
"""

import requests
import json

def test_api_endpoints():
    """Test the API endpoints"""
    base_url = "http://localhost:5005"
    
    print("🧪 Testing API endpoints...")
    
    # Test upcoming audiobooks endpoint
    try:
        response = requests.get(f"{base_url}/api/upcoming")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ /api/upcoming: {len(data)} upcoming audiobooks found")
            
            # Check data structure
            if data:
                first_book = data[0]
                required_fields = ['asin', 'title', 'author', 'release_date', 'image_url']
                missing_fields = [field for field in required_fields if field not in first_book]
                
                if missing_fields:
                    print(f"⚠️  Missing fields in audiobook data: {missing_fields}")
                else:
                    print("✅ All required fields present in audiobook data")
                    
                # Check for enhanced fields
                enhanced_fields = ['merchandising_summary', 'narrator', 'series', 'publisher_name']
                present_enhanced = [field for field in enhanced_fields if field in first_book and first_book[field]]
                print(f"✅ Enhanced fields present: {present_enhanced}")
                
        else:
            print(f"❌ /api/upcoming failed with status {response.status_code}")
    except Exception as e:
        print(f"❌ Error testing /api/upcoming: {e}")
    
    # Test iCal download if we have data
    try:
        response = requests.get(f"{base_url}/api/upcoming")
        if response.status_code == 200:
            data = response.json()
            if data:
                test_asin = data[0].get('asin')
                if test_asin:
                    ical_response = requests.get(f"{base_url}/api/ical/download/{test_asin}")
                    if ical_response.status_code == 200:
                        print(f"✅ iCal download working for ASIN: {test_asin}")
                        # Check if it's a valid iCal file
                        content = ical_response.text
                        if content.startswith('BEGIN:VCALENDAR') and 'END:VCALENDAR' in content:
                            print("✅ iCal content appears valid")
                        else:
                            print("⚠️  iCal content may be invalid")
                    else:
                        print(f"❌ iCal download failed with status {ical_response.status_code}")
                else:
                    print("⚠️  No ASIN found for iCal testing")
    except Exception as e:
        print(f"❌ Error testing iCal download: {e}")

def test_static_files():
    """Test that static files are accessible"""
    base_url = "http://localhost:5005"
    static_files = [
        "/static/css/upcoming.css",
        "/static/js/modules/upcoming-clean.js",
        "/static/images/og-image.png"
    ]
    
    print("\n🗂️  Testing static files...")
    
    for file_path in static_files:
        try:
            response = requests.get(f"{base_url}{file_path}")
            if response.status_code == 200:
                print(f"✅ {file_path}")
            else:
                print(f"❌ {file_path} - Status: {response.status_code}")
        except Exception as e:
            print(f"❌ {file_path} - Error: {e}")

if __name__ == "__main__":
    print("🔍 AudiobookStalkerr Enhanced Cards Validation")
    print("=" * 50)
    
    test_api_endpoints()
    test_static_files()
    
    print("\n" + "=" * 50)
    print("✨ Validation complete!")
