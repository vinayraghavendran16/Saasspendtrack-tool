-- Tenant-local, explicitly asserted business dependencies. No employee PII.
CREATE TABLE IF NOT EXISTS technology_graph_nodes (
 account_id TEXT NOT NULL REFERENCES accounts(id), id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('objective','department','capability','product','contract','integration')),
 label TEXT NOT NULL CHECK(length(trim(label)) BETWEEN 1 AND 240),
 source_ref TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id)
);
CREATE TABLE IF NOT EXISTS technology_graph_edges (
 account_id TEXT NOT NULL, id TEXT NOT NULL, dependent_id TEXT NOT NULL, dependency_id TEXT NOT NULL,
 criticality TEXT NOT NULL CHECK(criticality IN ('critical','high','medium','low')),
 evidence TEXT NOT NULL CHECK(evidence IN ('verified','asserted','unknown')),
 source_ref TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(account_id,id), UNIQUE(account_id,dependent_id,dependency_id),
 CHECK(dependent_id<>dependency_id),
 FOREIGN KEY(account_id,dependent_id) REFERENCES technology_graph_nodes(account_id,id),
 FOREIGN KEY(account_id,dependency_id) REFERENCES technology_graph_nodes(account_id,id)
);
CREATE INDEX IF NOT EXISTS graph_reverse_dependencies ON technology_graph_edges(account_id,dependency_id);
