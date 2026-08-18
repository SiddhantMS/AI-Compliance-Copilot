"""
AI COMPLIANCE COPILOT — AUTOMATED AWS BOTO3 DEPLOYER
Automatically provisions EC2 instance in AWS Mumbai (ap-south-1) with full security setup.
"""

import sys
import os
import time
import boto3

REGION = "ap-south-1"  # AWS Mumbai Region

def deploy_to_aws(access_key=None, secret_key=None):
    print("=========================================================================")
    print("  AUTOMATED AWS MUMBAI (ap-south-1) EC2 DEPLOYMENT ENGINE               ")
    print("=========================================================================")

    try:
        if access_key and secret_key:
            ec2_client = boto3.client('ec2', region_name=REGION, aws_access_key_id=access_key, aws_secret_access_key=secret_key)
            ec2_resource = boto3.resource('ec2', region_name=REGION, aws_access_key_id=access_key, aws_secret_access_key=secret_key)
        else:
            ec2_client = boto3.client('ec2', region_name=REGION)
            ec2_resource = boto3.resource('ec2', region_name=REGION)

        print("\n[1/5] Checking AWS Connection to Mumbai (ap-south-1)...")
        ec2_client.describe_regions()
        print("[+] Connected to AWS Mumbai successfully!")

        # Step 2: Create Security Group
        sg_name = "AI-Compliance-Copilot-SG"
        print(f"\n[2/5] Setting up Security Group '{sg_name}'...")
        try:
            vpcs = ec2_client.describe_vpcs()
            vpc_id = vpcs['Vpcs'][0]['VpcId']
            
            sg_res = ec2_client.create_security_group(
                GroupName=sg_name,
                Description="Security Group for AI Compliance Copilot (HTTP 80, HTTPS 443, SSH 22)",
                VpcId=vpc_id
            )
            sg_id = sg_res['GroupId']
            print(f"[+] Security Group created: {sg_id}")

            # Add Inbound Rules (80, 443, 22)
            ec2_client.authorize_security_group_ingress(
                GroupId=sg_id,
                IpPermissions=[
                    {'IpProtocol': 'tcp', 'FromPort': 80, 'ToPort': 80, 'IpRanges': [{'CidrIp': '0.0.0.0/0'}]},
                    {'IpProtocol': 'tcp', 'FromPort': 443, 'ToPort': 443, 'IpRanges': [{'CidrIp': '0.0.0.0/0'}]},
                    {'IpProtocol': 'tcp', 'FromPort': 22, 'ToPort': 22, 'IpRanges': [{'CidrIp': '0.0.0.0/0'}]}
                ]
            )
        except ec2_client.exceptions.ClientError as e:
            if "AlreadyExists" in str(e) or "Duplicate" in str(e):
                sgs = ec2_client.describe_security_groups(GroupNames=[sg_name])
                sg_id = sgs['SecurityGroups'][0]['GroupId']
                print(f"[+] Using existing Security Group: {sg_id}")
            else:
                raise e

        # Step 3: Find Latest Ubuntu 22.04 LTS AMI
        print("\n[3/5] Locating Ubuntu 22.04 LTS AMI in Mumbai...")
        ami_res = ec2_client.describe_images(
            Owners=['099720109477'],  # Canonical owner ID
            Filters=[
                {'Name': 'name', 'Values': ['ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*']},
                {'Name': 'state', 'Values': ['available']}
            ]
        )
        images = sorted(ami_res['Images'], key=lambda x: x['CreationDate'], reverse=True)
        ami_id = images[0]['ImageId']
        print(f"[+] Found AMI: {ami_id} ({images[0]['Name']})")

        # User Data Automated Installation Script
        user_data_script = """#!/bin/bash
apt-get update && apt-get install -y python3-pip python3-venv nginx tesseract-ocr poppler-utils git curl nodejs npm
cd /var/www
git clone https://github.com/your-org/AI_Compliance_Copilot.git
chown -R ubuntu:ubuntu /var/www/AI_Compliance_Copilot
cd /var/www/AI_Compliance_Copilot
python3 -m venv venv
./venv/bin/pip install -r requirements.txt gunicorn uvicorn
cd frontend && npm install && npm run build
"""

        # Step 4: Launch EC2 Instance (Auto-selecting Free Tier / Compatible instance types)
        candidate_instance_types = ['t3.micro', 't2.micro', 't3.small', 't2.small', 't3.medium', 't2.medium', 't3.xlarge']
        instances = None
        selected_type = None

        print("\n[4/5] Provisioning EC2 Instance in AWS Mumbai...")
        for itype in candidate_instance_types:
            try:
                print(f" -> Trying instance type '{itype}'...")
                instances = ec2_resource.create_instances(
                    ImageId=ami_id,
                    InstanceType=itype,
                    MinCount=1,
                    MaxCount=1,
                    SecurityGroupIds=[sg_id],
                    UserData=user_data_script,
                    TagSpecifications=[{
                        'ResourceType': 'instance',
                        'Tags': [{'Key': 'Name', 'Value': 'AI-Compliance-Copilot-Server'}]
                    }]
                )
                selected_type = itype
                break
            except Exception as inst_err:
                print(f"    Notice: Instance type '{itype}' unavailable or restricted: {inst_err}")

        if not instances:
            raise RuntimeError("Could not provision EC2 instance with any candidate instance types.")

        instance = instances[0]
        print(f"[+] EC2 Instance Created: {instance.id} (Type: {selected_type})")
        
        print("\n[5/5] Waiting for Instance to initialize and assign IP address...")
        instance.wait_until_running()
        instance.reload()
        
        public_ip = instance.public_ip_address
        print("\n=========================================================================")
        print(f" SUCCESS! EC2 Instance is Running in AWS Mumbai!")
        print(f" - Instance ID:  {instance.id}")
        print(f" - Public IP:    {public_ip}")
        print(f" - Public URL:   http://{public_ip}")
        print("=========================================================================\n")
        return public_ip

    except Exception as err:
        print(f"\n[ERROR] AWS Deployment Error: {err}")
        return None

if __name__ == "__main__":
    deploy_to_aws()
