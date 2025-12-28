import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth-store';
import { uploadDocument } from '@/lib/document-service';
import { moveDocumentToFolder } from '@/lib/folder-service';

interface QueuedImage {
  id: string;
  uri: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  result?: any;
  error?: string;
}

export default function CameraScreen() {
  const { user } = useAuthStore();
  const params = useLocalSearchParams<{ folderId?: string; mode?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [processing, setProcessing] = useState(false);
  const [bulkMode, setBulkMode] = useState(params.mode === 'bulk');
  const [imageQueue, setImageQueue] = useState<QueuedImage[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#9ca3af" />
        <Text style={styles.permissionTitle}>Camera Permission Required</Text>
        <Text style={styles.permissionMessage}>
          We need access to your camera to scan documents
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const addToQueue = (uri: string) => {
    const newImage: QueuedImage = {
      id: Date.now().toString(),
      uri,
      status: 'pending',
    };
    setImageQueue((prev) => [...prev, newImage]);
  };

  const processQueue = async () => {
    if (!user || imageQueue.length === 0) return;

    setProcessing(true);
    setShowQueue(true);

    for (let i = 0; i < imageQueue.length; i++) {
      const image = imageQueue[i];
      if (image.status !== 'pending') continue;

      // Update status to processing
      setImageQueue((prev) =>
        prev.map((img) =>
          img.id === image.id ? { ...img, status: 'processing' } : img
        )
      );

      try {
        const result = await uploadDocument({
          imageUri: image.uri,
          userId: user.id,
        });

        // Move to folder if specified
        if (params.folderId) {
          await moveDocumentToFolder(result.documentId, params.folderId);
        }

        setImageQueue((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, status: 'completed', result }
              : img
          )
        );
      } catch (error: any) {
        setImageQueue((prev) =>
          prev.map((img) =>
            img.id === image.id
              ? { ...img, status: 'error', error: error.message }
              : img
          )
        );
      }
    }

    setProcessing(false);
  };

  const takePicture = async () => {
    if (!cameraRef.current || !user) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
      });

      if (!photo) {
        throw new Error('Failed to capture photo');
      }

      if (bulkMode) {
        addToQueue(photo.uri);
      } else {
        setProcessing(true);
        const result = await uploadDocument({
          imageUri: photo.uri,
          userId: user.id,
        });

        if (params.folderId) {
          await moveDocumentToFolder(result.documentId, params.folderId);
        }

        Alert.alert(
          'Document Scanned!',
          `Document saved as: ${result.suggestedName}`,
          [
            {
              text: 'View Document',
              onPress: () => router.replace(`/document/${result.documentId}`),
            },
            {
              text: 'Scan Another',
              onPress: () => setProcessing(false),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process document');
      setProcessing(false);
    }
  };

  const pickImage = async () => {
    if (!user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        allowsMultipleSelection: bulkMode,
        quality: 0.8,
      });

      if (result.canceled) return;

      if (bulkMode) {
        // Add all selected images to queue
        for (const asset of result.assets) {
          addToQueue(asset.uri);
        }
        setShowQueue(true);
      } else {
        setProcessing(true);
        const uploadResult = await uploadDocument({
          imageUri: result.assets[0].uri,
          userId: user.id,
        });

        if (params.folderId) {
          await moveDocumentToFolder(uploadResult.documentId, params.folderId);
        }

        Alert.alert(
          'Document Processed!',
          `Document saved as: ${uploadResult.suggestedName}`,
          [
            {
              text: 'View Document',
              onPress: () => router.replace(`/document/${uploadResult.documentId}`),
            },
            {
              text: 'Done',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to process document');
    } finally {
      if (!bulkMode) {
        setProcessing(false);
      }
    }
  };

  const removeFromQueue = (id: string) => {
    setImageQueue((prev) => prev.filter((img) => img.id !== id));
  };

  const clearQueue = () => {
    setImageQueue([]);
    setShowQueue(false);
  };

  const getQueueStatus = () => {
    const completed = imageQueue.filter((i) => i.status === 'completed').length;
    const errors = imageQueue.filter((i) => i.status === 'error').length;
    const pending = imageQueue.filter((i) => i.status === 'pending').length;
    return { completed, errors, pending, total: imageQueue.length };
  };

  if (processing && !bulkMode) {
    return (
      <View style={styles.processingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.processingText}>Processing document...</Text>
        <Text style={styles.processingSubtext}>
          Scanning, extracting text, and analyzing content
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef} facing="back">
        <View style={styles.overlay}>
          <View style={styles.topControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, bulkMode && styles.modeButtonActive]}
              onPress={() => setBulkMode(!bulkMode)}
            >
              <Ionicons
                name={bulkMode ? 'layers' : 'layers-outline'}
                size={20}
                color="#fff"
              />
              <Text style={styles.modeButtonText}>
                {bulkMode ? 'Bulk Mode' : 'Single'}
              </Text>
            </TouchableOpacity>

            {bulkMode && imageQueue.length > 0 && (
              <TouchableOpacity
                style={styles.queueBadge}
                onPress={() => setShowQueue(true)}
              >
                <Text style={styles.queueBadgeText}>{imageQueue.length}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.frameContainer}>
            <View style={styles.frame} />
          </View>

          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={styles.galleryButton}
              onPress={pickImage}
            >
              <Ionicons name="images" size={28} color="#fff" />
              {bulkMode && (
                <Text style={styles.smallLabel}>Multi</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            {bulkMode && imageQueue.length > 0 ? (
              <TouchableOpacity
                style={styles.processButton}
                onPress={processQueue}
              >
                <Ionicons name="cloud-upload" size={28} color="#fff" />
                <Text style={styles.smallLabel}>Upload</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.galleryButton} />
            )}
          </View>
        </View>
      </CameraView>

      {/* Bulk Upload Queue Modal */}
      <Modal visible={showQueue} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.queueModal}>
            <View style={styles.queueHeader}>
              <Text style={styles.queueTitle}>
                Upload Queue ({imageQueue.length} images)
              </Text>
              <TouchableOpacity onPress={() => setShowQueue(false)}>
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            {processing && (
              <View style={styles.queueProgress}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.queueProgressText}>
                  Processing... {getQueueStatus().completed}/{imageQueue.length}
                </Text>
              </View>
            )}

            <ScrollView style={styles.queueList}>
              {imageQueue.map((image, index) => (
                <View key={image.id} style={styles.queueItem}>
                  <Image source={{ uri: image.uri }} style={styles.queueThumb} />
                  <View style={styles.queueItemInfo}>
                    <Text style={styles.queueItemName}>Image {index + 1}</Text>
                    <Text
                      style={[
                        styles.queueItemStatus,
                        image.status === 'completed' && styles.statusCompleted,
                        image.status === 'error' && styles.statusError,
                        image.status === 'processing' && styles.statusProcessing,
                      ]}
                    >
                      {image.status === 'pending' && 'Waiting...'}
                      {image.status === 'processing' && 'Processing...'}
                      {image.status === 'completed' && image.result?.suggestedName}
                      {image.status === 'error' && image.error}
                    </Text>
                  </View>
                  {image.status === 'pending' && !processing && (
                    <TouchableOpacity
                      onPress={() => removeFromQueue(image.id)}
                      style={styles.removeButton}
                    >
                      <Ionicons name="trash-outline" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  )}
                  {image.status === 'completed' && (
                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                  )}
                  {image.status === 'error' && (
                    <Ionicons name="alert-circle" size={24} color="#ef4444" />
                  )}
                  {image.status === 'processing' && (
                    <ActivityIndicator size="small" color="#2563eb" />
                  )}
                </View>
              ))}
            </ScrollView>

            <View style={styles.queueActions}>
              {!processing && getQueueStatus().pending > 0 && (
                <TouchableOpacity
                  style={styles.processAllButton}
                  onPress={processQueue}
                >
                  <Ionicons name="cloud-upload" size={20} color="#fff" />
                  <Text style={styles.processAllText}>
                    Upload All ({getQueueStatus().pending})
                  </Text>
                </TouchableOpacity>
              )}

              {!processing && getQueueStatus().completed === imageQueue.length && imageQueue.length > 0 && (
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={() => {
                    clearQueue();
                    router.back();
                  }}
                >
                  <Text style={styles.doneButtonText}>Done</Text>
                </TouchableOpacity>
              )}

              {!processing && (
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearQueue}
                >
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  permissionMessage: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 8,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#2563eb',
  },
  modeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  queueBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  queueBadgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frame: {
    width: '85%',
    aspectRatio: 3 / 4,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#22c55e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallLabel: {
    color: '#fff',
    fontSize: 9,
    marginTop: 2,
  },
  processingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 20,
  },
  processingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  processingSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  queueModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  queueProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#eff6ff',
    gap: 8,
  },
  queueProgressText: {
    color: '#2563eb',
    fontSize: 14,
  },
  queueList: {
    padding: 16,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 8,
  },
  queueThumb: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  queueItemInfo: {
    flex: 1,
  },
  queueItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  queueItemStatus: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  statusCompleted: {
    color: '#22c55e',
  },
  statusError: {
    color: '#ef4444',
  },
  statusProcessing: {
    color: '#2563eb',
  },
  removeButton: {
    padding: 8,
  },
  queueActions: {
    padding: 16,
    gap: 12,
  },
  processAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  processAllText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#22c55e',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    padding: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
});
