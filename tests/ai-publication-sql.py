#!/usr/bin/env python3
"""Actual SQLite constraints and rollback for AI recommendation publication."""
import sqlite3
from pathlib import Path
root=Path(__file__).resolve().parents[1]
db=sqlite3.connect(':memory:')
db.execute('PRAGMA foreign_keys=ON')
db.executescript("""CREATE TABLE accounts(id TEXT PRIMARY KEY);
INSERT INTO accounts VALUES ('a'),('b');
CREATE TABLE commercial_contracts(account_id TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(account_id,id));
INSERT INTO commercial_contracts VALUES ('a','contract-1'),('a','contract-2'),('b','contract-b');""")
for n in range(39,44):
    matches=list((root/'migrations').glob(f'{n:03d}_*.sql'))
    assert len(matches)==1,(n,matches)
    db.executescript(matches[0].read_text())

DIGEST='a'*64
db.execute("INSERT INTO ai_artifacts VALUES ('a','msa1','contract-1','active')")
db.execute("INSERT INTO ai_artifact_versions VALUES ('a','msa1',?,'[\"Clause 8.2\"]',1)",(DIGEST,))
db.commit()

def count(table,account='a'):
    return db.execute(f"SELECT COUNT(*) FROM {table} WHERE account_id=?",(account,)).fetchone()[0]

def write(recommendation='rec-1',revision=1,account='a',contract='contract-1',mode='good',change_audit=False):
    audit_id=f'audit-{recommendation}-{revision}'
    with db:
        db.execute("INSERT INTO ai_recommendation_revisions VALUES (?,?,?,?,?,?,?,?,?)",
            (account,recommendation,revision,'renewals','Notice clause requires action.','[]','[]','test-model',10))
        db.execute("INSERT INTO ai_recommendation_evidence VALUES (?,?,?,?,?,?,?,?,?)",
            (account,recommendation,revision,'evidence-1','msa','msa1',DIGEST,'{\"page\":1,\"start\":0,\"end\":10}','direct'))
        if mode=='bad_evidence':db.execute("DELETE FROM ai_recommendation_evidence WHERE account_id=? AND recommendation_id=?",(account,recommendation))
        db.execute("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,initiator_id,mode,action,entity_type,entity_id,outcome,correlation_id,batch_id,changed_fields_json,schema_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (account,audit_id,10,'ai','trackai','owner@example.invalid','ai_assisted','generate' if not change_audit else 'edit','ai_recommendation',recommendation,'proposed',audit_id,None,'[]',1))
        db.execute("INSERT INTO ai_recommendation_publications VALUES (?,?,?,?,?,?)",
            (account,recommendation,revision,contract,audit_id,10))

write()
assert [count(t) for t in ('ai_recommendation_revisions','ai_recommendation_evidence','platform_audit_events','ai_recommendation_publications')]==[1]*4
for invalid in [
    dict(recommendation='rec-wrong-contract',contract='contract-2'),
    dict(recommendation='rec-bad-audit',change_audit=True),
    dict(recommendation='rec-cross-tenant',account='b',contract='contract-b'),
    dict(recommendation='rec-bad-evidence',mode='bad_evidence'),
]:
    before=[count(t,invalid.get('account','a')) for t in ('ai_recommendation_revisions','ai_recommendation_evidence','platform_audit_events','ai_recommendation_publications')]
    try:write(**invalid)
    except sqlite3.IntegrityError:pass
    else:raise AssertionError(f'Invalid publication accepted: {invalid}')
    after=[count(t,invalid.get('account','a')) for t in ('ai_recommendation_revisions','ai_recommendation_evidence','platform_audit_events','ai_recommendation_publications')]
    assert before==after,(invalid,before,after)
try:write()
except sqlite3.IntegrityError:pass
else:raise AssertionError('Duplicate revision accepted')
assert [count(t) for t in ('ai_recommendation_revisions','ai_recommendation_evidence','platform_audit_events','ai_recommendation_publications')]==[1]*4
try:db.execute("UPDATE ai_recommendation_publications SET published_at=20")
except sqlite3.IntegrityError:pass
else:raise AssertionError('Published record mutated')
try:db.execute("INSERT INTO ai_recommendation_evidence VALUES (?,?,?,?,?,?,?,?,?)",
               ('a','rec-1',1,'late-evidence','msa','msa1',DIGEST,'{}','direct'))
except sqlite3.IntegrityError:pass
else:raise AssertionError('Published evidence appended')
db.execute("UPDATE ai_artifacts SET status='revoked' WHERE account_id='a' AND id='msa1'")
db.commit()
try:write(recommendation='rec-revoked')
except sqlite3.IntegrityError:pass
else:raise AssertionError('Revoked artifact accepted')
assert count('ai_recommendation_revisions')==1
print('PASS: real SQLite publication success, rollback, tenant/contract/audit constraints, duplicate revision and sealed evidence')
