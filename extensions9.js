/* ==========================================================================
   SaaS Spend Track — Phase 8
   Workspace, users, invites, trials
   - Workspace model with owner, members, roles, trial dates
   - Owner invites by email with role; generates a signed-looking token
   - Accept-invitation flow at ?invite=<token>
   - Owner can activate / deactivate users and change roles
   - Trial banner across the app
   NOTE: browser-only. There is no real auth or email delivery. The invite
   flow drafts the email via mailto and the acceptance flow writes to the
   same localStorage. When a backend ships, every action here maps 1:1 to
   a server endpoint.
   ========================================================================== */

const ROLES = {
  owner:   { label: 'Owner',   description: 'Full access; billing; invite and remove users.' },
  admin:   { label: 'Admin',   description: 'Full access; invite and remove users. Cannot delete the workspace.' },
  finance: { label: 'Finance', description: 'Full read and write access to subscriptions, invoices, contracts, approvals.' },
  legal:   { label: 'Legal',   description: 'Full read; can leave comments; approves per policy.' },
  it:      { label: 'IT',      description: 'Manages HRMS, directory, integrations and licence usage.' },
  viewer:  { label: 'Viewer',  description: 'Read-only everywhere.' },
};

/* ---------------- Workspace state ---------------- */
function ensureWorkspace() {
  state.settings.workspace = state.settings.workspace || {
    id: crypto.randomUUID(),
    name: 'Acme Corp',
    slug: 'acme',
    createdAt: new Date().toISOString(),
    plan: 'trial',
    trialStartedAt: new Date().toISOString(),
    trialDays: 14,
    ownerEmail: 'vinay@whizzlead.com',
  };
  state.settings.users = state.settings.users || [
    { id: crypto.randomUUID(), email: state.settings.workspace.ownerEmail, name: 'Vinay (Owner)', role: 'owner', status: 'active', addedAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() },
  ];
  state.settings.invites = state.settings.invites || [];
  save();
}
function workspace() { ensureWorkspace(); return state.settings.workspace; }
function users() { ensureWorkspace(); return state.settings.users; }
function invites() { ensureWorkspace(); return state.settings.invites; }
function trialRemainingDays() {
  const w = workspace();
  if (w.plan !== 'trial') return null;
  const start = new Date(w.trialStartedAt);
  const end = new Date(start); end.setDate(end.getDate() + (w.trialDays || 14));
  return Math.ceil((end - new Date()) / 86400000);
}
function isTrialExpired() { const d = trialRemainingDays(); return d != null && d <= 0; }

function activateUser(id) { const u = users().find(x => x.id === id); if (!u) return; u.status = 'active'; u.activatedAt = new Date().toISOString(); save(); renderWorkspace(); renderAll(); }
function deactivateUser(id) { const u = users().find(x => x.id === id); if (!u) return; if (u.role === 'owner') return toast('Cannot deactivate the owner.', 'warn'); u.status = 'suspended'; u.suspendedAt = new Date().toISOString(); save(); renderWorkspace(); renderAll(); }
function removeUser(id) { const u = users().find(x => x.id === id); if (!u) return; if (u.role === 'owner') return toast('Cannot remove the owner.', 'warn'); state.settings.users = users().filter(x => x.id !== id); save(); renderWorkspace(); renderAll(); toast(`Removed ${u.email}.`, 'success'); }
function changeRole(id, role) { const u = users().find(x => x.id === id); if (!u) return; if (u.role === 'owner') return; u.role = role; save(); renderWorkspace(); renderAll(); }

/* ---------------- Invites ---------------- */
function createInvite({ email, role, inviterName }) {
  ensureWorkspace();
  email = (email || '').trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Invalid email address.' };
  if (!ROLES[role] || role === 'owner') return { ok: false, error: 'Pick a valid role (not owner).' };
  if (users().some(u => u.email === email)) return { ok: false, error: `${email} is already in the workspace.` };
  if (invites().some(i => i.email === email && i.status === 'pending')) return { ok: false, error: `${email} already has a pending invite.` };
  const invite = {
    id: crypto.randomUUID(),
    email,
    role,
    workspaceId: workspace().id,
    workspaceName: workspace().name,
    inviterName: inviterName || users().find(u => u.role === 'owner')?.name || 'the owner',
    status: 'pending',
    createdAt: new Date().toISOString(),
    token: encodeInviteToken({ email, role, workspaceId: workspace().id, workspaceName: workspace().name, exp: Date.now() + 14 * 86400000 }),
  };
  state.settings.invites = [...invites(), invite];
  save();
  return { ok: true, invite };
}
function encodeInviteToken(obj) {
  // Base64-encoded payload. Not cryptographically signed because this is browser-only;
  // in production this would be a server-issued JWT.
  try { return btoa(unescape(encodeURIComponent(JSON.stringify(obj)))).replace(/=+$/, ''); }
  catch (_) { return btoa(JSON.stringify(obj)).replace(/=+$/, ''); }
}
function decodeInviteToken(token) {
  try {
    const padded = token + '==='.slice(0, (4 - token.length % 4) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(padded))));
  } catch (_) { return null; }
}
function inviteLink(invite) {
  const url = new URL(location.href.split('#')[0].split('?')[0]);
  url.search = '?invite=' + encodeURIComponent(invite.token);
  url.hash = '#accept-invite';
  return url.toString();
}
function inviteMailto(invite) {
  const link = inviteLink(invite);
  const subject = encodeURIComponent(`You're invited to ${workspace().name} on SaaS Spend Track`);
  const body = encodeURIComponent(
    `Hi,\n\n${invite.inviterName} invited you to join the ${workspace().name} workspace on SaaS Spend Track as a ${ROLES[invite.role].label}.\n\n` +
    `Accept the invitation here:\n${link}\n\nThe invite expires in 14 days.\n\nSaaS Spend Track\nsaasspendtrack.com`
  );
  return `mailto:${invite.email}?subject=${subject}&body=${body}`;
}
function revokeInvite(id) {
  const inv = invites().find(i => i.id === id); if (!inv) return;
  inv.status = 'revoked'; inv.revokedAt = new Date().toISOString();
  save(); renderWorkspace(); toast('Invite revoked.', 'success');
}
function resendInvite(id) {
  const inv = invites().find(i => i.id === id); if (!inv) return;
  inv.resentAt = new Date().toISOString(); save();
  window.open(inviteMailto(inv), '_blank');
}
function acceptInvite(token, acceptedName) {
  const payload = decodeInviteToken(token);
  if (!payload) return { ok: false, error: 'Invitation link is invalid.' };
  if (Date.now() > payload.exp) return { ok: false, error: 'Invitation has expired.' };
  const inv = invites().find(i => i.token === token);
  if (inv && inv.status !== 'pending') return { ok: false, error: `Invitation is already ${inv.status}.` };
  if (users().some(u => u.email === payload.email)) {
    if (inv) { inv.status = 'accepted'; inv.acceptedAt = new Date().toISOString(); save(); }
    return { ok: false, error: `${payload.email} is already a member of this workspace.` };
  }
  const user = {
    id: crypto.randomUUID(),
    email: payload.email,
    name: acceptedName || payload.email.split('@')[0],
    role: payload.role,
    status: 'active',
    addedAt: new Date().toISOString(),
    acceptedViaInvite: true,
  };
  state.settings.users = [...users(), user];
  if (inv) { inv.status = 'accepted'; inv.acceptedAt = new Date().toISOString(); inv.acceptedUserId = user.id; }
  save();
  return { ok: true, user };
}

/* ---------------- Render: Workspace view ---------------- */
function renderWorkspace() {
  const host = document.getElementById('workspace-body'); if (!host) return;
  ensureWorkspace();
  const w = workspace();
  const usersList = users();
  const pending = invites().filter(i => i.status === 'pending');
  const revoked = invites().filter(i => i.status === 'revoked');
  const trialDays = trialRemainingDays();

  host.innerHTML = `
    <div class="ws-head">
      <div>
        <div class="ws-badge ${w.plan === 'trial' && !isTrialExpired() ? 'info' : w.plan === 'active' ? 'ok' : 'danger'}">${w.plan === 'trial' ? (trialDays > 0 ? `Trial · ${trialDays} days left` : 'Trial expired') : w.plan}</div>
        <h3 class="ws-name">${escapeHtml(w.name)}</h3>
        <p class="ws-meta">${escapeHtml(w.slug)}.saasspendtrack.com · created ${new Date(w.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      <div class="ws-head-actions">
        <button class="icon-btn" id="ws-rename">Rename</button>
        <button class="primary" id="ws-invite">+ Invite user</button>
      </div>
    </div>

    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">Active users</span><span class="stat-value">${usersList.filter(u => u.status === 'active').length}</span><span class="stat-sub">${usersList.length} total</span></div>
      <div class="stat-card"><span class="stat-label">Pending invites</span><span class="stat-value" style="color:${pending.length ? 'var(--warning-text)' : 'var(--text)'}">${pending.length}</span><span class="stat-sub">${pending.length === 1 ? 'invitation' : 'invitations'} out</span></div>
      <div class="stat-card"><span class="stat-label">Roles represented</span><span class="stat-value">${new Set(usersList.filter(u => u.status === 'active').map(u => u.role)).size}</span><span class="stat-sub">${Object.keys(ROLES).length} available</span></div>
      <div class="stat-card"><span class="stat-label">Trial</span><span class="stat-value" style="color:${trialDays != null && trialDays <= 3 ? 'var(--danger-text)' : trialDays != null && trialDays <= 7 ? 'var(--warning-text)' : 'var(--text)'}">${trialDays != null ? (trialDays > 0 ? trialDays + 'd' : 'ended') : '—'}</span><span class="stat-sub">${w.plan === 'trial' ? 'contact to activate' : 'paid'}</span></div>
    </div>

    <div class="panel-grid">
      <div class="panel span-2">
        <h2>Team members</h2>
        <p class="panel-sub">Everyone with access to this workspace. The owner can change roles, deactivate accounts or remove users entirely.</p>
        <div class="table-wrap">
          <table class="sub-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Added</th><th></th></tr></thead>
          <tbody>${usersList.map(u => `<tr>
            <td><b>${escapeHtml(u.name || '—')}</b><div class="rc-meta">${escapeHtml(u.email)}</div></td>
            <td>
              ${u.role === 'owner' ? '<span class="badge warn">Owner</span>' : `<select class="rc-select" data-ws-role="${u.id}">${Object.entries(ROLES).filter(([k]) => k !== 'owner').map(([k, v]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>`}
            </td>
            <td><span class="badge ${u.status === 'active' ? 'ok' : u.status === 'suspended' ? 'warn' : ''}">${u.status}</span></td>
            <td>${new Date(u.addedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
            <td class="actions-cell">
              ${u.role === 'owner' ? '' : u.status === 'active'
                ? `<button class="icon-btn" data-ws-deactivate="${u.id}">Deactivate</button>`
                : `<button class="icon-btn" data-ws-activate="${u.id}">Activate</button>`}
              ${u.role === 'owner' ? '' : `<button class="icon-btn danger" data-ws-remove="${u.id}">Remove</button>`}
            </td>
          </tr>`).join('')}</tbody></table>
        </div>
      </div>

      <div class="panel span-2">
        <h2>Pending invitations <span class="badge">${pending.length}</span></h2>
        <p class="panel-sub">An invitation link is generated and the user's mail client opens with a pre-filled message. You can also copy the link and send it yourself.</p>
        ${pending.length === 0 ? '<p class="empty">No pending invitations. Hit <b>+ Invite user</b> above to send one.</p>' : `
        <div class="table-wrap">
          <table class="sub-table"><thead><tr><th>Email</th><th>Role</th><th>Invited by</th><th>Sent</th><th></th></tr></thead>
          <tbody>${pending.map(i => `<tr>
            <td><b>${escapeHtml(i.email)}</b></td>
            <td>${escapeHtml(ROLES[i.role]?.label || i.role)}</td>
            <td>${escapeHtml(i.inviterName)}</td>
            <td>${new Date(i.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}${i.resentAt ? ` · resent ${new Date(i.resentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}</td>
            <td class="actions-cell">
              <button class="icon-btn" data-ws-copy="${i.id}">Copy link</button>
              <button class="icon-btn" data-ws-resend="${i.id}">Resend</button>
              <button class="icon-btn danger" data-ws-revoke="${i.id}">Revoke</button>
            </td>
          </tr>`).join('')}</tbody></table>
        </div>`}
      </div>

      <div class="panel span-2">
        <h2>Roles reference</h2>
        <div class="roles-grid">${Object.entries(ROLES).map(([k, v]) => `<div class="role-card"><b>${v.label}</b><p>${v.description}</p></div>`).join('')}</div>
      </div>
    </div>
  `;

  document.getElementById('ws-rename').onclick = () => {
    const n = prompt('Rename workspace:', w.name); if (n && n.trim()) { w.name = n.trim(); w.slug = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20); save(); renderWorkspace(); }
  };
  document.getElementById('ws-invite').onclick = openInviteModal;
  host.querySelectorAll('[data-ws-role]').forEach(sel => sel.addEventListener('change', e => changeRole(sel.dataset.wsRole, e.target.value)));
  host.querySelectorAll('[data-ws-deactivate]').forEach(b => b.onclick = () => deactivateUser(b.dataset.wsDeactivate));
  host.querySelectorAll('[data-ws-activate]').forEach(b => b.onclick = () => activateUser(b.dataset.wsActivate));
  host.querySelectorAll('[data-ws-remove]').forEach(b => b.onclick = () => { if (confirm('Remove this user from the workspace?')) removeUser(b.dataset.wsRemove); });
  host.querySelectorAll('[data-ws-revoke]').forEach(b => b.onclick = () => { if (confirm('Revoke this invite?')) revokeInvite(b.dataset.wsRevoke); });
  host.querySelectorAll('[data-ws-resend]').forEach(b => b.onclick = () => resendInvite(b.dataset.wsResend));
  host.querySelectorAll('[data-ws-copy]').forEach(b => b.onclick = () => {
    const inv = invites().find(i => i.id === b.dataset.wsCopy); if (!inv) return;
    navigator.clipboard.writeText(inviteLink(inv)).then(() => toast('Link copied.', 'success'), () => toast('Copy failed.', 'error'));
  });
}

/* ---------------- Invite modal ---------------- */
function openInviteModal() {
  let modal = document.getElementById('ws-invite-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'modal-backdrop'; modal.id = 'ws-invite-modal';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px">
        <h2>Invite a teammate</h2>
        <form onsubmit="event.preventDefault()">
          <label>Email address<input type="email" id="ws-i-email" placeholder="colleague@yourcompany.com" required></label>
          <label>Role
            <select id="ws-i-role">${Object.entries(ROLES).filter(([k]) => k !== 'owner').map(([k, v]) => `<option value="${k}" ${k === 'finance' ? 'selected' : ''}>${v.label} &mdash; ${v.description}</option>`).join('')}</select>
          </label>
          <p style="font-size:12px;color:var(--text-dim);margin:-4px 0 4px">An invitation link is generated and your mail client opens with a pre-filled message. You can also copy the link and send it yourself.</p>
          <div class="actions">
            <button type="button" id="ws-i-cancel">Cancel</button>
            <button type="button" class="primary" id="ws-i-send">Generate &amp; open mail</button>
          </div>
        </form>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.hidden = true; });
  }
  modal.hidden = false;
  document.getElementById('ws-i-email').value = '';
  document.getElementById('ws-i-role').value = 'finance';
  setTimeout(() => document.getElementById('ws-i-email').focus(), 100);
  document.getElementById('ws-i-cancel').onclick = () => { modal.hidden = true; };
  document.getElementById('ws-i-send').onclick = () => {
    const email = document.getElementById('ws-i-email').value.trim();
    const role = document.getElementById('ws-i-role').value;
    const r = createInvite({ email, role, inviterName: users().find(u => u.role === 'owner')?.name });
    if (!r.ok) { toast(r.error, 'error'); return; }
    modal.hidden = true;
    renderWorkspace();
    window.open(inviteMailto(r.invite), '_blank');
    toast(`Invite ready for ${email}. Mail draft opened.`, 'success');
  };
}

/* ---------------- Accept-invite flow ---------------- */
function maybeShowAcceptInvite() {
  const url = new URL(location.href);
  const token = url.searchParams.get('invite');
  if (!token) return;
  const payload = decodeInviteToken(token);
  if (!payload) return;
  const existing = document.getElementById('accept-invite-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop'; modal.id = 'accept-invite-modal'; modal.hidden = false;
  const expired = Date.now() > payload.exp;
  modal.innerHTML = `<div class="modal" style="max-width:480px">
    <h2>You're invited to ${escapeHtml(payload.workspaceName)}</h2>
    <p style="font-size:14px;line-height:1.6;color:var(--text-2);margin:4px 0 14px">${expired ? 'This invitation has expired. Ask the workspace owner to send a new one.' : `You've been invited to join <b>${escapeHtml(payload.workspaceName)}</b> as a <b>${escapeHtml(ROLES[payload.role]?.label || payload.role)}</b>.`}</p>
    ${expired ? '' : `<label>Your name<input type="text" id="ai-name" value="${escapeHtml(payload.email.split('@')[0])}" style="width:100%;height:34px;padding:0 10px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--panel);color:var(--text);font-family:inherit;font-size:13px"/></label>`}
    <div class="actions" style="margin-top:14px">
      <button type="button" id="ai-skip">${expired ? 'Close' : 'Decline'}</button>
      ${expired ? '' : `<button type="button" class="primary" id="ai-accept">Accept invitation</button>`}
    </div>
  </div>`;
  document.body.appendChild(modal);
  document.getElementById('ai-skip').onclick = () => { modal.hidden = true; const u = new URL(location.href); u.searchParams.delete('invite'); history.replaceState({}, '', u); };
  if (!expired) document.getElementById('ai-accept').onclick = () => {
    const name = document.getElementById('ai-name').value.trim();
    const r = acceptInvite(token, name);
    if (!r.ok) { toast(r.error, 'error'); return; }
    modal.hidden = true;
    toast(`Welcome to ${payload.workspaceName}, ${name || payload.email}!`, 'success');
    const u = new URL(location.href); u.searchParams.delete('invite'); history.replaceState({}, '', u);
    renderAll();
  };
}

/* ---------------- Trial banner ---------------- */
function renderTrialBanner() {
  const existing = document.getElementById('trial-banner');
  const trialDays = trialRemainingDays();
  if (trialDays == null) { if (existing) existing.remove(); return; }
  if (trialDays > 7 && !isTrialExpired()) { if (existing) existing.remove(); return; }
  if (!existing) {
    const b = document.createElement('div');
    b.id = 'trial-banner';
    b.className = 'trial-banner';
    const main = document.querySelector('.main-area');
    if (main) main.insertBefore(b, main.firstChild);
  }
  const b = document.getElementById('trial-banner');
  if (isTrialExpired()) {
    b.className = 'trial-banner danger';
    b.innerHTML = `<div><b>Trial ended.</b> Reach out to activate your workspace so your team can keep using SaaS Spend Track.</div><a class="icon-btn" href="mailto:vinay@whizzlead.com?subject=Activate%20my%20workspace">Activate workspace</a>`;
  } else {
    b.className = 'trial-banner warn';
    b.innerHTML = `<div><b>${trialDays} days left</b> in your free trial. Reach out whenever you're ready to activate.</div><a class="icon-btn" href="mailto:vinay@whizzlead.com?subject=Activate%20my%20workspace">Activate workspace</a>`;
  }
}

/* ---------------- Nav + view ---------------- */
function ensureWorkspaceView() {
  if (document.getElementById('workspace')) return;
  const main = document.querySelector('.main-area main'); if (!main) return;
  const section = document.createElement('section');
  section.id = 'workspace'; section.className = 'view';
  section.innerHTML = `
    <div class="section-head"><div><h2>Workspace &amp; users</h2><p class="page-sub">Invite teammates, assign roles, manage the trial. Owner-only actions are gated on your current role.</p></div></div>
    <div id="workspace-body"></div>
  `;
  main.appendChild(section);
}
function ensureWorkspaceNav() {
  const groups = document.querySelectorAll('.sidebar .nav-group');
  const workspaceGroup = [...groups].find(g => g.querySelector('[data-view="integrations"]'));
  if (!workspaceGroup || workspaceGroup.querySelector('[data-view="workspace"]')) return;
  const svg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
  const btn = document.createElement('button');
  btn.className = 'tab'; btn.dataset.view = 'workspace';
  btn.innerHTML = `${svg}<span>Workspace</span><span class="nav-count" id="nav-count-workspace" hidden></span>`;
  workspaceGroup.insertBefore(btn, workspaceGroup.firstChild);
  btn.addEventListener('click', () => switchView('workspace'));
}
function patchSwitchViewForWorkspace() {
  if (window._wsSwitchPatched) return;
  const _orig = window.switchView;
  window.switchView = function (name, opts = {}) {
    if (name === 'workspace') {
      document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === name));
      window.scrollTo({ top: 0 });
      const crumb = document.getElementById('page-crumb'); if (crumb) crumb.textContent = 'Workspace';
      if (!opts.replaceHistory) {
        const target = '#workspace';
        if (location.hash !== target) history.pushState({ view: name }, '', target);
      }
      return;
    }
    return _orig(name, opts);
  };
  window._wsSwitchPatched = true;
}
function updateWorkspaceNavCount() {
  const el = document.getElementById('nav-count-workspace'); if (!el) return;
  const p = invites().filter(i => i.status === 'pending').length;
  el.textContent = p; el.hidden = !p;
}

/* Hook renderAll */
const _prevAll9 = typeof renderAll === 'function' ? renderAll : null;
if (_prevAll9) {
  window.renderAll = function () {
    _prevAll9();
    try {
      ensureWorkspace();
      ensureWorkspaceView();
      ensureWorkspaceNav();
      patchSwitchViewForWorkspace();
      renderWorkspace();
      updateWorkspaceNavCount();
      renderTrialBanner();
    } catch (e) { console.warn(e); }
  };
}
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    try {
      ensureWorkspace();
      ensureWorkspaceView();
      ensureWorkspaceNav();
      patchSwitchViewForWorkspace();
      renderWorkspace();
      updateWorkspaceNavCount();
      renderTrialBanner();
      maybeShowAcceptInvite();
    } catch (_) {}
  }, 400);
});
