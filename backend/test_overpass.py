import requests

query = """
[out:json][timeout:10];
node["amenity"="hospital"](around:5000,28.6139,77.2090);
out body 5;
"""

# Try alternative Overpass mirrors
urls = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
]

for url in urls:
    try:
        r = requests.post(url, data={"data": query}, timeout=15)
        print(f"{url} -> Status: {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            print(f"  Elements: {len(data.get('elements', []))}")
            if data.get("elements"):
                print(f"  First: {data['elements'][0]}")
            break
        else:
            print(f"  Error: {r.text[:100]}")
    except Exception as e:
        print(f"{url} -> Error: {e}")
