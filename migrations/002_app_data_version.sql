-- Apply once to the existing D1 app_data table before deploying CAS-aware endpoints.
-- Explicitly backfill legacy rows with version=1 so preexisting data cannot
-- be overwritten by an uninitialized client's If-Match: 0.
ALTER TABLE app_data ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1);
