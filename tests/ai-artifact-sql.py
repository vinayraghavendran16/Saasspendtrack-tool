import sqlite3
from pathlib import Path
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('a'),('b'); CREATE TABLE commercial_contracts(account_id TEXT,id TEXT,PRIMARY KEY(account_id,id)); INSERT INTO commercial_contracts VALUES ('a','c');")
db.executescript((Path(__file__).resolve().parents[1]/'migrations/042_ai_artifact_versions.sql').read_text())
def reject(sql,args=()):
    try: db.execute(sql,args)
    except sqlite3.IntegrityError: return
    raise AssertionError('invalid artifact write accepted')
db.execute("INSERT INTO ai_artifacts VALUES ('a','doc','c','active')")
reject("INSERT INTO ai_artifacts VALUES ('b','doc','c','active')")
db.execute("INSERT INTO ai_artifacts VALUES ('b','doc',NULL,'active')")
for digest in ['a'*64,'b'*64]:
    db.execute("INSERT INTO ai_artifact_versions VALUES ('a','doc',?,'[\"text\"]',1)",(digest,))
reject("INSERT INTO ai_artifact_versions VALUES ('b','missing',?,'[]',1)",('a'*64,))
reject("UPDATE ai_artifact_versions SET pages_json='[]'")
reject("UPDATE ai_artifacts SET account_id='b' WHERE account_id='a'")
sql="SELECT v.digest FROM ai_artifact_versions v JOIN ai_artifacts a ON a.account_id=v.account_id AND a.id=v.artifact_id WHERE v.account_id=? AND v.artifact_id=? AND v.digest=? AND a.status='active'"
assert db.execute(sql,('a','doc','a'*64)).fetchone()==('a'*64,)
assert db.execute(sql,('b','doc','a'*64)).fetchone() is None
db.execute("UPDATE ai_artifacts SET status='revoked' WHERE account_id='a'")
assert db.execute(sql,('a','doc','a'*64)).fetchone() is None
assert db.execute("SELECT COUNT(*) FROM ai_artifact_versions").fetchone()==(2,)
print('artifact registry SQL checks passed')
