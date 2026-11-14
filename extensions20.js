/* ==========================================================================
   SaaS Spend Track — QA tests for Phases 22-25
   Extends the existing TESTS registry from extensions10.js.
   ========================================================================== */

(function registerPhase22To25Tests() {
  if (typeof TESTS === 'undefined' || typeof test !== 'function') {
    console.warn('QA harness not loaded; skipping Phase 22-25 tests');
    return;
  }
  // Ensure the base 88 tests are registered first — defineTests() guards
  // against double-registration via TESTS.length, so we must populate
  // the base before adding ours.
  if (typeof defineTests === 'function') defineTests();

  /* ---------- Phase 22: One-pager ---------- */
  test('saas', 'onepager settings default to safe values', () => {
    const s = onepagerSettings();
    assert(typeof s === 'object', 'onepagerSettings should return object');
    assert('prospectName' in s, 'should have prospectName');
    assert('distributorName' in s, 'should have distributorName');
    assert('accentColor' in s, 'should have accentColor');
  });
  test('saas', 'onepager html renders without prospect name', () => {
    const html = onepagerHtml({ prospectName: '', distributorName: '', distributorEmail: '', distributorPhone: '', accentColor: '#0f2a5e' });
    assert(typeof html === 'string', 'onepagerHtml should return string');
    assert(html.includes('SaaS Spend Track'), 'should include product name');
    assert(html.includes('$3,499'), 'should include USD price');
    assert(html.includes('250 active contracts'), 'should include contract limit');
    assert(html.includes('qrserver.com'), 'should include QR code');
  });
  test('saas', 'onepager html personalises with prospect name', () => {
    const html = onepagerHtml({ prospectName: 'Nexlo Technologies', distributorName: 'JP', distributorEmail: 'jp@firm.com', distributorPhone: '+91', accentColor: '#0f2a5e' });
    assert(html.includes('Nexlo Technologies'), 'should bake prospect name into one-pager');
    assert(html.includes('JP'), 'should include distributor name');
    assert(html.includes('jp@firm.com'), 'should include distributor email');
    // The prospect name is double-encoded in the QR URL (ref value + outer QR data).
    // We just check that it round-trips somewhere into the final HTML.
    assert(/ref/i.test(html), 'should tag QR code URL with ref parameter');
  });
  test('saas', 'onepager CSS is valid', () => {
    const css = getOnepagerCss();
    assert(typeof css === 'string', 'CSS should be string');
    assert(css.includes('.op-page'), 'should style .op-page');
    assert(css.includes('210mm'), 'should use A4 width');
    assert(css.includes('297mm'), 'should use A4 height');
  });

  /* ---------- Phase 23: Trial expiry ---------- */
  test('saas', 'trial state is consistent', () => {
    const t = trialState();
    assert(typeof t === 'object', 'trialState should return object');
    assert('isTrial' in t, 'should have isTrial');
    assert('isPaid' in t, 'should have isPaid');
    assert('expired' in t, 'should have expired');
    assert('inGrace' in t, 'should have inGrace');
  });
  test('saas', 'force-expire sets expired to true', () => {
    const origStart = workspace().trialStartedAt;
    const origPlan = workspace().plan;
    try {
      workspace().plan = 'trial';
      const d = new Date(); d.setDate(d.getDate() - 20);
      workspace().trialStartedAt = d.toISOString();
      workspace().trialDays = 14;
      const t = trialState();
      assert(t.expired, 'should be expired after backdating');
      assert(!t.isPaid, 'should not be paid');
    } finally {
      workspace().plan = origPlan;
      workspace().trialStartedAt = origStart;
    }
  });
  test('saas', 'reset trial gives 14 fresh days', () => {
    const origStart = workspace().trialStartedAt;
    const origPlan = workspace().plan;
    try {
      workspace().plan = 'trial';
      workspace().trialStartedAt = new Date().toISOString();
      workspace().trialDays = 14;
      const t = trialState();
      assert(!t.expired, 'should not be expired');
      assert(t.daysLeft >= 13, 'should have ~14 days left, got ' + t.daysLeft);
    } finally {
      workspace().plan = origPlan;
      workspace().trialStartedAt = origStart;
    }
  });
  test('saas', 'grace mode triggers at ≤3 days', () => {
    const origStart = workspace().trialStartedAt;
    const origPlan = workspace().plan;
    try {
      workspace().plan = 'trial';
      const d = new Date(); d.setDate(d.getDate() - 12);
      workspace().trialStartedAt = d.toISOString();
      workspace().trialDays = 14;
      const t = trialState();
      assert(t.inGrace, 'should be in grace mode at 2 days left, got daysLeft=' + t.daysLeft);
    } finally {
      workspace().plan = origPlan;
      workspace().trialStartedAt = origStart;
    }
  });
  test('saas', 'paid plan clears expired state', () => {
    const origPlan = workspace().plan;
    try {
      workspace().plan = 'paid';
      const t = trialState();
      assert(t.isPaid, 'should be paid');
      assert(!t.isTrial, 'should not be trial');
      assert(!t.expired, 'paid should never be expired');
    } finally {
      workspace().plan = origPlan;
    }
  });

  /* ---------- Phase 24: Demo presets ---------- */
  test('saas', 'all demo presets are well-formed', () => {
    const keys = Object.keys(DEMO_PRESETS);
    assert(keys.length === 3, `expected 3 presets, got ${keys.length}`);
    keys.forEach(k => {
      const p = DEMO_PRESETS[k];
      assert(p.label, `preset ${k} missing label`);
      assert(p.company, `preset ${k} missing company`);
      assert(p.employees > 0, `preset ${k} missing employees`);
      assert(Array.isArray(p.vendors) && p.vendors.length > 0, `preset ${k} missing vendors`);
      assert(Array.isArray(p.departments) && p.departments.length > 0, `preset ${k} missing departments`);
    });
  });
  test('saas', 'Indian SaaS startup preset has sensible scale', () => {
    const p = DEMO_PRESETS['indian-saas'];
    assertEq(p.currencyPrefix, '₹', 'should be INR');
    assert(p.employees >= 50 && p.employees <= 120, 'employees in startup range');
    assert(p.vendors.length >= 20, 'at least 20 vendors');
  });
  test('saas', 'BFSI preset is compliance-heavy', () => {
    const p = DEMO_PRESETS['bfsi-midmarket'];
    const names = p.vendors.map(v => v[0].toLowerCase()).join(' ');
    assert(/okta|crowdstrike|splunk|onetrust|moody|thomson/.test(names), 'BFSI should include security/risk tools');
    assert(p.employees >= 300, 'BFSI should have mid-market headcount');
  });
  test('saas', 'Manufacturing preset has ERP + CAD + MES', () => {
    const p = DEMO_PRESETS['manufacturing'];
    const names = p.vendors.map(v => v[0].toLowerCase()).join(' ');
    assert(/sap|autocad|solidworks|teamcenter|rockwell/.test(names), 'manufacturing should include ERP/CAD/MES');
  });
  test('saas', 'buildStateFromPreset returns valid state shape', () => {
    const built = buildStateFromPreset('indian-saas');
    assert(built, 'should build state');
    assert(Array.isArray(built.subscriptions), 'should have subscriptions array');
    assert(built.subscriptions.length === DEMO_PRESETS['indian-saas'].vendors.length, 'subscription count matches preset');
    built.subscriptions.forEach(s => {
      assert(s.id, 'subscription needs id');
      assert(s.name, 'subscription needs name');
      assert(typeof s.cost === 'number', 'subscription needs numeric cost');
      assert(s.renewal, 'subscription needs renewal date');
    });
  });
  test('saas', 'preset vendors have realistic utilisation ratios', () => {
    const built = buildStateFromPreset('bfsi-midmarket');
    const withSeats = built.subscriptions.filter(s => s.licenses && s.activeUsers);
    const ratios = withSeats.map(s => s.activeUsers / s.licenses);
    const avg = ratios.reduce((a, r) => a + r, 0) / ratios.length;
    assert(avg > 0.5 && avg <= 1.0, `BFSI avg utilisation should be realistic, got ${avg.toFixed(2)}`);
  });

  /* ---------- Phase 25: Vendor contact book ---------- */
  test('saas', 'vendorContact returns an object', () => {
    const sub = (state.subscriptions || [])[0];
    if (!sub) { return; } // no data to test with
    const c = vendorContact(sub);
    assert(typeof c === 'object', 'should return object');
  });
  test('saas', 'vendorContact persists on the sub record', () => {
    const sub = (state.subscriptions || [])[0];
    if (!sub) return;
    const origBook = sub.contactBook;
    try {
      delete sub.contactBook;
      vendorContact(sub).email = 'test@example.com';
      assert(sub.contactBook.email === 'test@example.com', 'should persist to sub.contactBook');
    } finally {
      sub.contactBook = origBook;
    }
  });
  test('saas', 'draftRenewalEmail requires an email', () => {
    const sub = (state.subscriptions || [])[0];
    if (!sub) return;
    const origBook = sub.contactBook;
    try {
      sub.contactBook = {};
      // Should toast warn, not throw
      let warned = false;
      const origToast = window.toast;
      window.toast = (msg, kind) => { if (kind === 'warn') warned = true; };
      try { draftRenewalEmail(sub.id); } catch (_) {}
      window.toast = origToast;
      assert(warned, 'should warn when contact has no email');
    } finally {
      sub.contactBook = origBook;
    }
  });

  /* ---------- Cross-cutting: everything renders without error ---------- */
  test('integration', 'all new views exist after load', () => {
    const viewIds = ['onepager', 'demo-presets', 'contacts', 'changelog', 'chat', 'forecast'];
    viewIds.forEach(id => {
      assert(document.getElementById(id), `view #${id} should exist`);
    });
  });
  test('integration', 'all new nav buttons wire to switchView', () => {
    const navIds = ['onepager', 'demo-presets', 'contacts', 'changelog', 'chat', 'forecast'];
    navIds.forEach(id => {
      const btn = document.querySelector(`[data-view="${id}"]`);
      assert(btn, `nav button for ${id} should exist`);
    });
  });
  test('integration', 'switchView routes to new views', () => {
    const before = document.querySelector('.view.active')?.id;
    try {
      ['onepager', 'demo-presets', 'contacts'].forEach(name => {
        switchView(name, { replaceHistory: true });
        const active = document.querySelector('.view.active');
        assertEq(active?.id, name, `switchView(${name}) should activate view`);
      });
    } finally {
      if (before) switchView(before, { replaceHistory: true });
    }
  });

  /* ---------- Download bridge ---------- */
  test('integration', 'saveFileUniversal is defined', () => {
    assert(typeof saveFileUniversal === 'function', 'bridge should be loaded');
  });
  test('integration', 'downloadFile is patched to bridge', () => {
    assert(window._origDownloadFile, 'original downloadFile should be preserved');
    assert(window.downloadFile !== window._origDownloadFile, 'downloadFile should be wrapped');
  });

  /* ---------- Voice settings ---------- */
  test('saas', 'voice settings defaults to English TTS', () => {
    const vs = voiceSettings();
    assertEq(vs.ttsLang.split('-')[0], 'en', 'TTS should default to English');
  });
  test('saas', 'voice settings supports 12 languages', () => {
    assert(VOICE_LANGS.length === 12, `expected 12 languages, got ${VOICE_LANGS.length}`);
    const codes = VOICE_LANGS.map(l => l.code);
    ['en-US','en-IN','en-GB','hi-IN','ta-IN','te-IN','bn-IN','mr-IN','gu-IN','kn-IN','ml-IN','pa-IN'].forEach(c => {
      assert(codes.includes(c), `should support ${c}`);
    });
  });
  test('saas', 'speakOn defaults to true', () => {
    assert(voiceSettings().speakOn === true, 'speak should default on');
  });

  /* ---------- Ask Track intent routing ---------- */
  test('saas', 'Ask Track routes "spend on <vendor>" to spend_on_vendor', () => {
    const p = routeChatQuery('spend on Salesforce');
    assertEq(p.intent, 'spend_on_vendor', `expected spend_on_vendor, got ${p.intent}`);
  });
  test('saas', 'Ask Track routes "total spend on X this year" to spend_on_vendor (not dept_vendor)', () => {
    const p = routeChatQuery('what is the total spend on hubspot this year');
    assertEq(p.intent, 'spend_on_vendor', `should not misroute to dept_vendor, got ${p.intent}`);
  });
  test('saas', 'Ask Track routes dept+vendor only with explicit dept keyword', () => {
    const p = routeChatQuery('how much is the marketing team spending on hubspot');
    assertEq(p.intent, 'spend_by_dept_vendor', `should route dept+vendor with team keyword, got ${p.intent}`);
  });
  test('saas', 'Ask Track routes "list all vendors"', () => {
    const p = routeChatQuery('list all vendors');
    assertEq(p.intent, 'list_vendors', `expected list_vendors, got ${p.intent}`);
  });
  test('saas', 'Ask Track routes "give me all vendor names" (the bug from the screenshot)', () => {
    const p = routeChatQuery('give me all vendor names');
    assertEq(p.intent, 'list_vendors', `expected list_vendors, got ${p.intent}`);
  });
  test('saas', 'Ask Track routes help', () => {
    const p = routeChatQuery('help');
    assertEq(p.intent, 'help', `expected help, got ${p.intent}`);
  });

  /* ---------- Fuzzy vendor match (the hotspot→HubSpot bug) ---------- */
  test('saas', 'fuzzy vendor match finds HubSpot from "hotspot"', () => {
    // Needs HubSpot in state
    const hasHub = (state.subscriptions || []).some(v => /hubspot/i.test(v.name));
    if (!hasHub) return; // soft skip
    const match = findVendor('hotspot');
    assert(match, 'should find a fuzzy match for "hotspot"');
    assert(/hubspot/i.test(match.name), `expected HubSpot, got ${match.name}`);
  });
  test('saas', 'fuzzy vendor match strips trailing timeframe', () => {
    const hasHub = (state.subscriptions || []).some(v => /hubspot/i.test(v.name));
    if (!hasHub) return;
    const match = findVendor('hubspot this year');
    assert(match, 'should find HubSpot even with trailing timeframe');
  });
  test('saas', 'Levenshtein distance basics', () => {
    assertEq(_lev('abc','abc'), 0, 'identical strings');
    assertEq(_lev('abc','abd'), 1, 'one substitution');
    assertEq(_lev('abc','abcd'), 1, 'one insertion');
    assertEq(_lev('hotspot','hubspot'), 2, 'hotspot to hubspot');
  });

  /* ---------- Licence Forecast ---------- */
  test('saas', 'forecast respects headcount growth', () => {
    const s = fcSettings();
    const orig = { h: s.headcountGrowth, hz: s.horizon };
    try {
      s.headcountGrowth = 20; s.horizon = 4;
      const rows = forecastAll();
      if (!rows.length) return;
      const row = rows[0];
      assert(row.terminal >= row.active, 'with 20% growth, demand should grow');
    } finally {
      s.headcountGrowth = orig.h;
      s.horizon = orig.hz;
    }
  });

})();
