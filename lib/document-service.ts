import { supabase } from './supabase';
import { DocumentType, DocumentMetadata } from './database.types';
import { performOCR, analyzeDocument } from './ai-service';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

export interface UploadDocumentParams {
  imageUri: string;
  userId: string;
}

export interface UploadDocumentResult {
  documentId: string;
  suggestedName: string;
  documentType: DocumentType;
  metadata: DocumentMetadata;
}

/**
 * Processes and uploads a document image
 */
export async function uploadDocument(
  params: UploadDocumentParams
): Promise<UploadDocumentResult> {
  const { imageUri, userId } = params;

  try {
    // Step 1: Optimize image
    const optimizedImage = await optimizeImage(imageUri);

    // Step 2: Convert to base64 for AI processing
    const base64Image = await FileSystem.readAsStringAsync(optimizedImage.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Step 3: Perform OCR
    const ocrResult = await performOCR(base64Image);

    // Step 4: Analyze document with AI
    const analysis = await analyzeDocument(base64Image, ocrResult.text);

    // Step 5: Upload to Supabase Storage
    const fileExtension = imageUri.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = `${userId}/${fileName}`;

    const fileData = await FileSystem.readAsStringAsync(optimizedImage.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, decode(fileData), {
        contentType: `image/${fileExtension}`,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Step 6: Create thumbnail
    const thumbnail = await createThumbnail(imageUri);
    const thumbnailPath = `${userId}/thumbnails/${fileName}`;

    const thumbnailData = await FileSystem.readAsStringAsync(thumbnail.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await supabase.storage
      .from('documents')
      .upload(thumbnailPath, decode(thumbnailData), {
        contentType: `image/${fileExtension}`,
        upsert: false,
      });

    const { data: thumbnailUrlData } = supabase.storage
      .from('documents')
      .getPublicUrl(thumbnailPath);

    // Step 7: Get file info
    const fileInfo = await FileSystem.getInfoAsync(optimizedImage.uri);
    const fileSize = fileInfo.exists ? (fileInfo as any).size : 0;

    // Step 8: Insert document record
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        original_filename: fileName,
        auto_generated_name: analysis.suggestedName,
        storage_path: filePath,
        document_type: analysis.documentType,
        ocr_text: ocrResult.text,
        metadata: analysis.metadata as any,
        thumbnail_url: thumbnailUrlData.publicUrl,
        file_size: fileSize,
        mime_type: `image/${fileExtension}`,
        scanned_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      throw dbError;
    }

    // Step 9: Create reminders based on metadata
    await createRemindersFromMetadata(document.id, userId, analysis.metadata);

    return {
      documentId: document.id,
      suggestedName: analysis.suggestedName,
      documentType: analysis.documentType,
      metadata: analysis.metadata,
    };
  } catch (error) {
    console.error('Upload document error:', error);
    throw error;
  }
}

/**
 * Optimizes image for storage and processing
 */
async function optimizeImage(uri: string) {
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1920 } }], // Max width 1920px
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  return manipulatedImage;
}

/**
 * Creates a thumbnail from the image
 */
async function createThumbnail(uri: string) {
  const thumbnail = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 300 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  return thumbnail;
}

/**
 * Helper to decode base64 string to Uint8Array
 */
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Creates reminders based on extracted metadata
 */
async function createRemindersFromMetadata(
  documentId: string,
  userId: string,
  metadata: DocumentMetadata
) {
  const reminders = [];

  // Warranty expiration
  if (metadata.expiration_date) {
    reminders.push({
      document_id: documentId,
      user_id: userId,
      reminder_type: 'warranty_expiration' as const,
      reminder_date: metadata.expiration_date,
      title: `Warranty expiring: ${metadata.product_name || 'Product'}`,
      description: `Warranty expires on ${metadata.expiration_date}`,
    });
  }

  // Insurance renewal
  if (metadata.renewal_date) {
    reminders.push({
      document_id: documentId,
      user_id: userId,
      reminder_type: 'insurance_renewal' as const,
      reminder_date: metadata.renewal_date,
      title: `Insurance renewal: ${metadata.coverage_type || 'Policy'}`,
      description: `Policy renewal on ${metadata.renewal_date}`,
    });
  }

  // Car maintenance
  if (metadata.next_service_date) {
    reminders.push({
      document_id: documentId,
      user_id: userId,
      reminder_type: 'car_maintenance' as const,
      reminder_date: metadata.next_service_date,
      title: `Car service due: ${metadata.vehicle || 'Vehicle'}`,
      description: `Next service at ${metadata.mileage || 'scheduled'} miles`,
    });
  }

  // Contract expiration
  if (metadata.end_date) {
    reminders.push({
      document_id: documentId,
      user_id: userId,
      reminder_type: 'contract_renewal' as const,
      reminder_date: metadata.end_date,
      title: `Contract ending: ${metadata.contract_party || 'Contract'}`,
      description: `Contract expires on ${metadata.end_date}`,
    });
  }

  if (reminders.length > 0) {
    await supabase.from('reminders').insert(reminders);
  }
}

/**
 * Searches documents by text query
 */
export async function searchDocuments(userId: string, query: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .or(`auto_generated_name.ilike.%${query}%,ocr_text.ilike.%${query}%`)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets all documents for a user
 */
export async function getUserDocuments(userId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Gets a single document by ID
 */
export async function getDocument(documentId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Deletes a document
 */
export async function deleteDocument(documentId: string) {
  // Get document to find storage path
  const document = await getDocument(documentId);

  // Delete from storage
  await supabase.storage.from('documents').remove([document.storage_path]);

  if (document.thumbnail_url) {
    const thumbnailPath = document.thumbnail_url.split('/documents/')[1];
    await supabase.storage.from('documents').remove([thumbnailPath]);
  }

  // Delete reminders
  await supabase.from('reminders').delete().eq('document_id', documentId);

  // Delete from database
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (error) {
    throw error;
  }
}

/**
 * Gets upcoming reminders for a user
 */
export async function getUpcomingReminders(userId: string, daysAhead: number = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysAhead);

  const { data, error } = await supabase
    .from('reminders')
    .select('*, documents(*)')
    .eq('user_id', userId)
    .eq('is_completed', false)
    .lte('reminder_date', futureDate.toISOString())
    .order('reminder_date', { ascending: true });

  if (error) {
    throw error;
  }

  return data;
}
