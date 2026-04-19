import requests
import json

def clean_med_name(med_name):
    import re
    cleaned = re.sub(r'(?i)\b(strip|tablets?|capsules?|syrup|injection|drops?|sachets?|of)\b.*', '', med_name)
    cleaned = re.sub(r'(?i)\b\d*(mg|ml|mcg|gm|iu|%)\b.*', '', cleaned)
    return cleaned.strip()

def fetch_1mg(q):
    clean_q = clean_med_name(q)
    url = f"https://www.1mg.com/api/v4/search/all?name={clean_q}"
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        res = requests.get(url, headers=headers, timeout=5)
        if res.status_code == 200:
            data = res.json()
            products = data.get('results', [])
            if products:
                p = products[0]
                return {
                    "source": "Tata 1mg",
                    "medicineName": p.get('name'),
                    "brandedPrice": float(p.get('mrp', 0)),
                    "janAushadhiPrice": float(p.get('price', 0)),
                    "buyLink": f"https://www.1mg.com/drugs/{p.get('slug')}" if p.get('slug') else None
                }
    except Exception as e:
        print(f"1mg Error: {e}")
    return None

def fetch_apollo(q):
    clean_q = clean_med_name(q)
    url = "https://www.apollopharmacy.in/graphql"
    headers = {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0"
    }
    query = """
    query SearchProducts($query: String!, $page: Int) {
      searchProducts(query: $query, page: $page) {
        products {
          name
          price {
            minPrice
            maxPrice
          }
          url
        }
      }
    }
    """
    variables = {"query": clean_q, "page": 1}
    try:
        res = requests.post(url, headers=headers, json={"query": query, "variables": variables}, timeout=5)
        if res.status_code == 200:
            data = res.json()
            products = data.get('data', {}).get('searchProducts', {}).get('products', [])
            if products:
                p = products[0]
                mrp = float(p.get('price', {}).get('maxPrice', 0))
                sale = float(p.get('price', {}).get('minPrice', 0))
                return {
                    "source": "Apollo Pharmacy",
                    "medicineName": p.get('name'),
                    "brandedPrice": mrp,
                    "janAushadhiPrice": sale,
                    "buyLink": f"https://www.apollopharmacy.in{p.get('url')}" if p.get('url') else None
                }
    except Exception as e:
        print(f"Apollo Error: {e}")
    return None

if __name__ == "__main__":
    test_q = "Pan 40"
    print(f"Testing for: {test_q}")
    print("1mg:", fetch_1mg(test_q))
    print("Apollo:", fetch_apollo(test_q))
