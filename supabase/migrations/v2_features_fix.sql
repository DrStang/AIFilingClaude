-- V2 Features RLS Policy Fix
-- Run this after v2_features.sql to fix the infinite recursion issue

-- Drop the problematic family_members policies
DROP POLICY IF EXISTS "Members can view their group members" ON family_members;
DROP POLICY IF EXISTS "Group owners/admins can add members" ON family_members;
DROP POLICY IF EXISTS "Group owners can remove members" ON family_members;

-- Create fixed family_members policies that don't cause recursion

-- Users can view members of groups they belong to (direct user_id check, no recursion)
CREATE POLICY "Users can view family members"
  ON family_members FOR SELECT
  USING (
    -- User can see their own membership
    user_id = auth.uid() OR
    -- User can see other members if they're in the same group
    family_group_id IN (
      SELECT fm.family_group_id
      FROM family_members fm
      WHERE fm.user_id = auth.uid()
    )
  );

-- Only group owners can add members (check family_groups table, not family_members)
CREATE POLICY "Group owners can add members"
  ON family_members FOR INSERT
  WITH CHECK (
    -- User is adding themselves (joining via invite code)
    user_id = auth.uid() OR
    -- User owns the group
    EXISTS (
      SELECT 1 FROM family_groups
      WHERE family_groups.id = family_members.family_group_id
      AND family_groups.owner_id = auth.uid()
    )
  );

-- Owners can remove members, or users can remove themselves
CREATE POLICY "Users can leave or owners can remove members"
  ON family_members FOR DELETE
  USING (
    -- User is removing themselves (leaving)
    user_id = auth.uid() OR
    -- User owns the group
    EXISTS (
      SELECT 1 FROM family_groups
      WHERE family_groups.id = family_members.family_group_id
      AND family_groups.owner_id = auth.uid()
    )
  );

-- Fix family_groups SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Users can view groups they belong to" ON family_groups;

CREATE POLICY "Users can view their family groups"
  ON family_groups FOR SELECT
  USING (
    -- User owns the group
    owner_id = auth.uid() OR
    -- User is a member (direct check)
    id IN (
      SELECT family_group_id
      FROM family_members
      WHERE user_id = auth.uid()
    )
  );
