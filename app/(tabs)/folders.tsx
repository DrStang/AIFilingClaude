import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Image,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth-store';
import {
  getUserFolders,
  getRootFolders,
  getSubfolders,
  createFolder,
  deleteFolder,
  getDocumentsInFolder,
  getFolderCounts,
  FOLDER_COLORS,
  Folder,
} from '@/lib/folder-service';
import { format } from 'date-fns';

interface FolderWithCounts extends Folder {
  documentCount?: number;
  subfolderCount?: number;
}

export default function FoldersScreen() {
  const { user } = useAuthStore();
  const [folders, setFolders] = useState<FolderWithCounts[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [currentFolder, setCurrentFolder] = useState<Folder | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedColor, setSelectedColor] = useState(FOLDER_COLORS[0]);

  const loadFolderContents = useCallback(async (folderId: string | null) => {
    if (!user) return;

    try {
      // Load subfolders
      const subfolders = folderId
        ? await getSubfolders(folderId)
        : await getRootFolders(user.id);

      // Load folder counts
      const foldersWithCounts = await Promise.all(
        subfolders.map(async (folder) => {
          const counts = await getFolderCounts(folder.id);
          return { ...folder, ...counts };
        })
      );

      setFolders(foldersWithCounts);

      // Load documents in this folder
      const docs = await getDocumentsInFolder(user.id, folderId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading folder contents:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadFolderContents(currentFolder?.id || null);
    }, [currentFolder, loadFolderContents])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadFolderContents(currentFolder?.id || null);
  };

  const navigateToFolder = async (folder: Folder) => {
    setBreadcrumbs((prev) => [...prev, folder]);
    setCurrentFolder(folder);
    setLoading(true);
    await loadFolderContents(folder.id);
  };

  const navigateBack = async () => {
    const newBreadcrumbs = [...breadcrumbs];
    newBreadcrumbs.pop();
    const parentFolder = newBreadcrumbs[newBreadcrumbs.length - 1] || null;
    setBreadcrumbs(newBreadcrumbs);
    setCurrentFolder(parentFolder);
    setLoading(true);
    await loadFolderContents(parentFolder?.id || null);
  };

  const navigateToBreadcrumb = async (index: number) => {
    if (index === -1) {
      setBreadcrumbs([]);
      setCurrentFolder(null);
      setLoading(true);
      await loadFolderContents(null);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      const folder = newBreadcrumbs[index];
      setBreadcrumbs(newBreadcrumbs);
      setCurrentFolder(folder);
      setLoading(true);
      await loadFolderContents(folder.id);
    }
  };

  const handleCreateFolder = async () => {
    if (!user || !newFolderName.trim()) return;

    try {
      await createFolder({
        userId: user.id,
        name: newFolderName.trim(),
        parentId: currentFolder?.id || null,
        color: selectedColor,
      });

      setShowCreateModal(false);
      setNewFolderName('');
      setSelectedColor(FOLDER_COLORS[0]);
      loadFolderContents(currentFolder?.id || null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create folder');
    }
  };

  const handleDeleteFolder = (folder: Folder) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete "${folder.name}"? Documents will be moved to the parent folder.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFolder(folder.id);
              loadFolderContents(currentFolder?.id || null);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete folder');
            }
          },
        },
      ]
    );
  };

  const renderFolder = ({ item }: { item: FolderWithCounts }) => (
    <TouchableOpacity
      style={styles.folderCard}
      onPress={() => navigateToFolder(item)}
      onLongPress={() => handleDeleteFolder(item)}
    >
      <View style={[styles.folderIcon, { backgroundColor: item.color + '20' }]}>
        <Ionicons name="folder" size={28} color={item.color} />
      </View>
      <View style={styles.folderInfo}>
        <Text style={styles.folderName}>{item.name}</Text>
        <Text style={styles.folderMeta}>
          {item.subfolderCount || 0} folders • {item.documentCount || 0} documents
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  const renderDocument = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.documentCard}
      onPress={() => router.push(`/document/${item.id}`)}
    >
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Ionicons name="document" size={24} color="#6b7280" />
        </View>
      )}
      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={1}>
          {item.auto_generated_name}
        </Text>
        <Text style={styles.documentMeta}>
          {format(new Date(item.created_at), 'MMM d, yyyy')}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View>
      {/* Breadcrumbs */}
      <View style={styles.breadcrumbs}>
        <TouchableOpacity
          style={styles.breadcrumbItem}
          onPress={() => navigateToBreadcrumb(-1)}
        >
          <Ionicons name="home" size={16} color="#2563eb" />
          <Text style={styles.breadcrumbText}>Home</Text>
        </TouchableOpacity>
        {breadcrumbs.map((folder, index) => (
          <View key={folder.id} style={styles.breadcrumbItem}>
            <Ionicons name="chevron-forward" size={14} color="#9ca3af" />
            <TouchableOpacity onPress={() => navigateToBreadcrumb(index)}>
              <Text style={styles.breadcrumbText}>{folder.name}</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Folders Section */}
      {folders.length > 0 && (
        <View style={styles.sectionHeader}>
          <Ionicons name="folder" size={18} color="#6b7280" />
          <Text style={styles.sectionTitle}>Folders</Text>
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (documents.length === 0) return null;

    return (
      <View>
        <View style={styles.sectionHeader}>
          <Ionicons name="document" size={18} color="#6b7280" />
          <Text style={styles.sectionTitle}>Documents</Text>
        </View>
        {documents.map((doc) => (
          <View key={doc.id}>{renderDocument({ item: doc })}</View>
        ))}
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={folders}
        renderItem={renderFolder}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          documents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="folder-open-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyTitle}>
                {currentFolder ? 'Empty folder' : 'No folders yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Create a folder to organize your documents
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity
          style={styles.fabSecondary}
          onPress={() =>
            router.push({
              pathname: '/camera',
              params: { folderId: currentFolder?.id || '', mode: 'bulk' },
            })
          }
        >
          <Ionicons name="camera" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowCreateModal(true)}
        >
          <Ionicons name="folder-open" size={24} color="#fff" />
          <Ionicons
            name="add"
            size={16}
            color="#fff"
            style={styles.fabAddIcon}
          />
        </TouchableOpacity>
      </View>

      {/* Create Folder Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Folder</Text>

            <TextInput
              style={styles.input}
              placeholder="Folder name"
              value={newFolderName}
              onChangeText={setNewFolderName}
              autoFocus
            />

            <Text style={styles.colorLabel}>Color</Text>
            <View style={styles.colorPicker}>
              {FOLDER_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewFolderName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  !newFolderName.trim() && styles.createButtonDisabled,
                ]}
                onPress={handleCreateFolder}
                disabled={!newFolderName.trim()}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  breadcrumbs: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingVertical: 8,
    marginBottom: 16,
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  folderCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  folderIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  folderInfo: {
    flex: 1,
  },
  folderName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  folderMeta: {
    fontSize: 13,
    color: '#6b7280',
  },
  documentCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  thumbnailPlaceholder: {
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  documentMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    gap: 12,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabSecondary: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6b7280',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  fabAddIcon: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  colorOption: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#1f2937',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  createButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#2563eb',
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
