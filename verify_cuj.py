import os
from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        page.goto('http://localhost:3000/rede_gravimetrica/index.html')
        page.wait_for_selector('#map', state='visible')
        page.wait_for_timeout(3000) # wait for map load

        # Click on 'Executar Ajustamento' to run least squares
        page.evaluate("app.runAdjustment()")
        page.wait_for_timeout(1000)

        screenshot_path = '/home/jules/verification/screenshots/verification_gravimetry2.png'
        dir_name = os.path.dirname(screenshot_path)
        try:
            os.makedirs(dir_name, exist_ok=True)
            page.screenshot(path=screenshot_path)
            print(f"Screenshot successfully saved to {screenshot_path}")
        except Exception as e:
            print(f"Failed to save to {screenshot_path}: {e}")
            fallback_path = os.path.expanduser('~/tests/simul_adjust/verification_gravimetry2.png')
            print(f"Saving to fallback path: {fallback_path}")
            os.makedirs(os.path.dirname(fallback_path), exist_ok=True)
            page.screenshot(path=fallback_path)

        browser.close()

run()
