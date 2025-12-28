import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDocument } from './document-service';

export type ExportFormat = 'pdf' | 'zip' | 'csv';

export interface ExportOptions {
  userId: string;
  documentIds: string[];
  format: ExportFormat;
  includeMetadata?: boolean;
  includeOcrText?: boolean;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  fileName?: string;
  error?: string;
}

/**
 * Exports documents to the specified format
 */
export async function exportDocuments(options: ExportOptions): Promise<ExportResult> {
  const { userId, documentIds, format, includeMetadata = true, includeOcrText = false } = options;

  try {
    // Fetch all documents
    const documents = await Promise.all(
      documentIds.map((id) => getDocument(id))
    );

    const timestamp = new Date().toISOString().split('T')[0];
    let fileName: string;
    let filePath: string;

    switch (format) {
      case 'csv':
        fileName = `documents-export-${timestamp}.csv`;
        filePath = await exportToCsv(documents, includeMetadata, includeOcrText);
        break;
      case 'zip':
        fileName = `documents-export-${timestamp}.zip`;
        filePath = await exportToZip(documents, includeMetadata);
        break;
      case 'pdf':
        fileName = `documents-export-${timestamp}.pdf`;
        filePath = await exportToPdf(documents, includeMetadata);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }

    // Record export in history
    await recordExport(userId, format, documentIds, fileName);

    return {
      success: true,
      filePath,
      fileName,
    };
  } catch (error: any) {
    console.error('Export error:', error);
    return {
      success: false,
      error: error.message || 'Export failed',
    };
  }
}

/**
 * Exports documents to CSV format
 */
async function exportToCsv(
  documents: any[],
  includeMetadata: boolean,
  includeOcrText: boolean
): Promise<string> {
  const headers = [
    'ID',
    'Name',
    'Type',
    'Category',
    'Created At',
    'File Size',
  ];

  if (includeMetadata) {
    headers.push('Metadata');
  }
  if (includeOcrText) {
    headers.push('OCR Text');
  }

  const rows = documents.map((doc) => {
    const row = [
      doc.id,
      `"${doc.auto_generated_name.replace(/"/g, '""')}"`,
      doc.document_type,
      doc.category || '',
      doc.created_at,
      doc.file_size,
    ];

    if (includeMetadata) {
      row.push(`"${JSON.stringify(doc.metadata).replace(/"/g, '""')}"`);
    }
    if (includeOcrText) {
      row.push(`"${(doc.ocr_text || '').replace(/"/g, '""')}"`);
    }

    return row.join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');

  const filePath = `${FileSystem.cacheDirectory}export-${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(filePath, csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filePath;
}

/**
 * Exports documents to ZIP format (images + metadata JSON)
 */
async function exportToZip(
  documents: any[],
  includeMetadata: boolean
): Promise<string> {
  // Note: Full ZIP creation requires a library like 'jszip'
  // For now, we'll create a directory with files and info

  const exportDir = `${FileSystem.cacheDirectory}export-${Date.now()}/`;
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });

  const manifest: any[] = [];

  for (const doc of documents) {
    // Download image from storage
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(doc.storage_path);

    const imageFileName = `${doc.id}-${doc.auto_generated_name.replace(/[^a-zA-Z0-9]/g, '_')}.jpg`;
    const imagePath = `${exportDir}${imageFileName}`;

    try {
      await FileSystem.downloadAsync(urlData.publicUrl, imagePath);

      manifest.push({
        id: doc.id,
        name: doc.auto_generated_name,
        type: doc.document_type,
        file: imageFileName,
        metadata: includeMetadata ? doc.metadata : undefined,
        created_at: doc.created_at,
      });
    } catch (error) {
      console.error(`Failed to download ${doc.id}:`, error);
    }
  }

  // Write manifest
  const manifestPath = `${exportDir}manifest.json`;
  await FileSystem.writeAsStringAsync(
    manifestPath,
    JSON.stringify(manifest, null, 2),
    { encoding: FileSystem.EncodingType.UTF8 }
  );

  // Return directory path (in production, you'd zip this)
  return exportDir;
}

/**
 * Exports documents to PDF format
 */
async function exportToPdf(
  documents: any[],
  includeMetadata: boolean
): Promise<string> {
  // Note: Full PDF creation requires a library like 'react-native-pdf-lib' or 'expo-print'
  // This is a placeholder that creates an HTML file that can be printed to PDF

  let htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Document Export</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .document { page-break-after: always; margin-bottom: 40px; }
        .document:last-child { page-break-after: auto; }
        .header { border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
        .title { font-size: 24px; font-weight: bold; }
        .type { color: #666; font-size: 14px; }
        .metadata { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .metadata-item { margin: 8px 0; }
        .label { font-weight: bold; color: #333; }
        .image { max-width: 100%; border: 1px solid #ddd; }
        .ocr-text {
          background: #fff;
          border: 1px solid #ddd;
          padding: 15px;
          white-space: pre-wrap;
          font-family: monospace;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <h1>Document Export</h1>
      <p>Exported on ${new Date().toLocaleDateString()}</p>
      <p>Total documents: ${documents.length}</p>
      <hr>
  `;

  for (const doc of documents) {
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(doc.storage_path);

    htmlContent += `
      <div class="document">
        <div class="header">
          <div class="title">${escapeHtml(doc.auto_generated_name)}</div>
          <div class="type">${doc.document_type} • Created: ${new Date(doc.created_at).toLocaleDateString()}</div>
        </div>

        <img class="image" src="${urlData.publicUrl}" alt="${escapeHtml(doc.auto_generated_name)}" />
    `;

    if (includeMetadata && doc.metadata) {
      htmlContent += `
        <div class="metadata">
          <h3>Document Information</h3>
      `;

      for (const [key, value] of Object.entries(doc.metadata)) {
        if (value !== null && value !== undefined && value !== '') {
          htmlContent += `
            <div class="metadata-item">
              <span class="label">${formatLabel(key)}:</span> ${escapeHtml(String(value))}
            </div>
          `;
        }
      }

      htmlContent += '</div>';
    }

    if (doc.ocr_text) {
      htmlContent += `
        <h3>Extracted Text</h3>
        <div class="ocr-text">${escapeHtml(doc.ocr_text)}</div>
      `;
    }

    htmlContent += '</div>';
  }

  htmlContent += '</body></html>';

  const filePath = `${FileSystem.cacheDirectory}export-${Date.now()}.html`;
  await FileSystem.writeAsStringAsync(filePath, htmlContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return filePath;
}

/**
 * Records an export in history
 */
async function recordExport(
  userId: string,
  exportType: ExportFormat,
  documentIds: string[],
  fileName: string
): Promise<void> {
  const { error } = await supabase.from('export_history').insert({
    user_id: userId,
    export_type: exportType,
    document_ids: documentIds,
    file_name: fileName,
  });

  if (error) {
    console.error('Failed to record export:', error);
  }
}

/**
 * Gets export history for a user
 */
export async function getExportHistory(userId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('export_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Shares an exported file using native share sheet
 */
export async function shareExportedFile(filePath: string): Promise<void> {
  const canShare = await Sharing.isAvailableAsync();

  if (!canShare) {
    throw new Error('Sharing is not available on this device');
  }

  await Sharing.shareAsync(filePath, {
    mimeType: getMimeType(filePath),
    dialogTitle: 'Share Document Export',
  });
}

/**
 * Exports a single document
 */
export async function exportSingleDocument(
  userId: string,
  documentId: string,
  format: ExportFormat
): Promise<ExportResult> {
  return exportDocuments({
    userId,
    documentIds: [documentId],
    format,
    includeMetadata: true,
    includeOcrText: true,
  });
}

/**
 * Exports all documents in a folder
 */
export async function exportFolder(
  userId: string,
  folderId: string | null,
  format: ExportFormat
): Promise<ExportResult> {
  let query = supabase
    .from('documents')
    .select('id')
    .eq('user_id', userId);

  if (folderId === null) {
    query = query.is('folder_id', null);
  } else {
    query = query.eq('folder_id', folderId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const documentIds = data.map((d: any) => d.id);

  if (documentIds.length === 0) {
    return {
      success: false,
      error: 'No documents to export',
    };
  }

  return exportDocuments({
    userId,
    documentIds,
    format,
    includeMetadata: true,
  });
}

/**
 * Exports documents with a specific tag
 */
export async function exportByTag(
  userId: string,
  tagId: string,
  format: ExportFormat
): Promise<ExportResult> {
  const { data, error } = await supabase
    .from('document_tags')
    .select('document_id')
    .eq('tag_id', tagId);

  if (error) {
    throw error;
  }

  const documentIds = data.map((d: any) => d.document_id);

  if (documentIds.length === 0) {
    return {
      success: false,
      error: 'No documents with this tag',
    };
  }

  return exportDocuments({
    userId,
    documentIds,
    format,
    includeMetadata: true,
  });
}

// Helper functions
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv':
      return 'text/csv';
    case 'zip':
      return 'application/zip';
    case 'pdf':
      return 'application/pdf';
    case 'html':
      return 'text/html';
    default:
      return 'application/octet-stream';
  }
}
