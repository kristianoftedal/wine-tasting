'use server';

import { createClient } from '@/lib/supabase/server';
import type { GroupInvite } from '@/lib/types';
import { revalidatePath } from 'next/cache';

/** How long a freshly generated invite link stays valid. */
const INVITE_TTL_DAYS = 30;

export type InviteResult = { invite?: GroupInvite; error?: string };

const isActive = (invite: GroupInvite) =>
  !invite.revoked_at && (!invite.expires_at || new Date(invite.expires_at) > new Date());

/** The current usable invite for a group, or null. Members only (enforced by RLS). */
export const getActiveInvite = async (groupId: string): Promise<GroupInvite | null> => {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('group_invites')
    .select('*')
    .eq('group_id', groupId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  const invite = (data as GroupInvite[])?.[0];
  return invite && isActive(invite) ? invite : null;
};

/**
 * Returns the group's active invite, creating one if there is none. Generating
 * twice therefore hands out the same link instead of piling up dead tokens.
 */
export const createGroupInvite = async (groupId: string): Promise<InviteResult> => {
  const supabase = await createClient();
  if (!supabase) return { error: 'Databasen er ikke tilgjengelig' };

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return { error: 'Du må være innlogget' };

  const existing = await getActiveInvite(groupId);
  if (existing) return { invite: existing };

  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('group_invites')
    .insert({ group_id: groupId, created_by: user.id, expires_at: expiresAt })
    .select()
    .single<GroupInvite>();

  if (error) {
    return { error: 'Kunne ikke lage invitasjonslenke. Er du medlem i gruppen?' };
  }

  revalidatePath(`/gruppe/${groupId}`);
  return { invite: data };
};

/** Kills the current link. Anyone holding it can no longer join. */
export const revokeGroupInvite = async (inviteId: string, groupId: string): Promise<{ error?: string }> => {
  const supabase = await createClient();
  if (!supabase) return { error: 'Databasen er ikke tilgjengelig' };

  const { error } = await supabase
    .from('group_invites')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (error) return { error: 'Kunne ikke deaktivere lenken' };

  revalidatePath(`/gruppe/${groupId}`);
  return {};
};

const REDEEM_ERRORS: Record<string, string> = {
  not_authenticated: 'Du må være innlogget for å bli med i gruppen',
  invite_not_found: 'Invitasjonen finnes ikke',
  invite_revoked: 'Invitasjonen er deaktivert',
  invite_expired: 'Invitasjonen har utløpt'
};

/** Adds the signed-in user to the group the token points at. */
export const joinGroupWithInvite = async (token: string): Promise<{ groupId?: string; error?: string }> => {
  const supabase = await createClient();
  if (!supabase) return { error: 'Databasen er ikke tilgjengelig' };

  const { data, error } = await supabase.rpc('redeem_group_invite', { p_token: token });

  if (error) {
    const key = Object.keys(REDEEM_ERRORS).find(k => error.message.includes(k));
    return { error: key ? REDEEM_ERRORS[key] : 'Kunne ikke bli med i gruppen' };
  }

  revalidatePath(`/gruppe/${data}`);
  return { groupId: data as string };
};
