import sqlite3
from pathlib import Path
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('a'),('b'); CREATE TABLE fixture(account_id TEXT,id TEXT,value INTEGER,PRIMARY KEY(account_id,id)); INSERT INTO fixture VALUES ('a','c',1),('b','c',1);")
db.executescript((Path(__file__).resolve().parents[1]/'migrations/039_platform_audit_events.sql').read_text())
sql="INSERT INTO platform_audit_events VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
def event(account='a',id='e',mode='manual_ui'):
    db.execute(sql,(account,id,1,'user','owner',None,mode,'update','contract','c','committed','req',None,'["noticeDays"]',1))
with db:
    db.execute("UPDATE fixture SET value=2 WHERE account_id='a'")
    event()
assert db.execute("SELECT value FROM fixture WHERE account_id='a'").fetchone()==(2,)
for args in [('a','e','manual_ui'),('a','e2','invalid'),('missing','e3','manual_ui')]:
    try:
        with db:
            db.execute("UPDATE fixture SET value=3 WHERE account_id='a'")
            event(*args)
    except sqlite3.IntegrityError: pass
    else: raise AssertionError('invalid audit accepted')
    assert db.execute("SELECT value FROM fixture WHERE account_id='a'").fetchone()==(2,)
with db: event('b')
assert db.execute("SELECT COUNT(*) FROM platform_audit_events WHERE account_id='a'").fetchone()==(1,)
try:
    db.execute("UPDATE platform_audit_events SET action='delete' WHERE account_id='a'")
except sqlite3.IntegrityError: pass
else: raise AssertionError('audit mutation accepted')
assert db.execute("SELECT value FROM fixture WHERE account_id='b'").fetchone()==(1,)
print('audit SQL transaction checks passed')
