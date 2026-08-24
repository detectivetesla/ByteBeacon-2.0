-- ============================================================================
-- BYTEBEACON_LEGACY_ARCHIVE_DO_NOT_USE
-- ARCHIVAL SNAPSHOT OF LEGACY BYTEBEACON (VERSION 1.X) DATABASE SCHEMA
-- GENERATED: 2026-08-24T01:11:00.000Z
-- 
-- WARNING: THIS FILE CONTAINS DECOMMISSIONED LEGACY SCHEMA OBJECTS.
-- DO NOT APPLY TO BYTEBEACON 2.0 PRODUCTION DATABASE.
-- ============================================================================

-- 1. Legacy Supabase User & Auth Extensions (DEPRECATED)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Legacy Flat Orders Table (DEPRECATED - Replaced by ByteBeacon 2.0 8-Domain Schema)
CREATE TABLE IF NOT EXISTS legacy_orders_archive (
    id UUID PRIMARY KEY,
    user_id UUID,
    phone_number VARCHAR(20),
    network VARCHAR(50),
    plan_name VARCHAR(100),
    amount_paid DECIMAL(10, 2),
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Legacy Agent Store Configuration (DEPRECATED)
CREATE TABLE IF NOT EXISTS legacy_agent_stores_archive (
    id UUID PRIMARY KEY,
    agent_id UUID,
    store_name VARCHAR(255),
    custom_domain VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Legacy Messaging Log Table (DEPRECATED)
CREATE TABLE IF NOT EXISTS legacy_messaging_logs_archive (
    id UUID PRIMARY KEY,
    recipient VARCHAR(50),
    channel VARCHAR(20),
    message_content TEXT,
    delivery_status VARCHAR(50),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- END OF BYTEBEACON_LEGACY_ARCHIVE_DO_NOT_USE
-- ============================================================================
