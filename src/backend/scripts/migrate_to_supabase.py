import os
import sys
import json
import sqlite3
from datetime import datetime, timezone
import psycopg
from psycopg.rows import dict_row

# Ensure app imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from app.core.config import settings

DATABASE_URL = settings.clean_database_url
print("Supabase connection URL configured.")

conn = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True, prepare_threshold=None)
cur = conn.cursor()

print("=" * 60)
print("PHASE 7: CREATING / UPDATING SUPABASE POSTGRESQL SCHEMA")
print("=" * 60)

# 1. Ensure password_hash exists on users table
cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;")

# 2. Customer Organizations
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
""")
print("Created/verified table: customer_organizations")

# 3. Customer Users
cur.execute("""
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
""")
print("Created/verified table: customer_users")

# 4. Customer Vessels
cur.execute("""
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
""")
print("Created/verified table: customer_vessels")

# 5. Arrival Requests
cur.execute("""
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
""")
print("Created/verified table: arrival_requests")

# 6. Request Alternative Proposals
cur.execute("""
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
""")
print("Created/verified table: request_alternative_proposals")

# 7. Request Audit Logs
cur.execute("""
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
""")
print("Created/verified table: request_audit_logs")

# 8. Customer Notifications
cur.execute("""
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
print("Created/verified table: customer_notifications")

# Indexes
cur.execute("CREATE INDEX IF NOT EXISTS idx_customer_users_email ON customer_users(email);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_customer_users_org ON customer_users(organization_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_customer_vessels_org ON customer_vessels(organization_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_arrival_requests_org ON arrival_requests(organization_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_arrival_requests_status ON arrival_requests(status);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_request_proposals_req ON request_alternative_proposals(request_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_request_audit_logs_req ON request_audit_logs(request_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_customer_notifications_org ON customer_notifications(organization_id);")
cur.execute("CREATE INDEX IF NOT EXISTS idx_customer_notifications_read ON customer_notifications(organization_id, is_read);")
print("Verified all foreign keys and performance indexes.")

print("\n" + "=" * 60)
print("PHASE 8 & 9: DATA MIGRATION (IDEMPOTENT UPSERT)")
print("=" * 60)

# Migrate users from naviops_users.db
user_db_path = os.path.join(os.path.dirname(__file__), "..", "data", "naviops_users.db")
if os.path.exists(user_db_path):
    u_conn = sqlite3.connect(user_db_path)
    u_conn.row_factory = sqlite3.Row
    users = [dict(r) for r in u_conn.cursor().execute("SELECT * FROM users").fetchall()]
    u_conn.close()
    print(f"Read {len(users)} users from SQLite naviops_users.db")
    
    migrated_users = 0
    for u in users:
        cur.execute("""
            INSERT INTO users (id, email, full_name, role, department, password_hash, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                department = EXCLUDED.department,
                password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash);
        """, (
            str(u["id"]),
            str(u["email"]).strip().lower(),
            str(u["full_name"]).strip(),
            str(u["role"]).strip().lower(),
            str(u.get("department") or "Port Operations"),
            u.get("password_hash"),
            u.get("created_at") or datetime.now(timezone.utc).isoformat()
        ))
        migrated_users += 1
    print(f"Successfully migrated/upserted {migrated_users} users to Supabase PostgreSQL.")

# Migrate Customer Domain from naviops_customer.db
cust_db_path = os.path.join(os.path.dirname(__file__), "..", "data", "naviops_customer.db")
if os.path.exists(cust_db_path):
    c_conn = sqlite3.connect(cust_db_path)
    c_conn.row_factory = sqlite3.Row
    c_cur = c_conn.cursor()
    
    # 1. customer_organizations
    orgs = [dict(r) for r in c_cur.execute("SELECT * FROM customer_organizations").fetchall()]
    print(f"Migrating {len(orgs)} customer_organizations...")
    for o in orgs:
        cur.execute("""
            INSERT INTO customer_organizations (id, name, company_email, company_phone, country, address, city, state, postal_code, website, registration_number, industry, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
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
            o["id"], o["name"], o["company_email"], o["company_phone"],
            o["country"], o["address"], o["city"], o.get("state"),
            o["postal_code"], o.get("website"), o.get("registration_number"),
            o.get("industry") or "Commercial Shipping & Maritime Freight",
            o["created_at"], o["updated_at"]
        ))
    print(f"Done: {len(orgs)} organizations.")
    
    # 2. customer_users
    c_users = [dict(r) for r in c_cur.execute("SELECT * FROM customer_users").fetchall()]
    print(f"Migrating {len(c_users)} customer_users...")
    for cu in c_users:
        cur.execute("""
            INSERT INTO customer_users (id, organization_id, email, full_name, role, password_hash, phone, job_title, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                organization_id = EXCLUDED.organization_id,
                email = EXCLUDED.email,
                full_name = EXCLUDED.full_name,
                role = EXCLUDED.role,
                password_hash = EXCLUDED.password_hash,
                phone = EXCLUDED.phone,
                job_title = EXCLUDED.job_title,
                updated_at = EXCLUDED.updated_at;
        """, (
            cu["id"], cu["organization_id"], cu["email"].strip().lower(),
            cu["full_name"], cu["role"], cu["password_hash"],
            cu.get("phone"), cu.get("job_title"),
            cu["created_at"], cu["updated_at"]
        ))
    print(f"Done: {len(c_users)} customer users.")

    # 3. customer_vessels
    c_vessels = [dict(r) for r in c_cur.execute("SELECT * FROM customer_vessels").fetchall()]
    print(f"Migrating {len(c_vessels)} customer_vessels...")
    for v in c_vessels:
        cur.execute("""
            INSERT INTO customer_vessels (id, organization_id, vessel_name, imo_number, vessel_type, length_loa, beam, draft, gross_tonnage, deadweight_tonnage, flag, operator_name, cargo_type, cargo_capacity, hazardous_cargo, special_handling_requirements, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
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
            v["id"], v["organization_id"], v["vessel_name"], v["imo_number"],
            v["vessel_type"], float(v["length_loa"]), float(v["beam"]), float(v["draft"]),
            int(v["gross_tonnage"]), int(v["deadweight_tonnage"]), v["flag"],
            v.get("operator_name"), v["cargo_type"], int(v["cargo_capacity"]),
            bool(v.get("hazardous_cargo", 0)), v.get("special_handling_requirements"),
            v["created_at"], v["updated_at"]
        ))
    print(f"Done: {len(c_vessels)} customer vessels.")

    # 4. arrival_requests
    reqs = [dict(r) for r in c_cur.execute("SELECT * FROM arrival_requests").fetchall()]
    print(f"Migrating {len(reqs)} arrival_requests...")
    for ar in reqs:
        feas_json = ar.get("feasibility_details")
        if isinstance(feas_json, str):
            try:
                feas_val = json.loads(feas_json)
            except Exception:
                feas_val = []
        else:
            feas_val = feas_json or []

        opt_json = ar.get("optimization_recommendation")
        if isinstance(opt_json, str):
            try:
                opt_val = json.loads(opt_json)
            except Exception:
                opt_val = None
        else:
            opt_val = opt_json

        from psycopg.types.json import Jsonb
        cur.execute("""
            INSERT INTO arrival_requests (
                id, request_code, organization_id, vessel_id, requested_eta, expected_departure,
                expected_port_stay_hours, origin, destination, cargo_type, cargo_quantity,
                hazardous_cargo, special_cargo_requirements, preferred_berth_id, required_cranes,
                tug_required, pilot_required, bunkering_required, other_services, customer_notes,
                special_instructions, status, feasibility_status, feasibility_details,
                optimization_status, optimization_recommendation, assigned_berth_id,
                approved_start, approved_end, reviewed_by, reviewed_at, rejection_reason,
                rejection_comment, changes_requested_notes, schedule_version_at_eval,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (id) DO UPDATE SET
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
            ar["id"], ar["request_code"], ar["organization_id"], ar["vessel_id"],
            ar["requested_eta"], ar["expected_departure"], float(ar.get("expected_port_stay_hours") or 12.0),
            ar["origin"], ar["destination"], ar["cargo_type"], int(ar["cargo_quantity"]),
            bool(ar.get("hazardous_cargo", 0)), ar.get("special_cargo_requirements"),
            ar.get("preferred_berth_id"), int(ar.get("required_cranes") or 2),
            bool(ar.get("tug_required", 1)), bool(ar.get("pilot_required", 1)), bool(ar.get("bunkering_required", 0)),
            ar.get("other_services"), ar.get("customer_notes"), ar.get("special_instructions"),
            ar.get("status") or "SUBMITTED", ar.get("feasibility_status") or "PENDING",
            Jsonb(feas_val), ar.get("optimization_status") or "PENDING",
            Jsonb(opt_val) if opt_val else None, ar.get("assigned_berth_id"),
            ar.get("approved_start"), ar.get("approved_end"), ar.get("reviewed_by"),
            ar.get("reviewed_at"), ar.get("rejection_reason"), ar.get("rejection_comment"),
            ar.get("changes_requested_notes"), int(ar.get("schedule_version_at_eval") or 1),
            ar["created_at"], ar["updated_at"]
        ))
    print(f"Done: {len(reqs)} arrival requests.")

    # 5. request_alternative_proposals
    props = [dict(r) for r in c_cur.execute("SELECT * FROM request_alternative_proposals").fetchall()]
    print(f"Migrating {len(props)} request_alternative_proposals...")
    for p in props:
        cur.execute("""
            INSERT INTO request_alternative_proposals (id, request_id, proposed_eta, proposed_departure, proposed_berth_id, operational_reason, customer_response, customer_notes, proposed_by, created_at, responded_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
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
            p["id"], p["request_id"], p["proposed_eta"], p["proposed_departure"],
            p.get("proposed_berth_id"), p["operational_reason"], p.get("customer_response") or "PENDING",
            p.get("customer_notes"), p.get("proposed_by"), p["created_at"], p.get("responded_at")
        ))
    print(f"Done: {len(props)} alternative proposals.")

    # 6. request_audit_logs
    logs = [dict(r) for r in c_cur.execute("SELECT * FROM request_audit_logs").fetchall()]
    print(f"Migrating {len(logs)} request_audit_logs...")
    from psycopg.types.json import Jsonb
    for l in logs:
        details_json = l.get("details")
        if isinstance(details_json, str):
            try:
                details_val = json.loads(details_json)
            except Exception:
                details_val = {}
        else:
            details_val = details_json or {}

        cur.execute("""
            INSERT INTO request_audit_logs (id, request_id, actor_id, actor_name, actor_domain, action, previous_status, new_status, details, reason, comment, schedule_version, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING;
        """, (
            l["id"], l["request_id"], l["actor_id"], l["actor_name"], l["actor_domain"],
            l["action"], l.get("previous_status"), l.get("new_status"),
            Jsonb(details_val), l.get("reason"), l.get("comment"),
            int(l.get("schedule_version") or 1), l["created_at"]
        ))
    print(f"Done: {len(logs)} request audit logs.")

    # 7. customer_notifications
    notifs = [dict(r) for r in c_cur.execute("SELECT * FROM customer_notifications").fetchall()]
    print(f"Migrating {len(notifs)} customer_notifications...")
    for n in notifs:
        cur.execute("""
            INSERT INTO customer_notifications (id, organization_id, user_id, title, message, notification_type, link_url, is_read, created_at)
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
            n["id"], n["organization_id"], n.get("user_id"), n["title"],
            n["message"], n["notification_type"], n.get("link_url"),
            bool(n.get("is_read", 0)), n["created_at"]
        ))
    print(f"Done: {len(notifs)} customer notifications.")
    c_conn.close()

print("\n" + "=" * 60)
print("PHASE 10: DATA VALIDATION (SQLITE VS SUPABASE)")
print("=" * 60)

validation_results = {}
check_tables = [
    ("users", user_db_path, "users"),
    ("customer_organizations", cust_db_path, "customer_organizations"),
    ("customer_users", cust_db_path, "customer_users"),
    ("customer_vessels", cust_db_path, "customer_vessels"),
    ("arrival_requests", cust_db_path, "arrival_requests"),
    ("request_alternative_proposals", cust_db_path, "request_alternative_proposals"),
    ("request_audit_logs", cust_db_path, "request_audit_logs"),
    ("customer_notifications", cust_db_path, "customer_notifications"),
]

all_passed = True
for pg_table, sq_path, sq_table in check_tables:
    cur.execute(f'SELECT COUNT(*) FROM "{pg_table}"')
    pg_count = cur.fetchone()["count"]
    
    if os.path.exists(sq_path):
        sq_c = sqlite3.connect(sq_path)
        sq_count = sq_c.cursor().execute(f'SELECT COUNT(*) FROM "{sq_table}"').fetchone()[0]
        sq_c.close()
    else:
        sq_count = 0
        
    status = "PASS" if pg_count >= sq_count else "FAIL"
    if status == "FAIL":
        all_passed = False
    print(f"Table: {pg_table:<30} | SQLite: {sq_count:4} | Supabase: {pg_count:4} | Validation: {status}")
    validation_results[pg_table] = {
        "sqlite_rows": sq_count,
        "supabase_rows": pg_count,
        "status": status
    }

with open("scripts/migration_validation.json", "w") as f:
    json.dump(validation_results, f, indent=2)

print("\nValidation complete. All tables verified:", all_passed)
conn.close()
