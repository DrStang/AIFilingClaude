import { supabase } from './supabase';
import {
  FamilyGroup,
  FamilyMember,
  DocumentShare,
  SharePermission,
  FamilyRole,
} from './database.types';

// =====================================================
// FAMILY GROUPS
// =====================================================

export interface CreateFamilyGroupParams {
  ownerId: string;
  name: string;
}

export interface FamilyGroupWithMembers extends FamilyGroup {
  members: FamilyMemberWithUser[];
}

export interface FamilyMemberWithUser extends FamilyMember {
  user?: {
    email: string;
  };
}

/**
 * Creates a new family group
 */
export async function createFamilyGroup(
  params: CreateFamilyGroupParams
): Promise<FamilyGroup> {
  const { ownerId, name } = params;

  const { data, error } = await supabase
    .from('family_groups')
    .insert({
      owner_id: ownerId,
      name,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Add owner as a member with owner role
  await supabase.from('family_members').insert({
    family_group_id: data.id,
    user_id: ownerId,
    role: 'owner',
  });

  return data;
}

/**
 * Gets all family groups for a user (owned or member of)
 */
export async function getUserFamilyGroups(
  userId: string
): Promise<FamilyGroupWithMembers[]> {
  // First get user's own membership records (simplified RLS only allows this)
  const { data: memberships, error: memberError } = await supabase
    .from('family_members')
    .select('family_group_id, role')
    .eq('user_id', userId);

  if (memberError) {
    throw memberError;
  }

  const groupIds = memberships?.map((m: any) => m.family_group_id) || [];

  if (groupIds.length === 0) {
    return [];
  }

  // Get groups the user is a member of
  const { data: groups, error: groupError } = await supabase
    .from('family_groups')
    .select('*')
    .in('id', groupIds);

  if (groupError) {
    throw groupError;
  }

  // Map membership info to groups
  return (groups || []).map((group: any) => {
    const membership = memberships?.find((m: any) => m.family_group_id === group.id);
    return {
      ...group,
      members: membership ? [membership] : [],
    };
  });
}

/**
 * Gets a family group by ID
 */
export async function getFamilyGroup(
  groupId: string
): Promise<FamilyGroupWithMembers> {
  const { data, error } = await supabase
    .from('family_groups')
    .select(
      `
      *,
      family_members(*)
    `
    )
    .eq('id', groupId)
    .single();

  if (error) {
    throw error;
  }

  return {
    ...data,
    members: data.family_members || [],
  };
}

/**
 * Updates a family group
 */
export async function updateFamilyGroup(
  groupId: string,
  updates: { name?: string }
): Promise<FamilyGroup> {
  const { data, error } = await supabase
    .from('family_groups')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', groupId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Deletes a family group
 */
export async function deleteFamilyGroup(groupId: string): Promise<void> {
  const { error } = await supabase
    .from('family_groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    throw error;
  }
}

/**
 * Regenerates invite code for a family group
 */
export async function regenerateInviteCode(groupId: string): Promise<string> {
  // Generate new random code
  const newCode = Array.from({ length: 12 }, () =>
    Math.random().toString(36).charAt(2)
  ).join('');

  const { data, error } = await supabase
    .from('family_groups')
    .update({ invite_code: newCode })
    .eq('id', groupId)
    .select('invite_code')
    .single();

  if (error) {
    throw error;
  }

  return data.invite_code;
}

/**
 * Joins a family group using invite code
 */
export async function joinFamilyGroup(
  userId: string,
  inviteCode: string
): Promise<FamilyGroup> {
  // Find group by invite code
  const { data: group, error: findError } = await supabase
    .from('family_groups')
    .select('*')
    .eq('invite_code', inviteCode)
    .single();

  if (findError || !group) {
    throw new Error('Invalid invite code');
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('family_members')
    .select('*')
    .eq('family_group_id', group.id)
    .eq('user_id', userId)
    .single();

  if (existing) {
    throw new Error('Already a member of this group');
  }

  // Add as member
  const { error: joinError } = await supabase.from('family_members').insert({
    family_group_id: group.id,
    user_id: userId,
    role: 'member',
  });

  if (joinError) {
    throw joinError;
  }

  return group;
}

/**
 * Leaves a family group
 */
export async function leaveFamilyGroup(
  userId: string,
  groupId: string
): Promise<void> {
  // Check if user is owner
  const { data: group } = await supabase
    .from('family_groups')
    .select('owner_id')
    .eq('id', groupId)
    .single();

  if (group?.owner_id === userId) {
    throw new Error('Owner cannot leave the group. Transfer ownership or delete the group.');
  }

  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_group_id', groupId)
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}

/**
 * Updates a member's role
 */
export async function updateMemberRole(
  groupId: string,
  memberId: string,
  role: FamilyRole
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .update({ role })
    .eq('family_group_id', groupId)
    .eq('user_id', memberId);

  if (error) {
    throw error;
  }
}

/**
 * Removes a member from a group
 */
export async function removeFamilyMember(
  groupId: string,
  memberId: string
): Promise<void> {
  const { error } = await supabase
    .from('family_members')
    .delete()
    .eq('family_group_id', groupId)
    .eq('user_id', memberId);

  if (error) {
    throw error;
  }
}

// =====================================================
// DOCUMENT SHARING
// =====================================================

export interface ShareDocumentParams {
  documentId: string;
  sharedBy: string;
  sharedWith?: string; // User ID for individual share
  familyGroupId?: string; // Group ID for group share
  permission?: SharePermission;
}

/**
 * Shares a document with a user or family group
 */
export async function shareDocument(
  params: ShareDocumentParams
): Promise<DocumentShare> {
  const { documentId, sharedBy, sharedWith, familyGroupId, permission = 'view' } = params;

  if (!sharedWith && !familyGroupId) {
    throw new Error('Must specify either sharedWith or familyGroupId');
  }

  if (sharedWith && familyGroupId) {
    throw new Error('Cannot specify both sharedWith and familyGroupId');
  }

  const { data, error } = await supabase
    .from('document_shares')
    .insert({
      document_id: documentId,
      shared_by: sharedBy,
      shared_with: sharedWith || null,
      family_group_id: familyGroupId || null,
      permission,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets all shares for a document
 */
export async function getDocumentShares(
  documentId: string
): Promise<DocumentShare[]> {
  const { data, error } = await supabase
    .from('document_shares')
    .select('*')
    .eq('document_id', documentId);

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets documents shared with a user
 */
export async function getSharedWithMeDocuments(userId: string): Promise<any[]> {
  // Get user's family groups
  const { data: memberships } = await supabase
    .from('family_members')
    .select('family_group_id')
    .eq('user_id', userId);

  const groupIds = memberships?.map((m: any) => m.family_group_id) || [];

  // Get documents shared directly or through groups
  const { data, error } = await supabase
    .from('document_shares')
    .select('*, documents(*)')
    .or(
      `shared_with.eq.${userId}${groupIds.length > 0 ? `,family_group_id.in.(${groupIds.join(',')})` : ''}`
    );

  if (error) {
    throw error;
  }

  return data.map((share: any) => ({
    ...share.documents,
    shareInfo: {
      permission: share.permission,
      sharedBy: share.shared_by,
      sharedAt: share.created_at,
    },
  }));
}

/**
 * Updates share permission
 */
export async function updateSharePermission(
  shareId: string,
  permission: SharePermission
): Promise<void> {
  const { error } = await supabase
    .from('document_shares')
    .update({ permission })
    .eq('id', shareId);

  if (error) {
    throw error;
  }
}

/**
 * Removes a document share
 */
export async function unshareDocument(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('document_shares')
    .delete()
    .eq('id', shareId);

  if (error) {
    throw error;
  }
}

/**
 * Removes all shares for a document
 */
export async function unshareDocumentAll(documentId: string): Promise<void> {
  const { error } = await supabase
    .from('document_shares')
    .delete()
    .eq('document_id', documentId);

  if (error) {
    throw error;
  }
}

// =====================================================
// FOLDER SHARING
// =====================================================

export interface ShareFolderParams {
  folderId: string;
  sharedBy: string;
  sharedWith?: string;
  familyGroupId?: string;
  permission?: SharePermission;
}

/**
 * Shares a folder with a user or family group
 */
export async function shareFolder(params: ShareFolderParams): Promise<any> {
  const { folderId, sharedBy, sharedWith, familyGroupId, permission = 'view' } = params;

  if (!sharedWith && !familyGroupId) {
    throw new Error('Must specify either sharedWith or familyGroupId');
  }

  const { data, error } = await supabase
    .from('folder_shares')
    .insert({
      folder_id: folderId,
      shared_by: sharedBy,
      shared_with: sharedWith || null,
      family_group_id: familyGroupId || null,
      permission,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets all shares for a folder
 */
export async function getFolderShares(folderId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('folder_shares')
    .select('*')
    .eq('folder_id', folderId);

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Removes a folder share
 */
export async function unshareFolder(shareId: string): Promise<void> {
  const { error } = await supabase
    .from('folder_shares')
    .delete()
    .eq('id', shareId);

  if (error) {
    throw error;
  }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

/**
 * Checks if a user can view a document
 */
export async function canViewDocument(
  userId: string,
  documentId: string
): Promise<boolean> {
  // Owner check
  const { data: doc } = await supabase
    .from('documents')
    .select('user_id')
    .eq('id', documentId)
    .single();

  if (doc?.user_id === userId) return true;

  // Direct share check
  const { data: directShare } = await supabase
    .from('document_shares')
    .select('id')
    .eq('document_id', documentId)
    .eq('shared_with', userId)
    .single();

  if (directShare) return true;

  // Group share check
  const { data: groupShare } = await supabase
    .from('document_shares')
    .select('family_group_id')
    .eq('document_id', documentId)
    .not('family_group_id', 'is', null);

  if (groupShare && groupShare.length > 0) {
    const groupIds = groupShare.map((s: any) => s.family_group_id);
    const { data: membership } = await supabase
      .from('family_members')
      .select('id')
      .eq('user_id', userId)
      .in('family_group_id', groupIds)
      .single();

    if (membership) return true;
  }

  return false;
}

/**
 * Checks if a user can edit a document
 */
export async function canEditDocument(
  userId: string,
  documentId: string
): Promise<boolean> {
  // Owner check
  const { data: doc } = await supabase
    .from('documents')
    .select('user_id')
    .eq('id', documentId)
    .single();

  if (doc?.user_id === userId) return true;

  // Share with edit permission check
  const { data: share } = await supabase
    .from('document_shares')
    .select('*')
    .eq('document_id', documentId)
    .eq('permission', 'edit')
    .or(`shared_with.eq.${userId}`)
    .single();

  if (share) return true;

  return false;
}

/**
 * Finds a user by email for sharing
 */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('user_id')
    .limit(1);

  // Note: In production, you'd want a proper user lookup table
  // This is a placeholder - Supabase auth users aren't directly queryable
  // You'd need to implement an Edge Function or use a users table

  return null; // Placeholder - implement based on your auth setup
}
