import sqlite3,json
from pathlib import Path
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('a'),('b'); CREATE TABLE reporting_financial_facts(account_id TEXT,id TEXT,kind TEXT,currency TEXT,amount_minor INTEGER,effective_date TEXT,PRIMARY KEY(account_id,id)); INSERT INTO reporting_financial_facts VALUES ('a','f','invoice','USD',100,'2020-01-01'),('b','f','invoice','USD',100,'2020-01-01');")
root=Path(__file__).resolve().parents[1]
for name in ['037_financial_departments.sql','038_department_allocation_versions.sql']:
    db.executescript((root/'migrations'/name).read_text())
db.execute("INSERT INTO financial_departments VALUES ('a','d','Sales','active',1),('b','other','Sales','active',1)")
def insert(rev,weights,amount=100,account='a'):
    db.execute("INSERT INTO department_allocation_versions VALUES (?,?,?,?,?,?,?,?,?,?,?)",(account,'f',rev,'USD','invoice',amount,'2020-01-01',json.dumps(weights),'review','owner',1))
def reject(fn):
    try: fn()
    except sqlite3.IntegrityError: return
    raise AssertionError('invalid write accepted')
w=[{'departmentId':'d','basisPoints':5000}]
reject(lambda:insert(2,w))
reject(lambda:insert(1,w,99))
reject(lambda:insert(1,[{'departmentId':'other','basisPoints':5000}]))
reject(lambda:insert(1,w+w))
reject(lambda:insert(1,[{'departmentId':'d','basisPoints':10001}]))
insert(1,w)
reject(lambda:insert(1,w))
insert(2,[])
reject(lambda:db.execute("UPDATE department_allocation_versions SET rationale='changed'"))
reject(lambda:db.execute("DELETE FROM department_allocation_versions"))
db.execute("UPDATE financial_departments SET status='retired' WHERE account_id='a'")
reject(lambda:insert(3,w))
assert db.execute("SELECT COUNT(*) FROM department_allocation_versions").fetchone()==(2,)
print('allocation revision SQL checks passed')
