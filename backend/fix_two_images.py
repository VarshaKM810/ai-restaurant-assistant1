import sqlite3
import urllib.request
import os

MENU_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "images", "menu")
)
DB = os.path.abspath(os.path.join(os.path.dirname(__file__), "restaurant_db.sqlite"))
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

FIXES = {
    "Gulab Jamun": (
        "gulab-jamun.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Gulab_jamun_%28culture%29.jpg/640px-Gulab_jamun_%28culture%29.jpg",
    ),
    "Chole Bhature": (
        "chole-bhature.jpg",
        "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Chole_bhature.jpg/640px-Chole_bhature.jpg",
    ),
}

conn = sqlite3.connect(DB)
cur = conn.cursor()

for dish, (fname, url) in FIXES.items():
    dest = os.path.join(MENU_DIR, fname)
    print(f"Downloading {dish}...", end=" ", flush=True)
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=20) as r:
            with open(dest, "wb") as f:
                f.write(r.read())
        print(f"OK ({os.path.getsize(dest) // 1024} KB)")
    except Exception as e:
        print(f"FAIL: {e}")
    cur.execute(
        "UPDATE menu SET image_url=? WHERE name=?", (f"/images/menu/{fname}", dish)
    )

conn.commit()
conn.close()
print("Done!")
