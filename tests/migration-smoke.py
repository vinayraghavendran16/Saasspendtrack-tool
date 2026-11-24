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
# Version migration must preserve existing data and establish an unambiguous CAS revision.
conn.execute("INSERT INTO app_data (email,data,updated_at) VALUES (?,?,?)", ("owner@example.com", '{"subscriptions":[{"name":"test"}]}', 1))
conn.executescript((root / "migrations/002_app_data_version.sql").read_text())
old = conn.execute("SELECT data,version FROM app_data WHERE email=?", ("owner@example.com",)).fetchone()
assert old[1] == 1 and '"test"' in old[0]
result = conn.execute("UPDATE app_data SET data=?,version=version+1 WHERE email=? AND version=? RETURNING version", ('{"updated":true}', "owner@example.com", 1)).fetchone()
assert result == (2,)
assert conn.execute("UPDATE app_data SET data=?,version=version+1 WHERE email=? AND version=? RETURNING version", ('{"stale":true}', "owner@example.com", 1)).fetchone() is None
assert conn.execute("SELECT data,version FROM app_data WHERE email=?", ("owner@example.com",)).fetchone() == ('{"updated":true}', 2)
print("PASS: isolated SQLite AI consent + data version migrations, legacy data preservation, CAS conflict")


# Execute the actual invitation SQL from the Pages endpoint in local SQLite.
import re
accept_source = (root / "functions/api/account/accept.js").read_text()
batch_source = accept_source.split("const results = await env.DB.batch([", 1)[1].split("]);", 1)[0]
tick = chr(96)
pattern = r"env\.DB\.prepare\(\s*(" + tick + "[^" + tick + "]*" + tick + r"|'[^']*')\s*\)\.bind"
literals = re.findall(pattern, batch_source, re.S)
statements = [literal[1:-1] for literal in literals]
assert len(statements) == 5, "Invite batch must contain all five SQL guards"
assert "UPDATE invites SET used=1" in statements[0]
assert "changes()=1" in statements[1]
assert "COUNT(*) FROM memberships" in statements[3]
assert "ELSE NULL" in statements[4]

conn.execute("INSERT INTO users (email,created_at,trial_ends_at,status) VALUES (?,?,?,?)",
             ("owner@example.com", 1, 100000, "active"))
conn.execute("INSERT INTO accounts (id,owner_email,created_at) VALUES (?,?,?)",
             ("account-2", "other-owner@example.com", 1))
conn.commit()
ts = 1000

def add_invite(token_hash, email, account_id="account-1"):
    conn.execute("INSERT INTO invites (token_hash,account_id,email,role,invited_by,expires_at,used,created_at) "
                 "VALUES (?,?,?,?,?,?,0,?)",
                 (token_hash, account_id, email, "member", "owner@example.com", 100000, ts))
    conn.commit()

def claim_invite(token_hash, email, sid, account_id="account-1"):
    args = [
        (token_hash, ts),
        (sid, email, ts, 100000),
        (email, ts, 100000, "active", None),
        (email, account_id, "member", "owner@example.com", ts,
         account_id, 50, email, account_id),
        (email, account_id, sid),
    ]
    with conn:
        results = [conn.execute(sql, params).fetchall()
                   for sql, params in zip(statements, args)]
    return results

add_invite("invite-1", "new@example.com")
result = claim_invite("invite-1", "new@example.com", "session-1")
assert result[0] == [("invite-1",)]
assert conn.execute("SELECT used FROM invites WHERE token_hash='invite-1'").fetchone() == (1,)
assert conn.execute("SELECT account_id,status FROM memberships WHERE email='new@example.com'").fetchone() == ("account-1", "active")
assert conn.execute("SELECT COUNT(*) FROM sessions WHERE id='session-1'").fetchone() == (1,)

try:
    claim_invite("invite-1", "new@example.com", "replay-session")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Replay succeeded despite the atomic token guard")
assert conn.execute("SELECT COUNT(*) FROM sessions WHERE id='replay-session'").fetchone() == (0,)

conn.execute("INSERT INTO memberships (email,account_id,role,status,created_at) VALUES (?,?,?,?,?)",
             ("cross@example.com", "account-2", "member", "active", ts))
add_invite("invite-cross", "cross@example.com")
try:
    claim_invite("invite-cross", "cross@example.com", "cross-session")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Cross-workspace invite activated a foreign member")
assert conn.execute("SELECT used FROM invites WHERE token_hash='invite-cross'").fetchone() == (0,)
assert conn.execute("SELECT COUNT(*) FROM sessions WHERE id='cross-session'").fetchone() == (0,)

add_invite("invite-fail", "retry@example.com")
conn.execute("""CREATE TRIGGER fail_session_insert BEFORE INSERT ON sessions
                BEGIN SELECT RAISE(ABORT, 'injected session failure'); END""")
conn.commit()
try:
    claim_invite("invite-fail", "retry@example.com", "failure-session")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Injected session failure should abort the transaction")
conn.execute("DROP TRIGGER fail_session_insert")
conn.commit()
assert conn.execute("SELECT used FROM invites WHERE token_hash='invite-fail'").fetchone() == (0,)
assert conn.execute("SELECT COUNT(*) FROM memberships WHERE email='retry@example.com'").fetchone() == (0,)

for i in range(49):  # accepted member above + 49 = 50 active seats
    conn.execute("INSERT INTO memberships (email,account_id,role,status,created_at) VALUES (?,?,?,?,?)",
                 (f"seat{i}@example.com", "account-1", "member", "active", ts))
conn.commit()
add_invite("invite-cap", "overcap@example.com")
try:
    claim_invite("invite-cap", "overcap@example.com", "overcap-session")
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Transactional seat cap failed")
assert conn.execute("SELECT used FROM invites WHERE token_hash='invite-cap'").fetchone() == (0,)
assert conn.execute("SELECT COUNT(*) FROM memberships WHERE account_id='account-1' AND status='active'").fetchone() == (50,)
assert conn.execute("SELECT COUNT(*) FROM sessions WHERE id='overcap-session'").fetchone() == (0,)
print("PASS: invitation SQL transaction, replay prevention, workspace isolation and seat cap")
