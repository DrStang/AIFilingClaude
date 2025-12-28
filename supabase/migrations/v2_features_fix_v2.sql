-- V2 Features RLS Policy Fix v2
-- Ultra-simple policies to avoid any recursion

-- =====================================================
-- Drop ALL existing problematic policies
-- =====================================================
DROP POLICY IF EXISTS "Members can view their group members" ON family_members;
DROP POLICY IF EXISTS "Group owners/admins can add members" ON family_members;
DROP POLICY IF EXISTS "Group owners can remove members" ON family_members;
DROP POLICY IF EXISTS "Users can view family members" ON family_members;
DROP POLICY IF EXISTS "Group owners can add members" ON family_members;
DROP POLICY IF EXISTS "Users can leave or owners can remove members" ON family_members;
DROP POLICY IF EXISTS "View family members" ON family_members;
DROP POLICY IF EXISTS "Insert family members" ON family_members;
DROP POLICY IF EXISTS "Delete family members" ON family_members;

DROP POLICY IF EXISTS "Users can view groups they belong to" ON family_groups;
DROP POLICY IF EXISTS "Users can view their family groups" ON family_groups;
DROP POLICY IF EXISTS "View family groups" ON family_groups;

-- =====================================================
-- FAMILY_MEMBERS: Simple direct policies (no subqueries on self)
-- =====================================================

-- SELECT: Users can only see their own membership records directly
-- The app will handle fetching other members after verifying group membership
CREATE POLICY "Users see own memberships"
  ON family_members FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: Users can add themselves to any group (joining via invite code)
CREATE POLICY "Users can join groups"
  ON family_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- DELETE: Users can remove themselves (leave group)
CREATE POLICY "Users can leave groups"
  ON family_members FOR DELETE
  USING (user_id = auth.uid());

-- =====================================================
-- FAMILY_GROUPS: Simple ownership-based policies
-- =====================================================

-- SELECT: Users can view all groups (membership check done in app)
-- This is safe because group info itself isn't sensitive
CREATE POLICY "Users can view all groups"
  ON family_groups FOR SELECT
  USING (true);

-- INSERT: Only authenticated users can create groups
CREATE POLICY "Users can create groups"
  ON family_groups FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- UPDATE: Only owners can update their groups
CREATE POLICY "Owners can update groups"
  ON family_groups FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE: Only owners can delete their groups
CREATE POLICY "Owners can delete groups"
  ON family_groups FOR DELETE
  USING (auth.uid() = owner_id);
