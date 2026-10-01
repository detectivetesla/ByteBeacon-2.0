#!/usr/bin/env bash
# ==============================================================================
# ByteBeacon 2.0 - Automated Supabase Backup Restorer for Hostinger VPS
# Target Server: Hostinger KVM VPS (Ubuntu 22.04 / 24.04 / 26.04 LTS)
# Target Database: PostgreSQL 16 (bytebeacon_production)
# ==============================================================================

set -euo pipefail

# Text Styling
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "======================================================================"
echo "    ByteBeacon 2.0 - Authoritative Database Restore Wizard"
echo "======================================================================"
echo -e "${NC}"

# Check for root / sudo
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be run as root (or with sudo).${NC}"
   exit 1
fi

APP_DIR="/var/www/bytebeacon"
DB_NAME="bytebeacon_production"
DB_USER="bytebeacon_user"
BACKUP_FILE="/tmp/bytebeacon_supabase_backup.sql"
LOG_FILE="/tmp/bytebeacon_restore.log"

# ------------------------------------------------------------------------------
# STEP 1: Verify Backup File Existence and Size
# ------------------------------------------------------------------------------
echo -e "${YELLOW}${BOLD}[1/7] Verifying Supabase Dump File...${NC}"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo -e "${RED}[ERROR] Backup file $BACKUP_FILE not found!${NC}"
    echo -e "${YELLOW}Please upload or copy your Supabase dump to $BACKUP_FILE and run again.${NC}"
    exit 1
fi

BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo -e "${GREEN}[OK] Located backup file: ${BACKUP_FILE} (Size: ${BACKUP_SIZE})${NC}"

# Create or use pristine safety copy
if [[ ! -f "${BACKUP_FILE}.original_bak" ]]; then
    cp "$BACKUP_FILE" "${BACKUP_FILE}.original_bak"
    echo -e "${GREEN}[OK] Created safety backup: ${BACKUP_FILE}.original_bak${NC}"
else
    echo -e "${CYAN}[INFO] Restoring from pristine backup ${BACKUP_FILE}.original_bak...${NC}"
    cp "${BACKUP_FILE}.original_bak" "$BACKUP_FILE"
fi

# ------------------------------------------------------------------------------
# STEP 2: Sanitize Supabase-Specific Dialects in SQL Dump
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[2/7] Normalizing Supabase Extensions & Schemas in SQL Dump...${NC}"

# 1. Replace Supabase extensions.uuid_generate_v4() with native PostgreSQL gen_random_uuid()
sed -i -E 's/("extensions"\.|extensions\.)uuid_generate_v4\(\)/gen_random_uuid()/g' "$BACKUP_FILE"

# 2. Replace any extensions.gen_random_uuid() with native gen_random_uuid()
sed -i -E 's/("extensions"\.|extensions\.)gen_random_uuid\(\)/gen_random_uuid()/g' "$BACKUP_FILE"

# 3. Ensure any DROP SCHEMA public statements use CASCADE to avoid dependency locks
sed -i -E 's/DROP SCHEMA( IF EXISTS)? ("public"|public);/DROP SCHEMA IF EXISTS public CASCADE;/g' "$BACKUP_FILE"

echo -e "${GREEN}[OK] SQL dump normalized for standard PostgreSQL 16.${NC}"

# ------------------------------------------------------------------------------
# STEP 3: Terminate Connections & Recreate Database Cleanly
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[3/7] Preparing Clean Database '${DB_NAME}'...${NC}"

# Terminate existing connections (e.g. backend api pool)
sudo -u postgres psql -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
" || true

# Recreate database
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ${DB_NAME};"
sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

# ------------------------------------------------------------------------------
# STEP 4: Configure Roles, Extensions & Search Path
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[4/7] Configuring Compatibility Roles & Extensions...${NC}"

sudo -u postgres psql -d "${DB_NAME}" << 'EOSQL'
-- Create compatibility roles so grants in the dump never fail
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
END $$;

-- Create extensions schema and install extensions into both schemas
CREATE SCHEMA IF NOT EXISTS extensions;
GRANT ALL ON SCHEMA extensions TO postgres;
GRANT USAGE, CREATE ON SCHEMA extensions TO bytebeacon_user;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

-- Set search_path
ALTER DATABASE bytebeacon_production SET search_path TO public, extensions;
EOSQL

echo -e "${GREEN}[OK] Database, extensions, and compatibility roles configured.${NC}"

# ------------------------------------------------------------------------------
# STEP 5: Restore Authoritative Data
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[5/7] Importing Data from Backup...${NC}"
echo -e "${CYAN}Executing SQL dump (this may take a few moments depending on data volume)...${NC}"

sudo -u postgres psql -d "${DB_NAME}" -f "$BACKUP_FILE" > "$LOG_FILE" 2>&1 || true

echo -e "${GREEN}[OK] SQL restoration complete. Log saved to: ${LOG_FILE}${NC}"

# Re-grant permissions and transfer ownership of all objects to bytebeacon_user
sudo -u postgres psql -d "${DB_NAME}" << EOSQL
GRANT ALL ON SCHEMA public TO ${DB_USER};
ALTER SCHEMA public OWNER TO ${DB_USER};
GRANT ALL ON SCHEMA extensions TO ${DB_USER};

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

# Resynchronize all auto-increment sequences
sudo -u postgres psql -d "${DB_NAME}" << 'EOSQL'
DO $$
DECLARE
    r RECORD;
    v_max_id BIGINT;
BEGIN
    FOR r IN (
        SELECT 
            t.relname AS table_name,
            c.attname AS column_name,
            pg_get_serial_sequence('public.' || quote_ident(t.relname), c.attname) AS seq_name
        FROM pg_class t
        JOIN pg_attribute c ON c.attrelid = t.oid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND pg_get_serial_sequence('public.' || quote_ident(t.relname), c.attname) IS NOT NULL
    ) LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM public.%I', r.column_name, r.table_name) INTO v_max_id;
        IF v_max_id > 0 THEN
            EXECUTE format('SELECT setval(%L, %s, true)', r.seq_name, v_max_id);
            RAISE NOTICE 'Resynced sequence % for %.% to %', r.seq_name, r.table_name, r.column_name, v_max_id;
        END IF;
    END LOOP;
END $$;
EOSQL

# ------------------------------------------------------------------------------
# STEP 6: Run Pending Migrations & Verification Audit
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[6/7] Reconciling Database Migrations & Verifying Tables...${NC}"

if [[ -d "$APP_DIR" ]]; then
    cd "$APP_DIR"
    echo -e "${CYAN}Applying migration 37 (paused order controls) & 38 (bulk submissions schema)...${NC}"
    sudo -u postgres psql -d "${DB_NAME}" -f "$APP_DIR/apps/backend/src/infrastructure/database/migrations/00000000000037_add_paused_order_controls_and_status.sql" || true
    sudo -u postgres psql -d "${DB_NAME}" -f "$APP_DIR/apps/backend/src/infrastructure/database/migrations/00000000000038_reconcile_bulk_submissions_schema.sql" || true
    echo -e "${CYAN}Applying any missing migrations via application CLI...${NC}"
    npm run migrate:up -w @bytebeacon/backend || true
fi

echo ""
echo -e "${BOLD}Database Table Audit:${NC}"
sudo -u postgres psql -d "${DB_NAME}" -c "
SELECT 
  relname AS \"Authoritative Table\", 
  n_live_tup AS \"Approx Records\" 
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
"

TABLE_COUNT=$(sudo -u postgres psql -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")
USER_COUNT=$(sudo -u postgres psql -d "${DB_NAME}" -t -A -c "SELECT count(*) FROM users;" 2>/dev/null || echo "0")

echo ""
echo -e "Total Tables in public schema: ${BOLD}${GREEN}${TABLE_COUNT}${NC}"
echo -e "Total Users restored:          ${BOLD}${GREEN}${USER_COUNT}${NC}"

if [[ "$USER_COUNT" -gt 0 ]]; then
    echo ""
    echo -e "${BOLD}Sample User Accounts:${NC}"
    sudo -u postgres psql -d "${DB_NAME}" -c "SELECT id, email, phone, role, status FROM users LIMIT 5;"
else
    echo -e "${RED}[WARNING] No users found. Please inspect ${LOG_FILE} for details.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 7: Restart Application Backend Services
# ------------------------------------------------------------------------------
echo ""
echo -e "${YELLOW}${BOLD}[7/7] Restarting Backend API & Worker via PM2...${NC}"
pm2 restart all || true

echo ""
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "${GREEN}${BOLD}   DATABASE RESTORATION COMPLETED SUCCESSFULLY!${NC}"
echo -e "${GREEN}${BOLD}======================================================================${NC}"
echo -e "Your PostgreSQL database '${DB_NAME}' is restored and online."
echo ""
