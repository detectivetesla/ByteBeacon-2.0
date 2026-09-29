#!/usr/bin/env bash
# ==============================================================================
# ByteBeacon 2.0 - Phase 2: Backend API & Worker Deployment Script
# Target Server: Hostinger KVM VPS (Ubuntu 22.04 / 24.04 / 26.04 LTS)
# Components: Node.js 22, pnpm, PM2, Redis, Nginx Reverse Proxy, Certbot
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
echo "    ByteBeacon 2.0 - Phase 2: Backend API & Worker Deployment"
echo "======================================================================"
echo -e "${NC}"

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be run as root (or with sudo).${NC}"
   exit 1
fi

APP_DIR="/var/www/bytebeacon"
DOMAIN="api.bytebeacon.online"
VPS_IP="179.236.225.141"

# ------------------------------------------------------------------------------
# STEP 1: System Packages & Dependencies
# ------------------------------------------------------------------------------
echo -e "${YELLOW}${BOLD}[1/7] Installing System Prerequisites (Node.js 22, Redis, Nginx)...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt update -y
apt install -y curl ca-certificates gnupg lsb-release git build-essential ufw nginx certbot python3-certbot-nginx redis-server

# Install Node.js 22 LTS if not present
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | tr -d 'v') -lt 20 ]]; then
    echo -e "${CYAN}Installing Node.js 22 LTS...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt install -y nodejs
fi

NODE_VERSION=$(node -v)
echo -e "${GREEN}[OK] Node.js version: ${NODE_VERSION}${NC}"

# Install pnpm and pm2 globally
echo -e "${CYAN}Installing pnpm and pm2 globally...${NC}"
npm install -g pnpm pm2

# ------------------------------------------------------------------------------
# STEP 2: Configure Redis & Firewall
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[2/7] Configuring Local Redis & Firewall...${NC}"

# Ensure Redis binds to 127.0.0.1
sed -i "s/^bind .*/bind 127.0.0.1 ::1/" /etc/redis/redis.conf || true
systemctl enable redis-server
systemctl restart redis-server

if redis-cli ping | grep -q PONG; then
    echo -e "${GREEN}[OK] Redis is active and responding to PING.${NC}"
else
    echo -e "${RED}[WARNING] Redis did not respond immediately, continuing...${NC}"
fi

# Firewall rules for web traffic
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 5432/tcp || true
ufw allow 22/tcp || true
ufw --force enable || true

# ------------------------------------------------------------------------------
# STEP 3: Setup Application Codebase
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[3/7] Setting Up Repository at ${APP_DIR}...${NC}"

mkdir -p /var/www
if [[ -d "${APP_DIR}/.git" ]]; then
    echo -e "${CYAN}Updating existing repository...${NC}"
    cd "${APP_DIR}"
    git fetch origin
    git reset --hard origin/main
else
    echo -e "${CYAN}Cloning ByteBeacon 2.0 repository...${NC}"
    git clone https://github.com/detectivetesla/ByteBeacon-2.0.git "${APP_DIR}"
    cd "${APP_DIR}"
fi

# ------------------------------------------------------------------------------
# STEP 4: Configure Production Environment (.env)
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[4/7] Checking Production Environment (.env)...${NC}"

ENV_FILE="${APP_DIR}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${CYAN}Creating new .env from template...${NC}"
    cp "${APP_DIR}/.env.example" "$ENV_FILE"

    echo ""
    echo -e "${YELLOW}Please enter the PostgreSQL password for 'bytebeacon_user' (set during Phase 1):${NC}"
    read -rsp "DB Password: " DB_PASS
    echo ""

    echo -e "${YELLOW}Please enter your JWT_SECRET (min 32 characters, or press Enter for auto-generated):${NC}"
    read -rp "JWT Secret: " JWT_SEC
    if [[ -z "$JWT_SEC" ]]; then
        JWT_SEC=$(tr -dc 'A-Za-z0-9!@#%^&*' </dev/urandom | head -c 48 || true)
        echo -e "${GREEN}[INFO] Auto-generated secure JWT_SECRET.${NC}"
    fi

    echo -e "${YELLOW}Enter PAYSTACK_SECRET_KEY (or press Enter to configure later):${NC}"
    read -rp "Paystack Secret Key: " PAYSTACK_SEC
    PAYSTACK_SEC=${PAYSTACK_SEC:-"sk_test_placeholder_key_here"}

    echo -e "${YELLOW}Enter DATAHOUSE_API_KEY (or press Enter to configure later):${NC}"
    read -rp "DataHouse API Key: " DH_KEY
    DH_KEY=${DH_KEY:-"dh_sandbox_placeholder_key"}

    echo -e "${YELLOW}Enter DATAHOUSE_WEBHOOK_SECRET (or press Enter to configure later):${NC}"
    read -rp "DataHouse Webhook Secret: " DH_SEC
    DH_SEC=${DH_SEC:-"dh_webhook_placeholder_secret"}

    cat << EOF > "$ENV_FILE"
NODE_ENV=production
PORT=3000
APP_VERSION=2.0.0
CORS_ORIGINS=https://bytebeacon.online,https://www.bytebeacon.online,https://api.bytebeacon.online,https://frontend-byte-beacon.vercel.app,https://frontend-hazel-six-10.vercel.app,http://localhost:5173

# Database & Redis (Local VPS)
DATABASE_URL=postgresql://bytebeacon_user:${DB_PASS}@127.0.0.1:5432/bytebeacon_production
DB_SSL=false
REDIS_URL=redis://127.0.0.1:6379

# Cryptography
JWT_SECRET=${JWT_SEC}
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=604800

# Paystack
PAYSTACK_SECRET_KEY=${PAYSTACK_SEC}
PAYSTACK_PUBLIC_KEY=pk_live_placeholder

# DataHouse Telecom Gateway
DATAHOUSE_BASE_URL=https://api.getmorepaylessdatahouse.net/api/v1
DATAHOUSE_API_KEY=${DH_KEY}
DATAHOUSE_WEBHOOK_SECRET=${DH_SEC}

# Observability & Production Flags
SENTRY_DSN=
FF_NEW_ORDER_ENGINE=true
FF_AGENT_STORES=true
FF_MTN_PRECHECK=true
FF_PAYSTACK_LIVE=true
FF_MAINTENANCE_MODE=false
FF_DEVELOPER_SANDBOX=false
ALLOW_MOCK_PROVIDERS=false
DEV_AUTH_ENABLED=false
EOF
    echo -e "${GREEN}[OK] Production .env created.${NC}"
else
    echo -e "${GREEN}[OK] Existing .env file found at ${ENV_FILE}.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 5: Install Dependencies & Build Packages
# ------------------------------------------------------------------------------
echo ""
# Install dependencies using npm workspaces (uses package-lock.json and resolves local @bytebeacon/shared)
echo -e "${CYAN}Installing workspace dependencies via npm...${NC}"
npm ci || npm install

echo -e "${CYAN}Building @bytebeacon/shared...${NC}"
npm run build -w @bytebeacon/shared

echo -e "${CYAN}Building @bytebeacon/backend...${NC}"
npm run build -w @bytebeacon/backend

echo -e "${GREEN}[OK] Backend and shared packages compiled successfully.${NC}"

# ------------------------------------------------------------------------------
# STEP 6: Configure Nginx Reverse Proxy
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[6/7] Configuring Nginx Reverse Proxy for ${DOMAIN}...${NC}"

NGINX_CONF="/etc/nginx/sites-available/${DOMAIN}"

cat << 'EOF' > "$NGINX_CONF"
server {
    listen 80;
    listen [::]:80;
    server_name api.bytebeacon.online;

    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
EOF

ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default || true

nginx -t
systemctl reload nginx
echo -e "${GREEN}[OK] Nginx configured and reloaded.${NC}"

# ------------------------------------------------------------------------------
# STEP 7: Start with PM2 & Verify Health
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[7/7] Launching Backend API & Background Worker via PM2...${NC}"
cd "${APP_DIR}"

pm2 delete bytebeacon-api bytebeacon-worker 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root || true

sleep 3

echo -e "${CYAN}Checking local API health probe...${NC}"
if curl -sf http://127.0.0.1:3000/healthz > /dev/null; then
    echo -e "${GREEN}${BOLD}[SUCCESS] Fastify API is LIVE and responding locally on port 3000!${NC}"
else
    echo -e "${RED}[WARNING] API did not respond to /healthz probe immediately. Check logs with 'pm2 logs'.${NC}"
fi

echo ""
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}   PHASE 2 BACKEND DEPLOYMENT READY!${NC}"
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo ""
echo -e "${BOLD}Current PM2 Status:${NC}"
pm2 status
echo ""
echo -e "${BOLD}FINAL CUTOVER STEPS:${NC}"
echo -e "1. Go to your DNS provider (Cloudflare, Namecheap, or Hostinger DNS)."
echo -e "2. Point the A record for ${CYAN}${DOMAIN}${NC} to VPS IP: ${BOLD}${VPS_IP}${NC}"
echo -e "3. Once DNS propagates (1-5 mins), generate free SSL by running on VPS:"
echo -e "   ${GREEN}sudo certbot --nginx -d ${DOMAIN}${NC}"
echo -e "4. Monitor backend live logs anytime with: ${CYAN}pm2 logs${NC}"
echo "======================================================================"
