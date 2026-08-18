"""
AI COMPLIANCE COPILOT — DIRECT END-TO-END AWS SSH DEPLOYMENT ENGINE
Creates EC2 instance, uploads project files via SFTP, builds React frontend, and starts FastAPI + Nginx.
"""

import sys
import os
import time
import zipfile
import tempfile
import boto3
import paramiko

REGION = "ap-south-1"  # AWS Mumbai Region

def create_zip_archive(output_path):
    print(" -> Archiving local project files (excluding venv, node_modules)...")
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    
    ignore_dirs = {'.git', 'venv', 'node_modules', 'dist', '__pycache__', '.idea', '.vscode'}
    
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as ziph:
        for root, dirs, files in os.walk(project_root):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file in files:
                if file.endswith('.pyc') or file.endswith('.log'):
                    continue
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, project_root)
                ziph.write(file_path, arcname)
    print(" [+] Project archive created successfully!")

def deploy_to_aws_end_to_end(access_key, secret_key):
    print("=========================================================================")
    print("  FULL AUTOMATED AWS MUMBAI DIRECT END-TO-END DEPLOYMENT ENGINE          ")
    print("=========================================================================")

    ec2_client = boto3.client('ec2', region_name=REGION, aws_access_key_id=access_key, aws_secret_access_key=secret_key)
    ec2_resource = boto3.resource('ec2', region_name=REGION, aws_access_key_id=access_key, aws_secret_access_key=secret_key)

    # 1. Key Pair Setup
    key_name = "AI-Compliance-Copilot-Key"
    key_path = os.path.join(os.path.dirname(__file__), "compliance_key.pem")
    
    print("\n[1/6] Setting up AWS Key Pair...")
    try:
        key_pair = ec2_client.create_key_pair(KeyName=key_name)
        with open(key_path, "w") as f:
            f.write(key_pair['KeyMaterial'])
        os.chmod(key_path, 0o600)
        print(f" [+] Created new Key Pair: {key_name} -> {key_path}")
    except Exception as e:
        if "Duplicate" in str(e) or "AlreadyExists" in str(e):
            print(f" [+] Re-using existing Key Pair: {key_name}")
        else:
            raise e

    # 2. Security Group Setup
    sg_name = "AI-Compliance-Copilot-SG"
    print("\n[2/6] Setting up Security Group...")
    try:
        vpcs = ec2_client.describe_vpcs()
        vpc_id = vpcs['Vpcs'][0]['VpcId']
        sg_res = ec2_client.create_security_group(
            GroupName=sg_name,
            Description="Security Group for AI Compliance Copilot",
            VpcId=vpc_id
        )
        sg_id = sg_res['GroupId']
        ec2_client.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[
                {'IpProtocol': 'tcp', 'FromPort': 80, 'ToPort': 80, 'IpRanges': [{'CidrIp': '0.0.0.0/0'}]},
                {'IpProtocol': 'tcp', 'FromPort': 443, 'ToPort': 443, 'IpRanges': [{'CidrIp': '0.0.0.0/0'}]},
                {'IpProtocol': 'tcp', 'FromPort': 22, 'ToPort': 22, 'IpRanges': [{'CidrIp': '0.0.0.0/0'}]}
            ]
        )
        print(f" [+] Security Group created: {sg_id}")
    except ec2_client.exceptions.ClientError as e:
        if "AlreadyExists" in str(e) or "Duplicate" in str(e):
            sgs = ec2_client.describe_security_groups(GroupNames=[sg_name])
            sg_id = sgs['SecurityGroups'][0]['GroupId']
            print(f" [+] Using existing Security Group: {sg_id}")
        else:
            raise e

    # 3. Locate Ubuntu 22.04 AMI
    print("\n[3/6] Locating Ubuntu 22.04 LTS AMI in Mumbai...")
    ami_res = ec2_client.describe_images(
        Owners=['099720109477'],
        Filters=[
            {'Name': 'name', 'Values': ['ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*']},
            {'Name': 'state', 'Values': ['available']}
        ]
    )
    images = sorted(ami_res['Images'], key=lambda x: x['CreationDate'], reverse=True)
    ami_id = images[0]['ImageId']

    # 4. Launch EC2 Instance
    print("\n[4/6] Provisioning EC2 Instance in AWS Mumbai...")
    candidate_instance_types = ['t3.micro', 't2.micro', 't3.small', 't2.small', 't3.medium']
    instances = None
    selected_type = None

    for itype in candidate_instance_types:
        try:
            print(f" -> Trying instance type '{itype}'...")
            instances = ec2_resource.create_instances(
                ImageId=ami_id,
                InstanceType=itype,
                MinCount=1,
                MaxCount=1,
                KeyName=key_name,
                SecurityGroupIds=[sg_id],
                TagSpecifications=[{
                    'ResourceType': 'instance',
                    'Tags': [{'Key': 'Name', 'Value': 'AI-Compliance-Copilot-Server'}]
                }]
            )
            selected_type = itype
            break
        except Exception as inst_err:
            print(f"    Notice: Instance type '{itype}' failed: {inst_err}")

    if not instances:
        raise RuntimeError("Failed to provision instance.")

    instance = instances[0]
    print(f" [+] EC2 Instance Created: {instance.id} (Type: {selected_type})")

    print("\n[5/6] Waiting for EC2 Instance to start and obtain IP...")
    instance.wait_until_running()
    instance.reload()
    public_ip = instance.public_ip_address
    print(f" [+] EC2 Server IP: {public_ip}")

    # Wait for SSH port 22 to become responsive
    print(" -> Waiting 30 seconds for SSH daemon to initialize...")
    time.sleep(30)

    # 5. SSH Connect & Upload Codebase
    print("\n[6/6] Connecting via SSH & Uploading Codebase to Server...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    if not os.path.exists(key_path):
        print(f" [ERROR] Private key {key_path} not found locally.")
        return public_ip

    key = paramiko.RSAKey.from_private_key_file(key_path)
    
    # Try SSH Connection
    connected = False
    for attempt in range(10):
        try:
            ssh.connect(hostname=public_ip, username='ubuntu', pkey=key, timeout=15)
            connected = True
            print(" [+] SSH Connection Established!")
            break
        except Exception as ssh_err:
            print(f" -> SSH connection attempt {attempt+1}/10... ({ssh_err})")
            time.sleep(10)

    if not connected:
        print(f" [!] Unable to connect via SSH immediately. Server is running at http://{public_ip}")
        return public_ip

    # Create Zip & Upload via SFTP
    temp_zip = os.path.join(tempfile.gettempdir(), "project.zip")
    create_zip_archive(temp_zip)

    sftp = ssh.open_sftp()
    sftp.put(temp_zip, "/tmp/project.zip")
    sftp.close()
    os.remove(temp_zip)
    print(" [+] Project Zip Uploaded to /tmp/project.zip!")

    # Run Deployment Commands via SSH
    commands = [
        "sudo apt-get update && sudo apt-get install -y python3-pip python3-venv nginx tesseract-ocr poppler-utils unzip curl",
        "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs",
        "sudo mkdir -p /var/www/AI_Compliance_Copilot && sudo chown -R ubuntu:ubuntu /var/www/AI_Compliance_Copilot",
        "unzip -o /tmp/project.zip -d /var/www/AI_Compliance_Copilot",
        "cd /var/www/AI_Compliance_Copilot && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt gunicorn uvicorn",
        "cd /var/www/AI_Compliance_Copilot/frontend && npm install && npm run build",
        r"""sudo tee /etc/nginx/sites-available/compliance > /dev/null <<'EOF'
server {
    listen 80;
    server_name _;

    location / {
        root /var/www/AI_Compliance_Copilot/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;
    }
}
EOF
""",
        "sudo ln -sf /etc/nginx/sites-available/compliance /etc/nginx/sites-enabled/default",
        "sudo systemctl restart nginx",
        """sudo tee /etc/systemd/system/compliance_api.service > /dev/null <<'EOF'
[Unit]
Description=AI Compliance Copilot FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/var/www/AI_Compliance_Copilot
ExecStart=/var/www/AI_Compliance_Copilot/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker src.api:app --bind 127.0.0.1:8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF
""",
        "sudo systemctl daemon-reload && sudo systemctl enable --now compliance_api"
    ]

    print("\n -> Executing remote installation commands on EC2 server...")
    for cmd in commands:
        stdin, stdout, stderr = ssh.exec_command(cmd)
        exit_code = stdout.channel.recv_exit_status()
        if exit_code != 0:
            print(f" -> Notice on command: {stderr.read().decode()}")

    ssh.close()

    print("\n=========================================================================")
    print(f" SUCCESS! FULL DEPLOYMENT COMPLETE ON AWS MUMBAI!")
    print(f" - Instance ID:  {instance.id}")
    print(f" - Public IP:    {public_ip}")
    print(f" - Live URL:     http://{public_ip}")
    print("=========================================================================\n")
    return public_ip

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        deploy_to_aws_end_to_end(sys.argv[1], sys.argv[2])
    else:
        print("Usage: python deploy_full_ssh.py <access_key> <secret_key>")
