#!/usr/bin/env bash
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
expected="${1:-}"
if [[ ! "$expected" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Usage: bash scripts/v1-release-preflight.sh <approved-full-commit-sha>" >&2
  exit 2
fi
[[ "$(git rev-parse HEAD)" == "$expected" ]] || { echo "SHA mismatch" >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "Checkout is dirty" >&2; exit 1; }
npm ci
npm run test:release
npm run test:e2e:local
npm run build:preview-us
[[ "$(git rev-parse HEAD)" == "$expected" ]] || exit 1
[[ -z "$(git status --porcelain)" ]] || { echo "Tests changed checkout; inspect before proceeding" >&2; exit 1; }
echo "Local preflight passed for $expected"
echo "NOT DEPLOYED. Independently verify Cloudflare account/project/branch, isolated D1 binding, asset output and Functions inventory."
echo "Live preview, payment, backup/restore and approval gates remain mandatory."
