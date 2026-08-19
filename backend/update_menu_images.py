import os
import shutil
import sqlite3
import urllib.request

FRONTEND_MENU_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "frontend", "public", "images", "menu")
)
DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "restaurant_db.sqlite"))

# Correct, beautiful, dish-specific images from Unsplash CDN
# Each entry: dish_name -> (local_filename, unsplash_download_url)
DISH_IMAGES = {
    "Butter Chicken":    ("butter-chicken.jpg",    "https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?w=700&q=85&fit=crop"),
    "Paneer Tikka":      ("paneer-tikka.jpg",      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?w=700&q=85&fit=crop"),
    "Gulab Jamun":       ("gulab-jamun.jpg",       "https://images.unsplash.com/photo-1601303516534-bf5dc0d4b4e0?w=700&q=85&fit=crop"),
    "Garlic Naan":       ("garlic-naan.jpg",       "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=700&q=85&fit=crop"),
    "Chicken Biryani":   ("chicken-biryani.jpg",   "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=700&q=85&fit=crop"),
    "Mutton Rogan Josh": ("mutton-rogan-josh.jpg", "https://images.unsplash.com/photo-1574653853027-5382a3d23a15?w=700&q=85&fit=crop"),
    "Dal Makhani":       ("dal-makhani.jpg",       "https://images.unsplash.com/photo-1546833998-877b37c2e5c6?w=700&q=85&fit=crop"),
    "Masala Dosa":       ("masala-dosa.jpg",       "https://images.unsplash.com/photo-1630383249896-424e482df921?w=700&q=85&fit=crop"),
    "Idli Sambar":       ("idli-sambar.jpg",       "https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=700&q=85&fit=crop"),
    "Tandoori Chicken":  ("tandoori-chicken.jpg",  "https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=700&q=85&fit=crop"),
    "Samosa Chaat":      ("samosa-chaat.jpg",      "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=700&q=85&fit=crop"),
    "Pani Puri":         ("pani-puri.jpg",         "https://images.unsplash.com/photo-1606491956689-2ea866880c84?w=700&q=85&fit=crop"),
    "Mango Lassi":       ("mango-lassi.jpg",       "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=700&q=85&fit=crop"),
    "Masala Chai":       ("masala-chai.jpg",       "https://images.unsplash.com/photo-1561336526-2914f13ceb36?w=700&q=85&fit=crop"),
    "Cold Coffee":       ("cold-coffee.jpg",       "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=700&q=85&fit=crop"),
    "Rasmalai":          ("rasmalai.jpg",          "https://images.unsplash.com/photo-1610450949065-1f2841536c88?w=700&q=85&fit=crop"),
    "Gajar Ka Halwa":    ("gajar-ka-halwa.jpg",   "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=700&q=85&fit=crop"),
    "Palak Paneer":      ("palak-paneer.jpg",      "https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=700&q=85&fit=crop"),
    "Fish Curry":        ("fish-curry.jpg",        "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=700&q=85&fit=crop"),
    "Veg Pulao":         ("veg-pulao.jpg",         "https://images.unsplash.com/photo-1645177628172-a94c1f96e6db?w=700&q=85&fit=crop"),
    "Chole Bhature":     ("chole-bhature.jpg",     "https://images.unsplash.com/photo-1626132647523-68b98e990b41?w=700&q=85&fit=crop"),
    "Aloo Paratha":      ("aloo-paratha.jpg",      "https://images.unsplash.com/photo-1639024471283-03518883512d?w=700&q=85&fit=crop"),
}

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}


def download_image(url, dest_path):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=25) as response:
        with open(dest_path, "wb") as f:
            f.write(response.read())


def main():
    print(f"[INFO] Menu Images Dir : {FRONTEND_MENU_DIR}")
    print(f"[INFO] Database Path   : {DB_PATH}")
    os.makedirs(FRONTEND_MENU_DIR, exist_ok=True)

    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    ok, fail = 0, 0

    for dish_name, (filename, url) in DISH_IMAGES.items():
        dest = os.path.join(FRONTEND_MENU_DIR, filename)
        image_url_db = f"/images/menu/{filename}"

        # Download fresh image
        print(f"  Downloading [{dish_name}] ...", end=" ", flush=True)
        try:
            download_image(url, dest)
            kb = os.path.getsize(dest) / 1024
            print(f"OK  ({kb:.0f} KB)")
            ok += 1
        except Exception as e:
            print(f"FAIL ({e})")
            fail += 1
            if not os.path.exists(dest):
                print(f"    -> No existing file, skipping DB update for {dish_name}")
                continue
            print(f"    -> Using existing file for {dish_name}")

        cur.execute("UPDATE menu SET image_url = ? WHERE name = ?", (image_url_db, dish_name))
        if cur.rowcount:
            print(f"    -> DB updated: {dish_name} -> {image_url_db}")
        else:
            print(f"    -> WARNING: No DB row found for '{dish_name}'")

    conn.commit()
    conn.close()
    print(f"\n[DONE] {ok} downloaded, {fail} failed. DB committed.")


if __name__ == "__main__":
    main()
