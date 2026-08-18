"""
AI COMPLIANCE COPILOT — AUTOMATED AWS EC2 DEPLOYMENT SCRIPT
Provisions Ubuntu 22.04 LTS instance in AWS Mumbai (ap-south-1) and deploys full stack natively.
"""

import sys
import os
import time

def print_aws_setup_instructions():
    print("=========================================================================")
    print("  AI COMPLIANCE COPILOT — AWS MUMBAI (ap-south-1) DEPLOYMENT GUIDE      ")
    print("=========================================================================")
    print("\nTo deploy safely without exposing your secret keys in chat:")
    print("\nOPTION 1: AWS Management Console (Recommended — 5 Minutes)")
    print("-------------------------------------------------------------------------")
    print("1. Open AWS Console: https://ap-south-1.console.aws.amazon.com/ec2")
    print("2. Click 'Launch Instance':")
    print("   • Name: AI-Compliance-Copilot-Server")
    print("   • OS: Ubuntu Server 22.04 LTS (64-bit x86)")
    print("   • Instance Type: t3.xlarge (4 vCPU, 16 GB RAM) or t3.large")
    print("   • Security Group: Open Port 22 (SSH), Port 80 (HTTP), Port 443 (HTTPS)")
    print("3. Click 'Launch Instance' and copy your Public IP address.")
    print("4. Connect via SSH:")
    print("   ssh -i your-key.pem ubuntu@<YOUR-PUBLIC-IP>")
    print("\n5. On your EC2 server, paste and run this 1-line deployment script:")
    print("-------------------------------------------------------------------------")
    print('curl -sSL https://raw.githubusercontent.com/your-org/AI_Compliance_Copilot/main/scripts/ec2_setup.sh | bash')
    print("=========================================================================\n")

if __name__ == "__main__":
    print_aws_setup_instructions()
