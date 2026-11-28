# Trial delivery integration
Keep TRIAL_CADENCE_ENABLED false until the schema proposal receives a unique migration number on the combined checkout and release branch. Rehearse against synthetic data and a protected backup copy. Never execute the proposal directly in production.
Run tests/trial-delivery-claims.py and complete migration rehearsal. Verify scheduler with a mocked provider and isolated database.
Use trialDeliveryHealth to count stale claims, review outcomes and accepted claims missing email_log. Counts contain no recipient identifiers. Never automatically delete claims or retry uncertain sends. Reconcile using provider evidence under authorized operator review; acceptance is not inbox delivery.
