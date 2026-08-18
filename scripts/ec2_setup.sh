#!/bin/bash
# =========================================================================
# AI COMPLIANCE COPILOT — AUTOMATED AWS EC2 SETUP SCRIPT (UBUNTU 22.04)
# =========================================================================

set -e

echo "=== [1/6] Updating System Packages & Installing System Dependencies ==="
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y python3-pip python3-venv nginx tesseract-ocr poppler-utils git certbot python3-certbot-nginx curl

echo "=== [2/6] Installing Node.js 20 LTS ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "=== [3/6] Setting Up Python Virtual Environment & Requirements ==="
cd /var/www
if [ ! -d "AI_Compliance_Copilot" ]; then
    sudo git clone https://github.com/your-org/AI_Compliance_Copilot.git
fi
sudo chown -R $USER:$USER /var/www/AI_Compliance_Copilot
cd /var/www/AI_Compliance_Copilot

python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt gunicorn uvicorn

echo "=== [4/6] Installing & Starting Ollama LLM Engine (llama3.1) ==="
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.1:latest

echo "=== [5/6] Building React Frontend & Setting Up Nginx Web Server ==="
cd /var/www/AI_Compliance_Copilot/frontend
npm install
npm run build

sudo tee /etc/nginx/sites-available/compliance > /dev/null <<'EOF'
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

sudo ln -sf /etc/nginx/sites-available/compliance /etc/nginx/sites-enabled/default
sudo systemctl restart nginx

echo "=== [6/6] Setting Up Gunicorn FastAPI Systemd Service ==="
sudo tee /etc/systemd/system/compliance_api.service > /dev/null <<EOF
[Unit]
Description=AI Compliance Copilot FastAPI Backend
After=network.target

[Service]
User=$USER
WorkingDirectory=/var/www/AI_Compliance_Copilot
ExecStart=/var/www/AI_Compliance_Copilot/venv/bin/gunicorn -w 4 -k uvicorn.workers.UvicornWorker src.api:app --bind 127.0.0.1:8001
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now compliance_api

echo "========================================================================="
echo " 🎉 DEPLOYMENT COMPLETE! AI Compliance Copilot is Live on your AWS Server!"
echo " Open http://<YOUR-EC2-PUBLIC-IP> in your browser to access the dashboard."
echo "========================================================================="
