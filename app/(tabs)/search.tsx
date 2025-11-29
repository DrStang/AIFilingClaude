import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth-store';
import { searchDocuments } from '@/lib/document-service';
import { Database } from '@/lib/database.types';
import { format } from 'date-fns';

type Document = Database['public']['Tables']['documents']['Row'];

export default function SearchScreen() {
  const { user } = useAuthStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !user) return;

    setLoading(true);
    setSearched(true);

    try {
      const docs = await searchDocuments(user.id, query.trim());
      setResults(docs);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentTypeIcon = (type: string) => {
    const icons: { [key: string]: any } = {
      receipt: 'receipt',
      warranty: 'shield-checkmark',
      medical: 'medical',
      tax: 'calculator',
      contract: 'document-text',
      car_service: 'car',
      insurance: 'umbrella',
      misc: 'document',
    };
    return icons[type] || 'document';
  };

  const renderDocument = ({ item }: { item: Document }) => (
    <TouchableOpacity
      style={styles.documentCard}
      onPress={() => router.push(`/document/${item.id}`)}
    >
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Ionicons name={getDocumentTypeIcon(item.document_type)} size={32} color="#6b7280" />
        </View>
      )}

      <View style={styles.documentInfo}>
        <Text style={styles.documentName} numberOfLines={2}>
          {item.auto_generated_name}
        </Text>
        <Text style={styles.documentType}>
          {item.document_type.replace('_', ' ').toUpperCase()}
        </Text>
        <Text style={styles.documentDate}>
          {format(new Date(item.created_at), 'MMM d, yyyy')}
        </Text>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color="#6b7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search documents..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setQuery('');
                setResults([]);
                setSearched(false);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearch}
          disabled={!query.trim() || loading}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : searched && results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try searching with different keywords
          </Text>
        </View>
      ) : !searched ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="documents-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>Search your documents</Text>
          <Text style={styles.emptySubtitle}>
            Search by name, content, vendor, or any extracted text
          </Text>
        </View>
      ) : (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsCount}>
            {results.length} {results.length === 1 ? 'result' : 'results'} found
          </Text>
          <FlatList
            data={results}
            renderItem={renderDocument}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  searchButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  resultsContainer: {
    flex: 1,
  },
  resultsCount: {
    padding: 16,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  list: {
    paddingHorizontal: 16,
  },
  documentCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  thumbnail: {
    width: 60,
    height: 60,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  documentType: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '500',
    marginBottom: 2,
  },
  documentDate: {
    fontSize: 12,
    color: '#6b7280',
  },
});
