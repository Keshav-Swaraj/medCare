import io, PIL.Image
from ocr_service import process_prescription_image

# Create a tiny test image
img = PIL.Image.new("RGB", (100, 100), color=(255,255,255))
buf = io.BytesIO()
img.save(buf, format="JPEG")

try:
    result = process_prescription_image(buf.getvalue())
    print("SUCCESS:", result[:200])
except Exception as e:
    print("ERROR:", type(e).__name__, str(e))
