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
for n in range(39,48):
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

def response(id, action='accept', audit_action='accept', actor='owner', audit_actor='owner', contract='contract-1', revision=1, outcome='committed', audit_time=20):
    with db:
        db.execute("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES (?,?,?,'user',?,'api',?,'ai_recommendation','rec-1',?,?,'[]',1)",('a',id,audit_time,audit_actor,audit_action,outcome,id))
        db.execute("INSERT INTO ai_recommendation_actions VALUES (?,?,?,?,?,?,?,?,?)",('a',id,'rec-1',revision,contract,action,actor,20,id))
response('response-1')
for i,kwargs in enumerate([dict(audit_action='reject'),dict(audit_actor='other'),dict(contract='contract-2'),dict(revision=2),dict(outcome='observed'),dict(audit_time=21)]):
    before=(count('platform_audit_events'),count('ai_recommendation_actions'))
    try:response('invalid-'+str(i),**kwargs)
    except sqlite3.IntegrityError:pass
    else:raise AssertionError(kwargs)
    assert before==(count('platform_audit_events'),count('ai_recommendation_actions'))
print('PASS action audit correspondence and rollback')

def action(id,verb,ts,revision=1):
    with db:
        db.execute("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES ('a',?,?,'user','owner','api',?,'ai_recommendation','rec-1','committed',?,'[]',1)",(id,ts,verb,id))
        db.execute("INSERT INTO ai_recommendation_actions VALUES ('a',?,'rec-1',?,'contract-1',?,'owner',?,?)",(id,revision,verb,ts,id))
def denied(fn):
    before=(count('platform_audit_events'),count('ai_recommendation_actions'),count('ai_challenge_resolutions'))
    try:fn()
    except sqlite3.IntegrityError:pass
    else:raise AssertionError('invalid lifecycle transition accepted')
    assert before==(count('platform_audit_events'),count('ai_recommendation_actions'),count('ai_challenge_resolutions'))
denied(lambda:action('no-approval','execute',30))
action('approval-1','approve',31)
action('challenge-action','challenge',32)
with db:
    db.execute("INSERT INTO ai_recommendation_challenges VALUES ('a','challenge-1','rec-1',1,'assumption','Incorrect assumption','owner',32)")
    db.execute("INSERT INTO ai_challenge_submissions VALUES ('a','challenge-1','challenge-action')")
denied(lambda:action('blocked-approval','approve',33))
denied(lambda:action('blocked-execution','execute',33))
def resolve(id,disposition,replacement=None):
    with db:
        db.execute("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES ('a',?,34,'user','owner','api','resolve','ai_challenge','challenge-1','committed',?,'[]',1)",(id,id))
        db.execute("INSERT INTO ai_challenge_resolutions VALUES ('a','challenge-1',?,?,'Reviewed evidence','owner',34,?)",(disposition,replacement,id))
denied(lambda:resolve('bad-replacement','revised',2))
resolve('resolution-1','upheld')
denied(lambda:resolve('duplicate-resolution','upheld'))
denied(lambda:action('stale-approval','execute',35))
action('fresh-approval','approve',36)
action('execution-record','execute',37)
db.execute("UPDATE ai_artifacts SET status='active' WHERE account_id='a' AND id='msa1'")
db.commit()
write(revision=2)
denied(lambda:action('superseded','approve',38))
denied(lambda:action('superseded-execution','execute',38))
denied(lambda:action('new-revision-no-approval','execute',38,2))
action('new-revision-approval','approve',39,2)
action('new-revision-execution','execute',40,2)
print('PASS challenge lifecycle, stale approval, resolution rollback and superseded revision gates')

# Execute the exact endpoint SQL, not a separately maintained approximation.
import re
api=(root/'functions/api/renewals/ai-analytics.js').read_text()
cohort=re.search(r'const cohort="([^"]+)";',api).group(1)
queries=[cohort+' LIMIT 10001']
for tail in re.findall(r"scoped\('WITH cohort AS \('\+cohort\+'([^']+)'",api):
    queries.append('WITH cohort AS ('+cohort+tail)
assert len(queries)==4
# Identical recommendation and revision identifiers in another tenant.
db.execute("INSERT INTO ai_artifacts VALUES ('b','msa1','contract-b','active')")
db.execute("INSERT INTO ai_artifact_versions VALUES ('b','msa1',?,'[\"Clause 8.2\"]',1)",(DIGEST,))
db.commit()
write(account='b',contract='contract-b')
with db:
    db.execute("INSERT INTO platform_audit_events(account_id,id,occurred_at,actor_type,actor_id,mode,action,entity_type,entity_id,outcome,correlation_id,changed_fields_json,schema_version) VALUES ('b','b-action',20,'user','other','api','accept','ai_recommendation','rec-1','committed','b-action','[]',1)")
    db.execute("INSERT INTO ai_recommendation_actions VALUES ('b','b-action','rec-1',1,'contract-b','accept','other',20,'b-action')")
def snapshot(account):
    return [db.execute(q,(account,0,50) if i==0 else (account,0,50,account,100)).fetchall() for i,q in enumerate(queries)]
a,b=snapshot('a'),snapshot('b')
assert len(a[0])==2 and len(b[0])==1
assert all(row[2]=='contract-1' for row in a[0])
assert b[0][0][2]=='contract-b'
assert all(row[0]!='b-action' for row in a[1])
assert len(b[1])==1 and b[1][0][0]=='b-action'
assert len(a[2])==1 and len(a[3])==1 and not b[2] and not b[3]
plan=db.execute('EXPLAIN QUERY PLAN '+queries[0],('a',0,50)).fetchall()
assert any('ai_publication_account_time' in str(row) for row in plan),plan
print('PASS actual endpoint SQL tenant isolation and indexed cohort lookup')
