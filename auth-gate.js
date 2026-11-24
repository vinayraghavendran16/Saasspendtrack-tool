/* SaaS Spend Track - trial gate (client side).
   Entitlement is decided server-side by /api/me; this only renders the UI.
   Fails OPEN: if the backend can't be reached, the app is left usable so a
   bad deploy never bricks it. */
(function () {
  'use strict';

  var PAY_INDIA = 'https://rzp.io/rzp/NCGW9GyD';
  var PAY_GLOBAL = 'https://rzp.io/rzp/MhqdtN2a';

  function el(html) {
    var d = document.createElement('div');
    d.innerHTML = html.trim();
    return d.firstChild;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  }); }

  function removeGate() {
    var g = document.getElementById('sst-gate'); if (g) g.remove();
  }

  // ---- login screen ----
  function showLogin(message) {
    removeGate();
    var gate = el('<div class="sst-gate" id="sst-gate" role="dialog" aria-modal="true" aria-labelledby="sst-login-title"><div class="sst-gate__card">' +
      '<div class="sst-gate__logo">SaaS Spend Track</div>' +
      '<h2 id="sst-login-title">Start your free trial</h2>' +
      '<p>Enter your work email and we’ll send you a sign-in link. 7 days of full access, no card required.</p>' +
      (message ? '<div class="sst-gate__msg sst-gate__msg--err" role="alert">' + esc(message) + '</div>' : '') +
      '<div id="sst-login-body">' +
      '<input type="email" id="sst-email" placeholder="you@company.com" autocomplete="email" aria-label="Work email" />' +
      '<button class="sst-btn" id="sst-send">Email me a sign-in link</button>' +
      '</div>' +
      '<div class="sst-gate__foot">Already paid? Use the same email and you’re straight in.</div>' +
      '</div></div>');
    document.body.appendChild(gate);

    var btn = gate.querySelector('#sst-send');
    var input = gate.querySelector('#sst-email');
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 0);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') btn.click(); });
    btn.addEventListener('click', function () {
      var email = (input.value || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { input.focus(); return; }
      btn.disabled = true; btn.textContent = 'Sending…';
      fetch('/api/auth/request', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email }),
      }).then(function (response) {
        return response.json().then(function (result) {
          if (!response.ok || result.ok !== true || result.emailed !== true) throw new Error('email_failed');
        });
      }).then(function () {
        gate.querySelector('#sst-login-body').innerHTML =
          '<div class="sst-gate__msg sst-gate__msg--ok" role="status">Check your inbox at <b>' + esc(email) +
          '</b> for your sign-in link. It expires in 15 minutes.</div>';
      }).catch(function () {
        btn.disabled = false; btn.textContent = 'Send failed — try again';
      });
    });
  }

  // ---- expiry / paywall ----
  function showPaywall() {
    removeGate();
    var gate = el('<div class="sst-gate" id="sst-gate" role="dialog" aria-modal="true" aria-labelledby="sst-paywall-title"><div class="sst-gate__card">' +
      '<div class="sst-gate__logo">SaaS Spend Track</div>' +
      '<h2 id="sst-paywall-title">Your trial has ended</h2>' +
      '<p>Your access is paused but your data is safe. Upgrade to unlock your dashboard again.</p>' +
      '<a class="sst-btn sst-btn--pair" href="' + PAY_INDIA + '" target="_blank" rel="noopener">Pay in ₹ (India)</a>' +
      '<a class="sst-btn sst-btn--pair" href="' + PAY_GLOBAL + '" target="_blank" rel="noopener">Pay in $ (Global)</a>' +
      '<button class="sst-btn sst-btn--ghost" id="sst-paid">I’ve paid - refresh my access</button>' +
      '<div class="sst-gate__foot"><a href="#" id="sst-logout">Sign out</a></div>' +
      '</div></div>');
    document.body.appendChild(gate);
    setTimeout(function () { try { gate.querySelector('.sst-btn').focus(); } catch (_) {} }, 0);
    gate.querySelector('#sst-paid').addEventListener('click', function () { location.reload(); });
    gate.querySelector('#sst-logout').addEventListener('click', function (e) {
      e.preventDefault();
      fetch('/api/auth/logout', { method: 'POST' }).then(function () { location.reload(); });
    });
  }

  // ---- trial banner (non-blocking) ----
  function showBanner(daysLeft) {
    if (document.getElementById('sst-banner')) return;
    var warn = daysLeft <= 2;
    var label = daysLeft <= 0 ? 'Your trial ends today'
      : daysLeft === 1 ? '<strong>1 day</strong> left in your trial'
      : '<strong>' + daysLeft + ' days</strong> left in your trial';
    var banner = el('<div class="sst-banner' + (warn ? ' sst-banner--warn' : '') + '" id="sst-banner" role="status">' +
      '<span>' + label + '</span>' +
      '<a href="#pricing" id="sst-upgrade">Upgrade now</a>' +
      '<button class="sst-banner__x" id="sst-banner-x" title="Dismiss" aria-label="Dismiss trial banner">×</button>' +
      '</div>');
    document.body.insertBefore(banner, document.body.firstChild);
    banner.querySelector('#sst-banner-x').addEventListener('click', function () { banner.remove(); });
  }

  function cleanAuthParam() {
    if (!/[?&]auth=/.test(location.search)) return null;
    var m = location.search.match(/[?&]auth=([^&]+)/);
    var val = m ? m[1] : null;
    var clean = location.pathname + location.hash;
    history.replaceState(null, '', clean);
    return val;
  }

  function run() {
    var authParam = cleanAuthParam();
    fetch('/api/me', { headers: { accept: 'application/json' } })
      .then(function (r) {
        if (!r.ok) throw new Error('backend ' + r.status);
        var ct = r.headers.get('content-type') || '';
        if (ct.indexOf('application/json') === -1) throw new Error('non-json');
        return r.json();
      })
      .then(function (me) {
        if (!me.authenticated) {
          showLogin(authParam === 'expired' ? 'That sign-in link expired. Enter your email for a fresh one.'
            : authParam === 'invalid' ? 'That link was invalid. Enter your email to try again.' : null);
          return;
        }
        if (!me.entitled) { showPaywall(); return; }
        if (me.status === 'trial') showBanner(me.daysLeft);
        // active or in-trial: app runs normally underneath.
      })
      .catch(function (err) {
        // Fail open: backend unavailable -> let the app run, no gate.
        console.warn('[sst gate] backend unavailable, failing open:', err.message);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
