import sqlite3,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.execute('CREATE TABLE users(email TEXT PRIMARY KEY,status TEXT,paid_at INTEGER,trial_ends_at INTEGER)')
for path in ['functions/_shared/util.js','functions/api/cron/tick.js']:
    source=(root/path).read_text()
    sql=re.search(r'prepare\("(UPDATE users SET status=\? WHERE email=\? AND status=\'trial\'.*?)"\)',source).group(1)
    db.execute('DELETE FROM users')
    db.executemany('INSERT INTO users VALUES(?,?,?,?)',[('paid','active',100,50),('trial','trial',None,50),('future','trial',None,150)])
    for email,expected in [('paid',0),('trial',1),('future',0)]:
        assert db.execute(sql,('expired',email,100)).rowcount==expected
print('PASS: trial expiration cannot overwrite paid status')
