#!/usr/bin/env bash
# ==============================================================================
# ByteBeacon 2.0 - Phase 3: Frontend Migration (Vercel ➔ Hostinger Nginx)
# Target Server: Hostinger KVM VPS (Ubuntu 22.04 / 24.04 / 26.04 LTS)
# Serves: bytebeacon.online, www.bytebeacon.online
# ==============================================================================

set -euo pipefail

# Text Styling
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "======================================================================"
echo "    ByteBeacon 2.0 - Phase 3: Frontend Nginx Deployment"
echo "======================================================================"
echo -e "${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be run as root (or with sudo).${NC}"
   exit 1
fi

APP_DIR="/var/www/bytebeacon"
FRONTEND_DIST="${APP_DIR}/apps/frontend/dist"
DOMAINS="bytebeacon.online www.bytebeacon.online"
VPS_IP="179.236.225.141"

# ------------------------------------------------------------------------------
# STEP 1: Build Frontend Single Page Application
# ------------------------------------------------------------------------------
echo -e "${YELLOW}${BOLD}[1/4] Compiling Production Frontend Assets with Vite...${NC}"
cd "${APP_DIR}"

# Ensure shared package is built
npm run build -w @bytebeacon/shared

# Build frontend SPA
npm run build -w @bytebeacon/frontend

if [[ ! -f "${FRONTEND_DIST}/index.html" ]]; then
    echo -e "${RED}[ERROR] Build failed: ${FRONTEND_DIST}/index.html was not generated.${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Frontend built successfully in ${FRONTEND_DIST}.${NC}"

# Ensure permissions so Nginx (www-data) can read static files
chown -R www-data:www-data "${FRONTEND_DIST}"
chmod -R 755 "${FRONTEND_DIST}"

# ------------------------------------------------------------------------------
# STEP 2: Configure Nginx for Frontend SPA
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[2/4] Configuring Nginx Virtual Host for ${DOMAINS}...${NC}"

NGINX_CONF="/etc/nginx/sites-available/bytebeacon.online"

cat << 'EOF' > "$NGINX_CONF"
server {
    listen 80;
    listen [::]:80;
    server_name bytebeacon.online www.bytebeacon.online;

    root /var/www/bytebeacon/apps/frontend/dist;
    index index.html apisolutions.html;

    # High performance gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        application/json
        application/javascript
        application/x-javascript
        application/xml
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Immutable caching for hashed Vite production assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Favicon and static root assets
    location ~* \.(?:ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        access_log off;
    }

    # SPA routing: fallback all non-file client routes to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
}
EOF

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/bytebeacon.online"

# Virtual Host for apisolutions.store (Agent/Merchant Storefront Portal)
APISOLUTIONS_CONF="/etc/nginx/sites-available/apisolutions.store"

cat << 'EOF' > "$APISOLUTIONS_CONF"
server {
    listen 80;
    listen [::]:80;
    server_name apisolutions.store www.apisolutions.store;

    # If SSL cert exists, redirect HTTP to HTTPS
    if (-f /etc/letsencrypt/live/apisolutions.store/fullchain.pem) {
        return 301 https://$host$request_uri;
    }

    root /var/www/bytebeacon/apps/frontend/dist;
    index apisolutions.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss image/svg+xml;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(?:ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /apisolutions.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

# HTTPS server block if SSL cert exists
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name apisolutions.store www.apisolutions.store;

    ssl_certificate /etc/letsencrypt/live/apisolutions.store/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/apisolutions.store/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    root /var/www/bytebeacon/apps/frontend/dist;
    index apisolutions.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/xml+rss image/svg+xml;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(?:ico|png|jpg|jpeg|gif|svg|webp|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000";
        access_log off;
    }

    location / {
        try_files $uri $uri/ /apisolutions.html;
    }

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF

ln -sf "$APISOLUTIONS_CONF" "/etc/nginx/sites-enabled/apisolutions.store"

# ------------------------------------------------------------------------------
# STEP 3: Test & Reload Nginx
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[3/4] Testing Nginx Configuration & Reloading...${NC}"

nginx -t
systemctl reload nginx

echo -e "${GREEN}[OK] Nginx reloaded successfully.${NC}"

# ------------------------------------------------------------------------------
# STEP 4: Verification & Cutover Instructions
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[4/4] Verifying Local Delivery...${NC}"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: bytebeacon.online" http://127.0.0.1/)
if [[ "$HTTP_CODE" == "200" ]]; then
    echo -e "${GREEN}${BOLD}[SUCCESS] Local Nginx is serving ByteBeacon SPA (HTTP 200 OK)!${NC}"
else
    echo -e "${YELLOW}[NOTICE] Local HTTP probe returned: ${HTTP_CODE}${NC}"
fi

echo ""
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}   PHASE 3 FRONTEND DEPLOYMENT READY!${NC}"
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo ""
echo -e "${BOLD}FINAL DNS CUTOVER (Vercel ➔ Hostinger VPS):${NC}"
echo -e "1. Go to your DNS Manager (Cloudflare, Namecheap, or Hostinger DNS)."
echo -e "2. Update the records for your root domain and www:"
echo -e "   - Record 1: Type ${CYAN}A${NC} | Name: ${CYAN}@${NC} (or bytebeacon.online) | Value: ${BOLD}${VPS_IP}${NC}"
echo -e "   - Record 2: Type ${CYAN}A${NC} | Name: ${CYAN}www${NC} | Value: ${BOLD}${VPS_IP}${NC}"
echo -e "   (Delete any existing CNAME records pointing to cname.vercel-dns.com)"
echo ""
echo -e "3. Once DNS propagates (1-3 minutes), issue SSL for frontend:"
echo -e "   ${GREEN}sudo certbot --nginx -d bytebeacon.online -d www.bytebeacon.online${NC}"
echo ""
echo -e "4. Also ensure SSL is issued for the backend API if not done yet:"
echo -e "   ${GREEN}sudo certbot --nginx -d api.bytebeacon.online${NC}"
echo "======================================================================"
