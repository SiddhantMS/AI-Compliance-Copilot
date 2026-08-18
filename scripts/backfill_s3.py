import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

from db import get_connection
from s3_storage import upload_pdf_to_s3, S3_BUCKET_NAME

def backfill_layer1_to_s3():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, regulator, title, content, sha256_hash FROM document_queue")
    rows = cursor.fetchall()
    
    print(f"Starting Layer 1 S3 Backfill for {len(rows)} SEBI & RBI circulars...")
    uploaded_count = 0
    
    for r in rows:
        circ_id = r["id"]
        reg = r["regulator"].lower()
        sha = r["sha256_hash"][:8] if r["sha256_hash"] else "hash"
        obj_name = f"ingested/{reg}_circular_{circ_id}_{sha}.txt"
        
        content_bytes = r["content"].encode('utf-8') if r["content"] else b"Empty Regulatory Circular Content"
        s3_uri = upload_pdf_to_s3(content_bytes, obj_name)
        
        cursor.execute("UPDATE document_queue SET source_url_or_path = ? WHERE id = ?", (s3_uri, circ_id))
        uploaded_count += 1
        print(f" [{uploaded_count}/{len(rows)}] Uploaded ID {circ_id} ({r['regulator']}): {s3_uri}")

    conn.commit()
    conn.close()
    print(f"\n✓ SUCCESS: All {uploaded_count} SEBI & RBI Layer 1 circulars are stored in AWS S3 '{S3_BUCKET_NAME}'!")

if __name__ == "__main__":
    backfill_layer1_to_s3()
