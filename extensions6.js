/* ==========================================================================
   SaaS Spend Track — Phase 5
   Clause commenting + approval chains
   - Per-clause threads keyed by subId + clauseId
   - Approval policy: thresholds trigger required sign-off by named roles
   - Approvals view: pending approvals board
   - Contract review modal gets a comment thread per clause
   ========================================================================== */

/* ---------------- State ---------------- */
function threads() { state.settings.threads = state.settings.threads || {}; return state.settings.threads; }
function threadKey(subId, clauseId) { return `${subId}::${clauseId || 'general'}`; }
function threadFor(subId, clauseId) {
  const t = threads();
  const k = threadKey(subId, clauseId);
  if (!t[k]) t[k] = { subId, clauseId: clauseId || 'general', messages: [], resolved: false };
  return t[k];
}
function postMessage(subId, clauseId, author, role, body) {
  const t = threadFor(subId, clauseId);
  t.messages.push({ id: crypto.randomUUID(), author, role, body, at: new Date().toISOString() });
  t.lastAt = new Date().toISOString();
  save();
}
function resolveThread(subId, clauseId, by) {
  const t = threadFor(subId, clauseId);
  t.resolved = true; t.resolvedAt = new Date().toISOString(); t.resolvedBy = by;
  save();
}
function reopenThread(subId, clauseId) {
  const t = threadFor(subId, clauseId);
  t.resolved = false; delete t.resolvedAt; delete t.resolvedBy;
  save();
}
function threadMetrics(subId) {
  const all = threads();
  const open = []; const resolved = [];
  Object.values(all).forEach(t => {
    if (t.subId !== subId) return;
    (t.resolved ? resolved : open).push(t);
  });
  return { open, resolved, total: open.length + resolved.length };
}

/* Default authors — in production these would come from the directory/SSO */
function currentAuthor() {
  return state.settings.currentAuthor || { name: 'You (Finance)', role: 'Finance' };
}

/* ---------------- Approval policy ---------------- */
function approvalPolicy() {
  return state.settings.approvalPolicy || {
    enabled: true,
    thresholds: [
      { minAnnual: 500000,  signers: ['Finance Manager'], label: '≥ ₹5L / yr' },
      { minAnnual: 2500000, signers: ['Finance Manager', 'CFO'], label: '≥ ₹25L / yr' },
      { minAnnual: 10000000, signers: ['Finance Manager', 'CFO', 'CEO'], label: '≥ ₹1Cr / yr' },
      { minAnnual: 0, signers: ['Legal'], label: 'Any contract with a critical risk score (≥ 70)', condition: 'critical_risk' },
      { minAnnual: 0, signers: ['Security'], label: 'Any contract with a missing DPA when a DPA is in the playbook', condition: 'missing_dpa' },
    ],
  };
}
function saveApprovalPolicy(p) { state.settings.approvalPolicy = p; save(); renderAll(); }

function requiredApprovals(sub) {
  const policy = approvalPolicy();
  if (!policy.enabled) return [];
  const annual = monthlyCost(sub) * 12;
  const risk = sub.contract ? scoreContract(sub, portfolioCtx()) : null;
  const pb = playbook();
  const ev = sub.contract ? evaluatePlaybook(sub) : null;
  const dpaRequired = pb.dpa?.required;
  const dpaMissing = dpaRequired && ev && ev.results.some(r => r.id === 'dpa' && r.state === 'missing');
  const need = new Set();
  policy.thresholds.forEach(t => {
    const dollarsOk = annual >= (t.minAnnual || 0);
    if (!dollarsOk) return;
    if (t.condition === 'critical_risk' && !(risk && risk.overall >= 70)) return;
    if (t.condition === 'missing_dpa' && !dpaMissing) return;
    t.signers.forEach(s => need.add(s));
  });
  return [...need];
}

function approvalsFor(sub) {
  return (state.settings.approvals || {})[sub.id] || {};
}
function recordApproval(subId, role, verdict, note) {
  state.settings.approvals = state.settings.approvals || {};
  state.settings.approvals[subId] = state.settings.approvals[subId] || {};
  state.settings.approvals[subId][role] = { verdict, note: note || '', at: new Date().toISOString(), by: currentAuthor().name };
  save(); renderAll();
}
function approvalStatus(sub) {
  const needed = requiredApprovals(sub);
  if (!needed.length) return { state: 'not_required', needed: [], done: [], pending: [] };
  const got = approvalsFor(sub);
  const done = []; const pending = []; const rejected = [];
  needed.forEach(r => {
    const g = got[r];
    if (!g) pending.push(r);
    else if (g.verdict === 'approve') done.push(r);
    else rejected.push(r);
  });
  let state_;
  if (rejected.length) state_ = 'rejected';
  else if (pending.length) state_ = 'pending';
  else state_ = 'approved';
  return { state: state_, needed, done, pending, rejected, approvals: got };
}

/* ---------------- Render: Approvals view ---------------- */
function renderApprovalsView() {
  const host = document.getElementById('approvals-body');
  if (!host) return;
  const subs = activeSubs().map(s => ({ s, a: approvalStatus(s) })).filter(x => x.a.state !== 'not_required');
  subs.sort((a, b) => {
    const order = { rejected: 0, pending: 1, approved: 2 };
    return order[a.a.state] - order[b.a.state];
  });
  const pending = subs.filter(x => x.a.state === 'pending');
  const approved = subs.filter(x => x.a.state === 'approved');
  const rejected = subs.filter(x => x.a.state === 'rejected');
  const policy = approvalPolicy();

  host.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">Contracts needing approval</span><span class="stat-value">${subs.length}</span><span class="stat-sub">per the active policy</span></div>
      <div class="stat-card"><span class="stat-label">Pending signature</span><span class="stat-value" style="color:var(--warning-text)">${pending.length}</span><span class="stat-sub">${pending.reduce((s, x) => s + x.a.pending.length, 0)} approver slot${pending.reduce((s, x) => s + x.a.pending.length, 0) === 1 ? '' : 's'}</span></div>
      <div class="stat-card"><span class="stat-label">Approved</span><span class="stat-value" style="color:var(--success-text)">${approved.length}</span><span class="stat-sub">full sign-off</span></div>
      <div class="stat-card"><span class="stat-label">Rejected</span><span class="stat-value" style="color:var(--danger-text)">${rejected.length}</span><span class="stat-sub">need rework</span></div>
    </div>

    <div class="panel-grid">
      <div class="panel span-2">
        <h2>Approval policy</h2>
        <p class="panel-sub">Policy fires automatically against every contract. Edit to match your company's delegation of authority.</p>
        <div class="appr-policy">
          <label class="check"><input type="checkbox" id="appr-enabled" ${policy.enabled ? 'checked' : ''}/> Policy enabled</label>
          <table class="sub-table" style="margin-top:12px">
            <thead><tr><th>Trigger</th><th>Required signers</th><th></th></tr></thead>
            <tbody>${policy.thresholds.map((t, i) => `<tr>
              <td>${escapeHtml(t.label)}</td>
              <td>${t.signers.map(s => `<span class="badge info">${escapeHtml(s)}</span>`).join(' ')}</td>
              <td class="actions-cell"><button class="icon-btn danger" data-appr-rm="${i}">Remove</button></td>
            </tr>`).join('')}</tbody>
          </table>
          <div class="integ-actions" style="margin-top:12px">
            <button class="icon-btn" id="appr-add">+ Add rule</button>
            <button class="icon-btn" id="appr-reset">Reset to defaults</button>
          </div>
        </div>
      </div>
    </div>

    ${['pending', 'rejected', 'approved'].map(bucket => {
      const items = subs.filter(x => x.a.state === bucket);
      if (!items.length) return '';
      const title = { pending: 'Pending approval', rejected: 'Rejected', approved: 'Approved' };
      const colour = { pending: 'warn', rejected: 'danger', approved: 'ok' };
      return `<section class="rc-lane">
        <div class="rc-lane-head"><div><h3>${title[bucket]} <span class="badge ${colour[bucket]}">${items.length}</span></h3></div></div>
        <div class="rc-cards">${items.map(({ s, a }) => approvalCard(s, a)).join('')}</div>
      </section>`;
    }).join('')}
  `;

  // Wire policy controls
  document.getElementById('appr-enabled').addEventListener('change', e => {
    const p = { ...policy, enabled: e.target.checked }; saveApprovalPolicy(p);
  });
  document.getElementById('appr-add').onclick = () => {
    const label = prompt('Rule label (e.g. "≥ ₹10L / yr"):');
    if (!label) return;
    const amt = prompt('Minimum annual spend in INR (0 for no minimum):', '500000');
    if (amt === null) return;
    const signers = prompt('Required signers, comma-separated (e.g. "Finance Manager, CFO"):', 'Finance Manager');
    if (!signers) return;
    const p = { ...policy };
    p.thresholds = [...p.thresholds, { minAnnual: parseInt(amt, 10) || 0, signers: signers.split(',').map(s => s.trim()).filter(Boolean), label }];
    saveApprovalPolicy(p);
  };
  document.getElementById('appr-reset').onclick = () => {
    delete state.settings.approvalPolicy; save(); renderAll();
  };
  host.querySelectorAll('[data-appr-rm]').forEach(b => b.onclick = () => {
    const p = { ...policy };
    p.thresholds = p.thresholds.filter((_, i) => i !== parseInt(b.dataset.apprRm, 10));
    saveApprovalPolicy(p);
  });
  host.querySelectorAll('[data-appr-action]').forEach(btn => btn.addEventListener('click', () => {
    const subId = btn.dataset.sub; const role = btn.dataset.role; const verdict = btn.dataset.apprAction;
    const note = prompt(`Add a note for ${verdict} by ${role} (optional):`, '');
    if (note === null) return;
    recordApproval(subId, role, verdict, note);
    toast(`${role} ${verdict === 'approve' ? 'approved' : 'rejected'}.`, verdict === 'approve' ? 'success' : 'warn');
  }));
}

function approvalCard(sub, status) {
  const annual = monthlyCost(sub) * 12;
  const approvals = approvalsFor(sub);
  return `<div class="rc-card lane-${status.state === 'pending' ? 'soon' : status.state === 'approved' ? 'renew' : 'overdue'}">
    <div class="rc-card-head">
      <div class="rc-vendor">
        <div class="avatar" style="background:${avatarColor(sub.name)}">${initials(sub.name)}</div>
        <div><div class="rc-name"><a href="#" class="vendor-link" data-vendor-nav="${sub.id}">${escapeHtml(sub.name)}</a></div>
             <div class="rc-meta">${escapeHtml(sub.team || '—')} · ${escapeHtml(sub.category || '—')}</div></div>
      </div>
      <div class="rc-cost"><div class="rc-cost-main">${formatMoney(annual)}</div><div class="rc-cost-sub">annual</div></div>
    </div>
    <div class="appr-roles">
      ${status.needed.map(role => {
        const got = approvals[role];
        const isDone = got && got.verdict === 'approve';
        const isReject = got && got.verdict === 'reject';
        return `<div class="appr-role ${isDone ? 'done' : isReject ? 'rejected' : 'pending'}">
          <div class="appr-role-head">
            <b>${escapeHtml(role)}</b>
            <span class="badge ${isDone ? 'ok' : isReject ? 'danger' : 'warn'}">${isDone ? 'Approved' : isReject ? 'Rejected' : 'Pending'}</span>
          </div>
          ${got ? `<div class="appr-role-sub">${escapeHtml(got.by)} · ${new Date(got.at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${got.note ? ' · ' + escapeHtml(got.note) : ''}</div>` : ''}
          ${!got ? `<div class="appr-role-actions">
            <button class="icon-btn" data-appr-action="approve" data-sub="${sub.id}" data-role="${escapeHtml(role)}">Approve</button>
            <button class="icon-btn danger" data-appr-action="reject" data-sub="${sub.id}" data-role="${escapeHtml(role)}">Reject</button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

/* ---------------- Clause comments in contract review modal ---------------- */
function extendContractReviewModal() {
  // Monkey-patch openContractDetail to append a comments section + approval status at the top
  const orig = window.openContractDetail;
  if (!orig || window._contractDetailExtended) return;
  window._contractDetailExtended = true;
  window.openContractDetail = function (id) {
    orig(id);
    const back = document.getElementById('contract-detail-modal'); if (!back) return;
    const modal = back.querySelector('.modal'); if (!modal) return;
    const sub = state.subscriptions.find(s => s.id === id); if (!sub) return;

    // Approval banner at top
    const ap = approvalStatus(sub);
    if (ap.state !== 'not_required') {
      const banner = document.createElement('div');
      banner.className = `appr-banner appr-banner-${ap.state}`;
      banner.innerHTML = `
        <div><b>Approval chain:</b> ${ap.state === 'approved' ? 'Signed off by all required parties.' : ap.state === 'rejected' ? 'Rejected by ' + ap.rejected.join(', ') + '. Rework required.' : 'Pending ' + ap.pending.join(', ') + '.'}</div>
        <button class="icon-btn" onclick="document.getElementById('contract-detail-modal').hidden=true; switchView('approvals');">Open Approvals →</button>
      `;
      modal.insertBefore(banner, modal.children[2] || null);
    }

    // Comment thread at the bottom (before the Close button)
    const metrics = threadMetrics(id);
    const comments = document.createElement('div');
    comments.className = 'clause-comments';
    comments.innerHTML = `
      <h3 style="font-size:13px;margin:24px 0 10px;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em">Comments &amp; sign-off</h3>
      <p class="panel-sub" style="margin-bottom:10px">Leave notes against a specific clause for Legal, Finance or IT to resolve. ${metrics.total} thread${metrics.total === 1 ? '' : 's'} on this contract (${metrics.open.length} open).</p>
      <div class="cc-new">
        <select class="rc-select" id="cc-clause">
          <option value="general">General comment on this contract</option>
          ${CLAUSE_LIBRARY.map(c => `<option value="${c.id}">On clause: ${escapeHtml(c.label)}</option>`).join('')}
        </select>
        <select class="rc-select" id="cc-role">
          ${['Finance', 'Legal', 'Security', 'IT', 'Procurement', 'Owner'].map(r => `<option value="${r}" ${currentAuthor().role === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
        <textarea id="cc-body" placeholder="Leave a note…" rows="2" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--panel);color:var(--text);font-family:inherit;font-size:13px;resize:vertical"></textarea>
        <div style="display:flex;justify-content:flex-end;margin-top:6px"><button class="primary" id="cc-post">Post comment</button></div>
      </div>
      <div class="cc-threads" id="cc-threads"></div>
    `;
    // Append before any trailing action row
    const actions = modal.querySelector('.actions:last-child');
    if (actions) modal.insertBefore(comments, actions);
    else modal.appendChild(comments);

    const render = () => {
      const t = threads();
      const mine = Object.values(t).filter(x => x.subId === id).sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || ''));
      const host = document.getElementById('cc-threads');
      host.innerHTML = mine.length ? mine.map(th => {
        const clauseLabel = th.clauseId === 'general' ? 'General' : (CLAUSE_LIBRARY.find(c => c.id === th.clauseId)?.label || th.clauseId);
        return `<div class="cc-thread ${th.resolved ? 'resolved' : ''}">
          <div class="cc-head">
            <div><b>${escapeHtml(clauseLabel)}</b> ${th.resolved ? '<span class="badge ok">resolved</span>' : '<span class="badge warn">open</span>'}</div>
            <div>
              ${th.resolved
                ? `<button class="icon-btn" data-cc-reopen="${th.clauseId}">Reopen</button>`
                : `<button class="icon-btn" data-cc-resolve="${th.clauseId}">Mark resolved</button>`}
            </div>
          </div>
          <div class="cc-messages">
            ${th.messages.map(m => `<div class="cc-msg">
              <div class="cc-msg-head"><b>${escapeHtml(m.author)}</b> <span class="badge info">${escapeHtml(m.role)}</span> <span class="cc-msg-time">${new Date(m.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div>
              <div class="cc-msg-body">${escapeHtml(m.body)}</div>
            </div>`).join('')}
          </div>
        </div>`;
      }).join('') : '<p style="font-size:12.5px;color:var(--text-dim);padding:8px 0">No comments yet. Leave the first note above.</p>';

      host.querySelectorAll('[data-cc-resolve]').forEach(b => b.onclick = () => { resolveThread(id, b.dataset.ccResolve, currentAuthor().name); render(); });
      host.querySelectorAll('[data-cc-reopen]').forEach(b => b.onclick = () => { reopenThread(id, b.dataset.ccReopen); render(); });
    };
    render();
    document.getElementById('cc-post').onclick = () => {
      const clauseId = document.getElementById('cc-clause').value;
      const role = document.getElementById('cc-role').value;
      const body = document.getElementById('cc-body').value.trim();
      if (!body) return;
      postMessage(id, clauseId, currentAuthor().name, role, body);
      document.getElementById('cc-body').value = '';
      render();
      toast('Comment posted.', 'success');
    };
  };
}

/* ---------------- View + nav wiring ---------------- */
function ensureApprovalsView() {
  if (document.getElementById('approvals')) return;
  const main = document.querySelector('.main-area main');
  if (!main) return;
  const section = document.createElement('section');
  section.id = 'approvals';
  section.className = 'view';
  section.innerHTML = `
    <div class="section-head"><div><h2>Approvals</h2><p class="page-sub">Contracts queued for sign-off per the active approval policy. Finance, Legal, Security, CFO — each sees what they need to approve.</p></div></div>
    <div id="approvals-body"></div>
  `;
  main.appendChild(section);
}
function ensureApprovalsNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const contractsGroup = [...groups].find(g => g.querySelector('[data-view="risk"]'));
  if (!contractsGroup || contractsGroup.querySelector('[data-view="approvals"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'approvals';
  btn.innerHTML = `${svg}<span>Approvals</span><span class="nav-count" id="nav-count-approvals" hidden></span>`;
  // After playbook tab
  const pb = contractsGroup.querySelector('[data-view="playbook"]');
  if (pb && pb.nextSibling) contractsGroup.insertBefore(btn, pb.nextSibling);
  else contractsGroup.appendChild(btn);
  btn.addEventListener('click', () => switchView('approvals'));
}
function updateApprovalsNavCount() {
  const el = document.getElementById('nav-count-approvals'); if (!el) return;
  const pending = activeSubs().filter(s => approvalStatus(s).state === 'pending').length;
  el.textContent = pending; el.hidden = !pending;
}

/* Patch switchView for 'approvals' */
function patchSwitchViewForApprovals() {
  if (window._apprSwitchPatched) return;
  const _orig = window.switchView;
  window.switchView = function (name, opts = {}) {
    if (name === 'approvals') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Approvals';
      if (!opts.replaceHistory) {
        const target = '#approvals';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._apprSwitchPatched = true;
}

/* Hook renderAll */
const _prevAll6 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll6) {
  window.renderAll = function () {
    _prevAll6();
    try {
      ensureApprovalsView();
      ensureApprovalsNav();
      patchSwitchViewForApprovals();
      renderApprovalsView();
      updateApprovalsNavCount();
      extendContractReviewModal();
    } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureApprovalsView();
      ensureApprovalsNav();
      patchSwitchViewForApprovals();
      renderApprovalsView();
      updateApprovalsNavCount();
      extendContractReviewModal();
    } catch (_) {}
  }, 250);
});
