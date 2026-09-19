-- =============================================================================
-- NaviOps — Separate Customer Module & Vessel Arrival Approval Workflow
-- Database Migration 002: Customer Domain Entities
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Customer Organizations Table
CREATE TABLE IF NOT EXISTS customer_organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    company_email VARCHAR(255) UNIQUE NOT NULL,
    company_phone VARCHAR(50) NOT NULL,
    country VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(30) NOT NULL,
    website VARCHAR(255),
    registration_number VARCHAR(100),
    industry VARCHAR(100) DEFAULT 'Commercial Shipping & Maritime Freight',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Customer Users Table
CREATE TABLE IF NOT EXISTS customer_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('CUSTOMER_ADMIN', 'CUSTOMER_USER')),
    password_hash TEXT NOT NULL,
    phone VARCHAR(50),
    job_title VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Customer Registered Vessels Table
CREATE TABLE IF NOT EXISTS customer_vessels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
    vessel_name VARCHAR(150) NOT NULL,
    imo_number VARCHAR(30) NOT NULL,
    vessel_type VARCHAR(50) NOT NULL CHECK (vessel_type IN ('Container', 'Bulk Carrier', 'Tanker', 'Ro-Ro', 'General Cargo', 'LPG/LNG')),
    length_loa NUMERIC(6,2) NOT NULL CHECK (length_loa > 0),
    beam NUMERIC(6,2) NOT NULL CHECK (beam > 0),
    draft NUMERIC(5,2) NOT NULL CHECK (draft > 0),
    gross_tonnage INTEGER NOT NULL CHECK (gross_tonnage > 0),
    deadweight_tonnage INTEGER NOT NULL CHECK (deadweight_tonnage > 0),
    flag VARCHAR(100) NOT NULL,
    operator_name VARCHAR(150),
    cargo_type VARCHAR(50) NOT NULL,
    cargo_capacity INTEGER NOT NULL CHECK (cargo_capacity > 0),
    hazardous_cargo BOOLEAN NOT NULL DEFAULT FALSE,
    special_handling_requirements TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_vessel_org_imo UNIQUE (organization_id, imo_number)
);

-- 4. Vessel Arrival Requests Table
CREATE TABLE IF NOT EXISTS arrival_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_code VARCHAR(30) UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
    vessel_id UUID NOT NULL REFERENCES customer_vessels(id) ON DELETE CASCADE,
    requested_eta TIMESTAMPTZ NOT NULL,
    expected_departure TIMESTAMPTZ NOT NULL,
    expected_port_stay_hours NUMERIC(6,2) NOT NULL DEFAULT 12.0,
    origin VARCHAR(120) NOT NULL,
    destination VARCHAR(120) NOT NULL,
    cargo_type VARCHAR(50) NOT NULL,
    cargo_quantity INTEGER NOT NULL CHECK (cargo_quantity > 0),
    hazardous_cargo BOOLEAN NOT NULL DEFAULT FALSE,
    special_cargo_requirements TEXT,
    preferred_berth_id UUID REFERENCES berths(id) ON DELETE SET NULL,
    required_cranes INTEGER NOT NULL DEFAULT 2,
    tug_required BOOLEAN NOT NULL DEFAULT TRUE,
    pilot_required BOOLEAN NOT NULL DEFAULT TRUE,
    bunkering_required BOOLEAN NOT NULL DEFAULT FALSE,
    other_services TEXT,
    customer_notes TEXT,
    special_instructions TEXT,
    status VARCHAR(40) NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
        'DRAFT',
        'SUBMITTED',
        'VALIDATING',
        'FEASIBILITY_CHECK',
        'OPTIMIZATION_RUNNING',
        'PENDING_MANAGER_REVIEW',
        'ALTERNATIVE_PROPOSED',
        'CUSTOMER_RESPONSE_REQUIRED',
        'APPROVED',
        'REJECTED',
        'CANCELLED',
        'COMPLETED'
    )),
    feasibility_status VARCHAR(30) DEFAULT 'PENDING' CHECK (feasibility_status IN ('PENDING', 'PASS', 'WARN', 'FAIL')),
    feasibility_details JSONB DEFAULT '[]'::jsonb,
    optimization_status VARCHAR(40) DEFAULT 'PENDING' CHECK (optimization_status IN ('PENDING', 'ACCEPTABLE', 'ALTERNATIVE_RECOMMENDED', 'INFEASIBLE')),
    optimization_recommendation JSONB,
    assigned_berth_id UUID REFERENCES berths(id) ON DELETE SET NULL,
    approved_start TIMESTAMPTZ,
    approved_end TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    rejection_reason VARCHAR(100),
    rejection_comment TEXT,
    changes_requested_notes TEXT,
    schedule_version_at_eval INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Alternative Proposals Table
CREATE TABLE IF NOT EXISTS request_alternative_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES arrival_requests(id) ON DELETE CASCADE,
    proposed_eta TIMESTAMPTZ NOT NULL,
    proposed_departure TIMESTAMPTZ NOT NULL,
    proposed_berth_id UUID REFERENCES berths(id) ON DELETE SET NULL,
    operational_reason TEXT NOT NULL,
    customer_response VARCHAR(30) DEFAULT 'PENDING' CHECK (customer_response IN ('PENDING', 'ACCEPTED', 'DECLINED')),
    customer_notes TEXT,
    proposed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- 6. Request Audit Logs Table
CREATE TABLE IF NOT EXISTS request_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id UUID NOT NULL REFERENCES arrival_requests(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    actor_name VARCHAR(150) NOT NULL,
    actor_domain VARCHAR(30) NOT NULL CHECK (actor_domain IN ('CUSTOMER', 'PORT_OPERATIONS')),
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(40),
    new_status VARCHAR(40),
    details JSONB DEFAULT '{}'::jsonb,
    reason TEXT,
    comment TEXT,
    schedule_version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Customer Notifications Table
CREATE TABLE IF NOT EXISTS customer_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES customer_users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    link_url VARCHAR(255),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_users_org ON customer_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_vessels_org ON customer_vessels(organization_id);
CREATE INDEX IF NOT EXISTS idx_arrival_requests_org ON arrival_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_arrival_requests_status ON arrival_requests(status);
CREATE INDEX IF NOT EXISTS idx_arrival_requests_eta ON arrival_requests(requested_eta);
CREATE INDEX IF NOT EXISTS idx_audit_logs_request ON request_audit_logs(request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON customer_notifications(organization_id);
