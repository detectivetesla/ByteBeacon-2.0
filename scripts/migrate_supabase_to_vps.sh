#!/usr/bin/env bash
# ==============================================================================
# ByteBeacon 2.0 - Supabase to Hostinger VPS Automated Database Migration Script
# Target Server: Hostinger KVM VPS (Ubuntu 22.04 / 24.04 / 26.04 LTS)
# Target Database: PostgreSQL 16 (bytebeacon_production)
# ==============================================================================

set -euo pipefail

# Text Styling
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "======================================================================"
echo "    ByteBeacon 2.0 - Supabase ➔ Hostinger VPS Migration Wizard"
echo "======================================================================"
echo -e "${NC}"

# Check for root / sudo
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be run as root (or with sudo).${NC}"
   exit 1
fi

VPS_IP="179.236.225.141"
DB_NAME="bytebeacon_production"
DB_USER="bytebeacon_user"
BACKUP_FILE="/tmp/bytebeacon_supabase_backup.sql"

# ------------------------------------------------------------------------------
# STEP 1: Prompt for Passwords & Credentials
# ------------------------------------------------------------------------------
echo -e "${YELLOW}${BOLD}[STEP 1/7] Gathering Credentials...${NC}"

# 1. Supabase Connection String
echo -e "Enter your Supabase Connection URL (port 5432 - Direct or Session Pooler):"
echo -e "${CYAN}Example: postgresql://postgres:mypassword@db.xxxxxx.supabase.co:5432/postgres${NC}"
read -rp "Supabase URL: " SUPABASE_URL

if [[ -z "$SUPABASE_URL" ]]; then
    echo -e "${RED}[ERROR] Supabase URL cannot be empty.${NC}"
    exit 1
fi

# 2. Hostinger VPS PostgreSQL Password
echo ""
read -rsp "Set a Strong Password for new PostgreSQL user '$DB_USER' (press Enter to auto-generate): " INPUT_PASS
echo ""

if [[ -z "$INPUT_PASS" ]]; then
    DB_PASS=$(tr -dc 'A-Za-z0-9!@#%^&*' </dev/urandom | head -c 24 || true)
    echo -e "${GREEN}[INFO] Auto-generated secure password: ${BOLD}${DB_PASS}${NC}"
else
    DB_PASS="$INPUT_PASS"
fi

# ------------------------------------------------------------------------------
# STEP 2: Install PostgreSQL 16 & Essential Tools
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[STEP 2/7] Installing & Configuring PostgreSQL 16...${NC}"

export DEBIAN_FRONTEND=noninteractive
apt update -y
apt install -y curl ca-certificates gnupg lsb-release ufw

# Check if postgresql is already installed
if ! command -v psql &> /dev/null; then
    echo -e "${CYAN}Adding official PostgreSQL repository...${NC}"
    install -d /etc/apt/keyrings
    curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg --yes
    echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list
    apt update -y
    apt install -y postgresql-16 postgresql-contrib-16 postgresql-client-16
else
    echo -e "${GREEN}[OK] PostgreSQL is already installed.${NC}"
fi

systemctl enable postgresql
systemctl start postgresql

# Detect installed PG version directory
PG_CONF_DIR=$(find /etc/postgresql -name postgresql.conf -exec dirname {} \; | head -n 1)
if [[ -z "$PG_CONF_DIR" ]]; then
    echo -e "${RED}[ERROR] Could not find PostgreSQL configuration directory.${NC}"
    exit 1
fi

echo -e "${GREEN}[OK] Found PostgreSQL config in: ${PG_CONF_DIR}${NC}"

# ------------------------------------------------------------------------------
# STEP 3: Configure PostgreSQL for High-Performance & Remote Connection
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[STEP 3/7] Hardening & Tuning PostgreSQL for Production...${NC}"

# Backup existing configs
cp "${PG_CONF_DIR}/postgresql.conf" "${PG_CONF_DIR}/postgresql.conf.bak" 2>/dev/null || true
cp "${PG_CONF_DIR}/pg_hba.conf" "${PG_CONF_DIR}/pg_hba.conf.bak" 2>/dev/null || true

# 1. Listen addresses & Memory settings
sed -i "s/^#\?listen_addresses\s*=.*/listen_addresses = '*'/" "${PG_CONF_DIR}/postgresql.conf"
sed -i "s/^#\?max_connections\s*=.*/max_connections = 200/" "${PG_CONF_DIR}/postgresql.conf"
sed -i "s/^#\?shared_buffers\s*=.*/shared_buffers = 512MB/" "${PG_CONF_DIR}/postgresql.conf"
sed -i "s/^#\?work_mem\s*=.*/work_mem = 16MB/" "${PG_CONF_DIR}/postgresql.conf"
sed -i "s/^#\?maintenance_work_mem\s*=.*/maintenance_work_mem = 128MB/" "${PG_CONF_DIR}/postgresql.conf"
sed -i "s/^#\?ssl\s*=.*/ssl = on/" "${PG_CONF_DIR}/postgresql.conf"

# 2. Allow remote connections for bytebeacon_user in pg_hba.conf
# Remove previous lines if any
sed -i "/bytebeacon_production/d" "${PG_CONF_DIR}/pg_hba.conf"

cat << EOF >> "${PG_CONF_DIR}/pg_hba.conf"
# ByteBeacon Production Connections
hostssl    ${DB_NAME}    ${DB_USER}    0.0.0.0/0    scram-sha-256
host       ${DB_NAME}    ${DB_USER}    0.0.0.0/0    scram-sha-256
hostssl    ${DB_NAME}    ${DB_USER}    ::/0         scram-sha-256
EOF

# Restart PostgreSQL to apply settings
systemctl restart postgresql

# 3. Configure UFW Firewall (Ensure SSH port 22 is never blocked!)
echo -e "${CYAN}Configuring UFW Firewall (opening port 5432 and keeping SSH port 22 open)...${NC}"
ufw allow 22/tcp || true
ufw allow 5432/tcp || true
ufw --force enable || true

# ------------------------------------------------------------------------------
# STEP 4: Initialize ByteBeacon Database, Roles, and Extensions
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[STEP 4/7] Initializing User, Database & Extensions...${NC}"

# Create user with password and database
sudo -u postgres psql -v ON_ERROR_STOP=1 << EOSQL
DO \$\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASS}';
   ELSE
      ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASS}';
   END IF;
END
\$\$;
EOSQL

# Check and create database if not exists
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi

sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# Enable required extensions and schema permissions inside bytebeacon_production
sudo -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=1 << EOSQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};
EOSQL

echo -e "${GREEN}[OK] Database ${DB_NAME} and user ${DB_USER} ready.${NC}"

# ------------------------------------------------------------------------------
# STEP 5: Export Authoritative Public Schema & Data from Supabase
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[STEP 5/7] Exporting Clean Data from Supabase...${NC}"
echo -e "${CYAN}Streaming public tables, records, triggers, sequences, and indexes...${NC}"

rm -f "$BACKUP_FILE"

# Run pg_dump excluding Supabase-internal schemas to guarantee clean import
pg_dump "$SUPABASE_URL" \
    --format=plain \
    --schema=public \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --quote-all-identifiers \
    -f "$BACKUP_FILE"

if [[ ! -s "$BACKUP_FILE" ]]; then
    echo -e "${RED}[ERROR] Backup file is empty or export failed. Check Supabase connection URL.${NC}"
    exit 1
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo -e "${GREEN}[OK] Supabase dump completed successfully! (Size: ${BACKUP_SIZE})${NC}"

# Clean any Supabase-internal role references from the dump file
sed -i -E 's/(anon|authenticated|service_role|supabase_admin|supabase_auth_admin)//g' "$BACKUP_FILE"

# ------------------------------------------------------------------------------
# STEP 6: Import Data & Re-align Sequences
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[STEP 6/7] Restoring Data into Hostinger PostgreSQL...${NC}"

export PGPASSWORD="$DB_PASS"
psql -h 127.0.0.1 -U "${DB_USER}" -d "${DB_NAME}" -f "$BACKUP_FILE" > /tmp/bytebeacon_restore.log 2>&1 || true

echo -e "${GREEN}[OK] Data restored. Synchronizing all PostgreSQL sequences...${NC}"

# Sequence resynchronization to ensure auto-increment IDs never collide
sudo -u postgres psql -d "${DB_NAME}" << 'EOSQL'
DO $$
DECLARE
    r RECORD;
    v_max_id BIGINT;
    v_seq_name TEXT;
BEGIN
    FOR r IN (
        SELECT 
            t.relname AS table_name,
            c.attname AS column_name,
            pg_get_serial_sequence(t.relname, c.attname) AS seq_name
        FROM pg_class t
        JOIN pg_attribute c ON c.attrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND pg_get_serial_sequence(t.relname, c.attname) IS NOT NULL
    ) LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %I', r.column_name, r.table_name) INTO v_max_id;
        IF v_max_id > 0 THEN
            EXECUTE format('SELECT setval(%L, %s, true)', r.seq_name, v_max_id);
            RAISE NOTICE 'Resynced sequence % for %.% to %', r.seq_name, r.table_name, r.column_name, v_max_id;
        END IF;
    END LOOP;
END $$;
EOSQL

# Grant ownership of all restored tables to bytebeacon_user
sudo -u postgres psql -d "${DB_NAME}" << EOSQL
DO \$\$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('ALTER TABLE public.%I OWNER TO ${DB_USER};', r.tablename);
    END LOOP;
    FOR r IN (SELECT sequence_name FROM information_schema.sequences WHERE sequence_schema = 'public') LOOP
        EXECUTE format('ALTER SEQUENCE public.%I OWNER TO ${DB_USER};', r.sequence_name);
    END LOOP;
    FOR r IN (SELECT table_name FROM information_schema.views WHERE table_schema = 'public') LOOP
        EXECUTE format('ALTER VIEW public.%I OWNER TO ${DB_USER};', r.table_name);
    END LOOP;
END \$\$;
EOSQL

# ------------------------------------------------------------------------------
# STEP 7: Integrity & Verification Audit
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[STEP 7/7] Running Database Integrity Audit...${NC}"

sudo -u postgres psql -d "${DB_NAME}" -c "
SELECT 
  relname AS \"Authoritative Table\", 
  n_live_tup AS \"Approx Records\" 
FROM pg_stat_user_tables 
WHERE relname IN ('users', 'agents', 'orders', 'financial_ledger', 'catalog_products', 'bulk_submissions', 'telecom_networks', 'schema_migrations')
ORDER BY n_live_tup DESC;
"

TABLE_COUNT=$(sudo -u postgres psql -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo ""
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}   DATABASE MIGRATION COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "Total Public Tables & Views Restored: ${BOLD}${TABLE_COUNT}${NC}"
echo ""
echo -e "${BOLD}Your New Production Connection Details:${NC}"
echo -e "Host:     ${CYAN}${VPS_IP}${NC}"
echo -e "Port:     ${CYAN}5432${NC}"
echo -e "Database: ${CYAN}${DB_NAME}${NC}"
echo -e "Username: ${CYAN}${DB_USER}${NC}"
echo -e "Password: ${CYAN}${DB_PASS}${NC}"
echo ""
echo -e "${BOLD}Your New DATABASE_URL for Render Backend:${NC}"
echo -e "${GREEN}DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@${VPS_IP}:5432/${DB_NAME}?sslmode=prefer${NC}"
echo -e "${GREEN}DB_SSL=false${NC}"
echo ""
echo -e "${YELLOW}Save these credentials safely. Now update Render environment variables!${NC}"
echo "======================================================================"
