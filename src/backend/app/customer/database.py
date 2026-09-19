import os
import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from decimal import Decimal

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from app.core.config import settings
from app.customer.auth import hash_customer_password

logger = logging.getLogger("naviops.customer.database")


def clean_row(row: Dict[str, Any]) -> Dict[str, Any]:
    cleaned = {}
    for k, v in row.items():
        if isinstance(v, uuid.UUID):
            cleaned[k] = str(v)
        elif isinstance(v, Decimal):
            cleaned[k] = float(v)
        else:
            cleaned[k] = v
    return cleaned


class CustomerRepository:
    """
    Multi-tenant repository for the Customer Domain backed by Supabase PostgreSQL
    with high-performance in-memory caching.
    """

    def __init__(self):
        self.organizations: Dict[str, Dict[str, Any]] = {}
        self.users: Dict[str, Dict[str, Any]] = {}
        self.vessels: Dict[str, Dict[str, Any]] = {}
        self.arrival_requests: Dict[str, Dict[str, Any]] = {}
        self.proposals: Dict[str, Dict[str, Any]] = {}
        self.audit_logs: Dict[str, Dict[str, Any]] = {}
        self.notifications: Dict[str, Dict[str, Any]] = {}
        self._conn = None

        self._ensure_schema()
        self._load_from_db()
        self.seed_defaults_if_empty()

    def get_connection(self):
        """Get or reuse a persistent connection to Supabase PostgreSQL."""
        url = settings.clean_database_url
        if not url:
            return None
        if self._conn is not None and not self._conn.closed:
            try:
                self._conn.execute("SELECT 1")
                return self._conn
            except Exception:
                try:
                    self._conn.close()
                except Exception:
                    pass
                self._conn = None

        try:
            self._conn = psycopg.connect(url, row_factory=dict_row, autocommit=True, prepare_threshold=None)
            return self._conn
        except Exception as e:
            logger.warning(f"Failed to connect to Supabase PostgreSQL for Customer module: {e}")
            return None

    def _ensure_schema(self):
        """Ensure all Customer domain tables exist in Supabase PostgreSQL."""
        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS customer_organizations (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        company_email TEXT UNIQUE NOT NULL,
                        company_phone TEXT NOT NULL,
                        country TEXT NOT NULL,
                        address TEXT NOT NULL,
                        city TEXT NOT NULL,
                        state TEXT,
                        postal_code TEXT NOT NULL,
                        website TEXT,
                        registration_number TEXT,
                        industry TEXT DEFAULT 'Commercial Shipping & Maritime Freight',
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS customer_users (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
                        email TEXT UNIQUE NOT NULL,
                        full_name TEXT NOT NULL,
                        role TEXT NOT NULL CHECK (role IN ('CUSTOMER_ADMIN', 'CUSTOMER_USER')),
                        password_hash TEXT NOT NULL,
                        phone TEXT,
                        job_title TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS customer_vessels (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
                        vessel_name TEXT NOT NULL,
                        imo_number TEXT NOT NULL,
                        vessel_type TEXT NOT NULL,
                        length_loa DOUBLE PRECISION NOT NULL,
                        beam DOUBLE PRECISION NOT NULL,
                        draft DOUBLE PRECISION NOT NULL,
                        gross_tonnage INTEGER NOT NULL,
                        deadweight_tonnage INTEGER NOT NULL,
                        flag TEXT NOT NULL,
                        operator_name TEXT,
                        cargo_type TEXT NOT NULL,
                        cargo_capacity INTEGER NOT NULL,
                        hazardous_cargo BOOLEAN NOT NULL DEFAULT FALSE,
                        special_handling_requirements TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        CONSTRAINT customer_vessels_org_imo_key UNIQUE (organization_id, imo_number)
                    );

                    CREATE TABLE IF NOT EXISTS arrival_requests (
                        id TEXT PRIMARY KEY,
                        request_code TEXT UNIQUE NOT NULL,
                        organization_id TEXT NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
                        vessel_id TEXT NOT NULL REFERENCES customer_vessels(id) ON DELETE CASCADE,
                        requested_eta TIMESTAMPTZ NOT NULL,
                        expected_departure TIMESTAMPTZ NOT NULL,
                        expected_port_stay_hours DOUBLE PRECISION NOT NULL DEFAULT 12.0,
                        origin TEXT NOT NULL,
                        destination TEXT NOT NULL,
                        cargo_type TEXT NOT NULL,
                        cargo_quantity INTEGER NOT NULL,
                        hazardous_cargo BOOLEAN NOT NULL DEFAULT FALSE,
                        special_cargo_requirements TEXT,
                        preferred_berth_id TEXT,
                        required_cranes INTEGER NOT NULL DEFAULT 2,
                        tug_required BOOLEAN NOT NULL DEFAULT TRUE,
                        pilot_required BOOLEAN NOT NULL DEFAULT TRUE,
                        bunkering_required BOOLEAN NOT NULL DEFAULT FALSE,
                        other_services TEXT,
                        customer_notes TEXT,
                        special_instructions TEXT,
                        status TEXT NOT NULL DEFAULT 'SUBMITTED',
                        feasibility_status TEXT DEFAULT 'PENDING',
                        feasibility_details JSONB DEFAULT '[]'::jsonb,
                        optimization_status TEXT DEFAULT 'PENDING',
                        optimization_recommendation JSONB,
                        assigned_berth_id TEXT,
                        approved_start TIMESTAMPTZ,
                        approved_end TIMESTAMPTZ,
                        reviewed_by TEXT,
                        reviewed_at TIMESTAMPTZ,
                        rejection_reason TEXT,
                        rejection_comment TEXT,
                        changes_requested_notes TEXT,
                        schedule_version_at_eval INTEGER DEFAULT 1,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS request_alternative_proposals (
                        id TEXT PRIMARY KEY,
                        request_id TEXT NOT NULL REFERENCES arrival_requests(id) ON DELETE CASCADE,
                        proposed_eta TIMESTAMPTZ NOT NULL,
                        proposed_departure TIMESTAMPTZ NOT NULL,
                        proposed_berth_id TEXT,
                        operational_reason TEXT NOT NULL,
                        customer_response TEXT DEFAULT 'PENDING',
                        customer_notes TEXT,
                        proposed_by TEXT,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        responded_at TIMESTAMPTZ
                    );

                    CREATE TABLE IF NOT EXISTS request_audit_logs (
                        id TEXT PRIMARY KEY,
                        request_id TEXT NOT NULL REFERENCES arrival_requests(id) ON DELETE CASCADE,
                        actor_id TEXT NOT NULL,
                        actor_name TEXT NOT NULL,
                        actor_domain TEXT NOT NULL,
                        action TEXT NOT NULL,
                        previous_status TEXT,
                        new_status TEXT,
                        details JSONB DEFAULT '{}'::jsonb,
                        reason TEXT,
                        comment TEXT,
                        schedule_version INTEGER DEFAULT 1,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );

                    CREATE TABLE IF NOT EXISTS customer_notifications (
                        id TEXT PRIMARY KEY,
                        organization_id TEXT NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
                        user_id TEXT,
                        title TEXT NOT NULL,
                        message TEXT NOT NULL,
                        notification_type TEXT NOT NULL,
                        link_url TEXT,
                        is_read BOOLEAN NOT NULL DEFAULT FALSE,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """)
        except Exception as e:
            logger.error(f"Failed to verify customer schema in Supabase: {e}")

    def _load_from_db(self):
        """Preload all customer entities from Supabase PostgreSQL."""
        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                # Organizations
                cur.execute("SELECT * FROM customer_organizations")
                for r in cur.fetchall():
                    item = clean_row(r)
                    if isinstance(item.get("created_at"), str):
                        item["created_at"] = datetime.fromisoformat(item["created_at"])
                    if isinstance(item.get("updated_at"), str):
                        item["updated_at"] = datetime.fromisoformat(item["updated_at"])
                    self.organizations[item["id"]] = item

                # Users
                cur.execute("SELECT * FROM customer_users")
                for r in cur.fetchall():
                    item = clean_row(r)
                    if isinstance(item.get("created_at"), str):
                        item["created_at"] = datetime.fromisoformat(item["created_at"])
                    if isinstance(item.get("updated_at"), str):
                        item["updated_at"] = datetime.fromisoformat(item["updated_at"])
                    self.users[item["id"]] = item

                # Vessels
                cur.execute("SELECT * FROM customer_vessels")
                for r in cur.fetchall():
                    item = clean_row(r)
                    item["hazardous_cargo"] = bool(item.get("hazardous_cargo"))
                    if isinstance(item.get("created_at"), str):
                        item["created_at"] = datetime.fromisoformat(item["created_at"])
                    if isinstance(item.get("updated_at"), str):
                        item["updated_at"] = datetime.fromisoformat(item["updated_at"])
                    self.vessels[item["id"]] = item

                # Arrival requests
                cur.execute("SELECT * FROM arrival_requests")
                for r in cur.fetchall():
                    item = clean_row(r)
                    item["hazardous_cargo"] = bool(item.get("hazardous_cargo"))
                    item["tug_required"] = bool(item.get("tug_required", True))
                    item["pilot_required"] = bool(item.get("pilot_required", True))
                    item["bunkering_required"] = bool(item.get("bunkering_required", False))
                    if isinstance(item.get("requested_eta"), str):
                        item["requested_eta"] = datetime.fromisoformat(item["requested_eta"])
                    if isinstance(item.get("expected_departure"), str):
                        item["expected_departure"] = datetime.fromisoformat(item["expected_departure"])
                    if isinstance(item.get("approved_start"), str):
                        item["approved_start"] = datetime.fromisoformat(item["approved_start"])
                    if isinstance(item.get("approved_end"), str):
                        item["approved_end"] = datetime.fromisoformat(item["approved_end"])
                    if isinstance(item.get("reviewed_at"), str):
                        item["reviewed_at"] = datetime.fromisoformat(item["reviewed_at"])
                    if isinstance(item.get("created_at"), str):
                        item["created_at"] = datetime.fromisoformat(item["created_at"])
                    if isinstance(item.get("updated_at"), str):
                        item["updated_at"] = datetime.fromisoformat(item["updated_at"])
                    item["submitted_at"] = item.get("created_at")

                    if isinstance(item.get("feasibility_details"), str):
                        try:
                            item["feasibility_details"] = json.loads(item["feasibility_details"])
                        except Exception:
                            item["feasibility_details"] = []
                    elif item.get("feasibility_details") is None:
                        item["feasibility_details"] = []

                    if isinstance(item.get("optimization_recommendation"), str):
                        try:
                            item["optimization_recommendation"] = json.loads(item["optimization_recommendation"])
                        except Exception:
                            item["optimization_recommendation"] = None

                    self.arrival_requests[item["id"]] = item

                # Proposals
                cur.execute("SELECT * FROM request_alternative_proposals")
                for r in cur.fetchall():
                    item = clean_row(r)
                    if isinstance(item.get("proposed_eta"), str):
                        item["proposed_eta"] = datetime.fromisoformat(item["proposed_eta"])
                    if isinstance(item.get("proposed_departure"), str):
                        item["proposed_departure"] = datetime.fromisoformat(item["proposed_departure"])
                    if isinstance(item.get("created_at"), str):
                        item["created_at"] = datetime.fromisoformat(item["created_at"])
                    if isinstance(item.get("responded_at"), str):
                        item["responded_at"] = datetime.fromisoformat(item["responded_at"])
                    self.proposals[item["id"]] = item

                # Audit logs
                cur.execute("SELECT * FROM request_audit_logs")
                for r in cur.fetchall():
                    item = clean_row(r)
                    if isinstance(item.get("created_at"), str):
                        item["created_at"] = datetime.fromisoformat(item["created_at"])
                    if isinstance(item.get("details"), str):
                        try:
                            item["details"] = json.loads(item["details"])
                        except Exception:
                            item["details"] = {}
                    elif item.get("details") is None:
                        item["details"] = {}
                    self.audit_logs[item["id"]] = item

                # Notifications
                cur.execute("SELECT * FROM customer_notifications")
                for r in cur.fetchall():
                    item = clean_row(r)
                    item["is_read"] = bool(item.get("is_read"))
                    if isinstance(item.get("created_at"), str):
                        item["created_at"] = datetime.fromisoformat(item["created_at"])
                    self.notifications[item["id"]] = item

        except Exception as e:
            logger.error(f"Error loading Customer entities from Supabase: {e}")

    def seed_defaults_if_empty(self):
        """Seed default demo shipping company ABC Shipping Pvt. Ltd. if database has no organizations."""
        if self.organizations:
            return

        now = datetime.now(timezone.utc)
        org_id = "org-abc-shipping-001"
        org = {
            "id": org_id,
            "name": "ABC Shipping Pvt. Ltd.",
            "company_email": "operations@abcshipping.com",
            "company_phone": "+65 6789 0123",
            "country": "Singapore",
            "address": "12 Marina Boulevard, Marina Bay Financial Centre Tower 3",
            "city": "Singapore",
            "state": "Singapore",
            "postal_code": "018982",
            "website": "https://abcshipping.example.com",
            "registration_number": "SG-201829471Z",
            "industry": "Commercial Container & Bulk Carrier Line",
            "created_at": now - timedelta(days=60),
            "updated_at": now - timedelta(days=60),
        }
        self.save_organization(org)

        # Admin user
        admin_user_id = "usr-abc-admin-001"
        admin_user = {
            "id": admin_user_id,
            "organization_id": org_id,
            "email": "john@abcshipping.com",
            "full_name": "John Doe",
            "role": "CUSTOMER_ADMIN",
            "password_hash": hash_customer_password("admin123"),
            "phone": "+65 9123 4567",
            "job_title": "Fleet Director",
            "created_at": now - timedelta(days=60),
            "updated_at": now - timedelta(days=60),
        }
        self.save_user(admin_user)

        # Secondary customer user
        user_2_id = "usr-abc-user-002"
        user_2 = {
            "id": user_2_id,
            "organization_id": org_id,
            "email": "sarah@abcshipping.com",
            "full_name": "Sarah Connor",
            "role": "CUSTOMER_USER",
            "password_hash": hash_customer_password("password123"),
            "phone": "+65 9876 5432",
            "job_title": "Vessel Operations Specialist",
            "created_at": now - timedelta(days=45),
            "updated_at": now - timedelta(days=45),
        }
        self.save_user(user_2)

        # Pre-seeded customer vessels
        vessels_seed = [
            {
                "id": "vsl-abc-001",
                "organization_id": org_id,
                "vessel_name": "MV Neptune",
                "imo_number": "IMO-9812345",
                "vessel_type": "Container",
                "length_loa": 320.0,
                "beam": 42.8,
                "draft": 13.5,
                "gross_tonnage": 95000,
                "deadweight_tonnage": 110000,
                "flag": "Singapore",
                "operator_name": "ABC Shipping Line",
                "cargo_type": "Container",
                "cargo_capacity": 8500,
                "hazardous_cargo": False,
                "special_handling_requirements": "Standard quay crane gang allocation required.",
                "created_at": now - timedelta(days=30),
                "updated_at": now - timedelta(days=30),
            },
            {
                "id": "vsl-abc-002",
                "organization_id": org_id,
                "vessel_name": "MV Ocean Star",
                "imo_number": "IMO-9765432",
                "vessel_type": "Container",
                "length_loa": 366.0,
                "beam": 48.2,
                "draft": 15.0,
                "gross_tonnage": 140000,
                "deadweight_tonnage": 145000,
                "flag": "Panama",
                "operator_name": "ABC Shipping Line",
                "cargo_type": "Container",
                "cargo_capacity": 14000,
                "hazardous_cargo": False,
                "special_handling_requirements": "Requires dual Super-STS gantry support.",
                "created_at": now - timedelta(days=25),
                "updated_at": now - timedelta(days=25),
            },
            {
                "id": "vsl-abc-003",
                "organization_id": org_id,
                "vessel_name": "MV Horizon",
                "imo_number": "IMO-9654321",
                "vessel_type": "Bulk Carrier",
                "length_loa": 225.0,
                "beam": 32.2,
                "draft": 12.0,
                "gross_tonnage": 43000,
                "deadweight_tonnage": 75000,
                "flag": "Liberia",
                "operator_name": "ABC Bulk Line",
                "cargo_type": "Bulk",
                "cargo_capacity": 72000,
                "hazardous_cargo": False,
                "special_handling_requirements": "Continuous bulk grab discharge conveyor.",
                "created_at": now - timedelta(days=20),
                "updated_at": now - timedelta(days=20),
            }
        ]
        for v in vessels_seed:
            self.save_vessel(v)

        logger.info("Successfully seeded demo Customer Organization (ABC Shipping) with vessels into Supabase.")

    # ── Persistence Methods ───────────────────────────────────────────────────

    def save_organization(self, org: Dict[str, Any]):
        self.organizations[org["id"]] = org
        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO customer_organizations
                    (id, name, company_email, company_phone, country, address, city, state, postal_code, website, registration_number, industry, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                        name = EXCLUDED.name,
                        company_email = EXCLUDED.company_email,
                        company_phone = EXCLUDED.company_phone,
                        country = EXCLUDED.country,
                        address = EXCLUDED.address,
                        city = EXCLUDED.city,
                        state = EXCLUDED.state,
                        postal_code = EXCLUDED.postal_code,
                        website = EXCLUDED.website,
                        registration_number = EXCLUDED.registration_number,
                        industry = EXCLUDED.industry,
                        updated_at = EXCLUDED.updated_at;
                """, (
                    org["id"], org["name"], org["company_email"], org["company_phone"],
                    org["country"], org["address"], org["city"], org.get("state"),
                    org["postal_code"], org.get("website"), org.get("registration_number"),
                    org.get("industry") or "Commercial Shipping & Maritime Freight",
                    org["created_at"], org["updated_at"]
                ), prepare=False)
        except Exception as e:
            logger.error(f"Error saving customer organization to Supabase: {e}")

    def save_user(self, user: Dict[str, Any]):
        self.users[user["id"]] = user
        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO customer_users
                    (id, organization_id, email, full_name, role, password_hash, phone, job_title, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                        organization_id = EXCLUDED.organization_id,
                        email = EXCLUDED.email,
                        full_name = EXCLUDED.full_name,
                        role = EXCLUDED.role,
                        password_hash = EXCLUDED.password_hash,
                        phone = EXCLUDED.phone,
                        job_title = EXCLUDED.job_title,
                        updated_at = EXCLUDED.updated_at;
                """, (
                    user["id"], user["organization_id"], user["email"].strip().lower(),
                    user["full_name"], user["role"], user["password_hash"],
                    user.get("phone"), user.get("job_title"),
                    user["created_at"], user["updated_at"]
                ), prepare=False)
        except Exception as e:
            logger.error(f"Error saving customer user to Supabase: {e}")

    def save_vessel(self, vessel: Dict[str, Any]):
        self.vessels[vessel["id"]] = vessel
        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO customer_vessels
                    (id, organization_id, vessel_name, imo_number, vessel_type, length_loa, beam, draft, gross_tonnage, deadweight_tonnage, flag, operator_name, cargo_type, cargo_capacity, hazardous_cargo, special_handling_requirements, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                        organization_id = EXCLUDED.organization_id,
                        vessel_name = EXCLUDED.vessel_name,
                        imo_number = EXCLUDED.imo_number,
                        vessel_type = EXCLUDED.vessel_type,
                        length_loa = EXCLUDED.length_loa,
                        beam = EXCLUDED.beam,
                        draft = EXCLUDED.draft,
                        gross_tonnage = EXCLUDED.gross_tonnage,
                        deadweight_tonnage = EXCLUDED.deadweight_tonnage,
                        flag = EXCLUDED.flag,
                        operator_name = EXCLUDED.operator_name,
                        cargo_type = EXCLUDED.cargo_type,
                        cargo_capacity = EXCLUDED.cargo_capacity,
                        hazardous_cargo = EXCLUDED.hazardous_cargo,
                        special_handling_requirements = EXCLUDED.special_handling_requirements,
                        updated_at = EXCLUDED.updated_at;
                """, (
                    vessel["id"], vessel["organization_id"], vessel["vessel_name"],
                    vessel["imo_number"], vessel["vessel_type"], float(vessel["length_loa"]),
                    float(vessel["beam"]), float(vessel["draft"]), int(vessel["gross_tonnage"]),
                    int(vessel["deadweight_tonnage"]), vessel["flag"], vessel.get("operator_name"),
                    vessel["cargo_type"], int(vessel["cargo_capacity"]),
                    bool(vessel.get("hazardous_cargo")),
                    vessel.get("special_handling_requirements"),
                    vessel["created_at"], vessel["updated_at"]
                ), prepare=False)
        except Exception as e:
            logger.error(f"Error saving customer vessel to Supabase: {e}")

    def delete_vessel(self, vessel_id: str):
        if vessel_id in self.vessels:
            del self.vessels[vessel_id]
        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM customer_vessels WHERE id = %s", (vessel_id,), prepare=False)
        except Exception as e:
            logger.error(f"Error deleting customer vessel from Supabase: {e}")

    def save_arrival_request(self, req: Dict[str, Any]):
        self.arrival_requests[req["id"]] = req
        conn = self.get_connection()
        if not conn:
            return
        try:
            feas_val = req.get("feasibility_details")
            if isinstance(feas_val, str):
                try:
                    feas_val = json.loads(feas_val)
                except Exception:
                    feas_val = []
            elif feas_val is None:
                feas_val = []

            opt_val = req.get("optimization_recommendation")
            if isinstance(opt_val, str):
                try:
                    opt_val = json.loads(opt_val)
                except Exception:
                    opt_val = None

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO arrival_requests
                    (id, request_code, organization_id, vessel_id, requested_eta, expected_departure, expected_port_stay_hours, origin, destination, cargo_type, cargo_quantity, hazardous_cargo, special_cargo_requirements, preferred_berth_id, required_cranes, tug_required, pilot_required, bunkering_required, other_services, customer_notes, special_instructions, status, feasibility_status, feasibility_details, optimization_status, optimization_recommendation, assigned_berth_id, approved_start, approved_end, reviewed_by, reviewed_at, rejection_reason, rejection_comment, changes_requested_notes, schedule_version_at_eval, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                        request_code = EXCLUDED.request_code,
                        organization_id = EXCLUDED.organization_id,
                        vessel_id = EXCLUDED.vessel_id,
                        requested_eta = EXCLUDED.requested_eta,
                        expected_departure = EXCLUDED.expected_departure,
                        expected_port_stay_hours = EXCLUDED.expected_port_stay_hours,
                        origin = EXCLUDED.origin,
                        destination = EXCLUDED.destination,
                        cargo_type = EXCLUDED.cargo_type,
                        cargo_quantity = EXCLUDED.cargo_quantity,
                        hazardous_cargo = EXCLUDED.hazardous_cargo,
                        special_cargo_requirements = EXCLUDED.special_cargo_requirements,
                        preferred_berth_id = EXCLUDED.preferred_berth_id,
                        required_cranes = EXCLUDED.required_cranes,
                        tug_required = EXCLUDED.tug_required,
                        pilot_required = EXCLUDED.pilot_required,
                        bunkering_required = EXCLUDED.bunkering_required,
                        other_services = EXCLUDED.other_services,
                        customer_notes = EXCLUDED.customer_notes,
                        special_instructions = EXCLUDED.special_instructions,
                        status = EXCLUDED.status,
                        feasibility_status = EXCLUDED.feasibility_status,
                        feasibility_details = EXCLUDED.feasibility_details,
                        optimization_status = EXCLUDED.optimization_status,
                        optimization_recommendation = EXCLUDED.optimization_recommendation,
                        assigned_berth_id = EXCLUDED.assigned_berth_id,
                        approved_start = EXCLUDED.approved_start,
                        approved_end = EXCLUDED.approved_end,
                        reviewed_by = EXCLUDED.reviewed_by,
                        reviewed_at = EXCLUDED.reviewed_at,
                        rejection_reason = EXCLUDED.rejection_reason,
                        rejection_comment = EXCLUDED.rejection_comment,
                        changes_requested_notes = EXCLUDED.changes_requested_notes,
                        schedule_version_at_eval = EXCLUDED.schedule_version_at_eval,
                        updated_at = EXCLUDED.updated_at;
                """, (
                    req["id"], req["request_code"], req["organization_id"], req["vessel_id"],
                    req["requested_eta"], req["expected_departure"],
                    float(req.get("expected_port_stay_hours") or 12.0), req["origin"], req["destination"],
                    req["cargo_type"], int(req["cargo_quantity"]),
                    bool(req.get("hazardous_cargo")),
                    req.get("special_cargo_requirements"), req.get("preferred_berth_id"),
                    int(req.get("required_cranes") or 2),
                    bool(req.get("tug_required", True)),
                    bool(req.get("pilot_required", True)),
                    bool(req.get("bunkering_required", False)),
                    req.get("other_services"), req.get("customer_notes"),
                    req.get("special_instructions"), req["status"],
                    req.get("feasibility_status", "PENDING"), Jsonb(feas_val),
                    req.get("optimization_status", "PENDING"),
                    Jsonb(opt_val) if opt_val else None,
                    req.get("assigned_berth_id"),
                    req.get("approved_start"), req.get("approved_end"),
                    req.get("reviewed_by"), req.get("reviewed_at"),
                    req.get("rejection_reason"), req.get("rejection_comment"),
                    req.get("changes_requested_notes"),
                    int(req.get("schedule_version_at_eval") or 1),
                    req["created_at"], req["updated_at"]
                ), prepare=False)
        except Exception as e:
            logger.error(f"Error saving arrival request to Supabase: {e}")

    def save_proposal(self, proposal: Dict[str, Any]):
        self.proposals[proposal["id"]] = proposal
        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO request_alternative_proposals
                    (id, request_id, proposed_eta, proposed_departure, proposed_berth_id, operational_reason, customer_response, customer_notes, proposed_by, created_at, responded_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT(id) DO UPDATE SET
                        request_id = EXCLUDED.request_id,
                        proposed_eta = EXCLUDED.proposed_eta,
                        proposed_departure = EXCLUDED.proposed_departure,
                        proposed_berth_id = EXCLUDED.proposed_berth_id,
                        operational_reason = EXCLUDED.operational_reason,
                        customer_response = EXCLUDED.customer_response,
                        customer_notes = EXCLUDED.customer_notes,
                        proposed_by = EXCLUDED.proposed_by,
                        responded_at = EXCLUDED.responded_at;
                """, (
                    proposal["id"], proposal["request_id"],
                    proposal["proposed_eta"], proposal["proposed_departure"],
                    proposal.get("proposed_berth_id"), proposal["operational_reason"],
                    proposal.get("customer_response") or "PENDING",
                    proposal.get("customer_notes"), proposal.get("proposed_by"),
                    proposal["created_at"], proposal.get("responded_at")
                ), prepare=False)
        except Exception as e:
            logger.error(f"Error saving proposal to Supabase: {e}")

    def add_audit_log(self, log_entry: Dict[str, Any]):
        log_id = log_entry.get("id") or str(uuid.uuid4())
        log_entry["id"] = log_id
        if "created_at" not in log_entry:
            log_entry["created_at"] = datetime.now(timezone.utc)
        self.audit_logs[log_id] = log_entry

        conn = self.get_connection()
        if not conn:
            return
        try:
            details_val = log_entry.get("details", {})
            if isinstance(details_val, str):
                try:
                    details_val = json.loads(details_val)
                except Exception:
                    details_val = {}

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO request_audit_logs
                    (id, request_id, actor_id, actor_name, actor_domain, action, previous_status, new_status, details, reason, comment, schedule_version, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING;
                """, (
                    log_id, log_entry["request_id"], log_entry["actor_id"],
                    log_entry["actor_name"], log_entry["actor_domain"], log_entry["action"],
                    log_entry.get("previous_status"), log_entry.get("new_status"),
                    Jsonb(details_val), log_entry.get("reason"),
                    log_entry.get("comment"), int(log_entry.get("schedule_version") or 1),
                    log_entry["created_at"]
                ), prepare=False)
        except Exception as e:
            logger.error(f"Error saving audit log to Supabase: {e}")

    def add_notification(self, notif: Dict[str, Any]):
        notif_id = notif.get("id") or str(uuid.uuid4())
        notif["id"] = notif_id
        if "created_at" not in notif:
            notif["created_at"] = datetime.now(timezone.utc)
        self.notifications[notif_id] = notif

        conn = self.get_connection()
        if not conn:
            return
        try:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO customer_notifications
                    (id, organization_id, user_id, title, message, notification_type, link_url, is_read, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        organization_id = EXCLUDED.organization_id,
                        user_id = EXCLUDED.user_id,
                        title = EXCLUDED.title,
                        message = EXCLUDED.message,
                        notification_type = EXCLUDED.notification_type,
                        link_url = EXCLUDED.link_url,
                        is_read = EXCLUDED.is_read;
                """, (
                    notif_id, notif["organization_id"], notif.get("user_id"),
                    notif["title"], notif["message"], notif["notification_type"],
                    notif.get("link_url"), bool(notif.get("is_read")),
                    notif["created_at"]
                ), prepare=False)
        except Exception as e:
            logger.error(f"Error saving notification to Supabase: {e}")

    def mark_notification_read(self, notif_id: str, org_id: str):
        if notif_id in self.notifications and self.notifications[notif_id].get("organization_id") == org_id:
            self.notifications[notif_id]["is_read"] = True
            conn = self.get_connection()
            if not conn:
                return
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE customer_notifications SET is_read = TRUE WHERE id = %s",
                        (notif_id,),
                        prepare=False
                    )
            except Exception as e:
                logger.error(f"Error marking notification read in Supabase: {e}")

    # ── Scoped Query Helpers ──────────────────────────────────────────────────

    def get_organization_vessels(self, org_id: str) -> List[Dict[str, Any]]:
        vessels = [v for v in self.vessels.values() if v.get("organization_id") == org_id]
        vessels.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return vessels

    def get_organization_requests(self, org_id: str) -> List[Dict[str, Any]]:
        reqs = [r for r in self.arrival_requests.values() if r.get("organization_id") == org_id]
        reqs.sort(key=lambda x: str(x.get("submitted_at", x.get("created_at", ""))), reverse=True)
        return reqs

    def get_organization_users(self, org_id: str) -> List[Dict[str, Any]]:
        users = [u for u in self.users.values() if u.get("organization_id") == org_id]
        users.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return users

    def get_organization_notifications(self, org_id: str) -> List[Dict[str, Any]]:
        notifs = [n for n in self.notifications.values() if n.get("organization_id") == org_id]
        notifs.sort(key=lambda x: str(x.get("created_at", "")), reverse=True)
        return notifs


# Singleton Customer Repository instance
customer_repo = CustomerRepository()
