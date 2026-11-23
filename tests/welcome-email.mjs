import assert from 'node:assert/strict';
import { welcomeEmail } from '../functions/_shared/email.js';

const appUrl = 'https://app.saasspendtrack.com';
const mail = welcomeEmail('', appUrl);
assert.match(mail.subject, /7-day trial/);
assert.match(mail.html, /no credit card required/i);
assert.match(mail.html, /starts when you sign up/i);
assert.match(mail.html, /first subscription/i);
assert.match(mail.html, /reply to this email/i);
assert.match(mail.html, /saved data stays/i);
assert.match(mail.html, /https:\/\/app\.saasspendtrack\.com/);
assert.doesNotMatch(mail.html, /1000 leads|install your tracking script|unlimited AI|10 seconds/i);
const escaped = welcomeEmail('<unsafe&company>', appUrl);
assert.doesNotMatch(escaped.html, /<unsafe&company>/);
assert.match(escaped.html, /&lt;unsafe&amp;company&gt;/);
console.log('PASS: trial welcome copy, accurate terms, CTA and HTML escaping');
