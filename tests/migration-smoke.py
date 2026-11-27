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
pattern = r"env\.DB\.prepare\(\s*(" + tick + "[^" + tick + "]*" + tick + r"|'[^']*')\s*,?\s*\)\.bind"
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

# Analytics schema: isolated real SQLite, repeatable migration, constraints.
usage_db = sqlite3.connect(":memory:")
usage_migration = (root / "migrations/005_usage_events.sql").read_text()
usage_db.executescript(usage_migration)
usage_db.executescript(usage_migration)
usage_db.execute("INSERT INTO usage_events VALUES (?,?,?,?,?)", ("event-a","account-a","actor-a","login",100))
usage_db.execute("INSERT OR IGNORE INTO usage_events VALUES (?,?,?,?,?)", ("event-a","account-a","actor-a","login",100))
usage_db.execute("INSERT INTO usage_events VALUES (?,?,?,?,?)", ("event-b","account-b","actor-b","login",200))
assert usage_db.execute("SELECT COUNT(*) FROM usage_events WHERE account_id=?", ("account-a",)).fetchone() == (1,)
try:
    usage_db.execute("INSERT INTO usage_events VALUES (?,?,?,?,?)", ("invalid","account-a","actor-a","arbitrary",100))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Unknown analytics event accepted")
assert usage_db.execute("SELECT COUNT(*) FROM usage_events").fetchone() == (2,)
print("PASS: usage schema, idempotent migration, duplicate event prevention and event allowlist")

# Real SQLite enforcement of AI lock and payload-free audit schema.
for name in ("006_ai_policy_lock.sql","007_ai_egress_audit.sql","008_ai_audit_correlation.sql"):
    conn.executescript((root / "migrations" / name).read_text())
conn.execute("INSERT INTO workspace_ai_locks VALUES (?,?,?)",("account-1",1,100))
try:
    conn.execute("UPDATE workspace_ai_settings SET enabled=1 WHERE account_id=?",("account-1",))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Locked workspace accepted AI enablement")
conn.execute("UPDATE workspace_ai_locks SET locked=0 WHERE account_id=?",("account-1",))
assert conn.execute("SELECT enabled FROM workspace_ai_settings WHERE account_id=?",("account-1",)).fetchone()==(0,)
conn.execute("INSERT INTO ai_egress_audit(id,account_id,operation,outcome,occurred_at,request_id) VALUES (?,?,?,?,?,?)",("audit-1","account-1","messages","authorized",100,"request-1"))
assert conn.execute("SELECT request_id FROM ai_egress_audit WHERE account_id=?",("account-1",)).fetchone()==("request-1",)
print("PASS: AI lock database enforcement, unlock remains disabled, audit correlation")


# Full legacy-to-release migration chain on a separate synthetic database.
legacy = sqlite3.connect(":memory:")
legacy.execute("PRAGMA foreign_keys=ON")
legacy.executescript((root / "schema.sql").read_text())
for i, currency in enumerate(("USD", "EUR", "INR")):
    email = f"migration-{i}@example.invalid"
    account = f"migration-account-{i}"
    legacy.execute("INSERT INTO users(email,created_at,trial_ends_at,status,currency) VALUES (?,?,?,?,?)", (email,1,100000,"active",currency))
    legacy.execute("INSERT INTO accounts(id,owner_email,created_at) VALUES (?,?,?)",(account,email,1))
    legacy.execute("INSERT INTO memberships(email,account_id,role,status,created_at) VALUES (?,?,?,?,?)",(email,account,"owner","active",1))
    import json
    payload = json.dumps({"subscriptions":[{"name":"Synthetic","cost":99.50,"currency":currency,"cycle":"yearly"}],"settings":{"currency":currency}})
    legacy.execute("INSERT INTO app_data(email,data,updated_at) VALUES (?,?,?)",(email,payload,1))
    legacy.execute("INSERT INTO sessions VALUES (?,?,?,?)",(f"synthetic-session-{i}",email,1,100000))
    legacy.execute("INSERT INTO login_tokens VALUES (?,?,?,?)",(f"synthetic-token-{i}",email,100000,0))
    legacy.execute("INSERT INTO email_log VALUES (?,?,?)",(email,"welcome",1))
    legacy.execute("INSERT INTO rate_limits VALUES (?,?,?)",(f"synthetic-limit-{i}",1,1))
    legacy.execute("INSERT INTO invites(token_hash,account_id,email,expires_at,created_at) VALUES (?,?,?,?,?)",(f"synthetic-invite-{i}",account,f"invite-{i}@example.invalid",100000,1))
legacy.commit()
tables = [r[0] for r in legacy.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
def snapshot(db, columns):
    return {t: sorted(db.execute("SELECT "+",".join(cols)+" FROM "+t).fetchall(),key=repr) for t,cols in columns.items()}
columns = {t:[r[1] for r in legacy.execute("PRAGMA table_info("+t+")")] for t in tables}
before = snapshot(legacy,columns)
files = sorted((root / "migrations").glob("*.sql"))
assert [p.name[:3] for p in files] == [f"{i:03d}" for i in range(1,42)]
for migration in files:
    legacy.executescript(migration.read_text())
    assert snapshot(legacy,columns)==before, migration.name+" changed legacy data"
    assert legacy.execute("PRAGMA integrity_check").fetchone()==("ok",)
    assert not legacy.execute("PRAGMA foreign_key_check").fetchall()
assert legacy.execute("SELECT DISTINCT version FROM app_data").fetchall()==[(1,)]
assert legacy.execute("SELECT COUNT(*) FROM workspace_ai_settings").fetchone()==(0,)
# Case status audit must not violate vendor_case_events.actor_email NOT NULL.
legacy.execute("INSERT INTO vendor_cases(account_id,id,vendor_id,direction,severity,status,title,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)", ("migration-account-0","case-audit-1","vendor-1","outbound","medium","open","Synthetic audit case","migration-0@example.invalid",1,1))
legacy.execute("UPDATE vendor_cases SET status='awaiting_vendor',updated_at=2 WHERE account_id=? AND id=?", ("migration-account-0","case-audit-1"))
audit = legacy.execute("SELECT actor_email,kind,detail FROM vendor_case_events WHERE account_id=? AND case_id=?", ("migration-account-0","case-audit-1")).fetchone()
assert audit == ("system@saasspendtrack.internal","status_changed",'{"from":"open","to":"awaiting_vendor"}'), audit
print("PASS: case status audit trigger respects NOT NULL actor and records explicit system principal")

print("PASS: full 001–041 synthetic migration chain, exact legacy columns and rows, native currencies, integrity and default-deny AI")


# Offline recovery drill: actual SQLite backup API, isolated temporary files.
# This is not a Cloudflare D1 restore or a production RPO/RTO measurement.
import tempfile
from pathlib import Path
with tempfile.TemporaryDirectory(prefix="sst-synthetic-recovery-") as temp:
    backup_path = Path(temp) / "snapshot.sqlite"
    all_tables = [r[0] for r in legacy.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    all_columns = {t:[r[1] for r in legacy.execute("PRAGMA table_info("+t+")")] for t in all_tables}
    legacy.commit()
    expected = snapshot(legacy, all_columns)
    schema = legacy.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").fetchall()
    with sqlite3.connect(backup_path) as backup:
        legacy.backup(backup)
    backup.close()
    # Simulate a subsequent committed write, which must not silently appear in the older snapshot.
    legacy.execute("UPDATE app_data SET version=version+1 WHERE email=?", ("migration-0@example.invalid",))
    legacy.commit()
    restored = sqlite3.connect(":memory:")
    source = sqlite3.connect(backup_path.as_uri()+"?mode=ro", uri=True)
    source.backup(restored)
    source.close()
    assert restored.execute("PRAGMA integrity_check").fetchone()==("ok",)
    assert not restored.execute("PRAGMA foreign_key_check").fetchall()
    assert snapshot(restored, all_columns)==expected
    assert restored.execute("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").fetchall()==schema
    assert restored.execute("SELECT version FROM app_data WHERE email=?", ("migration-0@example.invalid",)).fetchone()==(1,)
    assert legacy.execute("SELECT version FROM app_data WHERE email=?", ("migration-0@example.invalid",)).fetchone()==(2,)
    restored.close()
print("PASS: synthetic SQLite backup/restore, exact schema and rows, integrity, post-snapshot write boundary")

# The freeze protects the snapshot table across both deployed save protocols.
recovery = root / "scripts" / "recovery"
freeze = (recovery / "freeze-workspace-writes.sql").read_text()
unfreeze = (recovery / "unfreeze-workspace-writes.sql").read_text()
email = "migration-0@example.invalid"
writes = [
    ("INSERT INTO app_data (email, data, updated_at) VALUES (?, '{}', 1) "
     "ON CONFLICT(email) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at", (email,)),
    ("INSERT OR IGNORE INTO app_data (email, data, updated_at, version) "
     "VALUES (?, '{}', 1, 1)", ("new-recovery@example.invalid",)),
    ("UPDATE app_data SET data='{}', version=version+1 WHERE email=? AND version=2", (email,)),
    ("DELETE FROM app_data WHERE email=?", (email,)),
]
expected = snapshot(legacy, all_columns)
legacy.executescript(freeze)
legacy.executescript(freeze)
for statement, args in writes:
    try:
        legacy.execute(statement, args)
    except sqlite3.IntegrityError as error:
        assert str(error) == "workspace_writes_frozen"
    else:
        raise AssertionError("Workspace mutation succeeded during recovery freeze")
assert snapshot(legacy, all_columns) == expected
legacy.executescript(unfreeze)
legacy.executescript(unfreeze)
assert legacy.execute(
    "UPDATE app_data SET version=version+1 WHERE email=? AND version=1", (email,)
).rowcount == 0
assert legacy.execute(
    "UPDATE app_data SET version=version+1 WHERE email=? AND version=2", (email,)
).rowcount == 1
print("PASS: recovery freeze rejects legacy and revision-checked writes, and guarded saves resume after unfreeze")

# Exercise the actual scheduled expiry SQL against a payment committed after selection.
cron_source = (root / "functions/api/cron/tick.js").read_text()
expiry_sql = cron_source.split('env.DB.prepare("UPDATE users SET status=', 1)[1].split('").bind(u.email,t)', 1)[0]
expiry_sql = "UPDATE users SET status=" + expiry_sql
email = "expiry-race@example.invalid"
legacy.execute("INSERT INTO users(email,created_at,trial_ends_at,status) VALUES (?,?,?,?)", (email,1,10,"trial"))
legacy.execute("UPDATE users SET status='active',paid_at=20 WHERE email=?", (email,))
assert legacy.execute(expiry_sql,(email,20)).fetchone() is None
assert legacy.execute("SELECT status,paid_at FROM users WHERE email=?", (email,)).fetchone()==("active",20)
legacy.execute("UPDATE users SET status='trial',paid_at=NULL WHERE email=?", (email,))
assert legacy.execute(expiry_sql,(email,20)).fetchone()==(email,)
assert legacy.execute("SELECT status FROM users WHERE email=?", (email,)).fetchone()==("expired",)
print("PASS: scheduled trial expiry cannot overwrite a committed payment")

# Verify retry ceiling using the actual payment queue SQL.
queue_source = (root / "functions/_shared/payment-notifications.js").read_text()
retire_sql = queue_source.split('env.DB.prepare("UPDATE payment_notification_outbox SET status=\'dead\'',1)[1].split('").bind(now)',1)[0]
retire_sql = "UPDATE payment_notification_outbox SET status='dead'" + retire_sql
claim_sql = queue_source.split('env.DB.prepare("UPDATE payment_notification_outbox SET status=\'leased\'',1)[1].split('").bind(lease,id,claimAt,claimAt)',1)[0]
claim_sql = "UPDATE payment_notification_outbox SET status='leased'" + claim_sql
for payment_id, attempts, lease_until in (("pay_retry_ceiling",5,10),("pay_retry_allowed",4,10),("pay_live_lease",5,100)):
    legacy.execute("INSERT INTO payment_ledger(payment_id,link_id,customer_email,tier,amount,currency,recorded_at,entitlement_until) VALUES (?,?,?,?,?,?,?,?)",(payment_id,"plink_fixture","retry@example.invalid","founding",149900,"USD",1,200))
    legacy.execute("UPDATE payment_notification_outbox SET status='leased',attempts=?,lease_until=? WHERE payment_id=?", (attempts,lease_until,payment_id))
legacy.execute(retire_sql,(20,))
assert legacy.execute("SELECT status,attempts FROM payment_notification_outbox WHERE payment_id='pay_retry_ceiling'").fetchone()==("dead",5)
assert legacy.execute(claim_sql,(140,"pay_retry_ceiling",20,20)).fetchone() is None
assert legacy.execute(claim_sql,(140,"pay_retry_allowed",20,20)).fetchone()==(5,)
assert legacy.execute(claim_sql,(140,"pay_live_lease",20,20)).fetchone() is None
assert legacy.execute("SELECT status FROM payment_notification_outbox WHERE payment_id='pay_live_lease'").fetchone()==("leased",)
print("PASS: exhausted payment notifications are retired without a sixth attempt; active leases preserved")

# Replay and rollback rehearsal using the actual webhook's two SQL statements.
from datetime import datetime, timezone
webhook = (root / "functions/api/razorpay/webhook.js").read_text()
def webhook_sql(prefix):
    return prefix + webhook.split("env.DB.prepare('" + prefix,1)[1].split("').bind(",1)[0].replace("\\'", "'")
ledger_sql = webhook_sql("INSERT INTO payment_ledger ")
user_sql = webhook_sql("INSERT INTO users ")
def ms(year,month,day):
    return int(datetime(year,month,day,tzinfo=timezone.utc).timestamp()*1000)
email="payment-replay@example.invalid"
def apply_payment(pid,t):
    with legacy:
        legacy.execute(ledger_sql,(pid,"plink_fixture",email,"founding",149900,"USD",t,t,t,email))
        legacy.execute(user_sql,(email,t,t,"active","annual-usd",t,pid,149900,"USD"))
legacy.commit()
apply_payment("pay_replay_1",ms(2024,2,29))
assert legacy.execute("SELECT entitlement_until FROM payment_ledger WHERE payment_id='pay_replay_1'").fetchone()==(ms(2025,2,28),)
try:
    apply_payment("pay_replay_1",ms(2024,3,1))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Duplicate payment was accepted")
assert legacy.execute("SELECT COUNT(*) FROM payment_notification_outbox WHERE payment_id='pay_replay_1'").fetchone()==(1,)
apply_payment("pay_replay_2",ms(2024,3,1))
assert legacy.execute("SELECT MAX(entitlement_until) FROM payment_ledger WHERE customer_email=?",(email,)).fetchone()==(ms(2026,2,28),)
legacy.execute("CREATE TRIGGER fixture_payment_failure BEFORE UPDATE ON users WHEN NEW.email='payment-replay@example.invalid' BEGIN SELECT RAISE(ABORT,'fixture failure'); END")
legacy.commit()
try:
    apply_payment("pay_rollback_fixture",ms(2024,3,2))
except sqlite3.IntegrityError:
    pass
else:
    raise AssertionError("Injected payment transaction failure was accepted")
assert legacy.execute("SELECT COUNT(*) FROM payment_ledger WHERE payment_id='pay_rollback_fixture'").fetchone()==(0,)
assert legacy.execute("SELECT COUNT(*) FROM payment_notification_outbox WHERE payment_id='pay_rollback_fixture'").fetchone()==(0,)
assert legacy.execute("SELECT rp_payment_id FROM users WHERE email=?",(email,)).fetchone()==("pay_replay_2",)
legacy.execute("DROP TRIGGER fixture_payment_failure")
print("PASS: payment replay, leap-day renewal, early renewal extension, and atomic ledger/outbox rollback")
