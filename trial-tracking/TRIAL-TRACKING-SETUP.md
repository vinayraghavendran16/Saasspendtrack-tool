# Trial signup tracking

Captures every trial signup to a Google Sheet so you can see who's trying the tool, where they're from, and follow up.

## What happens

1. First-time visitor opens https://app.saasspendtrack.com
2. A modal appears: "Start your 14-day trial. One field. No credit card."
3. They enter their work email (required) and company name (optional)
4. On submit, the tool POSTs to your Google Apps Script endpoint, which appends a row to your Sheet
5. The workspace is marked as captured so the modal never shows again for that browser

If the endpoint is unreachable (offline, placeholder URL, misconfigured), the signup is queued in the user's localStorage and retried on the next page load. No data is lost.

## One-time setup

### 1. Create the Google Sheet

1. Open https://sheets.new (or create a blank sheet)
2. Name it "SaaS Spend Track trial signups"
3. Leave it empty; the script will add headers automatically on the first submission

### 2. Bind the Apps Script

1. In the Sheet: **Extensions → Apps Script**
2. Delete the default `Code.gs` content
3. Paste the entire contents of [`signup-endpoint.gs`](./signup-endpoint.gs) from this folder
4. **File → Save** (name the project "SST Signup Endpoint" if asked)

### 3. Deploy as a Web App

1. In the Apps Script editor: **Deploy → New deployment**
2. Click the gear icon next to "Select type" → choose **Web app**
3. Settings:
   - Description: "SST signup endpoint v1"
   - Execute as: **Me** (your Google account)
   - Who has access: **Anyone** (this is the only way the tool can POST to it without OAuth)
4. Click **Deploy**
5. Google will ask for authorisation on first deploy. Click through:
   - "Review permissions" → pick your account → "Advanced" → "Go to SST Signup Endpoint (unsafe)" → "Allow"
   - The "unsafe" warning is because it's your own script, not published to the Google Workspace Marketplace. Safe.
6. Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/AKfycbz....../exec`

### 4. Wire the URL into the tool

**Option A: Edit the code** (requires a push)
- Open `saasspendtrack-tool/extensions21.js`
- Replace the line `const SIGNUP_ENDPOINT_DEFAULT = '...PASTE-YOUR-DEPLOYMENT-ID...'` with your real URL
- Commit and push; Cloudflare Pages auto-deploys in 15 seconds

**Option B: Set at runtime** (no code change)
- Open https://app.saasspendtrack.com in your browser
- Open DevTools → Console
- Run: `AskTrackSignup.setEndpoint('https://script.google.com/macros/s/YOUR-ID/exec')`
- The URL is stored in your localStorage. Only works for your browser.
- Better to use Option A so it's set for every visitor.

### 5. Test

1. Open https://app.saasspendtrack.com in an incognito window
2. The signup modal should appear
3. Enter a test email (`test@example.com`)
4. Click "Start my 14-day trial"
5. Check your Sheet. A new row should appear within 1-2 seconds.
6. If it doesn't: check the Apps Script editor's **Executions** panel for errors (usually a permissions issue, see step 3 again)

## What you'll see in the Sheet

| timestamp | email | company | country | locale | referrer | utm_source | ... |
|---|---|---|---|---|---|---|---|
| 2026-11-14T06:12:04 | priya@acmecorp.in | Acme Corp | IN | en-IN | https://saasspendtrack.com/ | distributor-jp | ... |

Useful next steps:

1. **Filter by `country`** to see Indian vs global trials
2. **Count rows per day** with `=COUNTIF(A:A, ">="&TODAY())` for today's signups
3. **Filter by `manual_paid=yes`** to see users who claimed they already paid
4. **Share the sheet** with your distributor so they see their referrals (use UTM params on the links they share: `https://app.saasspendtrack.com/?utm_source=jp-distributor&ref=acme-intro`)

## Dashboard (Looker Studio, free)

1. In the Sheet: **File → Share → Share with Google Looker Studio** (or go to lookerstudio.google.com → New report → Google Sheets connector)
2. Pick your trial signups sheet
3. Suggested widgets:
   - **Scorecard**: count of rows = total signups
   - **Scorecard**: count where timestamp >= TODAY() = today's signups
   - **Scorecard**: count where timestamp >= TODAY()-7 = last 7 days
   - **Pie chart**: `country` breakdown
   - **Bar chart**: `utm_source` breakdown
   - **Table**: email, company, country, timestamp, sorted by timestamp desc, top 50 rows

Save and share the Looker Studio URL with anyone who needs to see the dashboard.

## Follow-up workflow

1. Daily (5 minutes): open the sheet, scan new rows
2. For Indian signups: trigger your distributor flow, send a WhatsApp
3. For global signups: send a personal email within 24 hours (shows you noticed)
4. Flag hot ones (large company, strong signal) with a status column you add manually

## Troubleshooting

**Modal doesn't appear in my own browser**
- You already have a workspace. Run `AskTrackSignup.reset()` in the console to force the modal back.

**Sheet rows aren't landing**
- Check the Apps Script **Executions** panel (left sidebar in the editor)
- Confirm the deployment URL is current; every "New deployment" creates a new URL
- Confirm "Who has access" was set to **Anyone**, not "Anyone with Google account"

**Need a different column**
- Edit the `HEADERS` array in `signup-endpoint.gs`
- Add the matching field in `captureContext()` in `extensions21.js`
- Redeploy the Apps Script (**Deploy → Manage deployments → pencil icon → New version → Deploy**)

## Migrating off Apps Script later

When you have the server tier running, replace the single `SIGNUP_ENDPOINT_DEFAULT` URL in `extensions21.js` with your API endpoint (e.g., `https://api.saasspendtrack.com/signups`). Keep the same JSON shape and nothing else needs to change. The pending-signups queue in localStorage will drain on first load.
