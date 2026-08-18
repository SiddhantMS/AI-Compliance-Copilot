"""
AWS RDS POSTGRESQL PROVISIONER & METADATA MIGRATION ENGINE
Provisions an AWS RDS PostgreSQL instance in Mumbai (ap-south-1) for storing
all Bank of India metadata, circular queues, tickets, audit logs, and policy patches.
"""

import os
import sys
import time
import json
import logging
import boto3
import psycopg2
from botocore.exceptions import ClientError
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "src"))

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("aws_rds")

AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")

DB_INSTANCE_ID = "boi-compliance-rds"
DB_NAME = "boi_compliance_db"
DB_USER = "postgres"
DB_PASSWORD = "BoiCompliance2026!"
DB_PORT = 5432

def get_rds_client():
    """Initialize Boto3 RDS client."""
    return boto3.client(
        'rds',
        region_name=AWS_REGION,
        aws_access_key_id=AWS_ACCESS_KEY_ID,
        aws_secret_access_key=AWS_SECRET_ACCESS_KEY
    )

def provision_aws_rds() -> str:
    """Provision or locate AWS RDS PostgreSQL instance and return endpoint host."""
    rds = get_rds_client()
    logger.info(f"Checking AWS RDS Instances in {AWS_REGION}...")

    try:
        res = rds.describe_db_instances(DBInstanceIdentifier=DB_INSTANCE_ID)
        inst = res['DBInstances'][0]
        status = inst['DBInstanceStatus']
        logger.info(f"✓ Found existing AWS RDS Instance '{DB_INSTANCE_ID}' (Status: {status})")

        if status == 'available':
            endpoint = inst['Endpoint']['Address']
            logger.info(f"✓ AWS RDS Host Endpoint: {endpoint}:{DB_PORT}")
            return endpoint
        else:
            logger.info("Waiting for RDS instance to become available...")
            waiter = rds.get_waiter('db_instance_available')
            waiter.wait(DBInstanceIdentifier=DB_INSTANCE_ID)
            res = rds.describe_db_instances(DBInstanceIdentifier=DB_INSTANCE_ID)
            endpoint = res['DBInstances'][0]['Endpoint']['Address']
            return endpoint

    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code')
        if error_code == 'DBInstanceNotFound':
            logger.info(f"Creating new AWS RDS PostgreSQL Instance '{DB_INSTANCE_ID}' in {AWS_REGION}...")
            try:
                rds.create_db_instance(
                    DBInstanceIdentifier=DB_INSTANCE_ID,
                    AllocatedStorage=20,
                    DBInstanceClass='db.t3.micro',
                    Engine='postgres',
                    MasterUsername=DB_USER,
                    MasterUserPassword=DB_PASSWORD,
                    DBName=DB_NAME,
                    Port=DB_PORT,
                    PubliclyAccessible=True,
                    AutoMinorVersionUpgrade=True,
                    Tags=[{'Key': 'Project', 'Value': 'AI_Compliance_Copilot'}]
                )
                logger.info("✓ AWS RDS Creation call submitted. Waiting for instance provisioning (~3-5 mins)...")
                
                # Wait for RDS instance to be ready
                while True:
                    time.sleep(15)
                    try:
                        r = rds.describe_db_instances(DBInstanceIdentifier=DB_INSTANCE_ID)
                        st = r['DBInstances'][0]['DBInstanceStatus']
                        logger.info(f"   RDS Provisioning Status: {st}...")
                        if st == 'available':
                            ep = r['DBInstances'][0]['Endpoint']['Address']
                            logger.info(f"✓ AWS RDS Provisioned Successfully! Host Endpoint: {ep}")
                            return ep
                    except Exception as err:
                        logger.warning(f"Waiting status notice: {err}")
            except Exception as create_err:
                logger.error(f"Failed to create AWS RDS instance: {create_err}")
                return ""
        else:
            logger.error(f"RDS Error ({error_code}): {e}")
            return ""

def update_env_file(rds_host: str):
    """Write RDS configuration to local .env file."""
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_lines = []
    if os.path.exists(env_path):
        with open(env_path, "r") as f:
            env_lines = f.readlines()
    
    # Filter out old RDS entries
    new_lines = [l for l in env_lines if not any(l.startswith(k) for k in ["RDS_HOST=", "RDS_PORT=", "RDS_DB_NAME=", "RDS_USER=", "RDS_PASSWORD="])]
    
    new_lines.append(f"\n# AWS RDS POSTGRESQL METADATA ENGINE\n")
    new_lines.append(f"RDS_HOST={rds_host}\n")
    new_lines.append(f"RDS_PORT={DB_PORT}\n")
    new_lines.append(f"RDS_DB_NAME={DB_NAME}\n")
    new_lines.append(f"RDS_USER={DB_USER}\n")
    new_lines.append(f"RDS_PASSWORD={DB_PASSWORD}\n")
    
    with open(env_path, "w") as f:
        f.writelines(new_lines)
    logger.info("✓ Updated local .env with AWS RDS credentials.")

if __name__ == "__main__":
    host = provision_aws_rds()
    if host:
        update_env_file(host)
        print(f"\n=======================================================")
        print(f"  AWS RDS POSTGRESQL HOST: {host}")
        print(f"=======================================================\n")
