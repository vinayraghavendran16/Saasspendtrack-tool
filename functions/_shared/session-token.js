import { sha256Hex } from './util.js';

// Domain-separated digest. Never persist or log the browser bearer token.
// Prefix distinguishes the new storage format from legacy raw hex IDs.
export async function sessionStorageId(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
  return 'sha256:' + await sha256Hex('sst-session-v1:' + token);
}
