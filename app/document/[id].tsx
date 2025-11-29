import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getDocument, deleteDocument } from '@/lib/document-service';
import { supabase } from '@/lib/supabase';
import { Database } from '@/lib/database.types';
import { format } from 'date-fns';

type Document = Database['public']['Tables']['documents']['Row'];

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams();
  const [document, setDocument] = useState<Document | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocument();
  }, [id]);

  const loadDocument = async () => {
    try {
      const doc = await getDocument(id as string);
      setDocument(doc);

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

  const metadata = document.metadata as any;

  return (
    <ScrollView style={styles.container}>
      {imageUrl && (
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="contain" />
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{document.auto_generated_name}</Text>
            <Text style={styles.type}>
              {document.document_type.replace('_', ' ').toUpperCase()}
            </Text>
            <Text style={styles.date}>
              Scanned on {format(new Date(document.created_at), 'MMM d, yyyy')}
            </Text>
          </View>

          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Ionicons name="trash-outline" size={24} color="#ef4444" />
          </TouchableOpacity>
        </View>

        {metadata && Object.keys(metadata).length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted Information</Text>
            {Object.entries(metadata).map(([key, value]) => {
              if (
                !value ||
                key === 'tags' ||
                (Array.isArray(value) && value.length === 0)
              )
                return null;

              return (
                <View key={key} style={styles.metadataRow}>
                  <Text style={styles.metadataKey}>
                    {key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}:
                  </Text>
                  <Text style={styles.metadataValue}>
                    {typeof value === 'object'
                      ? JSON.stringify(value, null, 2)
                      : String(value)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {document.ocr_text && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Extracted Text</Text>
            <View style={styles.ocrTextContainer}>
              <Text style={styles.ocrText}>{document.ocr_text}</Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
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
        </View>
      </View>
    </ScrollView>
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
  image: {
    width: '100%',
    height: 300,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 8,
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
  deleteButton: {
    padding: 8,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
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
  },
});
