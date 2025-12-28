import { supabase } from './supabase';
import { uploadDocument } from './document-service';

export interface EmailImport {
  id: string;
  user_id: string;
  document_id: string | null;
  email_subject: string | null;
  email_from: string | null;
  email_date: string | null;
  attachment_name: string;
  import_source: 'manual' | 'imap' | 'webhook' | 'forward';
  processed: boolean;
  error_message: string | null;
  created_at: string;
}

export interface EmailImportConfig {
  enabled: boolean;
  forwardingAddress?: string;
  autoProcess: boolean;
  targetFolderId?: string;
}

/**
 * Gets all email imports for a user
 */
export async function getEmailImports(
  userId: string,
  options?: { processed?: boolean; limit?: number }
): Promise<EmailImport[]> {
  let query = supabase
    .from('email_imports')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (options?.processed !== undefined) {
    query = query.eq('processed', options.processed);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets pending (unprocessed) email imports
 */
export async function getPendingImports(userId: string): Promise<EmailImport[]> {
  return getEmailImports(userId, { processed: false });
}

/**
 * Creates a manual email import record
 * Use this when user manually uploads an email attachment
 */
export async function createManualImport(params: {
  userId: string;
  attachmentName: string;
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: string;
}): Promise<EmailImport> {
  const { userId, attachmentName, emailSubject, emailFrom, emailDate } = params;

  const { data, error } = await supabase
    .from('email_imports')
    .insert({
      user_id: userId,
      attachment_name: attachmentName,
      email_subject: emailSubject,
      email_from: emailFrom,
      email_date: emailDate,
      import_source: 'manual',
      processed: false,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Processes an email import (uploads and links document)
 */
export async function processEmailImport(
  importId: string,
  imageUri: string,
  userId: string,
  folderId?: string
): Promise<void> {
  try {
    // Upload the document
    const result = await uploadDocument({
      imageUri,
      userId,
    });

    // Move to folder if specified
    if (folderId) {
      await supabase
        .from('documents')
        .update({ folder_id: folderId })
        .eq('id', result.documentId);
    }

    // Update import record
    await supabase
      .from('email_imports')
      .update({
        document_id: result.documentId,
        processed: true,
        error_message: null,
      })
      .eq('id', importId);
  } catch (error: any) {
    // Mark as failed
    await supabase
      .from('email_imports')
      .update({
        processed: false,
        error_message: error.message || 'Processing failed',
      })
      .eq('id', importId);

    throw error;
  }
}

/**
 * Retries a failed email import
 */
export async function retryImport(
  importId: string,
  imageUri: string,
  userId: string
): Promise<void> {
  // Clear error and try again
  await supabase
    .from('email_imports')
    .update({ error_message: null })
    .eq('id', importId);

  await processEmailImport(importId, imageUri, userId);
}

/**
 * Deletes an email import record
 */
export async function deleteImport(importId: string): Promise<void> {
  const { error } = await supabase
    .from('email_imports')
    .delete()
    .eq('id', importId);

  if (error) {
    throw error;
  }
}

/**
 * Gets import statistics for a user
 */
export async function getImportStats(userId: string): Promise<{
  total: number;
  processed: number;
  pending: number;
  failed: number;
}> {
  const { data, error } = await supabase
    .from('email_imports')
    .select('processed, error_message')
    .eq('user_id', userId);

  if (error) {
    throw error;
  }

  const stats = {
    total: data.length,
    processed: 0,
    pending: 0,
    failed: 0,
  };

  for (const item of data) {
    if (item.processed) {
      stats.processed++;
    } else if (item.error_message) {
      stats.failed++;
    } else {
      stats.pending++;
    }
  }

  return stats;
}

// =====================================================
// EMAIL FORWARDING SETUP INSTRUCTIONS
// =====================================================

/**
 * Gets the email forwarding address for a user
 * In production, this would generate a unique address like:
 * docs-abc123@yourapp.com
 */
export function getForwardingAddress(userId: string): string {
  // Generate a deterministic but obfuscated address
  const hash = Buffer.from(userId).toString('base64').substring(0, 8).toLowerCase();
  return `docs-${hash}@import.aifilecabinet.app`;
}

/**
 * Instructions for setting up email forwarding
 */
export const EMAIL_SETUP_INSTRUCTIONS = {
  gmail: [
    '1. Open Gmail Settings (gear icon)',
    '2. Go to "Forwarding and POP/IMAP"',
    '3. Click "Add a forwarding address"',
    '4. Enter your unique import address',
    '5. Create a filter for documents you want to import',
    '6. Select "Forward to" with your import address',
  ],
  outlook: [
    '1. Go to Settings > Mail > Rules',
    '2. Click "Add new rule"',
    '3. Set conditions (e.g., has attachment)',
    '4. Select "Forward to" action',
    '5. Enter your unique import address',
    '6. Save the rule',
  ],
  general: [
    '1. Set up a forwarding rule in your email client',
    '2. Forward emails with document attachments',
    '3. Attachments will appear in your pending imports',
    '4. Review and process each import',
  ],
};

// =====================================================
// WEBHOOK HANDLER (for server-side use)
// =====================================================

/**
 * Webhook payload structure for email imports
 * This would be called by an email processing service (e.g., SendGrid, Mailgun)
 */
export interface EmailWebhookPayload {
  from: string;
  to: string;
  subject: string;
  date: string;
  attachments: Array<{
    filename: string;
    contentType: string;
    content: string; // base64 encoded
  }>;
}

/**
 * Parses the forwarding address to extract user ID
 * In production, this would be more secure (encrypted, signed, etc.)
 */
export function parseForwardingAddress(email: string): string | null {
  const match = email.match(/docs-([a-z0-9]+)@/i);
  if (!match) return null;

  try {
    // Decode the hash back to user ID
    const decoded = Buffer.from(match[1], 'base64').toString();
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Placeholder for webhook processing
 * In production, this would be an Edge Function or API route
 */
export async function handleEmailWebhook(payload: EmailWebhookPayload): Promise<void> {
  const userId = parseForwardingAddress(payload.to);
  if (!userId) {
    throw new Error('Invalid forwarding address');
  }

  // Create import records for each attachment
  for (const attachment of payload.attachments) {
    if (isImageAttachment(attachment.contentType)) {
      await supabase.from('email_imports').insert({
        user_id: userId,
        email_subject: payload.subject,
        email_from: payload.from,
        email_date: payload.date,
        attachment_name: attachment.filename,
        import_source: 'webhook',
        processed: false,
      });
    }
  }
}

function isImageAttachment(contentType: string): boolean {
  return contentType.startsWith('image/') ||
         contentType === 'application/pdf';
}
