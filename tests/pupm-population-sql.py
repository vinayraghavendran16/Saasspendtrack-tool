import sqlite3
from pathlib import Path
c=sqlite3.connect(':memory:')
c.executescript("PRAGMA foreign_keys=ON; CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('a'),('b');")
s=(Path(__file__).resolve().parents[1]/'migrations/035_pupm_population_observations.sql').read_text()
c.executescript(s)
c.executescript(s)
r=['a','1','department','sales','2027-01','employees',150,None,'hr','r1',1,None]
def insert(**kw):
    x=r.copy()
    for k,v in kw.items(): x[int(k[1:])]=v
    c.execute('INSERT INTO pupm_population_observations VALUES ('+','.join('?'*12)+')',x)
insert()
insert(x1='2',x9='r2',x10=2,x11='1',x6=155)
for patch in [dict(x0='b',x1='3',x9='r3',x10=3,x11='1'),dict(x1='3',x9='r3',x10=3,x11='1'),dict(x1='3',x9='r3',x6=-1),dict(x1='3',x9='r3',x5='active_users'),dict(x1='3'),dict(x1='3',x9='r3',x4='2027-13')]:
    try: insert(**patch)
    except sqlite3.IntegrityError: pass
    else: raise AssertionError(patch)
for q in ['UPDATE pupm_population_observations SET population=0','DELETE FROM pupm_population_observations']:
    try: c.execute(q)
    except sqlite3.IntegrityError: pass
    else: raise AssertionError(q)
assert c.execute('SELECT count(*) FROM pupm_population_observations').fetchone()==(2,)
print('PASS: historical population integrity')
