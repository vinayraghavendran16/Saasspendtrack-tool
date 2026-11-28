import sqlite3,re,tempfile,concurrent.futures,threading
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=(root/'functions/_shared/trial-delivery-claims.js').read_text()
claim,finish=re.findall(r'prepare\("([^"]+)"\)',source)
with tempfile.TemporaryDirectory() as d:
    path=str(Path(d)/'test.db')
    db=sqlite3.connect(path)
    db.executescript("CREATE TABLE users(email TEXT PRIMARY KEY,status TEXT,paid_at INTEGER,trial_ends_at INTEGER); CREATE TABLE email_log(email TEXT,kind TEXT,PRIMARY KEY(email,kind));")
    db.executescript((root/'docs/trial-delivery-schema-proposal.sql').read_text())
    db.executemany('INSERT INTO users VALUES(?,?,?,?)',[('trial','trial',None,200),('paid','active',50,200),('sent','trial',None,200),('expired','expired',None,50)])
    db.execute("INSERT INTO email_log VALUES('sent','day2')")
    db.commit()
    def reserve(conn,email,kind,id):
        return conn.execute(claim,(kind,id,100,email,kind,100,kind,100,kind)).fetchone()
    barrier=threading.Barrier(8)
    def worker(i):
        with sqlite3.connect(path,timeout=15) as c:
            barrier.wait()
            return reserve(c,'trial','day2',str(i))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        rows=list(pool.map(worker,range(8)))
    winners=[r[0] for r in rows if r]
    assert len(winners)==1
    assert reserve(db,'paid','day2','paid') is None
    assert reserve(db,'sent','day2','sent') is None
    assert reserve(db,'expired','day2','expired') is None
    assert reserve(db,'expired','expired','expiry')==('expiry',)
    assert db.execute(finish,('review',101,'trial','day2','wrong')).fetchone() is None
    assert db.execute(finish,('review',101,'trial','day2',winners[0])).fetchone()==(winners[0],)
    assert reserve(db,'trial','day2','retry') is None
    assert db.execute(finish,('accepted',102,'trial','day2',winners[0])).fetchone() is None
    health=re.search(r'prepare\("([^"]+)"\)',(root/'functions/_shared/trial-delivery-health.js').read_text()).group(1)
    assert db.execute(health,(100,)).fetchone()==(1,1,0)
    assert db.execute(finish,('accepted',102,'expired','expired','expiry')).fetchone()==('expiry',)
    assert db.execute(health,(100,)).fetchone()==(1,0,1)
    db.close()
print('PASS: concurrent trial claims and ambiguous delivery fencing')
