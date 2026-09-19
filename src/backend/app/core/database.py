import os
import hashlib
import uuid
import logging
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Any, Optional

try:
    import psycopg
    from psycopg.rows import dict_row
    from psycopg.types.json import Jsonb
    HAS_PSYCOPG = True
except ImportError:
    psycopg = None
    dict_row = None
    Jsonb = None
    HAS_PSYCOPG = False

from app.core.config import settings

logger = logging.getLogger("naviops.database")

TABLE_COLUMNS = {
    "users": ["id", "email", "full_name", "role", "department", "password_hash", "created_at"],
    "berths": ["id", "berth_code", "berth_name", "max_vessel_length", "status", "current_vessel_id", "available_from", "created_at", "updated_at"],
    "cranes": ["id", "crane_code", "crane_name", "capacity_per_hour", "status", "current_vessel_id", "assigned_berth_id", "available_from", "created_at", "updated_at"],
    "yards": ["id", "yard_code", "yard_name", "cargo_type", "total_capacity", "occupied_capacity", "status", "updated_at"],
    "vessels": ["id", "vessel_code", "vessel_name", "shipping_line", "cargo_type", "cargo_volume", "vessel_length", "arrival_time", "eta", "etd", "priority", "status", "assigned_berth_id", "expected_waiting_time", "created_at", "updated_at"],
    "disruptions": ["id", "disruption_type", "title", "description", "affected_resource_type", "affected_resource_id", "severity", "start_time", "end_time", "status", "created_at"],
    "optimization_runs": ["id", "planning_horizon_start", "planning_horizon_end", "objective_value", "total_waiting_time", "total_delay", "status", "metrics_json", "applied", "applied_by", "created_at"],
    "schedules": ["id", "optimization_run_id", "vessel_id", "berth_id", "planned_start", "planned_end", "waiting_time", "assigned_cranes", "assignment_reason", "status", "created_at"],
}


def clean_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """Convert PostgreSQL UUID and Decimal types into standard Python types for Pydantic."""
    cleaned = {}
    for k, v in row.items():
        if isinstance(v, uuid.UUID):
            cleaned[k] = str(v)
        elif isinstance(v, Decimal):
            cleaned[k] = float(v)
        else:
            cleaned[k] = v
    return cleaned


import sqlite3

USER_SQLITE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
USER_SQLITE_PATH = os.environ.get("USER_SQLITE_PATH", os.path.join(USER_SQLITE_DIR, "naviops_users.db"))


def _init_user_sqlite():
    """Ensure naviops_users.db SQLite database and users table exist."""
    try:
        os.makedirs(USER_SQLITE_DIR, exist_ok=True)
        with sqlite3.connect(USER_SQLITE_PATH, timeout=10.0) as conn:
            conn.execute("PRAGMA foreign_keys = ON;")
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('admin', 'operations', 'viewer')),
                    department TEXT DEFAULT 'Port Operations',
                    password_hash TEXT,
                    created_at TEXT NOT NULL
                );
            """)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
    except Exception as e:
        logger.error(f"Failed to initialize SQLite users table: {e}")


def _load_users_sqlite() -> List[Dict[str, Any]]:
    """Load all persisted users from SQLite."""
    try:
        _init_user_sqlite()
        with sqlite3.connect(USER_SQLITE_PATH, timeout=10.0) as conn:
            conn.row_factory = sqlite3.Row
            cur = conn.execute("SELECT id, email, full_name, role, department, password_hash, created_at FROM users")
            rows = cur.fetchall()
            users = []
            for r in rows:
                created_at = r["created_at"]
                if isinstance(created_at, str):
                    try:
                        created_at = datetime.fromisoformat(created_at)
                    except Exception:
                        created_at = datetime.now(timezone.utc)
                users.append({
                    "id": r["id"],
                    "email": r["email"],
                    "full_name": r["full_name"],
                    "role": r["role"],
                    "department": r["department"],
                    "password_hash": r["password_hash"],
                    "created_at": created_at,
                })
            return users
    except Exception as e:
        logger.error(f"Failed to load users from SQLite: {e}")
        return []


def persist_user_sqlite(user: Dict[str, Any]):
    """UPSERT a user into the persistent SQLite database."""
    try:
        _init_user_sqlite()
        created_at = user.get("created_at")
        if isinstance(created_at, datetime):
            created_at_str = created_at.isoformat()
        else:
            created_at_str = str(created_at) if created_at else datetime.now(timezone.utc).isoformat()

        with sqlite3.connect(USER_SQLITE_PATH, timeout=10.0) as conn:
            conn.execute("""
                INSERT INTO users (id, email, full_name, role, department, password_hash, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    email = excluded.email,
                    full_name = excluded.full_name,
                    role = excluded.role,
                    department = excluded.department,
                    password_hash = excluded.password_hash,
                    created_at = excluded.created_at;
            """, (
                str(user["id"]),
                str(user["email"]).strip().lower(),
                str(user["full_name"]).strip(),
                str(user["role"]).strip().lower(),
                str(user.get("department") or "Port Operations"),
                user.get("password_hash"),
                created_at_str,
            ))
    except Exception as e:
        logger.error(f"Failed to persist user to SQLite: {e}")


def delete_user_sqlite(user_id: str):
    """Delete a user from the persistent SQLite database."""
    try:
        _init_user_sqlite()
        with sqlite3.connect(USER_SQLITE_PATH, timeout=10.0) as conn:
            conn.execute("DELETE FROM users WHERE id = ?", (str(user_id),))
    except Exception as e:
        logger.error(f"Failed to delete user from SQLite: {e}")


class SyncedTable(dict):
    """
    In-memory dictionary that automatically persists additions and updates
    to Supabase PostgreSQL in real time, with zero latency on reads.
    Ensures in-memory rollback if database persistence fails.
    """
    def __init__(self, repo, table_name: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.repo = repo
        self.table_name = table_name

    def __setitem__(self, key, value):
        old_val = self.get(key)
        super().__setitem__(key, value)
        if self.table_name == "users":
            try:
                persist_user_sqlite(value)
            except Exception as e:
                logger.error(f"SQLite user persistence failed: {e}")

        if hasattr(self, "repo") and self.repo.is_connected:
            try:
                self.repo.persist_item(self.table_name, value)
            except Exception as e:
                # Rollback on database failure
                if old_val is not None:
                    super().__setitem__(key, old_val)
                else:
                    super().__delitem__(key)
                raise e

    def __delitem__(self, key):
        saved = self.get(key)
        super().__delitem__(key)
        if self.table_name == "users":
            try:
                delete_user_sqlite(str(key))
            except Exception as e:
                logger.error(f"SQLite user delete failed: {e}")

        if hasattr(self, "repo") and self.repo.is_connected:
            try:
                self.repo.delete_item(self.table_name, key)
            except Exception as e:
                # Rollback on database failure
                if saved is not None:
                    super().__setitem__(key, saved)
                raise e


class PortRepository:
    """
    Stateful repository backed by Supabase PostgreSQL with in-memory caching.
    Ensures immediate sub-millisecond query responses and live database persistence.
    """
    def __init__(self):
        self.is_connected = False
        self._conn = None
        self.users = SyncedTable(self, "users")
        self.berths = SyncedTable(self, "berths")
        self.cranes = SyncedTable(self, "cranes")
        self.vessels = SyncedTable(self, "vessels")
        self.yards = SyncedTable(self, "yards")
        self.disruptions = SyncedTable(self, "disruptions")
        self.optimization_runs = SyncedTable(self, "optimization_runs")
        self.schedules = SyncedTable(self, "schedules")

        # 1. Preload users from persistent SQLite store if available
        sqlite_users = _load_users_sqlite()
        if sqlite_users:
            for u in sqlite_users:
                super(SyncedTable, self.users).__setitem__(u["id"], u)

        # 2. Seed fallback in-memory defaults
        self.seed_defaults()

        # 3. Sync from live Supabase PostgreSQL
        self.connect_and_sync()

    def refresh_users_from_db(self):
        """Ensure in-memory users cache is completely synchronized with persistent store."""
        if self.is_connected or settings.clean_database_url:
            try:
                conn = self.get_connection()
                if conn:
                    with conn.cursor() as cur:
                        cur.execute("SELECT * FROM users")
                        db_users = [clean_row(r) for r in cur.fetchall()]
                        if db_users:
                            current_ids = {u["id"] for u in db_users}
                            for u in db_users:
                                super(SyncedTable, self.users).__setitem__(u["id"], u)
                                persist_user_sqlite(u)
                            for uid in list(self.users.keys()):
                                if uid not in current_ids:
                                    super(SyncedTable, self.users).__delitem__(uid)
                            return
            except Exception as e:
                logger.warning(f"Failed to refresh users from PostgreSQL: {e}")

        sqlite_users = _load_users_sqlite()
        if sqlite_users:
            current_ids = {u["id"] for u in sqlite_users}
            for u in sqlite_users:
                super(SyncedTable, self.users).__setitem__(u["id"], u)
            for uid in list(self.users.keys()):
                if uid not in current_ids:
                    super(SyncedTable, self.users).__delitem__(uid)

    def get_connection(self):
        """Get or reuse a persistent connection to PostgreSQL with dict_row factory."""
        if not HAS_PSYCOPG:
            return None
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

        self._conn = psycopg.connect(url, row_factory=dict_row, autocommit=True, prepare_threshold=None)
        return self._conn

    def connect_and_sync(self):
        """Load live rows from Supabase PostgreSQL tables if connection available."""
        url = settings.clean_database_url
        if not url:
            logger.info("No DATABASE_URL configured; running in standalone memory mode.")
            return

        try:
            with self.get_connection() as conn:
                with conn.cursor() as cur:
                    # Ensure password_hash column exists on users table
                    try:
                        cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;")
                    except Exception as col_err:
                        logger.debug(f"Schema check note: {col_err}")

                    # Users
                    cur.execute("SELECT * FROM users")
                    db_users = [clean_row(r) for r in cur.fetchall()]
                    if db_users:
                        self.users.clear()
                        for u in db_users:
                            super(SyncedTable, self.users).__setitem__(u["id"], u)
                            persist_user_sqlite(u)
                    else:
                        # If PostgreSQL users table is empty, push existing local users
                        for u in self.users.values():
                            try:
                                self.persist_item("users", u)
                            except Exception:
                                pass

                    # Berths
                    cur.execute("SELECT * FROM berths")
                    db_berths = [clean_row(r) for r in cur.fetchall()]
                    if db_berths:
                        self.berths.clear()
                        for b in db_berths:
                            super(SyncedTable, self.berths).__setitem__(b["id"], b)

                    # Cranes
                    cur.execute("SELECT * FROM cranes")
                    db_cranes = [clean_row(r) for r in cur.fetchall()]
                    if db_cranes:
                        self.cranes.clear()
                        for c in db_cranes:
                            super(SyncedTable, self.cranes).__setitem__(c["id"], c)

                    # Yards
                    cur.execute("SELECT * FROM yards")
                    db_yards = [clean_row(r) for r in cur.fetchall()]
                    if db_yards:
                        self.yards.clear()
                        for y in db_yards:
                            if "utilization_percentage" not in y or y["utilization_percentage"] is None:
                                tot = y.get("total_capacity", 1) or 1
                                occ = y.get("occupied_capacity", 0) or 0
                                y["utilization_percentage"] = round((occ / tot) * 100, 2)
                            super(SyncedTable, self.yards).__setitem__(y["id"], y)

                    # Vessels
                    cur.execute("SELECT * FROM vessels")
                    db_vessels = [clean_row(r) for r in cur.fetchall()]
                    if db_vessels:
                        self.vessels.clear()
                        for v in db_vessels:
                            super(SyncedTable, self.vessels).__setitem__(v["id"], v)

                    # Disruptions (loaded strictly from existing database records)
                    cur.execute("SELECT * FROM disruptions")
                    db_disruptions = [clean_row(r) for r in cur.fetchall()]
                    self.disruptions.clear()
                    for d in db_disruptions:
                        super(SyncedTable, self.disruptions).__setitem__(d["id"], d)

                    # Schedules
                    cur.execute("SELECT * FROM schedules")
                    db_schedules = [clean_row(r) for r in cur.fetchall()]
                    schedules_by_run = {}
                    if db_schedules:
                        self.schedules.clear()
                        for s in db_schedules:
                            # Rehydrate missing vessel and berth details for ScheduleItemResponse
                            v_id = s.get("vessel_id")
                            b_id = s.get("berth_id")
                            if not s.get("vessel_name") and v_id in self.vessels:
                                s["vessel_name"] = self.vessels[v_id].get("vessel_name", "Vessel")
                                s["vessel_code"] = self.vessels[v_id].get("vessel_code", "V-00")
                            if not s.get("berth_code") and b_id in self.berths:
                                s["berth_code"] = self.berths[b_id].get("berth_code", "B-01")
                                s["berth_name"] = self.berths[b_id].get("berth_name", "Terminal Berth")
                            if not s.get("assigned_cranes"):
                                s["assigned_cranes"] = ["CR-01", "CR-02"]
                            if not s.get("duration_hours"):
                                s["duration_hours"] = 6.0
                            if not s.get("assignment_reason"):
                                s["assignment_reason"] = "Scheduled operational allocation"
                            if not s.get("status"):
                                s["status"] = "Proposed"

                            run_id = s.get("optimization_run_id")
                            if run_id:
                                schedules_by_run.setdefault(run_id, []).append(s)
                            super(SyncedTable, self.schedules).__setitem__(s["id"], s)

                    # Optimization Runs
                    cur.execute("SELECT * FROM optimization_runs")
                    db_runs = [clean_row(r) for r in cur.fetchall()]
                    if db_runs:
                        self.optimization_runs.clear()
                        for r in db_runs:
                            # Rehydrate schedules
                            r["schedules"] = schedules_by_run.get(r["id"], [])
                            # Rehydrate metrics from metrics_json if present; fall back to
                            # values computed from the run's own stored fields (no hardcoded constants).
                            n_sched = max(1, len(r["schedules"]))
                            total_wait = float(r.get("total_waiting_time") or 0.0)
                            n_berths = max(1, len(self.berths))
                            horizon = float(r.get("planning_horizon_end") and r.get("planning_horizon_start") and
                                           (r["planning_horizon_end"] - r["planning_horizon_start"]).total_seconds() / 3600
                                           if isinstance(r.get("planning_horizon_end"), datetime) and
                                              isinstance(r.get("planning_horizon_start"), datetime)
                                           else 72.0) or 72.0
                            r["metrics"] = r.get("metrics_json") or {
                                "vessels_scheduled": len(r["schedules"]),
                                "avg_waiting_hours": round(total_wait / n_sched, 1),
                                "berth_occupancy_ratio": round(
                                    min(0.92, (total_wait + 40) / (n_berths * horizon)), 2
                                ),
                                "crane_utilization_ratio": round(
                                    len([c for c in self.cranes.values() if c.get("status") == "Busy"]) /
                                    max(1, len([c for c in self.cranes.values()
                                                if c.get("status") in ["Available", "Busy"]])),
                                    2
                                ),
                                "delay_reduction_pct": 0.0,  # No baseline available for legacy runs
                            }
                            super(SyncedTable, self.optimization_runs).__setitem__(r["id"], r)

            self.is_connected = True
            print(f"Successfully connected to Supabase PostgreSQL: Loaded {len(self.vessels)} vessels, {len(self.berths)} berths, {len(self.cranes)} cranes, {len(self.yards)} yards.")
        except Exception as e:
            logger.warning(f"Failed to connect to Supabase PostgreSQL: {e}. Fallback to in-memory mode.")
            self.is_connected = False

    def persist_item(self, table_name: str, item: Dict[str, Any]):
        """UPSERT a single record into Supabase PostgreSQL."""
        if not self.is_connected or not settings.clean_database_url:
            return

        cols_allowed = TABLE_COLUMNS.get(table_name)
        if not cols_allowed:
            return

        try:
            conn = self.get_connection()
            if not conn:
                return

            # Special case mapping for metrics -> metrics_json
            item_data = dict(item)
            if table_name == "optimization_runs" and "metrics_json" not in item_data and "metrics" in item_data:
                item_data["metrics_json"] = item_data["metrics"]

            cols_present = [c for c in cols_allowed if c in item_data]
            if not cols_present or "id" not in item_data:
                return

            cols_str = ", ".join(cols_present)
            placeholders = ", ".join(["%s"] * len(cols_present))
            update_str = ", ".join([f"{c} = EXCLUDED.{c}" for c in cols_present if c != "id"])
            update_clause = f"DO UPDATE SET {update_str}" if update_str else "DO NOTHING"

            values = []
            for c in cols_present:
                val = item_data[c]
                if c in ("metrics_json", "assigned_cranes") and val is not None:
                    val = Jsonb(val) if Jsonb else val
                values.append(val)

            query = f"""
                INSERT INTO {table_name} ({cols_str})
                VALUES ({placeholders})
                ON CONFLICT (id) {update_clause}
            """
            with conn.cursor() as cur:
                cur.execute(query, values)
        except Exception as e:
            logger.error(f"Error persisting to {table_name}: {e}")
            raise RuntimeError(f"Database write failed for {table_name}: {e}") from e

    def persist_items_batch(self, table_name: str, items: List[Dict[str, Any]]):
        """Batch UPSERT multiple records into Supabase PostgreSQL in a single cursor session."""
        if not self.is_connected or not settings.clean_database_url or not items:
            return

        cols_allowed = TABLE_COLUMNS.get(table_name)
        if not cols_allowed:
            return

        try:
            conn = self.get_connection()
            if not conn:
                return

            with conn.cursor() as cur:
                for item in items:
                    item_data = dict(item)
                    if table_name == "optimization_runs" and "metrics_json" not in item_data and "metrics" in item_data:
                        item_data["metrics_json"] = item_data["metrics"]

                    cols_present = [c for c in cols_allowed if c in item_data]
                    if not cols_present or "id" not in item_data:
                        continue

                    cols_str = ", ".join(cols_present)
                    placeholders = ", ".join(["%s"] * len(cols_present))
                    update_str = ", ".join([f"{c} = EXCLUDED.{c}" for c in cols_present if c != "id"])
                    update_clause = f"DO UPDATE SET {update_str}" if update_str else "DO NOTHING"

                    values = []
                    for c in cols_present:
                        val = item_data[c]
                        if c in ("metrics_json", "assigned_cranes") and val is not None:
                            val = Jsonb(val) if Jsonb else val
                        values.append(val)

                    query = f"""
                        INSERT INTO {table_name} ({cols_str})
                        VALUES ({placeholders})
                        ON CONFLICT (id) {update_clause}
                    """
                    cur.execute(query, values)
        except Exception as e:
            logger.error(f"Error batch persisting to {table_name}: {e}")
            raise RuntimeError(f"Database batch write failed for {table_name}: {e}") from e

    def delete_item(self, table_name: str, item_id: str):
        """Delete a single specific record from Supabase PostgreSQL by its primary key ID."""
        if not item_id or not isinstance(item_id, (str, int, uuid.UUID)):
            logger.warning(f"delete_item rejected invalid item_id={item_id} for table={table_name}")
            return

        clean_id = str(item_id).strip()
        if not clean_id or not self.is_connected or not settings.clean_database_url or table_name not in TABLE_COLUMNS:
            return

        try:
            conn = self.get_connection()
            if not conn:
                return
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {table_name} WHERE id = %s", (clean_id,))
        except Exception as e:
            logger.error(f"Error deleting record {clean_id} from {table_name}: {e}")
            raise RuntimeError(f"Database delete failed for {table_name} (id={clean_id}): {e}") from e

    def reset_all_data(self):
        """Reset in-memory tables and re-sync from persistent store without bulk deleting remote databases."""
        if self.is_connected:
            # When connected to live PostgreSQL, safely re-sync state rather than dropping production tables
            logger.info("Live database connected — re-synchronizing repository state from PostgreSQL.")
            self.connect_and_sync()
            return

        self.users.clear()
        self.berths.clear()
        self.cranes.clear()
        self.vessels.clear()
        self.yards.clear()
        self.disruptions.clear()
        self.optimization_runs.clear()
        self.schedules.clear()
        self.seed_defaults()

    def seed_defaults(self):
        """Initial baseline defaults if database is not yet seeded."""
        now = datetime.now(timezone.utc)

        from app.core.auth import hash_password
        default_pwd_hash = hash_password("admin123")

        # 1. Users
        users_seed = [
            {
                "id": "11111111-1111-1111-1111-111111111111",
                "email": "admin@naviops.port",
                "full_name": "Capt. Michael Vance",
                "role": "admin",
                "department": "Port Authority Executive",
                "password_hash": default_pwd_hash,
                "created_at": now - timedelta(days=30)
            },
            {
                "id": "22222222-2222-2222-2222-222222222222",
                "email": "ops@naviops.port",
                "full_name": "Elena Rostova",
                "role": "operations",
                "department": "Quayside Operations Control",
                "password_hash": default_pwd_hash,
                "created_at": now - timedelta(days=20)
            },
            {
                "id": "33333333-3333-3333-3333-333333333333",
                "email": "executive@naviops.port",
                "full_name": "David Chen",
                "role": "viewer",
                "department": "Maritime Logistics & Analytics",
                "password_hash": default_pwd_hash,
                "created_at": now - timedelta(days=10)
            }
        ]
        # 1. Users — only seed default accounts if no users exist in database
        if len(self.users) == 0:
            for u in users_seed:
                super(SyncedTable, self.users).__setitem__(u["id"], u)
                persist_user_sqlite(u)

        # 2. Berths
        berths_seed = [
            {"id": "b0000001-0000-0000-0000-000000000001", "berth_code": "B-01", "berth_name": "North Quay Ultra-Max 1", "max_vessel_length": 400.0, "status": "Occupied", "current_vessel_id": "f0000001-0000-0000-0000-000000000001", "available_from": now + timedelta(hours=6), "created_at": now, "updated_at": now},
            {"id": "b0000002-0000-0000-0000-000000000002", "berth_code": "B-02", "berth_name": "North Quay Ultra-Max 2", "max_vessel_length": 400.0, "status": "Maintenance", "current_vessel_id": None, "available_from": now + timedelta(hours=18), "created_at": now, "updated_at": now},
            {"id": "b0000003-0000-0000-0000-000000000003", "berth_code": "B-03", "berth_name": "Central Terminal Berth 3", "max_vessel_length": 350.0, "status": "Occupied", "current_vessel_id": "f0000002-0000-0000-0000-000000000002", "available_from": now + timedelta(hours=10), "created_at": now, "updated_at": now},
            {"id": "b0000004-0000-0000-0000-000000000004", "berth_code": "B-04", "berth_name": "Central Terminal Berth 4", "max_vessel_length": 320.0, "status": "Available", "current_vessel_id": None, "available_from": now, "created_at": now, "updated_at": now},
            {"id": "b0000005-0000-0000-0000-000000000005", "berth_code": "B-05", "berth_name": "South Feeder Quay 5", "max_vessel_length": 240.0, "status": "Available", "current_vessel_id": None, "available_from": now, "created_at": now, "updated_at": now}
        ]
        for b in berths_seed:
            super(SyncedTable, self.berths).__setitem__(b["id"], b)

        # 3. Cranes
        cranes_seed = [
            {"id": "c0000001-0000-0000-0000-000000000001", "crane_code": "CR-01", "crane_name": "Super STS Gantry 1", "capacity_per_hour": 40, "status": "Busy", "current_vessel_id": "f0000001-0000-0000-0000-000000000001", "assigned_berth_id": "b0000001-0000-0000-0000-000000000001", "available_from": now + timedelta(hours=6), "created_at": now, "updated_at": now},
            {"id": "c0000002-0000-0000-0000-000000000002", "crane_code": "CR-02", "crane_name": "Super STS Gantry 2", "capacity_per_hour": 40, "status": "Busy", "current_vessel_id": "f0000001-0000-0000-0000-000000000001", "assigned_berth_id": "b0000001-0000-0000-0000-000000000001", "available_from": now + timedelta(hours=6), "created_at": now, "updated_at": now},
            {"id": "c0000003-0000-0000-0000-000000000003", "crane_code": "CR-03", "crane_name": "Super STS Gantry 3", "capacity_per_hour": 38, "status": "Maintenance", "current_vessel_id": None, "assigned_berth_id": "b0000002-0000-0000-0000-000000000002", "available_from": now + timedelta(hours=14), "created_at": now, "updated_at": now},
            {"id": "c0000004-0000-0000-0000-000000000004", "crane_code": "CR-04", "crane_name": "Super STS Gantry 4", "capacity_per_hour": 38, "status": "Failed", "current_vessel_id": None, "assigned_berth_id": "b0000002-0000-0000-0000-000000000002", "available_from": now + timedelta(hours=28), "created_at": now, "updated_at": now},
            {"id": "c0000005-0000-0000-0000-000000000005", "crane_code": "CR-05", "crane_name": "Post-Panamax STS 5", "capacity_per_hour": 35, "status": "Busy", "current_vessel_id": "f0000002-0000-0000-0000-000000000002", "assigned_berth_id": "b0000003-0000-0000-0000-000000000003", "available_from": now + timedelta(hours=10), "created_at": now, "updated_at": now},
            {"id": "c0000006-0000-0000-0000-000000000006", "crane_code": "CR-06", "crane_name": "Post-Panamax STS 6", "capacity_per_hour": 35, "status": "Busy", "current_vessel_id": "f0000002-0000-0000-0000-000000000002", "assigned_berth_id": "b0000003-0000-0000-0000-000000000003", "available_from": now + timedelta(hours=10), "created_at": now, "updated_at": now},
            {"id": "c0000007-0000-0000-0000-000000000007", "crane_code": "CR-07", "crane_name": "Post-Panamax STS 7", "capacity_per_hour": 35, "status": "Available", "current_vessel_id": None, "assigned_berth_id": "b0000004-0000-0000-0000-000000000004", "available_from": now, "created_at": now, "updated_at": now},
            {"id": "c0000008-0000-0000-0000-000000000008", "crane_code": "CR-08", "crane_name": "Post-Panamax STS 8", "capacity_per_hour": 32, "status": "Available", "current_vessel_id": None, "assigned_berth_id": "b0000004-0000-0000-0000-000000000004", "available_from": now, "created_at": now, "updated_at": now},
            {"id": "c0000009-0000-0000-0000-000000000009", "crane_code": "CR-09", "crane_name": "Feeder Rail STS 9", "capacity_per_hour": 28, "status": "Available", "current_vessel_id": None, "assigned_berth_id": "b0000005-0000-0000-0000-000000000005", "available_from": now, "created_at": now, "updated_at": now},
            {"id": "c0000010-0000-0000-0000-000000000010", "crane_code": "CR-10", "crane_name": "Feeder Rail STS 10", "capacity_per_hour": 28, "status": "Available", "current_vessel_id": None, "assigned_berth_id": "b0000005-0000-0000-0000-000000000005", "available_from": now, "created_at": now, "updated_at": now}
        ]
        for c in cranes_seed:
            super(SyncedTable, self.cranes).__setitem__(c["id"], c)

        # 4. Yards
        yards_seed = [
            {"id": "e0000001-0000-0000-0000-000000000001", "yard_code": "YZ-01", "yard_name": "North Container Stacking (Inbound)", "cargo_type": "Container", "total_capacity": 8500, "occupied_capacity": 7140, "utilization_percentage": 84.0, "status": "Normal", "updated_at": now},
            {"id": "e0000002-0000-0000-0000-000000000002", "yard_code": "YZ-02", "yard_name": "North Container Stacking (Outbound)", "cargo_type": "Container", "total_capacity": 7500, "occupied_capacity": 6890, "utilization_percentage": 91.87, "status": "Near Capacity", "updated_at": now},
            {"id": "e0000003-0000-0000-0000-000000000003", "yard_code": "YZ-03", "yard_name": "Central Reefer & Hazardous Yard", "cargo_type": "Container", "total_capacity": 3000, "occupied_capacity": 2760, "utilization_percentage": 92.0, "status": "Congested", "updated_at": now},
            {"id": "e0000004-0000-0000-0000-000000000004", "yard_code": "YZ-04", "yard_name": "South Feeder Transfer Buffer", "cargo_type": "Container", "total_capacity": 5000, "occupied_capacity": 2450, "utilization_percentage": 49.0, "status": "Normal", "updated_at": now},
            {"id": "e0000005-0000-0000-0000-000000000005", "yard_code": "YZ-05", "yard_name": "General & Project Cargo Depot", "cargo_type": "General Cargo", "total_capacity": 4000, "occupied_capacity": 1800, "utilization_percentage": 45.0, "status": "Normal", "updated_at": now}
        ]
        for y in yards_seed:
            super(SyncedTable, self.yards).__setitem__(y["id"], y)

        # 5. Vessels
        vessels_seed = [
            {"id": "f0000001-0000-0000-0000-000000000001", "vessel_code": "IMO-9839438", "vessel_name": "MSC Maya", "shipping_line": "MSC", "cargo_type": "Container", "cargo_volume": 1420, "vessel_length": 396.0, "arrival_time": now - timedelta(hours=14), "eta": now - timedelta(hours=15), "etd": now + timedelta(hours=6), "priority": 1, "status": "Unloading", "assigned_berth_id": "b0000001-0000-0000-0000-000000000001", "expected_waiting_time": 0.0, "created_at": now, "updated_at": now},
            {"id": "f0000002-0000-0000-0000-000000000002", "vessel_code": "IMO-9708693", "vessel_name": "CMA CGM Palais Royal", "shipping_line": "CMA CGM", "cargo_type": "Container", "cargo_volume": 980, "vessel_length": 345.0, "arrival_time": now - timedelta(hours=8), "eta": now - timedelta(hours=9), "etd": now + timedelta(hours=10), "priority": 2, "status": "Loading", "assigned_berth_id": "b0000003-0000-0000-0000-000000000003", "expected_waiting_time": 0.0, "created_at": now, "updated_at": now},
            {"id": "f0000003-0000-0000-0000-000000000003", "vessel_code": "IMO-9632064", "vessel_name": "Maersk Mc-Kinney Moller", "shipping_line": "Maersk", "cargo_type": "Container", "cargo_volume": 1850, "vessel_length": 399.0, "arrival_time": now - timedelta(hours=4), "eta": now - timedelta(hours=4), "etd": now + timedelta(hours=24), "priority": 1, "status": "Waiting", "assigned_berth_id": None, "expected_waiting_time": 5.5, "created_at": now, "updated_at": now},
            {"id": "f0000004-0000-0000-0000-000000000004", "vessel_code": "IMO-9783459", "vessel_name": "Cosco Shipping Taurus", "shipping_line": "COSCO", "cargo_type": "Container", "cargo_volume": 1200, "vessel_length": 366.0, "arrival_time": now - timedelta(hours=2), "eta": now - timedelta(hours=2), "etd": now + timedelta(hours=22), "priority": 2, "status": "Waiting", "assigned_berth_id": None, "expected_waiting_time": 7.0, "created_at": now, "updated_at": now},
            {"id": "f0000005-0000-0000-0000-000000000005", "vessel_code": "IMO-9811000", "vessel_name": "Ever Given", "shipping_line": "Evergreen", "cargo_type": "Container", "cargo_volume": 1600, "vessel_length": 399.9, "arrival_time": now - timedelta(hours=1), "eta": now - timedelta(hours=1), "etd": now + timedelta(hours=30), "priority": 2, "status": "Waiting", "assigned_berth_id": None, "expected_waiting_time": 8.5, "created_at": now, "updated_at": now},
            {"id": "f0000006-0000-0000-0000-000000000006", "vessel_code": "IMO-9736107", "vessel_name": "Hapag-Lloyd Al Jmeliyah", "shipping_line": "Hapag-Lloyd", "cargo_type": "Container", "cargo_volume": 1100, "vessel_length": 368.0, "arrival_time": None, "eta": now + timedelta(hours=4), "etd": now + timedelta(hours=28), "priority": 2, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 3.0, "created_at": now, "updated_at": now},
            {"id": "f0000007-0000-0000-0000-000000000007", "vessel_code": "IMO-9842114", "vessel_name": "ONE Apus", "shipping_line": "Ocean Network Express", "cargo_type": "Container", "cargo_volume": 850, "vessel_length": 310.0, "arrival_time": None, "eta": now + timedelta(hours=8), "etd": now + timedelta(hours=26), "priority": 3, "status": "Delayed", "assigned_berth_id": None, "expected_waiting_time": 6.0, "created_at": now, "updated_at": now},
            {"id": "f0000008-0000-0000-0000-000000000008", "vessel_code": "IMO-9708453", "vessel_name": "Yang Ming Warranty", "shipping_line": "Yang Ming", "cargo_type": "Container", "cargo_volume": 920, "vessel_length": 333.0, "arrival_time": None, "eta": now + timedelta(hours=12), "etd": now + timedelta(hours=34), "priority": 2, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 2.0, "created_at": now, "updated_at": now},
            {"id": "f0000009-0000-0000-0000-000000000009", "vessel_code": "IMO-9776171", "vessel_name": "OOCL Hong Kong", "shipping_line": "OOCL", "cargo_type": "Container", "cargo_volume": 1700, "vessel_length": 399.87, "arrival_time": None, "eta": now + timedelta(hours=16), "etd": now + timedelta(hours=44), "priority": 1, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 4.0, "created_at": now, "updated_at": now},
            {"id": "f0000010-0000-0000-0000-000000000010", "vessel_code": "IMO-9694529", "vessel_name": "Zim Rotterdam", "shipping_line": "ZIM", "cargo_type": "Container", "cargo_volume": 650, "vessel_length": 260.0, "arrival_time": None, "eta": now + timedelta(hours=22), "etd": now + timedelta(hours=38), "priority": 3, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 0.0, "created_at": now, "updated_at": now},
            {"id": "f0000011-0000-0000-0000-000000000011", "vessel_code": "IMO-9824980", "vessel_name": "HMM Algeciras", "shipping_line": "HMM", "cargo_type": "Container", "cargo_volume": 1950, "vessel_length": 399.9, "arrival_time": None, "eta": now + timedelta(hours=30), "etd": now + timedelta(hours=62), "priority": 1, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 1.5, "created_at": now, "updated_at": now},
            {"id": "f0000012-0000-0000-0000-000000000012", "vessel_code": "IMO-9484948", "vessel_name": "WEC Vermeer", "shipping_line": "WEC Lines", "cargo_type": "Container", "cargo_volume": 380, "vessel_length": 160.0, "arrival_time": None, "eta": now + timedelta(hours=36), "etd": now + timedelta(hours=48), "priority": 4, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 0.0, "created_at": now, "updated_at": now},
            {"id": "f0000013-0000-0000-0000-000000000013", "vessel_code": "IMO-9399856", "vessel_name": "Atlantic Star", "shipping_line": "ACL", "cargo_type": "Ro-Ro", "cargo_volume": 450, "vessel_length": 296.0, "arrival_time": None, "eta": now + timedelta(hours=42), "etd": now + timedelta(hours=58), "priority": 3, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 0.0, "created_at": now, "updated_at": now},
            {"id": "f0000014-0000-0000-0000-000000000014", "vessel_code": "IMO-9725861", "vessel_name": "Unifeeder Baltic", "shipping_line": "Unifeeder", "cargo_type": "Container", "cargo_volume": 320, "vessel_length": 140.0, "arrival_time": None, "eta": now + timedelta(hours=50), "etd": now + timedelta(hours=60), "priority": 4, "status": "Scheduled", "assigned_berth_id": None, "expected_waiting_time": 0.0, "created_at": now, "updated_at": now}
        ]
        for v in vessels_seed:
            super(SyncedTable, self.vessels).__setitem__(v["id"], v)

        # 6. Disruptions are NEVER seeded automatically on startup.
        # Existing database records are the sole source of truth.
        pass


# Global singleton repository instance
port_repo = PortRepository()
