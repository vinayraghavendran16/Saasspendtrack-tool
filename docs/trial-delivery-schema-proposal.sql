-- Proposal only; not executed by migration runner.
CREATE TABLE trial_delivery_claims (
 email TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('day2','day4','day6','expired')),
 id TEXT NOT NULL UNIQUE,
 claimed_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('claimed','accepted','review')),
 finished_at INTEGER,
 PRIMARY KEY(email,kind),
 CHECK((status='claimed' AND finished_at IS NULL) OR (status<>'claimed' AND finished_at IS NOT NULL))
);
