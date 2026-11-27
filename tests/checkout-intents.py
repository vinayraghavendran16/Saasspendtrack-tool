import sqlite3
from pathlib import Path

db = sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("""
CREATE TABLE accounts(id TEXT PRIMARY KEY, owner_email TEXT);
CREATE TABLE memberships(email TEXT PRIMARY KEY, account_id TEXT, role TEXT, status TEXT);
""")
root=Path(__file__).resolve().parents[1]
for pattern in ('009_*','028_*','029_*','030_*','031_*'):
    db.executescript(next((root/'migrations').glob(pattern)).read_text())
def owner(i):
    db.execute('INSERT INTO accounts VALUES (?,?)',(str(i),f'{i}@example.test'))
    db.execute("INSERT INTO memberships VALUES (?,?,'owner','active')",(f'{i}@example.test',str(i)))
def reserve(i,slot,amount=149900,email=None):
    db.execute("INSERT INTO checkout_intents(id,account_id,owner_email,tier,amount,currency,founding_slot,created_at,expires_at) VALUES (?,?,?,'founding',?,'USD',?,1,2)",(f'c{i}',str(i),email or f'{i}@example.test',amount,slot))
def rejects(fn):
    try: fn()
    except sqlite3.IntegrityError: return
    raise AssertionError('Expected constraint rejection')
for i in range(1,28): owner(i)
for i in range(1,26): reserve(i,i)
rejects(lambda:reserve(26,26))
rejects(lambda:reserve(26,25))
rejects(lambda:reserve(26,25,1))
rejects(lambda:reserve(26,25,email='wrong@example.test'))
db.execute("UPDATE checkout_intents SET status='cancelled',founding_slot=NULL WHERE id='c25'")
rejects(lambda:reserve(26,25,1))
rejects(lambda:reserve(26,25,email='wrong@example.test'))
reserve(26,25)
db.execute("UPDATE checkout_intents SET status='created',link_id='plink_test' WHERE id='c1'")
rejects(lambda:db.execute("UPDATE checkout_intents SET amount=1 WHERE id='c1'"))
db.execute("INSERT INTO payment_ledger VALUES ('pay_bad','plink_test','2@example.test','founding',149900,'USD',1,2)")
rejects(lambda:db.execute("UPDATE checkout_intents SET status='paid',payment_id='pay_bad' WHERE id='c1'"))
db.execute("INSERT INTO payment_ledger VALUES ('pay_ok','plink_test','1@example.test','founding',149900,'USD',1,2)")
db.execute("UPDATE checkout_intents SET status='paid',payment_id='pay_ok' WHERE id='c1'")
rejects(lambda:db.execute("UPDATE checkout_intents SET status='cancelled',founding_slot=NULL WHERE id='c1'"))
rejects(lambda:db.execute("DELETE FROM checkout_events"))
rejects(lambda:db.execute("UPDATE checkout_events SET new_status='paid'"))
assert db.execute("SELECT COUNT(*) FROM checkout_events WHERE checkout_id='c1'").fetchone()==(3,)
assert db.execute('PRAGMA integrity_check').fetchone()==('ok',)
assert not db.execute('PRAGMA foreign_key_check').fetchall()
print('PASS: checkout schema regression')

db.execute("INSERT INTO checkout_provider_claims(checkout_id,claimed_at) VALUES ('c2',1)")
rejects(lambda:db.execute("INSERT INTO checkout_provider_claims(checkout_id,claimed_at) VALUES ('c2',1)"))
rejects(lambda:db.execute("UPDATE checkout_intents SET status='cancelled',founding_slot=NULL WHERE id='c2'"))
rejects(lambda:db.execute("DELETE FROM checkout_provider_claims WHERE checkout_id='c2'"))
rejects(lambda:db.execute("INSERT INTO checkout_provider_claims(checkout_id,claimed_at) VALUES ('c3',2)"))
print('PASS: provider claim uniqueness and release guards')
