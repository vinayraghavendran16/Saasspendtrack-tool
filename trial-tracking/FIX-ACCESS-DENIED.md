# Fix: nothing landing in the Sheet, no email sent

## Root cause

A `curl` of the deployment URL
`https://script.google.com/macros/s/AKfycbyaZnzM7Qq22uRyAcQ_PEQuXpZNRkdFhJuz2PZ2Csn_bt7LN2HXa6F-CbAmkh684kA/exec`
returns a Google **Access Denied / "You need access"** page.

That means the Web App is currently deployed as **"Who has access: Only
myself"** (the default). Every browser POST from the app hits that auth
wall before it ever reaches your `doPost`. The row never writes. The
browser cannot see the 401 because the POST runs in `no-cors` mode (it
must, otherwise the CORS preflight fails against Apps Script).

This is the single most common Apps Script trial-funnel bug and the
one-line fix is below.

## Fix (3 minutes)

### 1. Open the Apps Script project

Open your Google Sheet `SaaS Spend Track Signups` and go to
**Extensions → Apps Script**.

### 2. Replace the script with the new version

Open `trial-tracking/signup-endpoint.gs` in this repo and paste the
whole file over the existing `Code.gs`.

Fill in the two config lines at the top:

```javascript
const REPLY_TO       = 'your@email.com';   // where replies land
const SUPPORT_PHONE  = '+91 90000 00000';  // or '' to omit
```

Save.

### 3. Deploy as a Web App, PUBLIC

Click **Deploy → Manage deployments**. On your existing active
deployment, click the **pencil (Edit)** icon on the right.

- Version: **New version**
- Execute as: **Me (your-email@gmail.com)**
- Who has access: **Anyone** ← this is the fix

Click **Deploy**. If it asks for authorization, grant it (it needs
Mail + Sheets permissions now).

The URL stays the same — you do NOT need to change it in the app.

### 4. Confirm

In a browser, open the `/exec` URL. You should see:

```json
{
  "ok": true,
  "product": "SaaS Spend Track signup endpoint",
  "message": "Alive. POST signups here from the tool.",
  "headers_expected": [...],
  "quota_remaining_email": 100
}
```

If you see JSON instead of the HTML "Access Denied" page, you're done.

### 5. End-to-end test

- Hard reload `https://app.saasspendtrack.com/` (Cmd+Shift+R)
- In a Private/Incognito window, open the app and enter your email
- Row lands in the Sheet within 2 seconds
- Welcome email lands in your inbox within 10 seconds (check Spam
  the first time — the first email from a new sender often gets
  held there, after which Gmail learns)

If the row still doesn't land, open **Apps Script → Executions** and
you'll see the exact error for every POST.

## Why not fix this without redeploying?

You can't. "Who has access" is a deployment-time setting, not something
the code can change. Pasting new code without a new deployment also
does nothing — Web App deployments are versioned, and only the version
pinned to the deployment runs.

## Email deliverability notes

- The mail sends FROM the Google account that owns the Apps Script
  (whichever Google account you were signed in with when you created
  it). Free Gmail quota is 100 mails/day. Workspace is 1,500/day.
- Reply-To is set to `REPLY_TO` in the config, so replies land in your
  real inbox even though the "from" is the script owner's address.
- To send from `vinay@saasspendtrack.com` instead of your Gmail,
  you need to either (a) set up that address as a Gmail "Send mail
  as" alias on the script-owner account, or (b) move to an SMTP/API
  mail service (Resend, Postmark, MailerSend). The Apps Script code
  stays the same; only the delivery method changes.
