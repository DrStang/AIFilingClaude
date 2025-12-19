import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDocument, deleteDocument, updateDocument, UpdateDocumentParams } from '@/lib/document-service';
import { supabase } from '@/lib/supabase';
import { Database, DocumentType, DocumentMetadata } from '@/lib/database.types';
import { format } from 'date-fns';

type Document = Database['public']['Tables']['documents']['Row'];

const DOCUMENT_TYPES: DocumentType[] = [
  'receipt',
  'warranty',
  'medical',
  'tax',
  'contract',
  'car_service',
  'insurance',
  'misc',
];

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedType, setEditedType] = useState<DocumentType>('misc');
  const [editedMetadata, setEditedMetadata] = useState<Record<string, string>>({});
  const [showTypePicker, setShowTypePicker] = useState(false);

  // Image viewer state
  const [showImageViewer, setShowImageViewer] = useState(false);

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      const doc = await getDocument(id as string);
      setDocument(doc);
      setEditedName(doc.auto_generated_name);
      setEditedType(doc.document_type);

      // Convert metadata to editable string format
      const metadata = doc.metadata as DocumentMetadata;
      if (metadata) {
        const stringMetadata: Record<string, string> = {};
        Object.entries(metadata).forEach(([key, value]) => {
          if (value !== null && value !== undefined && key !== 'tags') {
            if (typeof value === 'object') {
              stringMetadata[key] = JSON.stringify(value);
            } else {
              stringMetadata[key] = String(value);
            }
          }
        });
        setEditedMetadata(stringMetadata);
      }

      // Get signed URL for the image
      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(doc.storage_path);

      setImageUrl(data.publicUrl);
    } catch (error) {
      console.error('Error loading document:', error);
      Alert.alert('Error', 'Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    setSaving(true);
    try {
      // Convert string metadata back to proper types
      const processedMetadata: DocumentMetadata = {};
      Object.entries(editedMetadata).forEach(([key, value]) => {
        if (value.trim()) {
          // Try to parse JSON for arrays/objects
          if (value.startsWith('[') || value.startsWith('{')) {
            try {
              processedMetadata[key] = JSON.parse(value);
            } catch {
              processedMetadata[key] = value;
            }
          } else if (!isNaN(Number(value)) && value !== '') {
            // Convert to number if it looks like one
            processedMetadata[key] = Number(value);
          } else {
            processedMetadata[key] = value;
          }
        }
      });

      const updates: UpdateDocumentParams = {
        auto_generated_name: editedName,
        document_type: editedType,
        metadata: processedMetadata,
      };

      const updatedDoc = await updateDocument(document.id, updates);
      setDocument(updatedDoc);
      setIsEditing(false);
      Alert.alert('Success', 'Document updated successfully');
    } catch (error) {
      console.error('Error updating document:', error);
      Alert.alert('Error', 'Failed to update document');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (document) {
      setEditedName(document.auto_generated_name);
      setEditedType(document.document_type);

      const metadata = document.metadata as DocumentMetadata;
      if (metadata) {
        const stringMetadata: Record<string, string> = {};
        Object.entries(metadata).forEach(([key, value]) => {
          if (value !== null && value !== undefined && key !== 'tags') {
            if (typeof value === 'object') {
              stringMetadata[key] = JSON.stringify(value);
            } else {
              stringMetadata[key] = String(value);
            }
          }
        });
        setEditedMetadata(stringMetadata);
      }
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(id as string);
              Alert.alert('Success', 'Document deleted', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete document');
            }
          },
        },
      ]
    );
  };

  const updateMetadataField = (key: string, value: string) => {
    setEditedMetadata(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const addMetadataField = () => {
    Alert.prompt(
      'Add Field',
      'Enter field name:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add',
          onPress: (fieldName) => {
            if (fieldName && fieldName.trim()) {
              const key = fieldName.trim().toLowerCase().replace(/\s+/g, '_');
              setEditedMetadata(prev => ({
                ...prev,
                [key]: '',
              }));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const removeMetadataField = (key: string) => {
    Alert.alert(
      'Remove Field',
      `Are you sure you want to remove "${formatKey(key)}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setEditedMetadata(prev => {
              const updated = { ...prev };
              delete updated[key];
              return updated;
            });
          },
        },
      ]
    );
  };

  const formatKey = (key: string) => {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.centerContainer}>
        <Text>Document not found</Text>
      </View>
    );
  }

  const metadata = document.metadata as DocumentMetadata;

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2563eb" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Document' : 'Document Details'}
        </Text>
        {isEditing ? (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.headerButton, styles.saveButton]}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
            <Ionicons name="pencil" size={20} color="#2563eb" />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scrollContent}>
          {/* Original Document Image */}
          {imageUrl && (
            <TouchableOpacity onPress={() => setShowImageViewer(true)} activeOpacity={0.9}>
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
                <View style={styles.imageOverlay}>
                  <Ionicons name="expand-outline" size={24} color="#fff" />
                  <Text style={styles.imageOverlayText}>Tap to view original</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.content}>
            {/* Document Header / Name */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Document Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  placeholder="Enter document name"
                  multiline
                />
              ) : (
                <Text style={styles.title}>{document.auto_generated_name}</Text>
              )}
            </View>

            {/* Document Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Document Type</Text>
              {isEditing ? (
                <TouchableOpacity
                  style={styles.typeSelector}
                  onPress={() => setShowTypePicker(true)}
                >
                  <Text style={styles.typeSelectorText}>
                    {editedType.replace('_', ' ').toUpperCase()}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#6b7280" />
                </TouchableOpacity>
              ) : (
                <Text style={styles.type}>
                  {document.document_type.replace('_', ' ').toUpperCase()}
                </Text>
              )}
              <Text style={styles.date}>
                Scanned on {format(new Date(document.created_at), 'MMM d, yyyy')}
              </Text>
            </View>

            {/* Extracted Information */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Extracted Information</Text>
                {isEditing && (
                  <TouchableOpacity onPress={addMetadataField} style={styles.addFieldButton}>
                    <Ionicons name="add-circle-outline" size={24} color="#2563eb" />
                  </TouchableOpacity>
                )}
              </View>

              {isEditing ? (
                Object.entries(editedMetadata).length > 0 ? (
                  Object.entries(editedMetadata).map(([key, value]) => (
                    <View key={key} style={styles.editableMetadataRow}>
                      <View style={styles.metadataLabelRow}>
                        <Text style={styles.metadataKey}>{formatKey(key)}:</Text>
                        <TouchableOpacity
                          onPress={() => removeMetadataField(key)}
                          style={styles.removeFieldButton}
                        >
                          <Ionicons name="close-circle" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        style={styles.metadataInput}
                        value={value}
                        onChangeText={(text) => updateMetadataField(key, text)}
                        placeholder={`Enter ${formatKey(key).toLowerCase()}`}
                        multiline={value.length > 50}
                      />
                    </View>
                  ))
                ) : (
                  <Text style={styles.noDataText}>
                    No extracted data. Tap + to add fields.
                  </Text>
                )
              ) : (
                metadata && Object.keys(metadata).length > 0 ? (
                  Object.entries(metadata).map(([key, value]) => {
                    if (
                      !value ||
                      key === 'tags' ||
                      (Array.isArray(value) && value.length === 0)
                    )
                      return null;

                    return (
                      <View key={key} style={styles.metadataRow}>
                        <Text style={styles.metadataKey}>{formatKey(key)}:</Text>
                        <Text style={styles.metadataValue}>
                          {typeof value === 'object'
                            ? JSON.stringify(value, null, 2)
                            : String(value)}
                        </Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.noDataText}>No extracted information available.</Text>
                )
              )}
            </View>

            {/* Extracted Text (OCR) */}
            {document.ocr_text && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Extracted Text</Text>
                <View style={styles.ocrTextContainer}>
                  <Text style={styles.ocrText}>{document.ocr_text}</Text>
                </View>
              </View>
            )}

            {/* File Details */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>File Details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>File Size:</Text>
                <Text style={styles.detailValue}>
                  {(document.file_size / 1024).toFixed(2)} KB
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Type:</Text>
                <Text style={styles.detailValue}>{document.mime_type}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Storage:</Text>
                <Text style={styles.detailValue} numberOfLines={1}>
                  {document.storage_path}
                </Text>
              </View>
            </View>

            {/* Delete Button */}
            {!isEditing && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
                <Text style={styles.deleteButtonText}>Delete Document</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Document Type Picker Modal */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTypePicker(false)}
        >
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Document Type</Text>
              <TouchableOpacity onPress={() => setShowTypePicker(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {DOCUMENT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pickerItem,
                    editedType === type && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setEditedType(type);
                    setShowTypePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      editedType === type && styles.pickerItemTextSelected,
                    ]}
                  >
                    {type.replace('_', ' ').toUpperCase()}
                  </Text>
                  {editedType === type && (
                    <Ionicons name="checkmark" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Image Viewer Modal */}
      <Modal
        visible={showImageViewer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImageViewer(false)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerClose}
            onPress={() => setShowImageViewer(false)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.imageViewerTitle}>Original Document</Text>
          {imageUrl && (
            <Image
              source={{ uri: imageUrl }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.imageViewerHint}>Pinch to zoom</Text>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoid: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  editButton: {
    padding: 8,
  },
  saveButton: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  cancelText: {
    color: '#6b7280',
    fontSize: 16,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#000',
  },
  image: {
    width: '100%',
    height: 300,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  imageOverlayText: {
    color: '#fff',
    fontSize: 14,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: 26,
  },
  textInput: {
    fontSize: 16,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#f9fafb',
    marginBottom: 8,
  },
  typeSelectorText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
  },
  type: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '600',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
  },
  addFieldButton: {
    padding: 4,
  },
  editableMetadataRow: {
    marginBottom: 16,
  },
  metadataLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  removeFieldButton: {
    padding: 4,
  },
  metadataInput: {
    fontSize: 14,
    color: '#1f2937',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#f9fafb',
  },
  metadataRow: {
    marginBottom: 12,
  },
  metadataKey: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 4,
  },
  metadataValue: {
    fontSize: 14,
    color: '#1f2937',
  },
  noDataText: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  ocrTextContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
  },
  ocrText: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginBottom: 32,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
  // Picker Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  pickerList: {
    padding: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  pickerItemSelected: {
    backgroundColor: '#eff6ff',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#1f2937',
  },
  pickerItemTextSelected: {
    color: '#2563eb',
    fontWeight: '600',
  },
  // Image Viewer Modal Styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageViewerTitle: {
    position: 'absolute',
    top: 55,
    left: 20,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  fullScreenImage: {
    width: screenWidth,
    height: screenHeight * 0.8,
  },
  imageViewerHint: {
    position: 'absolute',
    bottom: 50,
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
});
