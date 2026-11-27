import sqlite3
import json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
# Minimal parent schema; full migration compatibility is covered separately.
db.executescript("""
CREATE TABLE decision_financial_reviews(account_id TEXT,decision_id TEXT,revision INTEGER,contract_id TEXT,period_start TEXT,period_end TEXT,evidence_json TEXT,PRIMARY KEY(account_id,decision_id,revision));
CREATE TABLE reporting_financial_facts(account_id TEXT,id TEXT,contract_id TEXT,source_id TEXT,source_record_id TEXT,kind TEXT,effective_date TEXT,currency TEXT,amount_minor INTEGER,PRIMARY KEY(account_id,id));
""")
db.executescript((root/'migrations/034_financial_learning_attestations.sql').read_text())
source=(root/'functions/api/decisions/financial-attest.js').read_text()
insert=source.split("env.DB.prepare('INSERT INTO decision_financial_attestations",1)[1].split("').bind(",1)[0]
insert='INSERT INTO decision_financial_attestations'+insert
allocate=source.split('env.DB.prepare("INSERT INTO decision_financial_fact_allocations',1)[1].split('").bind(',1)[0]
allocate='INSERT INTO decision_financial_fact_allocations'+allocate
fact=dict(id='f1',contract_id='c1',source_id='erp',source_record_id='1',kind='invoice',effective_date='2027-06-01',currency='USD',amount_minor=100)
def seed(account,decision,evidence):
 db.execute('INSERT INTO decision_financial_reviews VALUES(?,?,?,?,?,?,?)',(account,decision,1,'c1','2027-01-01','2027-12-31',json.dumps(evidence)))
def attest(account,decision):
 with db:
  db.execute(insert,(account,decision,1,'owner','a'*64,1))
  db.execute(allocate,(account,decision,1))
def reject(account,decision):
 try: attest(account,decision)
 except sqlite3.IntegrityError: pass
 else: raise AssertionError('invalid attestation accepted')
 assert db.execute('SELECT count(*) FROM decision_financial_attestations WHERE account_id=? AND decision_id=?',(account,decision)).fetchone()==(0,)
 assert db.execute('SELECT count(*) FROM decision_financial_fact_allocations WHERE account_id=? AND decision_id=?',(account,decision)).fetchone()==(0,)
for account in ('a','b'):
 db.execute('INSERT INTO reporting_financial_facts VALUES(?,?,?,?,?,?,?,?,?)',(account,*fact.values()))
seed('a','valid',[fact])
seed('a','duplicate',[fact])
seed('b','valid',[fact])
seed('a','stale',[{**fact,'amount_minor':99}])
seed('a','missing',[{**fact,'id':'missing'}])
seed('a','partial',[fact,{**fact,'id':'missing'}])
db.commit()
reject('a','stale')
reject('a','missing')
reject('a','partial')
attest('a','valid')
reject('a','duplicate')
attest('b','valid')
assert db.execute('SELECT count(*) FROM decision_financial_fact_allocations').fetchone()==(2,)
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print('PASS: actual attestation SQL, stale/missing evidence, partial rollback, duplicate allocation and tenant-scoped fact identity')
