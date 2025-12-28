import { supabase } from './supabase';
import { Folder } from './database.types';

export interface CreateFolderParams {
  userId: string;
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
}

export interface UpdateFolderParams {
  name?: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
}

export interface FolderWithPath extends Folder {
  path?: Array<{ id: string; name: string; depth: number }>;
  documentCount?: number;
  subfolderCount?: number;
}

/**
 * Creates a new folder
 */
export async function createFolder(params: CreateFolderParams): Promise<Folder> {
  const { userId, name, parentId, color, icon } = params;

  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name,
      parent_id: parentId || null,
      color: color || '#6b7280',
      icon: icon || 'folder',
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets all folders for a user
 */
export async function getUserFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets folders at root level (no parent)
 */
export async function getRootFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .is('parent_id', null)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets subfolders of a specific folder
 */
export async function getSubfolders(parentId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('parent_id', parentId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets a single folder by ID
 */
export async function getFolder(folderId: string): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('id', folderId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets folder with its full path
 */
export async function getFolderWithPath(folderId: string): Promise<FolderWithPath> {
  const folder = await getFolder(folderId);

  // Get folder path using recursive function
  const { data: pathData, error: pathError } = await supabase.rpc('get_folder_path', {
    folder_id: folderId,
  });

  if (pathError) {
    console.error('Error getting folder path:', pathError);
    return folder;
  }

  return {
    ...folder,
    path: pathData,
  };
}

/**
 * Gets folder hierarchy as a tree
 */
export async function getFolderTree(userId: string): Promise<FolderTreeNode[]> {
  const folders = await getUserFolders(userId);
  return buildFolderTree(folders);
}

export interface FolderTreeNode extends Folder {
  children: FolderTreeNode[];
  level: number;
}

function buildFolderTree(folders: Folder[], parentId: string | null = null, level: number = 0): FolderTreeNode[] {
  return folders
    .filter((f) => f.parent_id === parentId)
    .map((folder) => ({
      ...folder,
      level,
      children: buildFolderTree(folders, folder.id, level + 1),
    }));
}

/**
 * Updates a folder
 */
export async function updateFolder(
  folderId: string,
  updates: UpdateFolderParams
): Promise<Folder> {
  // Prevent circular references
  if (updates.parentId) {
    const isDescendant = await isDescendantFolder(folderId, updates.parentId);
    if (isDescendant) {
      throw new Error('Cannot move folder into its own subfolder');
    }
  }

  const { data, error } = await supabase
    .from('folders')
    .update({
      ...updates,
      parent_id: updates.parentId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', folderId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Checks if targetId is a descendant of folderId
 */
async function isDescendantFolder(folderId: string, targetId: string): Promise<boolean> {
  if (folderId === targetId) return true;

  const { data: children } = await supabase
    .from('folders')
    .select('id')
    .eq('parent_id', folderId);

  if (!children || children.length === 0) return false;

  for (const child of children) {
    if (child.id === targetId) return true;
    const isDesc = await isDescendantFolder(child.id, targetId);
    if (isDesc) return true;
  }

  return false;
}

/**
 * Deletes a folder and moves its documents to parent or root
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const folder = await getFolder(folderId);

  // Move documents to parent folder or root
  await supabase
    .from('documents')
    .update({ folder_id: folder.parent_id })
    .eq('folder_id', folderId);

  // Move subfolders to parent
  await supabase
    .from('folders')
    .update({ parent_id: folder.parent_id })
    .eq('parent_id', folderId);

  // Delete the folder
  const { error } = await supabase.from('folders').delete().eq('id', folderId);

  if (error) {
    throw error;
  }
}

/**
 * Moves a document to a folder
 */
export async function moveDocumentToFolder(
  documentId: string,
  folderId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ folder_id: folderId })
    .eq('id', documentId);

  if (error) {
    throw error;
  }
}

/**
 * Moves multiple documents to a folder
 */
export async function moveDocumentsToFolder(
  documentIds: string[],
  folderId: string | null
): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .update({ folder_id: folderId })
    .in('id', documentIds);

  if (error) {
    throw error;
  }
}

/**
 * Gets documents in a folder
 */
export async function getDocumentsInFolder(
  userId: string,
  folderId: string | null
): Promise<any[]> {
  let query = supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (folderId === null) {
    query = query.is('folder_id', null);
  } else {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets document and subfolder counts for a folder
 */
export async function getFolderCounts(
  folderId: string
): Promise<{ documentCount: number; subfolderCount: number }> {
  const [docResult, folderResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('folder_id', folderId),
    supabase
      .from('folders')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', folderId),
  ]);

  return {
    documentCount: docResult.count || 0,
    subfolderCount: folderResult.count || 0,
  };
}

// Predefined folder colors
export const FOLDER_COLORS = [
  '#6b7280', // Gray (default)
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ec4899', // Pink
];

// Predefined folder icons
export const FOLDER_ICONS = [
  'folder',
  'folder-open',
  'documents',
  'archive',
  'briefcase',
  'home',
  'car',
  'medical',
  'card',
  'receipt',
  'calendar',
  'lock-closed',
  'star',
  'heart',
  'bookmark',
];
