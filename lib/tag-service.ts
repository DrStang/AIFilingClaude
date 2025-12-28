import { supabase } from './supabase';
import { Tag } from './database.types';

export interface CreateTagParams {
  userId: string;
  name: string;
  color?: string;
}

export interface TagWithCount extends Tag {
  documentCount: number;
}

/**
 * Creates a new tag
 */
export async function createTag(params: CreateTagParams): Promise<Tag> {
  const { userId, name, color } = params;

  const { data, error } = await supabase
    .from('tags')
    .insert({
      user_id: userId,
      name: name.toLowerCase().trim(),
      color: color || '#3b82f6',
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Tag already exists');
    }
    throw error;
  }

  return data;
}

/**
 * Gets all tags for a user
 */
export async function getUserTags(userId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets tags with document counts
 */
export async function getUserTagsWithCounts(userId: string): Promise<TagWithCount[]> {
  const tags = await getUserTags(userId);

  // Get counts for each tag
  const tagsWithCounts = await Promise.all(
    tags.map(async (tag) => {
      const { count } = await supabase
        .from('document_tags')
        .select('*', { count: 'exact', head: true })
        .eq('tag_id', tag.id);

      return {
        ...tag,
        documentCount: count || 0,
      };
    })
  );

  return tagsWithCounts;
}

/**
 * Gets a single tag by ID
 */
export async function getTag(tagId: string): Promise<Tag> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('id', tagId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Updates a tag
 */
export async function updateTag(
  tagId: string,
  updates: { name?: string; color?: string }
): Promise<Tag> {
  const updateData: any = {};

  if (updates.name) {
    updateData.name = updates.name.toLowerCase().trim();
  }
  if (updates.color) {
    updateData.color = updates.color;
  }

  const { data, error } = await supabase
    .from('tags')
    .update(updateData)
    .eq('id', tagId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Deletes a tag
 */
export async function deleteTag(tagId: string): Promise<void> {
  // Document_tags will cascade delete
  const { error } = await supabase.from('tags').delete().eq('id', tagId);

  if (error) {
    throw error;
  }
}

/**
 * Adds a tag to a document
 */
export async function addTagToDocument(
  documentId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase.from('document_tags').insert({
    document_id: documentId,
    tag_id: tagId,
  });

  if (error) {
    if (error.code === '23505') {
      // Already exists, ignore
      return;
    }
    throw error;
  }
}

/**
 * Removes a tag from a document
 */
export async function removeTagFromDocument(
  documentId: string,
  tagId: string
): Promise<void> {
  const { error } = await supabase
    .from('document_tags')
    .delete()
    .eq('document_id', documentId)
    .eq('tag_id', tagId);

  if (error) {
    throw error;
  }
}

/**
 * Gets all tags for a document
 */
export async function getDocumentTags(documentId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('document_tags')
    .select('tag_id, tags(*)')
    .eq('document_id', documentId);

  if (error) {
    throw error;
  }

  return data.map((dt: any) => dt.tags);
}

/**
 * Sets tags for a document (replaces existing)
 */
export async function setDocumentTags(
  documentId: string,
  tagIds: string[]
): Promise<void> {
  // Remove existing tags
  await supabase
    .from('document_tags')
    .delete()
    .eq('document_id', documentId);

  // Add new tags
  if (tagIds.length > 0) {
    const { error } = await supabase.from('document_tags').insert(
      tagIds.map((tagId) => ({
        document_id: documentId,
        tag_id: tagId,
      }))
    );

    if (error) {
      throw error;
    }
  }
}

/**
 * Gets documents with a specific tag
 */
export async function getDocumentsByTag(
  userId: string,
  tagId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from('document_tags')
    .select('document_id, documents(*)')
    .eq('tag_id', tagId);

  if (error) {
    throw error;
  }

  // Filter by user (RLS should handle this but double-check)
  return data
    .map((dt: any) => dt.documents)
    .filter((doc: any) => doc.user_id === userId);
}

/**
 * Creates tag if it doesn't exist, returns existing if it does
 */
export async function getOrCreateTag(
  userId: string,
  name: string,
  color?: string
): Promise<Tag> {
  const normalizedName = name.toLowerCase().trim();

  // Check if exists
  const { data: existing } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .eq('name', normalizedName)
    .single();

  if (existing) {
    return existing;
  }

  // Create new
  return createTag({ userId, name: normalizedName, color });
}

/**
 * Bulk adds tags to a document by name (creates if needed)
 */
export async function addTagsByName(
  userId: string,
  documentId: string,
  tagNames: string[]
): Promise<Tag[]> {
  const tags: Tag[] = [];

  for (const name of tagNames) {
    const tag = await getOrCreateTag(userId, name);
    await addTagToDocument(documentId, tag.id);
    tags.push(tag);
  }

  return tags;
}

/**
 * Searches tags by name
 */
export async function searchTags(userId: string, query: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .ilike('name', `%${query}%`)
    .order('name', { ascending: true })
    .limit(10);

  if (error) {
    throw error;
  }

  return data;
}

// Predefined tag colors
export const TAG_COLORS = [
  '#3b82f6', // Blue (default)
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#6b7280', // Gray
];

// Suggested default tags
export const SUGGESTED_TAGS = [
  'important',
  'urgent',
  'review',
  'archived',
  'personal',
  'business',
  'tax-deductible',
  'reimbursable',
  'warranty-active',
  'expired',
];
