#!/usr/bin/env python3
"""
Validation script to check if the JavaScript stabilization fixes are working
"""

import requests
import re
import time
from bs4 import BeautifulSoup

def test_page_loads(url, page_name):
    """Test if a page loads without server errors"""
    try:
        response = requests.get(url)
        if response.status_code == 200:
            print(f"✓ {page_name} loads successfully (status: {response.status_code})")
            return True, response.text
        else:
            print(f"✗ {page_name} failed to load (status: {response.status_code})")
            return False, None
    except Exception as e:
        print(f"✗ {page_name} failed to load (error: {e})")
        return False, None

def check_script_duplicates(html_content, page_name):
    """Check for duplicate script tags in HTML"""
    soup = BeautifulSoup(html_content, 'html.parser')
    scripts = soup.find_all('script', src=True)
    
    script_srcs = [script.get('src') for script in scripts if script.get('src')]
    duplicates = []
    seen = set()
    
    for src in script_srcs:
        if src in seen:
            duplicates.append(src)
        else:
            seen.add(src)
    
    if duplicates:
        print(f"✗ {page_name} has duplicate scripts: {duplicates}")
        return False
    else:
        print(f"✓ {page_name} has no duplicate script tags")
        return True

def main():
    print("=== AudiobookStalkerr JavaScript Stabilization Validation ===\n")
    
    base_url = "http://localhost:5005"
    
    # Test pages
    pages_to_test = [
        ("/", "Home/Upcoming"),
        ("/authors", "Authors"),
    ]
    
    all_passed = True
    
    for path, name in pages_to_test:
        url = base_url + path
        print(f"\nTesting {name} page ({url})...")
        
        # Test page load
        success, html = test_page_loads(url, name)
        if not success:
            all_passed = False
            continue
            
        # Test for script duplicates
        if not check_script_duplicates(html, name):
            all_passed = False
            
        # Count script tags for information
        soup = BeautifulSoup(html, 'html.parser')
        script_count = len(soup.find_all('script', src=True))
        print(f"  - Total script tags: {script_count}")
        
        # Check for specific patterns that indicate fixes
        if 'bootstrap.js' in html:
            bootstrap_count = html.count('bootstrap.js')
            if bootstrap_count == 1:
                print(f"✓ bootstrap.js loaded exactly once")
            else:
                print(f"✗ bootstrap.js loaded {bootstrap_count} times")
                all_passed = False
    
    print(f"\n=== VALIDATION RESULT ===")
    if all_passed:
        print("✓ ALL TESTS PASSED - JavaScript stabilization appears successful!")
        print("\nKey fixes verified:")
        print("  - No duplicate script tags detected")
        print("  - Pages load without server errors")
        print("  - Bootstrap script loads exactly once per page")
    else:
        print("✗ SOME TESTS FAILED - Issues still remain")
    
    return all_passed

if __name__ == "__main__":
    main()
