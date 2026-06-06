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

        page.screenshot(path='/home/jules/verification/screenshots/verification_gravimetry2.png')
        browser.close()

run()
