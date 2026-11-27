CREATE TABLE IF NOT EXISTS ai_artifacts (
 account_id TEXT NOT NULL REFERENCES accounts(id),
 id TEXT NOT NULL CHECK(length(id) BETWEEN 1 AND 256),
 contract_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('active','revoked')),
 PRIMARY KEY(account_id,id),
 FOREIGN KEY(account_id,contract_id) REFERENCES commercial_contracts(account_id,id)
);
CREATE TABLE IF NOT EXISTS ai_artifact_versions (
 account_id TEXT NOT NULL,
 artifact_id TEXT NOT NULL,
 digest TEXT NOT NULL CHECK(length(digest)=64 AND digest NOT GLOB '*[^0-9a-f]*'),
 pages_json TEXT NOT NULL CHECK(json_valid(pages_json) AND json_type(pages_json)='array' AND length(CAST(pages_json AS BLOB))<=1000000),
 created_at INTEGER NOT NULL CHECK(typeof(created_at)='integer' AND created_at>0),
 PRIMARY KEY(account_id,artifact_id,digest),
 FOREIGN KEY(account_id,artifact_id) REFERENCES ai_artifacts(account_id,id)
);
CREATE TRIGGER IF NOT EXISTS ai_artifact_version_no_update BEFORE UPDATE ON ai_artifact_versions
BEGIN SELECT RAISE(ABORT,'artifact version immutable'); END;
CREATE TRIGGER IF NOT EXISTS ai_artifact_identity_no_update BEFORE UPDATE OF account_id,id,contract_id ON ai_artifacts
BEGIN SELECT RAISE(ABORT,'artifact identity immutable'); END;
-- No public ingestion or read API until authorization and retention are reviewed.
