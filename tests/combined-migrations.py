import sqlite3
from pathlib import Path
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript(Path('schema.sql').read_text())
db.execute("INSERT INTO users(email,created_at,trial_ends_at) VALUES('fixture@example.invalid',1,2)")
db.execute("INSERT INTO app_data(email,data,updated_at) VALUES('fixture@example.invalid','{}',1)")
db.commit()
files=sorted(Path('migrations').glob('*.sql'))
for f in files:
    db.executescript(f.read_text())
    assert db.execute('PRAGMA quick_check').fetchall()==[('ok',)], f
    assert not db.execute('PRAGMA foreign_key_check').fetchall(), f
    print('PASS',f.name)
assert db.execute("SELECT data FROM app_data WHERE email='fixture@example.invalid'").fetchone()==('{}',)
assert db.execute("SELECT count(*) FROM users WHERE email='fixture@example.invalid'").fetchone()==(1,)
assert any(f.name.startswith('016') for f in files)
print('Synthetic migration rehearsal passed')
