from playwright.sync_api import sync_playwright
import time
import os

os.makedirs('screenshots', exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.goto('http://localhost:8080/')
    time.sleep(2)
    # Check if we are on auth page
    if "auth" in page.url.lower() or "login" in page.url.lower():
        print("On auth page, trying to create account...")
        try:
            # Click sign up tab if exists
            page.get_by_text("Sign Up").click()
            time.sleep(1)
            page.get_by_placeholder("Full Name", exact=False).fill("Test User")
            page.get_by_placeholder("Email", exact=False).fill("test12345@example.com")
            page.get_by_placeholder("Password", exact=False).fill("password123")
            page.get_by_placeholder("Confirm Password", exact=False).fill("password123")
            page.get_by_role("checkbox").check()
            page.get_by_role("button", name="Create Account").click()
            time.sleep(3)
        except Exception as e:
            print("Could not sign up:", e)
    
    time.sleep(2)
    page.screenshot(path='screenshots/dashboard.png', full_page=True)
    print("Dashboard captured")
    
    try:
        # Navigate to Transactions or Budget
        page.get_by_text("Transactions", exact=True).click()
        time.sleep(2)
        page.screenshot(path='screenshots/transactions.png', full_page=True)
        print("Transactions captured")
    except Exception as e:
        print("Could not capture transactions:", e)
        
    browser.close()
