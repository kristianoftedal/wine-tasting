-- =============================================================================
-- 022 — GROUP INVITE LINKS
-- Shareable links that let a new user sign up and land straight in a group.
-- =============================================================================

CREATE TABLE IF NOT EXISTS group_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  token        TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at   TIMESTAMP WITH TIME ZONE,
  revoked_at   TIMESTAMP WITH TIME ZONE,
  uses         INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_group_invites_group_id ON group_invites(group_id);


-- =============================================================================
-- ROW LEVEL SECURITY
-- The token itself is never readable through the table — only members of the
-- group can list or manage invites. Invitees resolve a token through the
-- SECURITY DEFINER function below, which exposes nothing but the group name.
-- =============================================================================

ALTER TABLE group_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group members can view invites" ON group_invites;
CREATE POLICY "Group members can view invites" ON group_invites FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_invites.group_id AND gm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Group members can create invites" ON group_invites;
CREATE POLICY "Group members can create invites" ON group_invites FOR INSERT WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_invites.group_id AND gm.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Group members can revoke invites" ON group_invites;
CREATE POLICY "Group members can revoke invites" ON group_invites FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM group_members gm
    WHERE gm.group_id = group_invites.group_id AND gm.user_id = auth.uid()
  )
);

GRANT SELECT, INSERT, UPDATE ON group_invites TO authenticated;


-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Look up an invite token without being logged in, so the landing page can show
-- "you have been invited to <group>" before the visitor has an account.
CREATE OR REPLACE FUNCTION public.resolve_group_invite(p_token TEXT)
RETURNS TABLE (
  group_id          UUID,
  group_name        TEXT,
  group_description TEXT,
  member_count      BIGINT,
  status            TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.group_invites;
BEGIN
  SELECT * INTO inv FROM public.group_invites WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, NULL::TEXT, 0::BIGINT, 'not_found'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.description,
    (SELECT COUNT(*) FROM public.group_members gm WHERE gm.group_id = g.id),
    CASE
      WHEN inv.revoked_at IS NOT NULL THEN 'revoked'
      WHEN inv.expires_at IS NOT NULL AND inv.expires_at < NOW() THEN 'expired'
      ELSE 'valid'
    END
  FROM public.groups g
  WHERE g.id = inv.group_id;
END;
$$;

-- Redeem a token: validates it and adds the caller to the group.
CREATE OR REPLACE FUNCTION public.redeem_group_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv     public.group_invites;
  v_user  UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO inv FROM public.group_invites WHERE token = p_token FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF inv.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'invite_revoked';
  END IF;
  IF inv.expires_at IS NOT NULL AND inv.expires_at < NOW() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (inv.group_id, v_user)
  ON CONFLICT (group_id, user_id) DO NOTHING;

  -- FOUND is only true when the row was actually inserted, so repeat visits by
  -- an existing member do not inflate the counter.
  IF FOUND THEN
    UPDATE public.group_invites
    SET uses = uses + 1, last_used_at = NOW()
    WHERE id = inv.id;
  END IF;

  RETURN inv.group_id;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_group_invite(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_group_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_group_invite(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_group_invite(TEXT) TO authenticated;
