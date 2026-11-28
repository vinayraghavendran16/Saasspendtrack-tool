import sqlite3
import re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
db = sqlite3.connect(':memory:')
db.execute('CREATE TABLE memberships(email TEXT PRIMARY KEY, account_id TEXT, role TEXT, status TEXT)')
db.executemany('INSERT INTO memberships VALUES(?,?,?,?)', [('a','x','admin','active'),('b','x','member','active'),('o','x','owner','active'),('z','y','owner','active')])
def sql(name):
    source = (root / ('functions/api/account/member-'+name+'.js')).read_text()
    return re.search(r'prepare\("((?:UPDATE|DELETE FROM) memberships .*?)"\)',source).group(1)
update, delete = sql('role'), sql('remove')
assert db.execute(update, ('admin','b','x','member','a','x','admin')).rowcount == 0
assert db.execute(update, ('admin','b','x','member','o','x','admin')).rowcount == 1
assert db.execute(delete, ('b','x','member','a','x')).rowcount == 0
assert db.execute(delete, ('b','x','admin','a','x')).rowcount == 0
assert db.execute(delete, ('b','x','admin','z','x')).rowcount == 0
db.execute("UPDATE memberships SET status='inactive' WHERE email='o'")
assert db.execute(delete, ('b','x','admin','o','x')).rowcount == 0
db.execute("UPDATE memberships SET status='active' WHERE email='o'")
assert db.execute(delete, ('o','x','owner','o','x')).rowcount == 0
assert db.execute(delete, ('b','x','admin','o','x')).rowcount == 1
print('PASS: atomic membership mutation authorization')
