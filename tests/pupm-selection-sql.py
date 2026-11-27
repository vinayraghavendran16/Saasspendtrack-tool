import sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
c=sqlite3.connect(':memory:')
c.executescript("PRAGMA foreign_keys=ON; CREATE TABLE accounts(id TEXT PRIMARY KEY); INSERT INTO accounts VALUES ('a'),('b');")
for name in ('035_pupm_population_observations.sql','036_pupm_source_selections.sql'):
    c.executescript((root/'migrations'/name).read_text())
def obs(id,record,t,previous=None):
    c.execute("INSERT INTO pupm_population_observations VALUES ('a',?,'organization','a','2020-01','employees',100,NULL,'hr',?,?,?)",(id,record,t,previous))
def select(account,id,observation):
    c.execute("INSERT INTO pupm_source_selections VALUES (?,?,?,'owner','HR source',10)",(account,id,observation))
def rejects(fn):
    try: fn()
    except sqlite3.IntegrityError: return
    raise AssertionError('unexpected acceptance')
obs('p','r',1)
select('a','s','p')
rejects(lambda:select('b','s','p'))
obs('p2','r2',2,'p')
rejects(lambda:select('a','s2','p'))
select('a','s3','p2')
rejects(lambda:c.execute("UPDATE pupm_source_selections SET reason='changed'"))
rejects(lambda:c.execute("DELETE FROM pupm_source_selections"))
assert c.execute("SELECT count(*) FROM pupm_source_selections").fetchone()==(2,)
print('PUPM selection integrity passed')
