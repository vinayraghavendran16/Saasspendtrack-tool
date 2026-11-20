/* ================================================================
   Phase 54 - PWA install (service worker + Add-to-Home-Screen)
   ================================================================
   Makes the browser app installable as a standalone app on:
   - iOS Safari → Share → Add to Home Screen (user-driven)
   - Android Chrome / Edge → auto-prompts installation
   - macOS Chrome / Edge → address bar install icon
   - Windows Chrome / Edge → install icon

   What this phase adds:
   - Service worker registration (sw.js) so the app shell is
     cached + offline-ready after first load
   - "Install this app" card in Settings on devices that support
     the beforeinstallprompt event
   - iOS install hint on Safari (since iOS doesn't fire the prompt)

   PWA installation is NOT the App Store. It's the best bridge
   between a browser app and a native-feeling home-screen app
   until you build a real iOS / Android app. Covers 90% of the
   "I want it on my phone" ask with zero native development.
   ================================================================ */

(() => {

/* ---------------- Register the service worker ---------------- */

/* Only register on real hosts - not on artifact previews, not on
   file:// - the SW needs an origin to scope to and isn't meaningful
   in those contexts. */
function canRegisterSW() {
  try {
    if (!('serviceWorker' in navigator)) return false;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return false;
    if (location.hostname.endsWith('claudeusercontent.com')) return false;
    return true;
  } catch (_) { return false; }
}

if (canRegisterSW()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      // Soft update check once a day
      setInterval(() => reg.update().catch(() => {}), 24 * 60 * 60 * 1000);
      console.log('[PWA] service worker registered');
    }).catch(err => {
      console.warn('[PWA] service worker registration failed', err);
    });
  });
}

/* ---------------- Capture the install prompt (Chrome / Edge) ---------------- */

let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('[PWA] install prompt available');
  // If the Settings view is open, re-render the install card
  renderInstallCard();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  console.log('[PWA] app installed');
  renderInstallCard();
});

/* ---------------- Platform detection ---------------- */

function platform() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;  // iPad masquerading as Mac
  const isAndroid = /Android/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isChrome = /Chrome|CriOS/.test(ua);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;
  return { isIOS: isIOS || isIPadOS, isAndroid, isSafari, isChrome, isStandalone };
}

/* ---------------- Install card in Settings ---------------- */

function injectInstallCard() {
  const settings = document.querySelector('.view[data-view="settings"]');
  if (!settings || !settings.querySelector('.st-grid')) return;
  if (settings.querySelector('#pwa-install-card')) return renderInstallCard();

  const card = document.createElement('section');
  card.id = 'pwa-install-card';
  card.className = 'st-card';
  const grid = settings.querySelector('.st-grid');
  // Place after the Workspace card, before Danger zone
  const danger = grid.querySelector('.st-card.is-danger');
  if (danger) grid.insertBefore(card, danger);
  else grid.appendChild(card);
  renderInstallCard();
}

function renderInstallCard() {
  const card = document.getElementById('pwa-install-card');
  if (!card) return;
  const p = platform();

  if (p.isStandalone) {
    card.innerHTML = `
      <h3>Installed ✓</h3>
      <p class="st-note">You're running SaaS Spend Track as an installed app. Nice.</p>
    `;
    return;
  }

  if (p.isIOS && p.isSafari) {
    card.innerHTML = `
      <h3>Install on iPhone / iPad</h3>
      <p class="st-note">Add to Home Screen to use SaaS Spend Track like a real app. Keeps you in full-screen mode, works offline after first load.</p>
      <ol class="pwa-steps">
        <li>Tap the <b>Share</b> button in Safari (square with up arrow)</li>
        <li>Scroll and tap <b>Add to Home Screen</b></li>
        <li>Name it (default is fine) → <b>Add</b></li>
      </ol>
      <p class="pwa-note">Chrome and other browsers on iOS can't install PWAs - Apple restricts it to Safari.</p>
    `;
    return;
  }

  if (p.isIOS && !p.isSafari) {
    card.innerHTML = `
      <h3>Install on iPhone / iPad</h3>
      <p class="st-note">Open this page in <b>Safari</b> first (Apple restricts installs to Safari on iOS). Then Share → Add to Home Screen.</p>
    `;
    return;
  }

  if (deferredInstallPrompt) {
    card.innerHTML = `
      <h3>Install this app</h3>
      <p class="st-note">Install SaaS Spend Track as a standalone app on this device. Launches without the browser chrome, works offline after first load.</p>
      <button type="button" class="st-save" id="pwa-install-btn">Install app</button>
    `;
    card.querySelector('#pwa-install-btn').onclick = async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('[PWA] user choice:', outcome);
      deferredInstallPrompt = null;
      renderInstallCard();
    };
    return;
  }

  if (p.isAndroid) {
    card.innerHTML = `
      <h3>Install on Android</h3>
      <p class="st-note">In Chrome, tap the menu (three dots) → <b>Install app</b> or <b>Add to Home screen</b>.</p>
    `;
    return;
  }

  card.innerHTML = `
    <h3>Install as an app</h3>
    <p class="st-note">Your browser should show an install icon in the address bar. On Chrome / Edge it's a small computer-with-arrow icon on the right side of the URL. Click it to install.</p>
    <p class="pwa-note">On Firefox + Safari (desktop), PWA install isn't available - but the app runs fine in a regular tab.</p>
  `;
}

/* Hook into switchView so the card renders when Settings opens */
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const prev = window.switchView;
    if (typeof prev !== 'function' || prev._p54) return;
    window.switchView = function (name, opts) {
      const r = prev.apply(this, arguments);
      if (name === 'settings') setTimeout(injectInstallCard, 180);
      return r;
    };
    window.switchView._p54 = true;
  }, 800);
});

/* Public handle */
window.PWA = {
  canInstall: () => !!deferredInstallPrompt,
  prompt: async () => {
    if (!deferredInstallPrompt) return 'no-prompt-available';
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return outcome;
  },
  platform,
  isStandalone: () => platform().isStandalone,
};

})();
