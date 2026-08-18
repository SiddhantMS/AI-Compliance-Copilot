"""
AWS S3 STORAGE MANAGER FOR AI COMPLIANCE COPILOT
Stores raw ingested PDFs and uploaded internal bank policies directly in AWS S3 (ap-south-1 Mumbai)
and streams/fetches them on demand.
"""

import os
import logging
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("s3_storage")
logger.setLevel(logging.INFO)

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME", "boi-compliance-raw-documents")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")

def get_s3_client():
    """Initialize and return Boto3 S3 client."""
    try:
        if AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY:
            client = boto3.client(
                's3',
                region_name=AWS_REGION,
                aws_access_key_id=AWS_ACCESS_KEY_ID,
                aws_secret_access_key=AWS_SECRET_ACCESS_KEY
            )
        else:
            client = boto3.client('s3', region_name=AWS_REGION)
        return client
    except Exception as e:
        logger.warning(f"S3 Client init notice: {e}")
        return None

def ensure_s3_bucket_exists():
    """Ensure the target S3 bucket exists in AWS Mumbai region."""
    s3 = get_s3_client()
    if not s3:
        return False
    
    try:
        s3.head_bucket(Bucket=S3_BUCKET_NAME)
        logger.info(f"✓ AWS S3 Bucket '{S3_BUCKET_NAME}' verified in {AWS_REGION}")
        return True
    except ClientError as err:
        error_code = err.response.get('Error', {}).get('Code')
        if error_code == '404':
            try:
                if AWS_REGION == 'us-east-1':
                    s3.create_bucket(Bucket=S3_BUCKET_NAME)
                else:
                    s3.create_bucket(
                        Bucket=S3_BUCKET_NAME,
                        CreateBucketConfiguration={'LocationConstraint': AWS_REGION}
                    )
                logger.info(f"✓ Created new AWS S3 Bucket '{S3_BUCKET_NAME}' in {AWS_REGION}")
                return True
            except Exception as create_err:
                logger.warning(f"Could not create S3 bucket '{S3_BUCKET_NAME}': {create_err}")
                return False
        else:
            logger.warning(f"S3 Bucket verification notice ({error_code}): {err}")
            return False

def upload_pdf_to_s3(file_data_bytes_or_path, object_name: str) -> str:
    """
    Upload raw PDF content or local file to S3 bucket.
    Returns: S3 URI string ('s3://bucket/object') or local path fallback.
    """
    s3 = get_s3_client()
    s3_uri = f"s3://{S3_BUCKET_NAME}/{object_name}"

    if s3:
        try:
            if isinstance(file_data_bytes_or_path, str) and os.path.exists(file_data_bytes_or_path):
                s3.upload_file(file_data_bytes_or_path, S3_BUCKET_NAME, object_name, ExtraArgs={'ContentType': 'application/pdf'})
            else:
                bytes_data = file_data_bytes_or_path if isinstance(file_data_bytes_or_path, bytes) else file_data_bytes_or_path.encode('utf-8')
                s3.put_object(Bucket=S3_BUCKET_NAME, Key=object_name, Body=bytes_data, ContentType='application/pdf')
            
            logger.info(f"✓ Raw PDF uploaded to AWS S3: {s3_uri}")
            return s3_uri
        except Exception as e:
            logger.warning(f"S3 Upload failed ({e}). Falling back to local storage.")

    # Fallback to local storage
    local_dir = os.path.join(os.path.dirname(__file__), "..", "data", "s3_raw_documents")
    os.makedirs(local_dir, exist_ok=True)
    local_file = os.path.join(local_dir, os.path.basename(object_name))
    
    if isinstance(file_data_bytes_or_path, str) and os.path.exists(file_data_bytes_or_path):
        import shutil
        shutil.copy(file_data_bytes_or_path, local_file)
    else:
        bytes_data = file_data_bytes_or_path if isinstance(file_data_bytes_or_path, bytes) else file_data_bytes_or_path.encode('utf-8')
        with open(local_file, "wb") as f:
            f.write(bytes_data)

    return local_file

def download_pdf_from_s3(object_name_or_uri: str, target_local_path: str) -> bool:
    """
    Download raw PDF file from S3 bucket to local destination path.
    """
    object_name = object_name_or_uri.replace(f"s3://{S3_BUCKET_NAME}/", "") if object_name_or_uri.startswith("s3://") else object_name_or_uri
    
    s3 = get_s3_client()
    if s3:
        try:
            os.makedirs(os.path.dirname(target_local_path), exist_ok=True)
            s3.download_file(S3_BUCKET_NAME, object_name, target_local_path)
            logger.info(f"✓ Streamed PDF from AWS S3 '{object_name}' to local path: {target_local_path}")
            return True
        except Exception as e:
            logger.warning(f"S3 Download failed for object '{object_name}': {e}")

    # Fallback check
    local_fallback = os.path.join(os.path.dirname(__file__), "..", "data", "s3_raw_documents", os.path.basename(object_name))
    if os.path.exists(local_fallback):
        import shutil
        shutil.copy(local_fallback, target_local_path)
        return True

    return False

def get_s3_presigned_url(object_name: str, expiration: int = 3600) -> str:
    """Generate a presigned URL to view/download raw PDF directly from AWS S3."""
    s3 = get_s3_client()
    if not s3:
        return f"http://localhost:8001/data/uploads/{object_name}"
    try:
        url = s3.generate_presigned_url(
            'get_object',
            Params={'Bucket': S3_BUCKET_NAME, 'Key': object_name},
            ExpiresIn=expiration
        )
        return url
    except Exception as e:
        logger.warning(f"Presigned URL generation failed: {e}")
        return f"http://localhost:8001/data/uploads/{object_name}"
