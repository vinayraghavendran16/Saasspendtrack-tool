import sqlite3
from pathlib import Path
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('a'),('b');")
db.executescript((Path(__file__).resolve().parents[1]/'migrations/037_financial_departments.sql').read_text())
def reject(sql,args=()):
    try:
        db.execute(sql,args)
    except sqlite3.IntegrityError:
        return
    raise AssertionError(sql)
db.execute("INSERT INTO financial_departments VALUES ('a','d','Sales','active',1)")
db.execute("INSERT INTO financial_departments VALUES ('b','d','Sales','active',1)")
db.execute("INSERT INTO financial_departments VALUES ('b','only-b','Other','active',1)")
reject("INSERT INTO financial_departments VALUES ('missing','d','Sales','active',1)")
reject("INSERT INTO financial_department_sources VALUES ('a','hr','x','only-b','owner',1)")
db.execute("INSERT INTO financial_department_sources VALUES ('a','hr','x','d','owner',1)")
db.execute("INSERT INTO financial_department_sources VALUES ('b','hr','x','d','owner',1)")
reject("INSERT INTO financial_department_sources VALUES ('a','hr','x','d','owner',2)")
reject("UPDATE financial_departments SET id='new' WHERE account_id='a'")
reject("UPDATE financial_department_sources SET reviewed_at=2 WHERE account_id='a'")
db.execute("UPDATE financial_departments SET label='Revenue',status='retired' WHERE account_id='a'")
reject("INSERT INTO financial_department_sources VALUES ('a','hr','y','d','owner',2)")
assert db.execute("SELECT department_id FROM financial_department_sources WHERE account_id='a'").fetchone()==('d',)
assert db.execute("SELECT label FROM financial_departments WHERE account_id='b'").fetchone()==('Sales',)
reject("DELETE FROM financial_departments WHERE account_id='a'")
print('department registry SQL checks passed')
