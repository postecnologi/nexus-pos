#!/bin/bash
# NEXUS POS - Server Setup Script for DigitalOcean Ubuntu 24.04
# Run as root: bash setup_server.sh

set -e
echo "=========================================="
echo "  NEXUS POS - Configurando servidor..."
echo "=========================================="

# 1. Update system
apt update && apt upgrade -y

# 2. Install PostgreSQL
apt install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# 3. Configure PostgreSQL
sudo -u postgres psql -c "CREATE USER nexus_user WITH PASSWORD 'NexusDB2026!';"
sudo -u postgres psql -c "CREATE DATABASE nexus_db OWNER nexus_user;"
sudo -u postgres psql -c "ALTER USER nexus_user CREATEDB;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nexus_db TO nexus_user;"
echo "PostgreSQL OK"

# 4. Install Python 3.12
apt install -y python3 python3-pip python3-venv

# 5. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 6. Install Nginx
apt install -y nginx
systemctl enable nginx

# 7. Install Certbot for SSL
apt install -y certbot python3-certbot-nginx

# 8. Clone the repo
cd /opt
git clone https://github.com/postecnologi/nexus-pos.git
cd /opt/nexus-pos

# 9. Setup backend
cd /opt/nexus-pos/nexus_web/backend
python3 -m venv /opt/nexus-pos/.venv
/opt/nexus-pos/.venv/bin/pip install -r requirements.txt

# 10. Create .env
cat > /opt/nexus-pos/.env << 'ENVEOF'
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nexus_db
DB_USER=nexus_user
DB_PASSWORD=NexusDB2026!

JWT_SECRET_KEY=nexus_prod_secret_key_2026_pos_ec
JWT_EXPIRE_MINUTES=480

SRI_P12_PASSWORD=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_NAME=NEXUS POS
SMTP_FROM_EMAIL=
SMTP_USE_TLS=true

APP_NAME=NEXUS IA by POS-TECNOLOGI
APP_VERSION=2.0.0
DEBUG=False

MULTI_TENANT=true
ENVEOF

# 11. Setup frontend
cd /opt/nexus-pos/nexus_web/frontend
npm install
VITE_API_URL=https://api.pos-tecnologi.com/api npm run build

# 12. Create systemd service for backend
cat > /etc/systemd/system/nexus-api.service << 'SVCEOF'
[Unit]
Description=NEXUS POS API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/nexus-pos/nexus_web/backend
Environment=PATH=/opt/nexus-pos/.venv/bin:/usr/bin
ExecStart=/opt/nexus-pos/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable nexus-api
systemctl start nexus-api
echo "Backend service started"

# 13. Configure Nginx
cat > /etc/nginx/sites-available/nexus << 'NGXEOF'
# API backend
server {
    listen 80;
    server_name api.pos-tecnologi.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;
    }
}

# Frontend
server {
    listen 80;
    server_name pos-tecnologi.com www.pos-tecnologi.com;

    root /opt/nexus-pos/nexus_web/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/nexus /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
echo "Nginx configured"

# 14. Setup SSL with Let's Encrypt
certbot --nginx -d pos-tecnologi.com -d www.pos-tecnologi.com -d api.pos-tecnologi.com --non-interactive --agree-tos -m postecnologi@gmail.com || echo "SSL will be configured after DNS propagation"

echo ""
echo "=========================================="
echo "  NEXUS POS - INSTALACION COMPLETA!"
echo "=========================================="
echo ""
echo "  Backend:  http://67.205.136.228:8000"
echo "  Frontend: http://67.205.136.228"
echo ""
echo "  Ahora actualiza los DNS en Namecheap:"
echo "  A Record  @    -> 67.205.136.228"
echo "  CNAME     www  -> pos-tecnologi.com"
echo "  A Record  api  -> 67.205.136.228"
echo ""
