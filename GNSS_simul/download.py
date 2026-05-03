import urllib.request

url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=gnss&FORMAT=tle"
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'})
try:
    with urllib.request.urlopen(req) as response:
        data = response.read()
        with open("gnss.txt", "wb") as f:
            f.write(data)
    print("Success")
except Exception as e:
    print(e)
