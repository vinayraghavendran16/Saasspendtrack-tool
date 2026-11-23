#!/usr/bin/env python3
"""Apply production schema and proposed migrations to an isolated in-memory SQLite DB."""
import pathlib
import sqlite3

root = pathlib.Path(__file__).resolve().parents[1]
conn = sqlite3.connect(":memory:")
conn.execute("PRAGMA foreign_keys=ON")
conn.executescript((root / "schema.sql").read_text())
conn.execute("INSERT INTO accounts (id,owner_email,created_at) VALUES (?,?,?)", ("account-1", "owner@example.com", 1))
migration = (root / "migrations/001_workspace_ai_consent.sql").read_text()
conn.executescript(migration)
conn.executescript(migration)  # safe to rerun
assert conn.execute("SELECT enabled FROM workspace_ai_settings WHERE account_id='account-1'").fetchone() is None
conn.execute("INSERT INTO workspace_ai_settings (account_id,enabled,consent_version,changed_by,changed_at) VALUES (?,?,?,?,?)", ("account-1", 0, None, None, 1))
assert conn.execute("SELECT enabled FROM workspace_ai_settings WHERE account_id='account-1'").fetchone()[0] == 0
for bad_enabled in (-1, 2):
    try:
        conn.execute("INSERT INTO workspace_ai_settings (account_id,enabled) VALUES (?,?)", ("invalid-" + str(bad_enabled), bad_enabled))
    except sqlite3.IntegrityError:
        pass
    else:
        raise AssertionError("Invalid AI consent value unexpectedly accepted")
try:
    conn.execute("INSERT INTO workspace_ai_settings (account_id,enabled) VALUES (?,?)", ("missing-account", 1))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Orphan workspace AI settings accepted")
conn.execute("INSERT INTO workspace_ai_consent_events (id,account_id,actor_email,enabled,consent_version,created_at) VALUES (?,?,?,?,?,?)", ("event-1", "account-1", "owner@example.com", 1, "workspace-ai-v1", 2))
assert conn.execute("SELECT COUNT(*) FROM workspace_ai_consent_events").fetchone()[0] == 1
print("PASS: isolated SQLite schema and AI consent migration (idempotency, disabled default, constraints, event audit)")
