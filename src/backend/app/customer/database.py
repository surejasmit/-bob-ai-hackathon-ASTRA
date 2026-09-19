import os
import uuid
import sqlite3
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any, Optional
from decimal import Decimal

from app.core.config import settings
from app.customer.auth import hash_customer_password

logger = logging.getLogger("naviops.customer.database")

CUSTOMER_SQLITE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
CUSTOMER_SQLITE_PATH = os.environ.get("CUSTOMER_SQLITE_PATH", os.path.join(CUSTOMER_SQLITE_DIR, "naviops_customer.db"))


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


def _init_customer_sqlite():
    """Ensure SQLite database and customer domain tables exist."""
    try:
        os.makedirs(CUSTOMER_SQLITE_DIR, exist_ok=True)
        with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=15.0) as conn:
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.executescript("""
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
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
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
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS customer_vessels (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
                    vessel_name TEXT NOT NULL,
                    imo_number TEXT NOT NULL,
                    vessel_type TEXT NOT NULL,
                    length_loa REAL NOT NULL,
                    beam REAL NOT NULL,
                    draft REAL NOT NULL,
                    gross_tonnage INTEGER NOT NULL,
                    deadweight_tonnage INTEGER NOT NULL,
                    flag TEXT NOT NULL,
                    operator_name TEXT,
                    cargo_type TEXT NOT NULL,
                    cargo_capacity INTEGER NOT NULL,
                    hazardous_cargo INTEGER NOT NULL DEFAULT 0,
                    special_handling_requirements TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(organization_id, imo_number)
                );

                CREATE TABLE IF NOT EXISTS arrival_requests (
                    id TEXT PRIMARY KEY,
                    request_code TEXT UNIQUE NOT NULL,
                    organization_id TEXT NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
                    vessel_id TEXT NOT NULL REFERENCES customer_vessels(id) ON DELETE CASCADE,
                    requested_eta TEXT NOT NULL,
                    expected_departure TEXT NOT NULL,
                    expected_port_stay_hours REAL NOT NULL DEFAULT 12.0,
                    origin TEXT NOT NULL,
                    destination TEXT NOT NULL,
                    cargo_type TEXT NOT NULL,
                    cargo_quantity INTEGER NOT NULL,
                    hazardous_cargo INTEGER NOT NULL DEFAULT 0,
                    special_cargo_requirements TEXT,
                    preferred_berth_id TEXT,
                    required_cranes INTEGER NOT NULL DEFAULT 2,
                    tug_required INTEGER NOT NULL DEFAULT 1,
                    pilot_required INTEGER NOT NULL DEFAULT 1,
                    bunkering_required INTEGER NOT NULL DEFAULT 0,
                    other_services TEXT,
                    customer_notes TEXT,
                    special_instructions TEXT,
                    status TEXT NOT NULL DEFAULT 'SUBMITTED',
                    feasibility_status TEXT DEFAULT 'PENDING',
                    feasibility_details TEXT DEFAULT '[]',
                    optimization_status TEXT DEFAULT 'PENDING',
                    optimization_recommendation TEXT,
                    assigned_berth_id TEXT,
                    approved_start TEXT,
                    approved_end TEXT,
                    reviewed_by TEXT,
                    reviewed_at TEXT,
                    rejection_reason TEXT,
                    rejection_comment TEXT,
                    changes_requested_notes TEXT,
                    schedule_version_at_eval INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS request_alternative_proposals (
                    id TEXT PRIMARY KEY,
                    request_id TEXT NOT NULL REFERENCES arrival_requests(id) ON DELETE CASCADE,
                    proposed_eta TEXT NOT NULL,
                    proposed_departure TEXT NOT NULL,
                    proposed_berth_id TEXT,
                    operational_reason TEXT NOT NULL,
                    customer_response TEXT DEFAULT 'PENDING',
                    customer_notes TEXT,
                    proposed_by TEXT,
                    created_at TEXT NOT NULL,
                    responded_at TEXT
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
                    details TEXT DEFAULT '{}',
                    reason TEXT,
                    comment TEXT,
                    schedule_version INTEGER DEFAULT 1,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS customer_notifications (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL REFERENCES customer_organizations(id) ON DELETE CASCADE,
                    user_id TEXT,
                    title TEXT NOT NULL,
                    message TEXT NOT NULL,
                    notification_type TEXT NOT NULL,
                    link_url TEXT,
                    is_read INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );
            """)
    except Exception as e:
        logger.error(f"Failed to initialize Customer SQLite schema: {e}")


class CustomerRepository:
    """
    Multi-tenant repository for the Customer Domain.
    Provides sub-millisecond in-memory responsiveness backed by persistent SQLite storage
    and Supabase PostgreSQL sync when active.
    """

    def __init__(self):
        self.organizations: Dict[str, Dict[str, Any]] = {}
        self.users: Dict[str, Dict[str, Any]] = {}
        self.vessels: Dict[str, Dict[str, Any]] = {}
        self.arrival_requests: Dict[str, Dict[str, Any]] = {}
        self.proposals: Dict[str, Dict[str, Any]] = {}
        self.audit_logs: Dict[str, Dict[str, Any]] = {}
        self.notifications: Dict[str, Dict[str, Any]] = {}

        _init_customer_sqlite()
        self._load_from_sqlite()
        self.seed_defaults_if_empty()

    def _load_from_sqlite(self):
        """Preload all customer entities from SQLite."""
        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.row_factory = sqlite3.Row

                # Organizations
                for r in conn.execute("SELECT * FROM customer_organizations").fetchall():
                    item = dict(r)
                    item["created_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"]
                    item["updated_at"] = datetime.fromisoformat(item["updated_at"]) if isinstance(item["updated_at"], str) else item["updated_at"]
                    self.organizations[item["id"]] = item

                # Users
                for r in conn.execute("SELECT * FROM customer_users").fetchall():
                    item = dict(r)
                    item["created_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"]
                    item["updated_at"] = datetime.fromisoformat(item["updated_at"]) if isinstance(item["updated_at"], str) else item["updated_at"]
                    self.users[item["id"]] = item

                # Vessels
                for r in conn.execute("SELECT * FROM customer_vessels").fetchall():
                    item = dict(r)
                    item["hazardous_cargo"] = bool(item.get("hazardous_cargo", 0))
                    item["created_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"]
                    item["updated_at"] = datetime.fromisoformat(item["updated_at"]) if isinstance(item["updated_at"], str) else item["updated_at"]
                    self.vessels[item["id"]] = item

                # Arrival requests
                import json
                for r in conn.execute("SELECT * FROM arrival_requests").fetchall():
                    item = dict(r)
                    item["hazardous_cargo"] = bool(item.get("hazardous_cargo", 0))
                    item["tug_required"] = bool(item.get("tug_required", 1))
                    item["pilot_required"] = bool(item.get("pilot_required", 1))
                    item["bunkering_required"] = bool(item.get("bunkering_required", 0))
                    item["requested_eta"] = datetime.fromisoformat(item["requested_eta"]) if isinstance(item["requested_eta"], str) else item["requested_eta"]
                    item["expected_departure"] = datetime.fromisoformat(item["expected_departure"]) if isinstance(item["expected_departure"], str) else item["expected_departure"]
                    item["submitted_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"]
                    item["created_at"] = item["submitted_at"]
                    item["updated_at"] = datetime.fromisoformat(item["updated_at"]) if isinstance(item["updated_at"], str) else item["updated_at"]
                    if item.get("approved_start") and isinstance(item["approved_start"], str):
                        item["approved_start"] = datetime.fromisoformat(item["approved_start"])
                    if item.get("approved_end") and isinstance(item["approved_end"], str):
                        item["approved_end"] = datetime.fromisoformat(item["approved_end"])
                    if item.get("reviewed_at") and isinstance(item["reviewed_at"], str):
                        item["reviewed_at"] = datetime.fromisoformat(item["reviewed_at"])

                    if isinstance(item.get("feasibility_details"), str):
                        try:
                            item["feasibility_details"] = json.loads(item["feasibility_details"])
                        except Exception:
                            item["feasibility_details"] = []
                    if isinstance(item.get("optimization_recommendation"), str):
                        try:
                            item["optimization_recommendation"] = json.loads(item["optimization_recommendation"])
                        except Exception:
                            item["optimization_recommendation"] = None

                    self.arrival_requests[item["id"]] = item

                # Proposals
                for r in conn.execute("SELECT * FROM request_alternative_proposals").fetchall():
                    item = dict(r)
                    item["proposed_eta"] = datetime.fromisoformat(item["proposed_eta"]) if isinstance(item["proposed_eta"], str) else item["proposed_eta"]
                    item["proposed_departure"] = datetime.fromisoformat(item["proposed_departure"]) if isinstance(item["proposed_departure"], str) else item["proposed_departure"]
                    item["created_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"]
                    if item.get("responded_at") and isinstance(item["responded_at"], str):
                        item["responded_at"] = datetime.fromisoformat(item["responded_at"])
                    self.proposals[item["id"]] = item

                # Audit logs
                for r in conn.execute("SELECT * FROM request_audit_logs").fetchall():
                    item = dict(r)
                    item["created_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"]
                    if isinstance(item.get("details"), str):
                        try:
                            item["details"] = json.loads(item["details"])
                        except Exception:
                            item["details"] = {}
                    self.audit_logs[item["id"]] = item

                # Notifications
                for r in conn.execute("SELECT * FROM customer_notifications").fetchall():
                    item = dict(r)
                    item["is_read"] = bool(item.get("is_read", 0))
                    item["created_at"] = datetime.fromisoformat(item["created_at"]) if isinstance(item["created_at"], str) else item["created_at"]
                    self.notifications[item["id"]] = item

        except Exception as e:
            logger.error(f"Error loading from Customer SQLite: {e}")

    def seed_defaults_if_empty(self):
        """Seed default demo shipping company ABC Shipping Pvt. Ltd."""
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

        logger.info("Successfully seeded demo Customer Organization (ABC Shipping) with vessels.")

    # ── Persistence Methods ───────────────────────────────────────────────────

    def save_organization(self, org: Dict[str, Any]):
        self.organizations[org["id"]] = org
        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.execute("""
                    INSERT INTO customer_organizations
                    (id, name, company_email, company_phone, country, address, city, state, postal_code, website, registration_number, industry, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        name = excluded.name,
                        company_email = excluded.company_email,
                        company_phone = excluded.company_phone,
                        country = excluded.country,
                        address = excluded.address,
                        city = excluded.city,
                        state = excluded.state,
                        postal_code = excluded.postal_code,
                        website = excluded.website,
                        registration_number = excluded.registration_number,
                        industry = excluded.industry,
                        updated_at = excluded.updated_at;
                """, (
                    org["id"], org["name"], org["company_email"], org["company_phone"],
                    org["country"], org["address"], org["city"], org.get("state"),
                    org["postal_code"], org.get("website"), org.get("registration_number"),
                    org.get("industry"),
                    org["created_at"].isoformat() if isinstance(org["created_at"], datetime) else str(org["created_at"]),
                    org["updated_at"].isoformat() if isinstance(org["updated_at"], datetime) else str(org["updated_at"]),
                ))
        except Exception as e:
            logger.error(f"Error saving customer organization to SQLite: {e}")

    def save_user(self, user: Dict[str, Any]):
        self.users[user["id"]] = user
        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.execute("""
                    INSERT INTO customer_users
                    (id, organization_id, email, full_name, role, password_hash, phone, job_title, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        organization_id = excluded.organization_id,
                        email = excluded.email,
                        full_name = excluded.full_name,
                        role = excluded.role,
                        password_hash = excluded.password_hash,
                        phone = excluded.phone,
                        job_title = excluded.job_title,
                        updated_at = excluded.updated_at;
                """, (
                    user["id"], user["organization_id"], user["email"].strip().lower(),
                    user["full_name"], user["role"], user["password_hash"],
                    user.get("phone"), user.get("job_title"),
                    user["created_at"].isoformat() if isinstance(user["created_at"], datetime) else str(user["created_at"]),
                    user["updated_at"].isoformat() if isinstance(user["updated_at"], datetime) else str(user["updated_at"]),
                ))
        except Exception as e:
            logger.error(f"Error saving customer user to SQLite: {e}")

    def save_vessel(self, vessel: Dict[str, Any]):
        self.vessels[vessel["id"]] = vessel
        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.execute("""
                    INSERT INTO customer_vessels
                    (id, organization_id, vessel_name, imo_number, vessel_type, length_loa, beam, draft, gross_tonnage, deadweight_tonnage, flag, operator_name, cargo_type, cargo_capacity, hazardous_cargo, special_handling_requirements, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        vessel_name = excluded.vessel_name,
                        imo_number = excluded.imo_number,
                        vessel_type = excluded.vessel_type,
                        length_loa = excluded.length_loa,
                        beam = excluded.beam,
                        draft = excluded.draft,
                        gross_tonnage = excluded.gross_tonnage,
                        deadweight_tonnage = excluded.deadweight_tonnage,
                        flag = excluded.flag,
                        operator_name = excluded.operator_name,
                        cargo_type = excluded.cargo_type,
                        cargo_capacity = excluded.cargo_capacity,
                        hazardous_cargo = excluded.hazardous_cargo,
                        special_handling_requirements = excluded.special_handling_requirements,
                        updated_at = excluded.updated_at;
                """, (
                    vessel["id"], vessel["organization_id"], vessel["vessel_name"],
                    vessel["imo_number"], vessel["vessel_type"], float(vessel["length_loa"]),
                    float(vessel["beam"]), float(vessel["draft"]), int(vessel["gross_tonnage"]),
                    int(vessel["deadweight_tonnage"]), vessel["flag"], vessel.get("operator_name"),
                    vessel["cargo_type"], int(vessel["cargo_capacity"]),
                    1 if vessel.get("hazardous_cargo") else 0,
                    vessel.get("special_handling_requirements"),
                    vessel["created_at"].isoformat() if isinstance(vessel["created_at"], datetime) else str(vessel["created_at"]),
                    vessel["updated_at"].isoformat() if isinstance(vessel["updated_at"], datetime) else str(vessel["updated_at"]),
                ))
        except Exception as e:
            logger.error(f"Error saving customer vessel to SQLite: {e}")

    def delete_vessel(self, vessel_id: str):
        if vessel_id in self.vessels:
            del self.vessels[vessel_id]
        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.execute("DELETE FROM customer_vessels WHERE id = ?", (vessel_id,))
        except Exception as e:
            logger.error(f"Error deleting customer vessel: {e}")

    def save_arrival_request(self, req: Dict[str, Any]):
        import json
        self.arrival_requests[req["id"]] = req
        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                feas_json = json.dumps(req.get("feasibility_details", []), default=str) if not isinstance(req.get("feasibility_details"), str) else req.get("feasibility_details")
                opt_json = json.dumps(req.get("optimization_recommendation"), default=str) if req.get("optimization_recommendation") and not isinstance(req.get("optimization_recommendation"), str) else req.get("optimization_recommendation")

                conn.execute("""
                    INSERT INTO arrival_requests
                    (id, request_code, organization_id, vessel_id, requested_eta, expected_departure, expected_port_stay_hours, origin, destination, cargo_type, cargo_quantity, hazardous_cargo, special_cargo_requirements, preferred_berth_id, required_cranes, tug_required, pilot_required, bunkering_required, other_services, customer_notes, special_instructions, status, feasibility_status, feasibility_details, optimization_status, optimization_recommendation, assigned_berth_id, approved_start, approved_end, reviewed_by, reviewed_at, rejection_reason, rejection_comment, changes_requested_notes, schedule_version_at_eval, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        status = excluded.status,
                        feasibility_status = excluded.feasibility_status,
                        feasibility_details = excluded.feasibility_details,
                        optimization_status = excluded.optimization_status,
                        optimization_recommendation = excluded.optimization_recommendation,
                        assigned_berth_id = excluded.assigned_berth_id,
                        approved_start = excluded.approved_start,
                        approved_end = excluded.approved_end,
                        reviewed_by = excluded.reviewed_by,
                        reviewed_at = excluded.reviewed_at,
                        rejection_reason = excluded.rejection_reason,
                        rejection_comment = excluded.rejection_comment,
                        changes_requested_notes = excluded.changes_requested_notes,
                        schedule_version_at_eval = excluded.schedule_version_at_eval,
                        requested_eta = excluded.requested_eta,
                        expected_departure = excluded.expected_departure,
                        expected_port_stay_hours = excluded.expected_port_stay_hours,
                        cargo_quantity = excluded.cargo_quantity,
                        customer_notes = excluded.customer_notes,
                        special_instructions = excluded.special_instructions,
                        updated_at = excluded.updated_at;
                """, (
                    req["id"], req["request_code"], req["organization_id"], req["vessel_id"],
                    req["requested_eta"].isoformat() if isinstance(req["requested_eta"], datetime) else str(req["requested_eta"]),
                    req["expected_departure"].isoformat() if isinstance(req["expected_departure"], datetime) else str(req["expected_departure"]),
                    float(req.get("expected_port_stay_hours", 12.0)), req["origin"], req["destination"],
                    req["cargo_type"], int(req["cargo_quantity"]),
                    1 if req.get("hazardous_cargo") else 0,
                    req.get("special_cargo_requirements"), req.get("preferred_berth_id"),
                    int(req.get("required_cranes", 2)),
                    1 if req.get("tug_required") else 0,
                    1 if req.get("pilot_required") else 0,
                    1 if req.get("bunkering_required") else 0,
                    req.get("other_services"), req.get("customer_notes"),
                    req.get("special_instructions"), req["status"],
                    req.get("feasibility_status", "PENDING"), feas_json,
                    req.get("optimization_status", "PENDING"), opt_json,
                    req.get("assigned_berth_id"),
                    req["approved_start"].isoformat() if req.get("approved_start") and isinstance(req["approved_start"], datetime) else req.get("approved_start"),
                    req["approved_end"].isoformat() if req.get("approved_end") and isinstance(req["approved_end"], datetime) else req.get("approved_end"),
                    req.get("reviewed_by"),
                    req["reviewed_at"].isoformat() if req.get("reviewed_at") and isinstance(req["reviewed_at"], datetime) else req.get("reviewed_at"),
                    req.get("rejection_reason"), req.get("rejection_comment"),
                    req.get("changes_requested_notes"),
                    int(req.get("schedule_version_at_eval", 1)),
                    req["created_at"].isoformat() if isinstance(req["created_at"], datetime) else str(req["created_at"]),
                    req["updated_at"].isoformat() if isinstance(req["updated_at"], datetime) else str(req["updated_at"]),
                ))
        except Exception as e:
            logger.error(f"Error saving arrival request to SQLite: {e}")

    def save_proposal(self, proposal: Dict[str, Any]):
        self.proposals[proposal["id"]] = proposal
        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.execute("""
                    INSERT INTO request_alternative_proposals
                    (id, request_id, proposed_eta, proposed_departure, proposed_berth_id, operational_reason, customer_response, customer_notes, proposed_by, created_at, responded_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        customer_response = excluded.customer_response,
                        customer_notes = excluded.customer_notes,
                        responded_at = excluded.responded_at;
                """, (
                    proposal["id"], proposal["request_id"],
                    proposal["proposed_eta"].isoformat() if isinstance(proposal["proposed_eta"], datetime) else str(proposal["proposed_eta"]),
                    proposal["proposed_departure"].isoformat() if isinstance(proposal["proposed_departure"], datetime) else str(proposal["proposed_departure"]),
                    proposal.get("proposed_berth_id"), proposal["operational_reason"],
                    proposal.get("customer_response", "PENDING"), proposal.get("customer_notes"),
                    proposal.get("proposed_by"),
                    proposal["created_at"].isoformat() if isinstance(proposal["created_at"], datetime) else str(proposal["created_at"]),
                    proposal["responded_at"].isoformat() if proposal.get("responded_at") and isinstance(proposal["responded_at"], datetime) else proposal.get("responded_at"),
                ))
        except Exception as e:
            logger.error(f"Error saving proposal to SQLite: {e}")

    def add_audit_log(self, log_entry: Dict[str, Any]):
        import json
        log_id = log_entry.get("id") or str(uuid.uuid4())
        log_entry["id"] = log_id
        if "created_at" not in log_entry:
            log_entry["created_at"] = datetime.now(timezone.utc)
        self.audit_logs[log_id] = log_entry

        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.execute("""
                    INSERT INTO request_audit_logs
                    (id, request_id, actor_id, actor_name, actor_domain, action, previous_status, new_status, details, reason, comment, schedule_version, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    log_id, log_entry["request_id"], log_entry["actor_id"],
                    log_entry["actor_name"], log_entry["actor_domain"], log_entry["action"],
                    log_entry.get("previous_status"), log_entry.get("new_status"),
                    json.dumps(log_entry.get("details", {}), default=str), log_entry.get("reason"),
                    log_entry.get("comment"), int(log_entry.get("schedule_version", 1)),
                    log_entry["created_at"].isoformat() if isinstance(log_entry["created_at"], datetime) else str(log_entry["created_at"]),
                ))
        except Exception as e:
            logger.error(f"Error saving audit log to SQLite: {e}")

    def add_notification(self, notif: Dict[str, Any]):
        notif_id = notif.get("id") or str(uuid.uuid4())
        notif["id"] = notif_id
        if "created_at" not in notif:
            notif["created_at"] = datetime.now(timezone.utc)
        self.notifications[notif_id] = notif

        try:
            with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                conn.execute("""
                    INSERT INTO customer_notifications
                    (id, organization_id, user_id, title, message, notification_type, link_url, is_read, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    notif_id, notif["organization_id"], notif.get("user_id"),
                    notif["title"], notif["message"], notif["notification_type"],
                    notif.get("link_url"), 1 if notif.get("is_read") else 0,
                    notif["created_at"].isoformat() if isinstance(notif["created_at"], datetime) else str(notif["created_at"]),
                ))
        except Exception as e:
            logger.error(f"Error saving notification to SQLite: {e}")

    def mark_notification_read(self, notif_id: str, org_id: str):
        if notif_id in self.notifications and self.notifications[notif_id].get("organization_id") == org_id:
            self.notifications[notif_id]["is_read"] = True
            try:
                with sqlite3.connect(CUSTOMER_SQLITE_PATH, timeout=10.0) as conn:
                    conn.execute("UPDATE customer_notifications SET is_read = 1 WHERE id = ?", (notif_id,))
            except Exception as e:
                logger.error(f"Error marking notification read in SQLite: {e}")

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
