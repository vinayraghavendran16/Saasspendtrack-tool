# Phase 45: Trial email nurture drip - setup

Five-email sequence over 14 days. Runs entirely out of your
existing Apps Script project - no new backend, no third-party ESP,
no CRM. Uses the Gmail quota of the Google account that owns the
script (100/day free, 1,500/day Workspace).

## The sequence

| Day | Email | Sent to |
|---|---|---|
| 2 | *Fastest way to see what SaaS Spend Track does* | Users with no contract and no bulk import yet |
| 4 | *Three findings worth looking for on your dashboard* | Users who've loaded data |
| 8 | *What the first 90 days with SaaS Spend Track usually look like* | All active trials |
| 12 | *Your SaaS Spend Track trial ends Friday* | All active trials |
| 14 | *Last day on your SaaS Spend Track trial* | All active trials |

Paid users are automatically excluded. Users who reply "stop" or
"unsubscribe" can be moved to an opt-out sheet (see below).

## Install (3 minutes)

### 1. Paste the drip code

Open the Apps Script project bound to your Signups Sheet
(**Extensions → Apps Script** from the Sheet), scroll to the
bottom of `Code.gs`, and paste the entire contents of
`drip-emails.gs` **below** your existing signup code.

**Important:** the drip file has placeholder config constants
(`APP_URL`, `REPLY_TO`, `SUPPORT_PHONE`, etc.) commented out at
the top. Your existing signup code already defines these, so
leave the commented-out lines in the drip file alone. JavaScript
will throw `Identifier 'APP_URL' has already been declared` if
you uncomment them.

Save (Cmd+S).

### 2. Install the time-driven trigger

- In the Apps Script editor's left sidebar, click the **clock icon** (Triggers)
- Click **+ Add Trigger** (bottom right)
- Configure:
  - **Choose which function to run**: `runDailyDrip`
  - **Which deployment**: Head
  - **Event source**: Time-driven
  - **Type of time-based trigger**: Day timer
  - **Time of day**: 9am to 10am
  - **Failure notification**: Notify me immediately
- Click **Save**
- Grant Mail permission if prompted (you may have already done this when wiring the welcome email)

### 3. Test immediately (optional but recommended)

From the Apps Script editor's function dropdown (next to Debug), select
**testDripNow** and click **Run**. This:

- Reads your Signups sheet
- Builds the per-user state table
- Sends any eligible drip emails *right now* based on the current date
- Logs each send back to the sheet as `event_type = drip_<id>_sent`

You should see a log line like `runDailyDrip: {"eligible":2,"sent":2,"skipped":5,"errors":0}` in the execution log at the bottom of the editor.

To see the raw state table without sending anything, run **previewTrialState** instead - it logs every user's current day-number and completion flags to the console.

## Turn it off temporarily

In the Triggers panel, click the three-dot menu next to the drip trigger → **Disable trigger**. Re-enable the same way. No code changes needed.

## Opt-out handling

When a user replies with "stop":

1. Open your Signups Sheet
2. Add a new sheet named exactly **Opt Out** (no other sheet name - the drip looks for this specific name)
3. Paste the email address into column A
4. Done - next daily run excludes them

You can also add multiple emails on multiple rows, and the drip ignores empty cells.

## Changing the copy

All five emails are defined at the top of `drip-emails.gs` in the
`DRIP_EMAILS` array. Each one has a `plain` function (plain-text
version) and an `html` function (HTML version for most mail
clients). Edit either. No deployment or trigger reconfig needed -
Apps Script picks up changes on the next scheduled run.

If you want to change the pricing CTA destination, search for
`#pricing` in the drip file - it appears in three emails.

## Adding a new email (e.g. day 7)

Append to the `DRIP_EMAILS` array:

```javascript
{
  id: 'd07_use_case',          // stable id, logged to the sheet
  day: 7,                      // which trial-day this fires on
  when: (s) => s.hasContract && !s.paid,   // eligibility rule
  subject: 'How finance teams use SaaS Spend Track',
  plain: (s) => 'Hi,\n\n...body...',
  html:  (s) => dripHtml(s, 'Heading', ['Para 1', 'Para 2'], { cta: 'Open', ctaUrl: APP_URL }),
}
```

Save. Next daily run fires it for anyone currently on day 7 and
matching the `when` rule.

## Deliverability notes

- First-time emails to a new recipient commonly go to **Promotions** in Gmail. They'll sort to Inbox from the second or third email as Gmail learns the address.
- Your sending reputation lives on the Google account that owns the Apps Script. If you plan to send > 50 trial starts a day, consider migrating to Resend / Postmark / MailerSend - the drip code would stay the same shape; only the `MailApp.sendEmail(...)` call would change.
- Keep the plaintext version meaningful - some corporate email systems strip HTML.

## How the state detection works

The drip reads the Signups sheet (which is now also the Events sheet, since every onboarding action POSTs there). For each email address it builds a state object:

```
{
  email:         user@company.com
  signupAt:      Date - earliest trial_started event
  paid:          true if any payment_completed / paid_marked / manual_paid cell
  hasContract:   true if onboarding_item_completed with item_id=upload_contract
  bulkImported:  true if bulk_import_completed or add_vendor completed
  askTrackUsed:  true if onboarding_item_completed with item_id=ask_track
  sent:          { d02_stuck: timestamp, ... }
}
```

Each day's rule inspects that state and decides. The browser code
in Phase 43/44 already fires the events this needs - no additional
client-side work required.

## What's NOT in Phase 45 (deliberate)

- **A/B testing on subject lines**. Add later - needs an experiment table in the sheet.
- **Per-email open/click tracking**. Needs pixel hosting + redirect, which is a different set of problems and often gets blocked by corporate mail anyway. Rely on reply-rate as the quality signal for now.
- **Segmentation by company size / industry**. The signup form only collects email + optional company name, so there's nothing to segment on. If you add firmographics later, extend the `when` functions.
- **A second sequence for paid users (customer-success drip)**. Easy to add once you have paying customers. Not needed yet.
- **Webhooks from Razorpay**. When a user pays, you'd ideally fire a `payment_completed` event into the sheet so the drip stops instantly instead of waiting until the next day. Razorpay supports this via webhooks - a future phase can wire that up.

## Testing locally without waiting for 9am

The `testDripNow()` function sends immediately based on the current date. But the eligibility rules use real day-numbers, so if nobody in your Signups sheet is on day 2 / 4 / 8 / 12 / 14 right now, nothing will send.

To force a specific user to receive a specific email, temporarily backdate their `trial_started` row's timestamp in the sheet (e.g. subtract 4 days to test the day-4 email), then run `testDripNow`. Restore the timestamp after.

Or: add a `DRIP_FORCE_SEND = true` constant and skip the `already sent` check - but remember to revert before the real trigger runs the next day, or every active trial will get spammed with every email at once.
