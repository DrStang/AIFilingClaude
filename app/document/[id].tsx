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
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDocument, deleteDocument, updateDocument, UpdateDocumentParams } from '@/lib/document-service';
import { getUserTags, getDocumentTags, setDocumentTags, createTag, Tag, TAG_COLORS } from '@/lib/tag-service';
import { getUserFolders, moveDocumentToFolder, Folder, FOLDER_COLORS } from '@/lib/folder-service';
import { getUserFamilyGroups, shareDocument, getDocumentShares, unshareDocument } from '@/lib/sharing-service';
import { exportSingleDocument, shareExportedFile } from '@/lib/export-service';
import { supabase } from '@/lib/supabase';
import { Database, DocumentType, DocumentMetadata } from '@/lib/database.types';
import { useAuthStore } from '@/stores/auth-store';
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
  const { user } = useAuthStore();
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

  // V2 Features state
  const [tags, setTags] = useState<Tag[]>([]);
  const [documentTags, setDocumentTags] = useState<Tag[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [selectedTagColor, setSelectedTagColor] = useState(TAG_COLORS[0]);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [showFolderPicker, setShowFolderPicker] = useState(false);

  const [familyGroups, setFamilyGroups] = useState<any[]>([]);
  const [documentShares, setDocumentShares] = useState<any[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadDocument();
      loadV2Data();
    }, [id])
  );

  const loadDocument = async () => {
    try {
      const doc = await getDocument(id as string);
      setDocument(doc);
      setEditedName(doc.auto_generated_name);
      setEditedType(doc.document_type);

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

  const loadV2Data = async () => {
    if (!user) return;

    try {
      const [userTags, docTags, userFolders, groups, shares] = await Promise.all([
        getUserTags(user.id),
        getDocumentTags(id as string),
        getUserFolders(user.id),
        getUserFamilyGroups(user.id),
        getDocumentShares(id as string),
      ]);

      setTags(userTags);
      setDocumentTags(docTags);
      setFolders(userFolders);
      setFamilyGroups(groups);
      setDocumentShares(shares);
    } catch (error) {
      console.error('Error loading V2 data:', error);
    }
  };

  const handleSave = async () => {
    if (!document) return;

    setSaving(true);
    try {
      const processedMetadata: DocumentMetadata = {};
      Object.entries(editedMetadata).forEach(([key, value]) => {
        if (value.trim()) {
          if (value.startsWith('[') || value.startsWith('{')) {
            try {
              processedMetadata[key] = JSON.parse(value);
            } catch {
              processedMetadata[key] = value;
            }
          } else if (!isNaN(Number(value)) && value !== '') {
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

  // Tag handlers
  const handleToggleTag = async (tag: Tag) => {
    const isSelected = documentTags.some(t => t.id === tag.id);
    const newTags = isSelected
      ? documentTags.filter(t => t.id !== tag.id)
      : [...documentTags, tag];

    try {
      await setDocumentTags(id as string, newTags.map(t => t.id));
      setDocumentTags(newTags);
    } catch (error) {
      Alert.alert('Error', 'Failed to update tags');
    }
  };

  const handleCreateTag = async () => {
    if (!user || !newTagName.trim()) return;

    try {
      const tag = await createTag({
        userId: user.id,
        name: newTagName.trim(),
        color: selectedTagColor,
      });
      setTags(prev => [...prev, tag]);
      setNewTagName('');
      await handleToggleTag(tag);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create tag');
    }
  };

  // Folder handlers
  const handleMoveToFolder = async (folderId: string | null) => {
    try {
      await moveDocumentToFolder(id as string, folderId);
      setShowFolderPicker(false);
      loadDocument();
      Alert.alert('Success', 'Document moved successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to move document');
    }
  };

  // Share handlers
  const handleShareWithGroup = async (groupId: string) => {
    if (!user) return;

    try {
      await shareDocument({
        documentId: id as string,
        sharedBy: user.id,
        familyGroupId: groupId,
        permission: 'view',
      });
      loadV2Data();
      Alert.alert('Success', 'Document shared with group');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to share document');
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      await unshareDocument(shareId);
      loadV2Data();
    } catch (error) {
      Alert.alert('Error', 'Failed to remove share');
    }
  };

  // Export handlers
  const handleExport = async (format: 'pdf' | 'csv' | 'zip') => {
    if (!user) return;

    setExporting(true);
    try {
      const result = await exportSingleDocument(user.id, id as string, format);
      if (result.success && result.filePath) {
        setShowExportModal(false);
        await shareExportedFile(result.filePath);
      } else {
        Alert.alert('Error', result.error || 'Export failed');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Export failed');
    } finally {
      setExporting(false);
    }
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
  const currentFolder = folders.find(f => f.id === document.folder_id);

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
            {/* Quick Actions */}
            {!isEditing && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => setShowFolderPicker(true)}
                >
                  <Ionicons name="folder-outline" size={22} color="#2563eb" />
                  <Text style={styles.quickActionText}>Move</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => setShowTagPicker(true)}
                >
                  <Ionicons name="pricetag-outline" size={22} color="#2563eb" />
                  <Text style={styles.quickActionText}>Tags</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => setShowShareModal(true)}
                >
                  <Ionicons name="share-social-outline" size={22} color="#2563eb" />
                  <Text style={styles.quickActionText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAction}
                  onPress={() => setShowExportModal(true)}
                >
                  <Ionicons name="download-outline" size={22} color="#2563eb" />
                  <Text style={styles.quickActionText}>Export</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Folder Location */}
            {currentFolder && (
              <View style={styles.locationBadge}>
                <Ionicons name="folder" size={16} color={currentFolder.color} />
                <Text style={styles.locationText}>{currentFolder.name}</Text>
              </View>
            )}

            {/* Tags Display */}
            {documentTags.length > 0 && (
              <View style={styles.tagsContainer}>
                {documentTags.map(tag => (
                  <View key={tag.id} style={[styles.tag, { backgroundColor: tag.color + '20' }]}>
                    <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                    <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
                  </View>
                ))}
              </View>
            )}

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
                    if (!value || key === 'tags' || (Array.isArray(value) && value.length === 0))
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

            {/* Sharing Status */}
            {documentShares.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shared With</Text>
                {documentShares.map(share => (
                  <View key={share.id} style={styles.shareRow}>
                    <Ionicons name="people" size={18} color="#6b7280" />
                    <Text style={styles.shareText}>
                      {familyGroups.find(g => g.id === share.family_group_id)?.name || 'Shared'}
                    </Text>
                    <TouchableOpacity onPress={() => handleRemoveShare(share.id)}>
                      <Ionicons name="close-circle" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

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

      {/* Tag Picker Modal */}
      <Modal
        visible={showTagPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTagPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Manage Tags</Text>
              <TouchableOpacity onPress={() => setShowTagPicker(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            <View style={styles.createTagSection}>
              <TextInput
                style={styles.tagInput}
                placeholder="New tag name"
                value={newTagName}
                onChangeText={setNewTagName}
              />
              <View style={styles.tagColorRow}>
                {TAG_COLORS.slice(0, 6).map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.tagColorOption,
                      { backgroundColor: color },
                      selectedTagColor === color && styles.tagColorSelected,
                    ]}
                    onPress={() => setSelectedTagColor(color)}
                  />
                ))}
              </View>
              <TouchableOpacity
                style={[styles.createTagButton, !newTagName.trim() && styles.createTagButtonDisabled]}
                onPress={handleCreateTag}
                disabled={!newTagName.trim()}
              >
                <Text style={styles.createTagButtonText}>Create & Add Tag</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickerList}>
              {tags.map(tag => {
                const isSelected = documentTags.some(t => t.id === tag.id);
                return (
                  <TouchableOpacity
                    key={tag.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
                    onPress={() => handleToggleTag(tag)}
                  >
                    <View style={styles.tagOption}>
                      <View style={[styles.tagDot, { backgroundColor: tag.color }]} />
                      <Text style={styles.pickerItemText}>{tag.name}</Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#2563eb" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Folder Picker Modal */}
      <Modal
        visible={showFolderPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFolderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Move to Folder</Text>
              <TouchableOpacity onPress={() => setShowFolderPicker(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={[styles.pickerItem, !document.folder_id && styles.pickerItemSelected]}
                onPress={() => handleMoveToFolder(null)}
              >
                <View style={styles.folderOption}>
                  <Ionicons name="home" size={20} color="#6b7280" />
                  <Text style={styles.pickerItemText}>Root (No Folder)</Text>
                </View>
                {!document.folder_id && <Ionicons name="checkmark" size={20} color="#2563eb" />}
              </TouchableOpacity>
              {folders.map(folder => (
                <TouchableOpacity
                  key={folder.id}
                  style={[
                    styles.pickerItem,
                    document.folder_id === folder.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => handleMoveToFolder(folder.id)}
                >
                  <View style={styles.folderOption}>
                    <Ionicons name="folder" size={20} color={folder.color} />
                    <Text style={styles.pickerItemText}>{folder.name}</Text>
                  </View>
                  {document.folder_id === folder.id && (
                    <Ionicons name="checkmark" size={20} color="#2563eb" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Share Modal */}
      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Share Document</Text>
              <TouchableOpacity onPress={() => setShowShareModal(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {familyGroups.length === 0 ? (
                <View style={styles.emptyShareContainer}>
                  <Ionicons name="people-outline" size={48} color="#9ca3af" />
                  <Text style={styles.emptyShareText}>No family groups yet</Text>
                  <Text style={styles.emptyShareSubtext}>
                    Create a family group in the Sharing tab to share documents
                  </Text>
                </View>
              ) : (
                familyGroups.map(group => {
                  const isShared = documentShares.some(s => s.family_group_id === group.id);
                  return (
                    <TouchableOpacity
                      key={group.id}
                      style={[styles.pickerItem, isShared && styles.pickerItemSelected]}
                      onPress={() => !isShared && handleShareWithGroup(group.id)}
                      disabled={isShared}
                    >
                      <View style={styles.folderOption}>
                        <Ionicons name="people" size={20} color="#2563eb" />
                        <Text style={styles.pickerItemText}>{group.name}</Text>
                      </View>
                      {isShared && <Ionicons name="checkmark" size={20} color="#22c55e" />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Export Modal */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowExportModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pickerModal}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Export Document</Text>
              <TouchableOpacity onPress={() => setShowExportModal(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>
            <View style={styles.exportOptions}>
              {exporting ? (
                <View style={styles.exportingContainer}>
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text style={styles.exportingText}>Preparing export...</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.exportOption}
                    onPress={() => handleExport('pdf')}
                  >
                    <Ionicons name="document-text" size={32} color="#ef4444" />
                    <Text style={styles.exportOptionTitle}>PDF Report</Text>
                    <Text style={styles.exportOptionDesc}>
                      Document with image and metadata
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exportOption}
                    onPress={() => handleExport('csv')}
                  >
                    <Ionicons name="grid" size={32} color="#22c55e" />
                    <Text style={styles.exportOptionTitle}>CSV Data</Text>
                    <Text style={styles.exportOptionDesc}>
                      Spreadsheet-compatible format
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exportOption}
                    onPress={() => handleExport('zip')}
                  >
                    <Ionicons name="archive" size={32} color="#3b82f6" />
                    <Text style={styles.exportOptionTitle}>ZIP Archive</Text>
                    <Text style={styles.exportOptionDesc}>
                      Image and metadata files
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </View>
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
  quickActions: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    justifyContent: 'space-around',
  },
  quickAction: {
    alignItems: 'center',
    gap: 4,
  },
  quickActionText: {
    fontSize: 12,
    color: '#6b7280',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 13,
    color: '#4b5563',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  tagDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
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
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  shareText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
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
  createTagSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tagInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  tagColorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  tagColorOption: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  tagColorSelected: {
    borderWidth: 3,
    borderColor: '#1f2937',
  },
  createTagButton: {
    backgroundColor: '#2563eb',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  createTagButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  createTagButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tagOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  folderOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyShareContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyShareText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4b5563',
    marginTop: 12,
  },
  emptyShareSubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  exportOptions: {
    padding: 20,
    gap: 16,
  },
  exportOption: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 8,
  },
  exportOptionDesc: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  exportingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  exportingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
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
