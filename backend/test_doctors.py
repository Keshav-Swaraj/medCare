import asyncio
import httpx

async def test():
    overpass_url = "http://overpass-api.de/api/interpreter"
    search_lat = 28.6139
    search_lng = 77.2090
    query = f"""
    [out:json][timeout:30];
    (
      node["healthcare"="doctor"](around:100000,{search_lat},{search_lng});
      node["amenity"="doctors"](around:100000,{search_lat},{search_lng});
    );
    out body;
    """
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            res = await client.post(overpass_url, data=query)
            data = res.json()
            elements = data.get("elements", [])
            print(f"Overpass query returned {len(elements)} elements")
            print(elements[:2])
    except Exception as e:
        print(f"Overpass query failed: {e}")

asyncio.run(test())
