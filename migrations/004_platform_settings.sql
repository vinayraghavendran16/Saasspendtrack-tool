-- Platform administration is deliberately independent of customer workspaces.
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY CHECK (key IN ('roadmap','changelog','upvotedRoadmap','crTab','onepager')),
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
