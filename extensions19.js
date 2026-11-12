/* ==========================================================================
   SaaS Spend Track — Phase 25
   Vendor contact book
   ---------------------------------------------------------------------------
   Capture the vendor-side context that makes renewals real conversations:
   AE/CSM name, direct email, phone, LinkedIn, last outreach timestamp,
   next-touch date, and freeform renewal notes. Lives on each subscription
   in state.subscriptions[i].contactBook. Rendered as:

   1. A new sub-section inside the contract review modal (so it's one
      click from every vendor row)
   2. A standalone "Vendor contacts" view that lists the full book across
      the portfolio with "last outreach > 60 days" warning flags
   3. Quick-draft email button that builds a personalised renegotiation
      email using the vendor + contact + contract context, opens the
      user's mail client with the draft prefilled

   All in-browser. Each contact is scoped to its vendor.
   ========================================================================== */

/* ---------- State access ---------- */
function vendorContact(sub) {
  sub.contactBook = sub.contactBook || {};
  return sub.contactBook;
}

/* ---------- Standalone Vendor Contacts view ---------- */
function renderContactBook() {
  const host = document.getElementById('cb-body'); if (!host) return;
  const subs = (state.subscriptions || []).filter(v => v.status !== 'cancelled');
  const total = subs.length;
  const withContact = subs.filter(v => vendorContact(v).email).length;
  const stale = subs.filter(v => {
    const c = vendorContact(v);
    if (!c.lastOutreach) return true;
    const days = Math.round((Date.now() - new Date(c.lastOutreach).getTime()) / 86400000);
    return days > 60;
  }).length;

  host.innerHTML = `
    <div class="cb-kpis">
      <div class="kpi"><div class="kpi-label">Vendors with a contact</div><div class="kpi-value">${withContact}<span class="dim" style="font-size:12px"> / ${total}</span></div></div>
      <div class="kpi"><div class="kpi-label">Missing a contact</div><div class="kpi-value" style="color:${total - withContact > 0 ? '#f59e0b' : 'var(--ink)'}">${total - withContact}</div></div>
      <div class="kpi"><div class="kpi-label">Stale (no touch >60d)</div><div class="kpi-value" style="color:${stale > 0 ? '#ef4444' : 'var(--ink)'}">${stale}</div></div>
      <div class="kpi"><div class="kpi-label">Portfolio value</div><div class="kpi-value">${formatMoney(subs.reduce((a, s) => a + annualCost(s), 0))}/yr</div></div>
    </div>

    <div class="cb-table-wrap">
      <table class="cb-table">
        <thead><tr>
          <th>Vendor</th><th>AE / CSM</th><th>Email</th><th>Phone</th><th>Last touch</th><th>Next touch</th><th>Notes</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${subs.sort((a, b) => annualCost(b) - annualCost(a)).map(v => {
            const c = vendorContact(v);
            const lastDays = c.lastOutreach ? Math.round((Date.now() - new Date(c.lastOutreach).getTime()) / 86400000) : null;
            const lastClass = lastDays === null ? 'cb-stale' : lastDays > 60 ? 'cb-stale' : lastDays > 30 ? 'cb-aging' : '';
            return `<tr class="${lastClass}" data-vendor-id="${v.id}">
              <td><b>${escapeHtml(v.name)}</b><div class="dim" style="font-size:11px">${escapeHtml(v.department || '—')}</div></td>
              <td><input class="cb-edit" data-field="name" data-vendor="${v.id}" value="${escapeHtml(c.name || '')}" placeholder="AE or CSM name"/></td>
              <td><input class="cb-edit" data-field="email" data-vendor="${v.id}" value="${escapeHtml(c.email || '')}" placeholder="name@vendor.com" type="email"/></td>
              <td><input class="cb-edit" data-field="phone" data-vendor="${v.id}" value="${escapeHtml(c.phone || '')}" placeholder="+91 ..."/></td>
              <td><input class="cb-edit" data-field="lastOutreach" data-vendor="${v.id}" value="${c.lastOutreach || ''}" type="date"/>${lastDays !== null ? `<div class="dim" style="font-size:10px">${lastDays}d ago</div>` : ''}</td>
              <td><input class="cb-edit" data-field="nextOutreach" data-vendor="${v.id}" value="${c.nextOutreach || ''}" type="date"/></td>
              <td><input class="cb-edit cb-notes" data-field="notes" data-vendor="${v.id}" value="${escapeHtml(c.notes || '')}" placeholder="Last call, concessions, etc."/></td>
              <td>
                <button class="icon-btn cb-draft" data-vendor="${v.id}" title="Draft renewal email">✉️</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Wire edits
  host.querySelectorAll('.cb-edit').forEach(input => {
    input.onchange = () => {
      const vid = input.dataset.vendor;
      const field = input.dataset.field;
      const sub = (state.subscriptions || []).find(s => s.id === vid);
      if (!sub) return;
      vendorContact(sub)[field] = input.value;
      save();
      renderContactBook();
    };
  });
  host.querySelectorAll('.cb-draft').forEach(b => b.onclick = () => draftRenewalEmail(b.dataset.vendor));
}

/* ---------- Draft renewal email ---------- */
function draftRenewalEmail(vendorId) {
  const sub = (state.subscriptions || []).find(s => s.id === vendorId);
  if (!sub) return;
  const c = vendorContact(sub);
  if (!c.email) {
    toast(`Add an email for ${sub.name} first — then the draft can address it to the right person.`, 'warn');
    return;
  }
  const annual = annualCost(sub);
  const seats = +sub.users || +sub.licenses || 0;
  const active = +sub.activeUsers || Math.round(seats * ((sub.utilizationPct ?? 75) / 100));
  const util = seats ? Math.round(active / seats * 100) : null;
  const renewal = sub.renewal || 'our next renewal';
  const contactFirstName = (c.name || '').split(' ')[0] || 'there';

  const subject = `${sub.name} renewal — a few questions before ${renewal}`;
  const body = [
    `Hi ${contactFirstName},`,
    ``,
    `We're starting our ${sub.name} renewal review for ${renewal}. Before we lock anything in, I wanted to flag a few points from our end.`,
    ``,
    seats ? `We currently have ${seats} seats contracted and active usage is at ${active} (${util}% utilisation). Given the gap, we'd like to discuss right-sizing the seat count at renewal.` : null,
    `Our annual commitment with you sits at ${formatMoney(annual)}. We're reviewing a renegotiation on both pricing and term length.`,
    ``,
    `Could we set up 30 minutes next week to walk through: price, right-sizing, term, and anything new in your roadmap that would influence our decision?`,
    ``,
    `Thanks,`,
    `${workspace()?.ownerEmail?.split('@')[0] || ''}`,
  ].filter(Boolean).join('\n');

  // Open the user's mail client
  const mailto = `mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.open(mailto, '_blank');
  // Log last outreach
  c.lastOutreach = new Date().toISOString().slice(0, 10);
  save();
  renderContactBook();
  toast('Draft opened in your mail client. Last-touch date recorded.', 'success');
}

/* ---------- Inline contact pane inside the contract review modal ----------
   The contract review modal is openContractDetail(id). We hook in by
   observing the modal's DOM and injecting our pane. */
function injectContactPaneIntoModal() {
  const modal = document.getElementById('contract-detail-modal');
  if (!modal || !modal.classList.contains('open')) return;
  if (modal.querySelector('.cb-pane')) return;
  // Find the currently-open vendor id
  const titleEl = modal.querySelector('.modal-head h3, .cd-title');
  const nameShown = titleEl?.textContent?.trim();
  if (!nameShown) return;
  const sub = (state.subscriptions || []).find(s => s.name === nameShown);
  if (!sub) return;
  const c = vendorContact(sub);
  const pane = document.createElement('div');
  pane.className = 'cb-pane';
  pane.innerHTML = `
    <h4>Vendor contact</h4>
    <div class="cb-pane-grid">
      <label>AE / CSM<input class="cb-pane-edit" data-field="name" value="${escapeHtml(c.name || '')}" placeholder="Rep name"/></label>
      <label>Email<input class="cb-pane-edit" data-field="email" value="${escapeHtml(c.email || '')}" placeholder="name@vendor.com" type="email"/></label>
      <label>Phone<input class="cb-pane-edit" data-field="phone" value="${escapeHtml(c.phone || '')}" placeholder="+91 ..."/></label>
      <label>LinkedIn<input class="cb-pane-edit" data-field="linkedin" value="${escapeHtml(c.linkedin || '')}" placeholder="linkedin.com/in/..."/></label>
      <label>Last outreach<input class="cb-pane-edit" data-field="lastOutreach" value="${c.lastOutreach || ''}" type="date"/></label>
      <label>Next outreach<input class="cb-pane-edit" data-field="nextOutreach" value="${c.nextOutreach || ''}" type="date"/></label>
    </div>
    <label>Notes<textarea class="cb-pane-edit" data-field="notes" rows="2" placeholder="Last call concessions, what the vendor is pushing, roadmap items...">${escapeHtml(c.notes || '')}</textarea></label>
    <div class="cb-pane-actions">
      <button class="icon-btn cb-pane-draft">✉️ Draft renewal email</button>
    </div>
  `;
  // Insert after the head
  const body = modal.querySelector('.modal-body') || modal.querySelector('.cd-body') || modal;
  body.appendChild(pane);
  pane.querySelectorAll('.cb-pane-edit').forEach(el => {
    el.onchange = () => { vendorContact(sub)[el.dataset.field] = el.value; save(); };
  });
  pane.querySelector('.cb-pane-draft').onclick = () => draftRenewalEmail(sub.id);
}

// Watch for the modal opening
const _modalObserver = new MutationObserver(() => {
  try { injectContactPaneIntoModal(); } catch (_) {}
});
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const m = document.getElementById('contract-detail-modal');
    if (m) _modalObserver.observe(m, { attributes: true, childList: true, subtree: false });
  }, 1000);
});

/* ---------- View + nav ---------- */
function ensureContactBookView() {
  if (document.getElementById('contacts')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'contacts'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Vendor contacts</h2>
        <p class="page-sub">Every vendor's rep, direct line, and last touch date in one place. Draft renegotiation emails with one click — context from your contract is pre-filled.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="icon-btn" data-pdf-export="cb-body" data-pdf-title="Vendor contacts">Download PDF</button>
      </div>
    </div>
    <div id="cb-body"></div>
    <style>
      .cb-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px; }
      .cb-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 4px; overflow-x: auto; }
      .cb-table { width: 100%; border-collapse: collapse; font-size: 12px; }
      .cb-table th { position: sticky; top: 0; background: var(--surface-2); color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.04em; font-size: 10.5px; padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--border); }
      .cb-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); vertical-align: top; }
      .cb-table tr.cb-stale td { background: rgba(239,68,68,0.04); }
      .cb-table tr.cb-aging td { background: rgba(245,158,11,0.04); }
      .cb-edit { width: 100%; background: var(--surface-2); color: var(--ink); border: 1px solid transparent; border-radius: 4px; padding: 4px 6px; font-size: 11.5px; }
      .cb-edit:focus { border-color: var(--accent); background: var(--surface); outline: none; }
      .cb-notes { font-size: 11px; }
      .cb-draft { background: var(--accent); color: #fff; border: 0; cursor: pointer; padding: 4px 8px; border-radius: 4px; }
      /* Contact pane inside the contract modal */
      .cb-pane { background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 14px; margin-top: 14px; }
      .cb-pane h4 { margin: 0 0 10px; font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-dim); }
      .cb-pane-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
      .cb-pane label { display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: var(--ink-dim); }
      .cb-pane input, .cb-pane textarea { background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: 5px; padding: 5px 7px; font-size: 12px; font-family: inherit; }
      .cb-pane-actions { display: flex; justify-content: flex-end; margin-top: 10px; }
      .cb-pane-draft { background: var(--accent); color: #fff; border: 0; padding: 7px 14px; border-radius: 6px; cursor: pointer; }
      @media (max-width: 760px) { .cb-pane-grid { grid-template-columns: 1fr; } }
    </style>
  `;
  main.appendChild(section);
  renderContactBook();
}

function ensureContactBookNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const g = [...groups].find(x => x.querySelector('[data-view="team"]')) || [...groups].find(x => x.querySelector('[data-view="subscriptions"]')) || groups[1];
  if (!g || g.querySelector('[data-view="contacts"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'contacts';
  btn.innerHTML = `${svg}<span>Vendor contacts</span>`;
  g.appendChild(btn);
  btn.addEventListener('click', () => switchView('contacts'));
}

/* Patch switchView */
const _origSwForCb = window.switchView;
if (_origSwForCb && !window._cbSwitchPatched) {
  window.switchView = function (name, opts) {
    if (name === 'contacts') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0 });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Vendor contacts';
      if (!opts?.replaceHistory) {
        const target = '#contacts';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      renderContactBook();
      return;
    }
    return _origSwForCb(name, opts);
  };
  window._cbSwitchPatched = true;
}

if (window.PAGE_TITLES) { window.PAGE_TITLES.contacts = 'Vendor contacts'; }

const _prevAll19 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll19) {
  window.renderAll = function () {
    _prevAll19();
    try { ensureContactBookView(); ensureContactBookNav(); } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => { try { ensureContactBookView(); ensureContactBookNav(); } catch (_) {} }, 900);
});
