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

# Independent connections race for the same provider claim.
import tempfile
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
with tempfile.TemporaryDirectory() as tmp:
    target=str(Path(tmp)/'race.sqlite')
    db.commit()
    with sqlite3.connect(target) as dest: db.backup(dest)
    barrier=Barrier(8)
    def claim(_):
        with sqlite3.connect(target,timeout=10) as conn:
            conn.execute('PRAGMA foreign_keys=ON')
            barrier.wait(timeout=10)
            return conn.execute("INSERT INTO checkout_provider_claims(checkout_id,claimed_at) VALUES ('c3',1) ON CONFLICT(checkout_id) DO NOTHING RETURNING checkout_id").fetchone()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results=list(pool.map(claim,range(8)))
    assert results.count(('c3',))==1, results
    assert results.count(None)==7, results
print('PASS: eight concurrent connections produce one provider claim')

# Execute the actual entitlement INSERT from the webhook against SQLite.
import re
from datetime import datetime, timezone
source=(root/'functions/api/razorpay/test-webhook.js').read_text()
sql=re.search(r'env.DB.prepare\(`(INSERT INTO payment_ledger[\s\S]*?)`\)',source).group(1)
db.execute('CREATE TABLE users(email TEXT PRIMARY KEY)')
db.execute("INSERT INTO users VALUES ('4@example.test')")
db.execute("UPDATE checkout_intents SET status='created',link_id='plink_leap' WHERE id='c4'")
def millis(s): return int(datetime.fromisoformat(s).replace(tzinfo=timezone.utc).timestamp()*1000)
t=millis('2028-02-29T12:00:00.123')
db.execute(sql,('pay_leap',t,t,'c4'))
assert db.execute("SELECT entitlement_until FROM payment_ledger WHERE payment_id='pay_leap'").fetchone()==(millis('2029-02-28T12:00:00.123'),)
print('PASS: actual webhook SQL leap-day entitlement')

# Competing owners attempt to reserve the final available founding seat.
db.execute("UPDATE checkout_intents SET status='cancelled',founding_slot=NULL WHERE id='c26'")
owner(28)
db.commit()
with tempfile.TemporaryDirectory() as tmp:
    target=str(Path(tmp)/'seat.sqlite')
    with sqlite3.connect(target) as dest: db.backup(dest)
    barrier=Barrier(2)
    def last_seat(i):
        with sqlite3.connect(target,timeout=10) as conn:
            conn.execute('PRAGMA foreign_keys=ON')
            barrier.wait(timeout=10)
            try:
                conn.execute("INSERT INTO checkout_intents(id,account_id,owner_email,tier,amount,currency,founding_slot,created_at,expires_at) VALUES (?,?,?,'founding',149900,'USD',25,1,2)",(f'race{i}',str(i),f'{i}@example.test'))
                return True
            except sqlite3.IntegrityError: return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(last_seat,[27,28]))==[False,True]
    with sqlite3.connect(target) as conn:
        assert conn.execute('SELECT count(*) FROM checkout_intents WHERE founding_slot IS NOT NULL').fetchone()==(25,)
# Workspace ownership cannot be spoofed at the database boundary.
rejects(lambda:db.execute("INSERT INTO checkout_intents(id,account_id,owner_email,tier,amount,currency,created_at,expires_at) VALUES ('spoof','27','28@example.test','standard',200000,'USD',1,2)"))
db.execute("UPDATE memberships SET role='member' WHERE email='28@example.test'")
rejects(lambda:db.execute("INSERT INTO checkout_intents(id,account_id,owner_email,tier,amount,currency,created_at,expires_at) VALUES ('member','28','28@example.test','standard',200000,'USD',1,2)"))
assert db.execute("SELECT old_status,new_status FROM checkout_events WHERE checkout_id='c26' ORDER BY id").fetchall()==[(None,'reserved'),('reserved','cancelled')]
print('PASS: final founding seat race, owner boundary and audit sequence')

# Race two deliveries of the same payment ledger insertion.
db.commit()
with tempfile.TemporaryDirectory() as tmp:
    target=str(Path(tmp)/'payment.sqlite')
    with sqlite3.connect(target) as dest: db.backup(dest)
    barrier=Barrier(2)
    def delivery(i):
        with sqlite3.connect(target,timeout=10) as conn:
            conn.execute('PRAGMA foreign_keys=ON')
            barrier.wait(timeout=10)
            try:
                conn.execute("INSERT INTO payment_ledger VALUES ('pay_race','plink_race','5@example.test','founding',149900,'USD',1,2)")
                return True
            except sqlite3.IntegrityError: return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(delivery,range(2)))==[False,True]
    with sqlite3.connect(target) as conn:
        assert conn.execute("SELECT count(*) FROM payment_ledger WHERE payment_id='pay_race'").fetchone()==(1,)
# A claimed reservation can only release capacity after verified terminal evidence.
db.execute("UPDATE checkout_intents SET status='created',link_id='plink_release' WHERE id='c2'")
db.execute("UPDATE checkout_provider_claims SET provider_url='https://rzp.io/i/test',completed_at=2 WHERE checkout_id='c2'")
rejects(lambda:db.execute("UPDATE checkout_intents SET status='expired',founding_slot=NULL WHERE id='c2'"))
db.execute("INSERT INTO checkout_release_evidence(checkout_id,link_id,provider_status,amount_paid,verified_at) VALUES ('c2','plink_release','expired',0,3)")
db.execute("UPDATE checkout_intents SET status='expired',founding_slot=NULL WHERE id='c2'")
assert db.execute("SELECT founding_slot FROM checkout_intents WHERE id='c2'").fetchone()==(None,)
print('PASS: duplicate ledger race and verified capacity release')

db.executescript(next((root/'migrations').glob('032_*')).read_text())
db.execute("INSERT INTO legacy_founding_allocations VALUES (2,'27','fixture-evidence',1)")
rejects(lambda:db.execute("INSERT INTO legacy_founding_allocations VALUES (3,'28','collision',1)"))
rejects(lambda:db.execute("INSERT INTO checkout_intents(id,account_id,owner_email,tier,amount,currency,founding_slot,created_at,expires_at) VALUES ('legacy-repeat','27','27@example.test','founding',149900,'USD',25,1,2)"))
rejects(lambda:db.execute("DELETE FROM legacy_founding_allocations"))
print('PASS: historical allocation collision and immutability')

# Execute the actual aggregate health SQL against the migration fixture.
health_source=(root/'functions/_shared/checkout-health.js').read_text()
health_sql=re.search(r'db.prepare\(`([\s\S]*?)`\)',health_source).group(1)
health=db.execute(health_sql,(0,0)).fetchone()
assert health[3]==db.execute('SELECT count(*) FROM checkout_intents WHERE founding_slot IS NOT NULL').fetchone()[0]+1
assert 0<=health[3]<=25
print('PASS: historical and current allocations included in health totals')

# Historical import and a new reservation compete for the same free slot.
owner(29)
owner(30)
db.commit()
with tempfile.TemporaryDirectory() as tmp:
    target=str(Path(tmp)/'historical-race.sqlite')
    with sqlite3.connect(target) as dest: db.backup(dest)
    barrier=Barrier(2)
    def historical_race(i):
        with sqlite3.connect(target,timeout=10) as conn:
            conn.execute('PRAGMA foreign_keys=ON')
            barrier.wait(timeout=10)
            try:
                if i==0:
                    conn.execute("INSERT INTO legacy_founding_allocations VALUES (25,'29','race-evidence',1)")
                else:
                    conn.execute("INSERT INTO checkout_intents(id,account_id,owner_email,tier,amount,currency,founding_slot,created_at,expires_at) VALUES ('new-race','30','30@example.test','founding',149900,'USD',25,1,2)")
                return True
            except sqlite3.IntegrityError: return False
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(historical_race,range(2)))==[False,True]
print('PASS: historical import and new checkout cannot share a seat')
