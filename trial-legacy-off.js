/* Legacy trial/signup system OFF.
   The 14-day Apps Script trial (signup modal, client-side expiry gate, drip, and
   all Google Sheet posting) is replaced by the server-gated magic-link trial
   (auth-gate.js + /api/*). This stubs the old globals so the two never compete.
   Loaded after all extensions, before auth-gate.js. */
(function () {
  'use strict';
  function noop() {}
  async function anoop() {}

  // Old client-side trial math -> never "expired", no legacy banner/gate.
  try { window.isTrialExpired = function () { return false; }; } catch (_) {}
  try { window.trialRemainingDays = function () { return null; }; } catch (_) {}

  // Old signup capture + modal.
  try { window.needsSignupCapture = function () { return false; }; } catch (_) {}
  try { window.maybeShowSignupModal = noop; } catch (_) {}

  // Apps Script posting (signup / funnel / paid_marked) -> no endpoint, no posts.
  try { window.signupEndpoint = function () { return ''; }; } catch (_) {}
  try { window.submitSignup = anoop; } catch (_) {}
  try { window.retryPending = anoop; } catch (_) {}

  // Remove any legacy UI that other scripts may inject on their timers.
  function cleanup() {
    ['expiry-gate', 'trial-banner', 'signup-modal', 'signup-overlay'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.remove();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cleanup);
  else cleanup();
  setTimeout(cleanup, 500);
  setTimeout(cleanup, 1000);
})();
