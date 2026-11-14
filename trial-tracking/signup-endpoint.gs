/**
 * SaaS Spend Track — Trial signup endpoint
 *
 * Paste this into script.google.com (bound to the Sheet where signups land)
 * and deploy as a Web App with "Who has access = Anyone" (otherwise the
 * browser POST hits Google's auth wall and the row is never written —
 * which is the failure mode if you see "Access Denied" on the /exec URL).
 *
 * Setup steps are in TRIAL-TRACKING-SETUP.md
 */

// Required columns on the Sheet (row 1 as header, in this order):
const HEADERS = [
  'timestamp', 'event_type', 'email', 'previous_email', 'company',
  'country', 'locale', 'referrer',
  'utm_source', 'utm_medium', 'utm_campaign', 'ref',
  'workspace_id', 'user_agent', 'manual_paid', 'ip', 'email_sent'
];

// --- Config --------------------------------------------------------------
// FILL THESE IN before deploying. The email address is used as the
// reply-to on the welcome email. The script sends FROM the Google
// account that owns the Apps Script (that's a Gmail quota of 100/day on
// free / 1500/day on Workspace — plenty for a trial funnel).
const APP_URL        = 'https://app.saasspendtrack.com/';
const WEBSITE_URL    = 'https://saasspendtrack.com/';
const FROM_NAME      = 'SaaS Spend Track';
const REPLY_TO       = 'REPLACE_WITH_YOUR_EMAIL';   // e.g. the owner's inbox
const SUPPORT_PHONE  = 'REPLACE_WITH_YOUR_PHONE';   // or leave empty string

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Ensure headers exist on row 1
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight('bold').setBackground('#0f2a5e').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    const params = e.parameter || {};
    const eventType = (params.event_type || '').toLowerCase();
    const email = (params.email || '').trim();
    let emailSent = '';

    // Send the welcome email on trial_started and email_changed.
    // Not on paid_marked (internal event).
    if ((eventType === 'trial_started' || eventType === 'email_changed')
        && email && email.indexOf('@') > 0) {
      try {
        sendWelcomeEmail(email, params.company || '', eventType === 'email_changed');
        emailSent = eventType === 'email_changed' ? 'yes (change)' : 'yes';
      } catch (mailErr) {
        emailSent = 'failed: ' + String(mailErr);
      }
    }

    // Build row in header order; missing fields are empty strings
    const row = HEADERS.map(h => {
      if (h === 'email_sent') return emailSent;
      return params[h] || '';
    });

    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({
      ok: true, row: sheet.getLastRow(), email_sent: emailSent
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // Log to Executions so you can see failures even when the browser
    // can't read the response (no-cors mode).
    console.error('doPost failed', err);
    return ContentService.createTextOutput(JSON.stringify({
      ok: false, error: String(err)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// GET on the same URL for a sanity check.
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    product: 'SaaS Spend Track signup endpoint',
    message: 'Alive. POST signups here from the tool.',
    headers_expected: HEADERS,
    quota_remaining_email: MailApp.getRemainingDailyQuota()
  })).setMimeType(ContentService.MimeType.JSON);
}

// --- Welcome email -------------------------------------------------------

function sendWelcomeEmail(toEmail, company, isChange) {
  const subject = isChange
    ? 'Your SaaS Spend Track access link (updated email)'
    : 'Your SaaS Spend Track trial is live';

  const greetingName = company ? ('team at ' + company) : 'there';

  const plain = [
    'Hi ' + greetingName + ',',
    '',
    (isChange
      ? "We've updated your SaaS Spend Track email. Here's your access link:"
      : "Welcome to SaaS Spend Track. Your 14-day trial is live."),
    '',
    'Open the tool:',
    APP_URL,
    '',
    'A few things worth knowing:',
    '',
    '1. Everything runs in your browser. Contracts, vendor data, and',
    '   spend never leave your device. Nothing to install, no backend.',
    '',
    '2. Bookmark the link above. Loading it on any browser gives you',
    '   a fresh workspace for that browser; your original workspace',
    '   stays on the browser you started with.',
    '',
    '3. On day 14 the tool asks for payment to keep going. If you want',
    '   to upgrade early, there is a Pay button inside the tool.',
    '',
    (SUPPORT_PHONE
      ? ('Any questions, hit reply or message ' + SUPPORT_PHONE + '. I read')
      : 'Any questions, hit reply. I read'),
    'every one of these personally.',
    '',
    'Vinay',
    'Whizzlead Solutions OPC Private Limited',
    WEBSITE_URL
  ].join('\n');

  const html = [
    '<div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; color:#101828; max-width: 560px; line-height:1.55; font-size:15px;">',
    '  <div style="background:#0b1120; color:#fff; padding:20px 24px; border-radius:10px 10px 0 0;">',
    '    <div style="display:inline-block; width:36px; height:36px; background:#2563eb; color:#fff; font-weight:800; font-size:14px; text-align:center; line-height:36px; border-radius:8px; vertical-align:middle;">SST</div>',
    '    <span style="font-weight:700; font-size:16px; margin-left:12px; vertical-align:middle;">SaaS Spend Track</span>',
    '  </div>',
    '  <div style="border:1px solid #e4e7ec; border-top:0; border-radius:0 0 10px 10px; padding:24px;">',
    '    <h2 style="margin:0 0 12px; font-size:20px;">' + (isChange
      ? "We've updated your access email"
      : "Your 14-day trial is live") + '</h2>',
    '    <p>Hi ' + escapeHtml(greetingName) + ',</p>',
    '    <p>' + (isChange
      ? "Here's your SaaS Spend Track access link on the new email address:"
      : "Thanks for starting a trial. Open the tool with the button below and import your first contract.") + '</p>',
    '    <p style="margin:24px 0;"><a href="' + APP_URL + '" style="background:#2563eb; color:#fff; padding:12px 20px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">Open SaaS Spend Track &rarr;</a></p>',
    '    <p style="font-size:13px; color:#667085;">Or paste this in your browser:<br/><a href="' + APP_URL + '">' + APP_URL + '</a></p>',
    '    <hr style="border:0; border-top:1px solid #e4e7ec; margin:24px 0;"/>',
    '    <p style="font-size:13.5px;"><b>A few things worth knowing</b></p>',
    '    <ol style="font-size:13.5px; padding-left:18px; color:#344054;">',
    '      <li style="margin-bottom:8px;">Everything runs in your browser. Contracts, vendor data, and spend never leave your device.</li>',
    '      <li style="margin-bottom:8px;">Bookmark the link. Loading it on any browser gives that browser a fresh workspace; your first workspace stays on the browser you started with.</li>',
    '      <li>On day 14 the tool asks for payment to keep going. There is a Pay button inside the tool whenever you want to upgrade.</li>',
    '    </ol>',
    (SUPPORT_PHONE
      ? ('    <p style="font-size:13px; color:#667085; margin-top:24px;">Any questions, hit reply or message ' + SUPPORT_PHONE + '. I read every one of these personally.</p>')
      : '    <p style="font-size:13px; color:#667085; margin-top:24px;">Any questions, hit reply. I read every one of these personally.</p>'),
    '    <p style="font-size:13px; color:#667085; margin-top:20px;">Vinay<br/>Whizzlead Solutions OPC Private Limited<br/><a href="' + WEBSITE_URL + '" style="color:#2563eb;">' + WEBSITE_URL + '</a></p>',
    '  </div>',
    '</div>'
  ].join('\n');

  MailApp.sendEmail({
    to: toEmail,
    subject: subject,
    body: plain,
    htmlBody: html,
    name: FROM_NAME,
    replyTo: REPLY_TO
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// --- One-off test you can run from the editor --------------------------
// Click this function in the Apps Script editor's function dropdown, press
// Run, grant mail permission once, then check your inbox.
function testWelcomeEmail() {
  sendWelcomeEmail(Session.getActiveUser().getEmail(), 'Your Company');
}
