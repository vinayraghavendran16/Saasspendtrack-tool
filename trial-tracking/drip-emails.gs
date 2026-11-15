/**
 * Phase 45 — Trial email nurture drip
 *
 * Append this to your existing signup-endpoint.gs project (same
 * Apps Script bound to the Signups Sheet). You do NOT need a new
 * deployment URL for this; it runs via a time-driven trigger, not
 * over HTTP.
 *
 * Setup (one time):
 *   1. Paste this file's contents at the bottom of Code.gs
 *   2. Save
 *   3. In the Apps Script editor sidebar: click the clock icon
 *      ("Triggers") → Add Trigger
 *        - Function: runDailyDrip
 *        - Deployment: Head
 *        - Event source: Time-driven
 *        - Type: Day timer
 *        - Time of day: 9am to 10am (your local IST)
 *      → Save. Grant permission when asked.
 *   4. (Optional) To test immediately without waiting for 9am,
 *      run the `testDripNow` function from the editor — it
 *      executes runDailyDrip() once.
 *
 * How it works:
 *   - Reads the Signups sheet (every event: trial_started,
 *     bulk_import_completed, onboarding_item_completed, etc.)
 *   - Builds a per-email state view: when did they sign up, did
 *     they upload a contract, did they bulk-import, did they
 *     use Ask Track, did they pay?
 *   - Decides the right email for each user's day-number and
 *     state, skipping anything already sent or opted-out
 *   - Logs every send back to the sheet as event_type =
 *     drip_<id>_sent so future runs don't double-send
 *
 * Opt-out: if a user replies with "stop" or "unsubscribe", add
 * their email to the "Opt Out" sheet (any single-column sheet
 * named "Opt Out" works) and they're excluded.
 */

/* ---- Config (shared with signup endpoint) --------------------- */

// These constants probably already exist at the top of your
// Code.gs — if so, DELETE the duplicates below. Only one copy
// should live in the file.
//
// const APP_URL        = 'https://app.saasspendtrack.com/';
// const WEBSITE_URL    = 'https://saasspendtrack.com/';
// const FROM_NAME      = 'SaaS Spend Track';
// const REPLY_TO       = 'you@yourdomain.com';
// const SUPPORT_PHONE  = '+91 90000 00000';

const DRIP_TRIAL_DAYS = 14;           // match the browser tool
const OPT_OUT_SHEET_NAME = 'Opt Out'; // optional sheet of opt-out emails

/* ---- Email catalog -------------------------------------------- */

/* Each entry defines ONE email in the sequence. The drip runs
   once per day and picks at most one eligible email per user.

   fields:
     id          — stable short id, logged back to the sheet
     day         — the trial-day this email targets (1=signup day)
     when        — function(state) → true if the user should get it
     subject     — email subject
     plain       — function(state) → plain-text body
     html        — function(state) → html body
*/
const DRIP_EMAILS = [

  /* Day 2: no contract yet, nudge them to load a sample */
  {
    id: 'd02_stuck',
    day: 2,
    when: (s) => !s.hasContract && !s.bulkImported && !s.paid,
    subject: 'Fastest way to see what SaaS Spend Track does',
    plain: (s) => [
      'Hi ' + (s.company ? ('team at ' + s.company) : 'there') + ',',
      '',
      "You signed up two days ago but haven't loaded a contract yet.",
      "I know — PDFs of MSAs are never where you expect them. So here's the shortcut:",
      '',
      '1. Open ' + APP_URL,
      '2. Go to Contract terms',
      '3. Click "Load a sample contract" (top of the form)',
      '',
      "That runs the parser on a realistic MSA. You'll see",
      "renewal date, notice window, auto-renew clause, price-cap,",
      "all pulled out in 10 seconds. That's the value prop in one screen.",
      '',
      "If you'd rather see your own spend first, use Bulk Import on",
      "the Subscriptions tab — paste your vendor spreadsheet and",
      "the tool builds the dashboard in one click.",
      '',
      'Any questions, hit reply.',
      '',
      '— Vinay',
    ].join('\n'),
    html: (s) => dripHtml(s, "Fastest way to see what SaaS Spend Track does", [
      "You signed up two days ago but haven't loaded a contract yet. I know — PDFs of MSAs are never where you expect them. So here's the shortcut.",
      '<b>1.</b> Open the tool and go to <b>Contract terms</b><br/><b>2.</b> Click <b>"Load a sample contract"</b><br/><b>3.</b> Watch the parser pull out renewal date, notice window, auto-renew clause, and price-cap in 10 seconds.',
      "That's the value prop in one screen.",
      "If you'd rather see your own spend first, use <b>Bulk Import</b> on the Subscriptions tab — paste your vendor spreadsheet and the tool builds the dashboard in one click.",
    ], { cta: 'Open the tool', ctaUrl: APP_URL }),
  },

  /* Day 4: they have contracts/vendors — show a finding they'd miss */
  {
    id: 'd04_finding',
    day: 4,
    when: (s) => (s.hasContract || s.bulkImported) && !s.paid,
    subject: 'Three findings worth looking for on your dashboard',
    plain: (s) => [
      'Hi ' + (s.company ? ('team at ' + s.company) : 'there') + ',',
      '',
      "You've loaded data in SaaS Spend Track — good. Now the part",
      "that pays for itself. Three things worth checking today:",
      '',
      '1. Auto-renew traps',
      '   Open the Risk tab. Anything flagged red is a contract',
      '   auto-renewing within the notice window. Missing the window',
      '   is how a one-year commitment turns into another full year',
      '   you didn\'t sign off on. Fix: diary the notice date now.',
      '',
      '2. Licences you paid for but nobody uses',
      '   Licence usage tab. Any vendor where utilization is under',
      '   60% is a renewal negotiation lever. "We\'re at 45% of seats',
      '   — drop us to 30 seats or we\'ll move." Vendors cave more',
      '   than you\'d think.',
      '',
      '3. Overlapping tools',
      '   Same category, multiple vendors. Zoom + Google Meet,',
      '   Figma + Adobe XD, Notion + Confluence. Each of those is',
      '   a consolidation conversation worth having.',
      '',
      "The dashboard flags these automatically but it's worth",
      "walking through them yourself the first time.",
      '',
      'Reply with what you find — I collect them.',
      '',
      '— Vinay',
    ].join('\n'),
    html: (s) => dripHtml(s, "Three findings worth looking for on your dashboard", [
      "You've loaded data in SaaS Spend Track — good. Now the part that pays for itself. Three things worth checking today.",
      '<b>1. Auto-renew traps</b><br/>Open the <b>Risk</b> tab. Anything flagged red is a contract auto-renewing within the notice window. Missing the window is how a one-year commitment turns into another full year you didn\'t sign off on. Fix: diary the notice date now.',
      '<b>2. Licences you paid for but nobody uses</b><br/>Licence usage tab. Any vendor where utilization is under 60% is a renewal negotiation lever. "We\'re at 45% of seats — drop us to 30 seats or we\'ll move." Vendors cave more than you\'d think.',
      '<b>3. Overlapping tools</b><br/>Same category, multiple vendors. Zoom + Google Meet, Figma + Adobe XD, Notion + Confluence. Each of those is a consolidation conversation worth having.',
      "The dashboard flags these automatically but it's worth walking through them yourself the first time. Reply with what you find.",
    ], { cta: 'Open the Risk tab', ctaUrl: APP_URL + '#risk' }),
  },

  /* Day 8: ROI framing */
  {
    id: 'd08_roi',
    day: 8,
    when: (s) => !s.paid,
    subject: 'What the first 90 days with SaaS Spend Track usually look like',
    plain: (s) => [
      'Hi ' + (s.company ? ('team at ' + s.company) : 'there') + ',',
      '',
      "You've been in the tool for about a week. Here's the pattern",
      "across the teams I've helped set it up:",
      '',
      'Week 1  — Contracts loaded, overlaps surfaced. Usually a',
      '          couple of "we are still paying for that?" moments.',
      'Week 2  — First auto-renew flagged before the notice window',
      '          closes. That one flag often pays back the whole',
      '          annual price of the tool.',
      'Week 4  — First renewal negotiated down. Usage data becomes',
      '          a lever: "we are at 45%, cut the commit or we go".',
      'Week 8  — Procurement starts forwarding new tool requests',
      '          here first, before signing.',
      'Week 12 — Finance uses the monthly spend summary at the',
      '          quarterly review. Tool becomes part of the process.',
      '',
      "You get that from any SaaS management tool costing 10-20x",
      "what this does. The reason this one is priced where it is:",
      "it runs entirely in your browser, no backend to pay for,",
      "no seat-based pricing, no onboarding consultant.",
      '',
      'If you want to lock in trial pricing before you need it:',
      APP_URL + '#pricing',
      '',
      "If it's not a fit, no hard feelings — reply and tell me why.",
      "I use every one of those replies.",
      '',
      '— Vinay',
    ].join('\n'),
    html: (s) => dripHtml(s, "What the first 90 days with SaaS Spend Track usually look like", [
      "You've been in the tool for about a week. Here's the pattern across the teams I've helped set it up.",
      '<b>Week 1</b> — Contracts loaded, overlaps surfaced. Usually a couple of "we are still paying for that?" moments.<br/><b>Week 2</b> — First auto-renew flagged before the notice window closes. That one flag often pays back the whole annual price of the tool.<br/><b>Week 4</b> — First renewal negotiated down. Usage data becomes a lever: "we are at 45%, cut the commit or we go".<br/><b>Week 8</b> — Procurement starts forwarding new tool requests here first, before signing.<br/><b>Week 12</b> — Finance uses the monthly spend summary at the quarterly review. Tool becomes part of the process.',
      "You get that from any SaaS management tool costing 10–20x what this does. The reason this one is priced where it is: it runs entirely in your browser, no backend to pay for, no seat-based pricing, no onboarding consultant.",
      "If it's not a fit, reply and tell me why. I use every one of those replies.",
    ], { cta: 'See pricing', ctaUrl: APP_URL + '#pricing' }),
  },

  /* Day 12: trial ends in 2 days */
  {
    id: 'd12_expiry',
    day: 12,
    when: (s) => !s.paid,
    subject: 'Your SaaS Spend Track trial ends Friday',
    plain: (s) => [
      'Hi ' + (s.company ? ('team at ' + s.company) : 'there') + ',',
      '',
      "Quick heads-up: your trial ends in two days.",
      '',
      "What happens on day 14: the tool continues to work but",
      "upgrades are gated behind a payment screen. Your data stays",
      "in your browser untouched — nothing is deleted. You can pay",
      "any time and pick up where you left off.",
      '',
      'Pay now (keep everything you have loaded):',
      APP_URL + '#pricing',
      '',
      "Not sure yet? Reply and tell me what's missing. If it's",
      "something I can build fast, I will. If it's not a fit, no",
      "pressure — your trial just sunsets quietly.",
      '',
      '— Vinay',
    ].join('\n'),
    html: (s) => dripHtml(s, "Your SaaS Spend Track trial ends Friday", [
      "Quick heads-up: your trial ends in two days.",
      "<b>What happens on day 14:</b> the tool continues to work but upgrades are gated behind a payment screen. Your data stays in your browser untouched — nothing is deleted. You can pay any time and pick up where you left off.",
      "Not sure yet? Reply and tell me what's missing. If it's something I can build fast, I will. If it's not a fit, no pressure — your trial just sunsets quietly.",
    ], { cta: 'Pay & activate', ctaUrl: APP_URL + '#pricing' }),
  },

  /* Day 14: last call */
  {
    id: 'd14_lastcall',
    day: 14,
    when: (s) => !s.paid,
    subject: 'Last day on your SaaS Spend Track trial',
    plain: (s) => [
      'Hi ' + (s.company ? ('team at ' + s.company) : 'there') + ',',
      '',
      "Last day of the trial.",
      '',
      "Your data stays in your browser whether you pay or not —",
      "nothing is deleted on day 15 or ever. The paid plan unlocks",
      "the full view (exports, team seats, API access) and is how",
      "I keep the lights on.",
      '',
      'Pay here, ~30 seconds:',
      APP_URL + '#pricing',
      '',
      "If the timing is wrong and you want another 7 days, just",
      "reply and I'll extend you.",
      '',
      '— Vinay',
    ].join('\n'),
    html: (s) => dripHtml(s, "Last day on your SaaS Spend Track trial", [
      "Last day of the trial.",
      "Your data stays in your browser whether you pay or not — nothing is deleted on day 15 or ever. The paid plan unlocks the full view (exports, team seats, API access) and is how I keep the lights on.",
      "If the timing is wrong and you want another 7 days, just reply and I'll extend you.",
    ], { cta: 'Pay & activate', ctaUrl: APP_URL + '#pricing' }),
  },
];

/* ---- HTML template (shared) ----------------------------------- */

function dripHtml(state, heading, paragraphs, action) {
  const supportLine = (typeof SUPPORT_PHONE !== 'undefined' && SUPPORT_PHONE)
    ? ('Any questions, hit reply or message ' + SUPPORT_PHONE + '.')
    : 'Any questions, hit reply.';
  return [
    '<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color:#101828; max-width: 560px; line-height:1.55; font-size:15px;">',
    '  <div style="background:#0b1120; color:#fff; padding:20px 24px; border-radius:10px 10px 0 0;">',
    '    <div style="display:inline-block; width:36px; height:36px; background:#2563eb; color:#fff; font-weight:800; font-size:14px; text-align:center; line-height:36px; border-radius:8px; vertical-align:middle;">SST</div>',
    '    <span style="font-weight:700; font-size:16px; margin-left:12px; vertical-align:middle;">SaaS Spend Track</span>',
    '  </div>',
    '  <div style="border:1px solid #e4e7ec; border-top:0; border-radius:0 0 10px 10px; padding:24px;">',
    '    <h2 style="margin:0 0 14px; font-size:19px; line-height:1.3;">' + heading + '</h2>',
    paragraphs.map(p => '<p style="margin:0 0 14px;">' + p + '</p>').join('\n    '),
    action ? '    <p style="margin:24px 0;"><a href="' + action.ctaUrl + '" style="background:#2563eb; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">' + action.cta + ' &rarr;</a></p>' : '',
    '    <hr style="border:0; border-top:1px solid #e4e7ec; margin:22px 0;"/>',
    '    <p style="font-size:13px; color:#667085;">' + supportLine + '</p>',
    '    <p style="font-size:12px; color:#98a2b3; margin-top:20px;">You are getting this because you started a trial of SaaS Spend Track. Reply with <b>stop</b> and I will remove you from this list.</p>',
    '  </div>',
    '</div>',
  ].join('\n');
}

/* ---- Main entry point (time-driven trigger calls this) -------- */

function runDailyDrip() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const events = ss.getActiveSheet();     // the Signups sheet
  const optOutSet = loadOptOuts(ss);
  const state = buildTrialState(events);

  const today = new Date();
  const results = { eligible: 0, sent: 0, skipped: 0, errors: 0 };

  Object.keys(state).forEach(email => {
    const s = state[email];
    if (!s.email || !s.signupAt) return;
    if (optOutSet.has(s.email.toLowerCase())) { results.skipped++; return; }
    if (s.paid) { results.skipped++; return; }

    const day = daysBetween(s.signupAt, today);
    if (day < 1 || day > DRIP_TRIAL_DAYS) { results.skipped++; return; }

    for (const mail of DRIP_EMAILS) {
      if (mail.day !== day) continue;
      if (s.sent[mail.id]) continue;       // already sent this one
      if (!mail.when(s)) continue;
      results.eligible++;
      try {
        MailApp.sendEmail({
          to: s.email,
          subject: mail.subject,
          body: mail.plain(s),
          htmlBody: mail.html(s),
          name: (typeof FROM_NAME !== 'undefined') ? FROM_NAME : 'SaaS Spend Track',
          replyTo: (typeof REPLY_TO !== 'undefined') ? REPLY_TO : null,
        });
        // Log back to events sheet so future runs don't resend.
        logDripSent(events, s.email, mail.id, day);
        results.sent++;
      } catch (err) {
        console.error('drip send failed', s.email, mail.id, err);
        results.errors++;
      }
      break;   // one email per user per day, max
    }
  });

  console.log('runDailyDrip:', JSON.stringify(results));
  return results;
}

/* ---- Trial state derivation ----------------------------------- */

/* Reads all event rows and builds, per email, a single state
   object the drip rules can inspect. */
function buildTrialState(events) {
  const lastRow = events.getLastRow();
  if (lastRow < 2) return {};
  const headers = events.getRange(1, 1, 1, events.getLastColumn()).getValues()[0];
  const rows = events.getRange(2, 1, lastRow - 1, events.getLastColumn()).getValues();

  const col = {};
  headers.forEach((h, i) => col[String(h || '').trim()] = i);

  const state = {};
  rows.forEach(r => {
    const email = String(r[col.email] || '').trim().toLowerCase();
    if (!email || email.indexOf('@') < 0) return;
    const eventType = String(r[col.event_type] || '').trim();
    const ts = r[col.timestamp] ? new Date(r[col.timestamp]) : null;
    const s = state[email] = state[email] || {
      email, company: '', signupAt: null, paid: false,
      hasContract: false, bulkImported: false, askTrackUsed: false,
      sent: {},
    };
    // Company name from whichever row has it
    if (r[col.company] && !s.company) s.company = String(r[col.company]).trim();

    if (eventType === 'trial_started') { if (!s.signupAt || ts < s.signupAt) s.signupAt = ts; }
    if (eventType === 'paid_marked' || eventType === 'payment_completed') s.paid = true;
    if (r[col.manual_paid] && String(r[col.manual_paid]).trim()) s.paid = true;
    if (eventType === 'bulk_import_completed') s.bulkImported = true;
    if (eventType === 'onboarding_item_completed') {
      const itemId = String(r[col.item_id] || '').trim();
      if (itemId === 'upload_contract') s.hasContract = true;
      if (itemId === 'ask_track')       s.askTrackUsed = true;
      if (itemId === 'add_vendor')      s.bulkImported = true;  // same bucket
    }
    if (eventType && eventType.indexOf('drip_') === 0 && eventType.endsWith('_sent')) {
      const id = eventType.replace(/^drip_/, '').replace(/_sent$/, '');
      s.sent[id] = ts || true;
    }
  });
  return state;
}

/* ---- Opt-out sheet (optional) --------------------------------- */

function loadOptOuts(ss) {
  const sh = ss.getSheetByName(OPT_OUT_SHEET_NAME);
  const set = new Set();
  if (!sh) return set;
  const vals = sh.getDataRange().getValues();
  vals.forEach(r => r.forEach(cell => {
    const v = String(cell || '').trim().toLowerCase();
    if (v && v.indexOf('@') > 0) set.add(v);
  }));
  return set;
}

/* ---- Logging back to the events sheet ------------------------- */

function logDripSent(events, email, dripId, dayNumber) {
  const headers = events.getRange(1, 1, 1, events.getLastColumn()).getValues()[0];
  const now = new Date();
  // Build a row matching the header order; empty where we don't have data.
  const row = headers.map(h => {
    switch (String(h || '').trim()) {
      case 'timestamp':   return now;
      case 'event_type':  return 'drip_' + dripId + '_sent';
      case 'email':       return email;
      case 'email_sent':  return 'drip';
      case 'item_id':     return dripId;
      case 'manual_paid': return '';
      default:            return '';
    }
  });
  events.appendRow(row);
}

/* ---- Utilities ------------------------------------------------- */

function daysBetween(then, now) {
  if (!then) return -1;
  const ms = now.getTime() - then.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/* ---- Manual test from the editor ------------------------------ */

function testDripNow() {
  const r = runDailyDrip();
  console.log('Test run result:', JSON.stringify(r));
  return r;
}

/* ---- Preview the state table without sending anything --------- */

function previewTrialState() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const state = buildTrialState(ss.getActiveSheet());
  const now = new Date();
  const summary = Object.values(state).map(s => ({
    email: s.email,
    signupAt: s.signupAt ? s.signupAt.toISOString() : null,
    day: s.signupAt ? daysBetween(s.signupAt, now) : null,
    paid: s.paid,
    hasContract: s.hasContract,
    bulkImported: s.bulkImported,
    askTrackUsed: s.askTrackUsed,
    sent: Object.keys(s.sent).join(','),
  }));
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}
