/**
 * SaaS Spend Track — Trial signup endpoint
 *
 * Paste this into script.google.com (New Project), bind it to the Sheet
 * where you want signups to land, and deploy as a Web App. The deployment
 * URL goes into extensions21.js as SIGNUP_ENDPOINT_DEFAULT (or set it at
 * runtime via `AskTrackSignup.setEndpoint('...')` in the browser console).
 *
 * Setup steps are in TRIAL-TRACKING-SETUP.md
 */

// Required columns on the Sheet (row 1 as header, in this order):
const HEADERS = [
  'timestamp', 'email', 'company', 'country', 'locale', 'referrer',
  'utm_source', 'utm_medium', 'utm_campaign', 'ref',
  'workspace_id', 'user_agent', 'manual_paid', 'ip'
];

function doPost(e) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Ensure headers exist on row 1
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#0f2a5e').setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // Parse the form-encoded body
    const params = e.parameter || {};

    // Build row in header order; missing fields are empty strings
    const row = HEADERS.map(h => {
      if (h === 'ip') {
        // Apps Script doesn't expose client IP natively; we get country from
        // the client's own ipapi.co lookup which is sent as 'country'
        return params.ip || '';
      }
      return params[h] || '';
    });

    sheet.appendRow(row);
    return ContentService.createTextOutput(JSON.stringify({ ok: true, row: sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helpful: GET on the same URL to sanity-check the endpoint is live
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    product: 'SaaS Spend Track signup endpoint',
    message: 'Alive. POST signups here from the tool.',
    headers_expected: HEADERS
  })).setMimeType(ContentService.MimeType.JSON);
}
