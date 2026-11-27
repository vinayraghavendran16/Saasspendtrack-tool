import sqlite3
import json
from pathlib import Path

db = sqlite3.connect(":memory:")
db.execute("PRAGMA foreign_keys=ON")

db.executescript("""
CREATE TABLE accounts (
 id TEXT PRIMARY KEY
);
CREATE TABLE memberships (
 email TEXT PRIMARY KEY
);
INSERT INTO accounts VALUES ('workspace-a');
INSERT INTO accounts VALUES ('workspace-b');
""")

root = Path("migrations")

for name in [
    "010_vendor_governance.sql",
    "016_case_status_audit.sql",
    "027_case_status_audit_actor.sql"
]:
    db.executescript((root / name).read_text())

for account in ["workspace-a", "workspace-b"]:
    db.execute("""
        INSERT INTO vendor_cases (
          account_id,id,vendor_id,direction,severity,
          status,title,created_by,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?)
    """, (
        account, "case-1", "vendor-1", "outbound",
        "high", "open", "Synthetic case",
        "tester@example.com", 1000, 1000
    ))

db.execute("""
 UPDATE vendor_cases
 SET status='resolved', updated_at=2000
 WHERE account_id='workspace-a' AND id='case-1'
""")

event = db.execute("""
 SELECT actor_email,kind,detail,created_at
 FROM vendor_case_events
 WHERE account_id='workspace-a'
""").fetchone()

assert event is not None
assert event[0] == "system@saasspendtrack.internal"
assert event[1] == "status_changed"
assert json.loads(event[2]) == {
    "from": "open", "to": "resolved"
}
assert event[3] == 2000

print("PASS: status transition and audit attribution")

db.execute("""
 UPDATE vendor_cases SET status='resolved'
 WHERE account_id='workspace-a' AND id='case-1'
""")

assert db.execute("""
 SELECT COUNT(*) FROM vendor_case_events
""").fetchone()[0] == 1

print("PASS: unchanged status creates no duplicate event")

assert db.execute("""
 SELECT status FROM vendor_cases
 WHERE account_id='workspace-b' AND id='case-1'
""").fetchone()[0] == "open"

assert db.execute("""
 SELECT COUNT(*) FROM vendor_case_events
 WHERE account_id='workspace-b'
""").fetchone()[0] == 0

print("PASS: foreign workspace unchanged")

assert db.execute(
    "PRAGMA integrity_check"
).fetchone()[0] == "ok"

assert not db.execute(
    "PRAGMA foreign_key_check"
).fetchall()

print("PASS: database and foreign-key integrity")
