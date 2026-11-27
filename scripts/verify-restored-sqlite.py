"""Compare two local SQLite snapshots before migrations; never contact production."""
import argparse
import sqlite3
from pathlib import Path
from collections import Counter

def connect(path):
    return sqlite3.connect(Path(path).resolve(strict=True).as_uri() + '?mode=ro', uri=True)

def quote(name):
    return '"' + name.replace('"', '""') + '"'

def tables(db):
    return {row[0]:row[1] for row in db.execute(
        "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")}

def check(db):
    if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
        raise SystemExit('FAIL: integrity check')
    if db.execute('PRAGMA foreign_key_check').fetchone() is not None:
        raise SystemExit('FAIL: foreign key check')

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source')
    parser.add_argument('restored')
    args=parser.parse_args()
    if Path(args.source).samefile(args.restored):
        raise SystemExit('FAIL: source and restored must be distinct files')
    with connect(args.source) as source, connect(args.restored) as restored:
        check(source)
        check(restored)
        expected=tables(source)
        if expected != tables(restored):
            raise SystemExit('FAIL: table schema differs')
        for table in sorted(expected):
            sql='SELECT * FROM '+quote(table)
            if Counter(source.execute(sql)) != Counter(restored.execute(sql)):
                raise SystemExit('FAIL: row mismatch in '+table)
        print('PASS: exact table schemas and row multisets, integrity and foreign keys')
        print('Tables compared:',len(expected))
        print('Local comparison only; verify D1 bindings, migration ledger and key custody separately.')
if __name__=='__main__':
    main()
