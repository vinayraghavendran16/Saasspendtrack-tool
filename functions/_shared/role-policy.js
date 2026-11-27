// Centralized grant policy: only the workspace owner may invite or promote admins.
export function canInviteRole(actorRole, targetRole) {
  if (!['member','admin','owner'].includes(actorRole)) return false;
  if (!['member','admin'].includes(targetRole)) return false;
  return targetRole !== 'admin' || actorRole === 'owner';
}
