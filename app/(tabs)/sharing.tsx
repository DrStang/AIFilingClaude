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
  Share,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth-store';
import {
  getUserFamilyGroups,
  createFamilyGroup,
  joinFamilyGroup,
  leaveFamilyGroup,
  deleteFamilyGroup,
  regenerateInviteCode,
  getSharedWithMeDocuments,
  FamilyGroupWithMembers,
} from '@/lib/sharing-service';
import { format } from 'date-fns';

export default function SharingScreen() {
  const { user } = useAuthStore();
  const [familyGroups, setFamilyGroups] = useState<FamilyGroupWithMembers[]>([]);
  const [sharedDocuments, setSharedDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'groups' | 'shared'>('groups');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;

    try {
      const [groups, shared] = await Promise.all([
        getUserFamilyGroups(user.id),
        getSharedWithMeDocuments(user.id),
      ]);
      setFamilyGroups(groups);
      setSharedDocuments(shared);
    } catch (error) {
      console.error('Error loading sharing data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;

    try {
      await createFamilyGroup({
        ownerId: user.id,
        name: newGroupName.trim(),
      });
      setShowCreateModal(false);
      setNewGroupName('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create group');
    }
  };

  const handleJoinGroup = async () => {
    if (!user || !inviteCode.trim()) return;

    try {
      await joinFamilyGroup(user.id, inviteCode.trim());
      setShowJoinModal(false);
      setInviteCode('');
      loadData();
      Alert.alert('Success', 'You have joined the group!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to join group');
    }
  };

  const handleShareInviteCode = async (group: FamilyGroupWithMembers) => {
    try {
      await Share.share({
        message: `Join my AI Filing Cabinet family group "${group.name}"!\n\nInvite code: ${group.invite_code}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleRegenerateCode = async (groupId: string) => {
    try {
      const newCode = await regenerateInviteCode(groupId);
      loadData();
      Alert.alert('New Code Generated', `New invite code: ${newCode}`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to regenerate code');
    }
  };

  const handleLeaveGroup = (group: FamilyGroupWithMembers) => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave "${group.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveFamilyGroup(user!.id, group.id);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave group');
            }
          },
        },
      ]
    );
  };

  const handleDeleteGroup = (group: FamilyGroupWithMembers) => {
    Alert.alert(
      'Delete Group',
      `Are you sure you want to delete "${group.name}"? All shares will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFamilyGroup(group.id);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete group');
            }
          },
        },
      ]
    );
  };

  const renderGroup = ({ item }: { item: FamilyGroupWithMembers }) => {
    const isOwner = item.owner_id === user?.id;

    return (
      <View style={styles.groupCard}>
        <View style={styles.groupHeader}>
          <View style={styles.groupIcon}>
            <Ionicons name="people" size={24} color="#2563eb" />
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>{item.name}</Text>
            <Text style={styles.groupMeta}>
              {item.members.length} member{item.members.length !== 1 ? 's' : ''} •{' '}
              {isOwner ? 'Owner' : 'Member'}
            </Text>
          </View>
        </View>

        <View style={styles.inviteSection}>
          <Text style={styles.inviteLabel}>Invite Code</Text>
          <View style={styles.inviteCode}>
            <Text style={styles.inviteCodeText}>{item.invite_code}</Text>
            <TouchableOpacity
              style={styles.inviteButton}
              onPress={() => handleShareInviteCode(item)}
            >
              <Ionicons name="share-outline" size={18} color="#2563eb" />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                style={styles.inviteButton}
                onPress={() => handleRegenerateCode(item.id)}
              >
                <Ionicons name="refresh" size={18} color="#6b7280" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.groupActions}>
          {isOwner ? (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteGroup(item)}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.deleteButtonText}>Delete Group</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.leaveButton}
              onPress={() => handleLeaveGroup(item)}
            >
              <Ionicons name="exit-outline" size={18} color="#6b7280" />
              <Text style={styles.leaveButtonText}>Leave Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderSharedDocument = ({ item }: { item: any }) => (
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
          {item.shareInfo?.permission === 'edit' ? 'Can edit' : 'View only'} •{' '}
          {format(new Date(item.shareInfo?.sharedAt || item.created_at), 'MMM d')}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'groups' && styles.tabActive]}
          onPress={() => setActiveTab('groups')}
        >
          <Ionicons
            name="people"
            size={18}
            color={activeTab === 'groups' ? '#2563eb' : '#6b7280'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'groups' && styles.tabTextActive,
            ]}
          >
            Family Groups
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'shared' && styles.tabActive]}
          onPress={() => setActiveTab('shared')}
        >
          <Ionicons
            name="share-social"
            size={18}
            color={activeTab === 'shared' ? '#2563eb' : '#6b7280'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'shared' && styles.tabTextActive,
            ]}
          >
            Shared with Me
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'groups' ? (
        <>
          <FlatList
            data={familyGroups}
            renderItem={renderGroup}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={64} color="#9ca3af" />
                <Text style={styles.emptyTitle}>No family groups</Text>
                <Text style={styles.emptySubtitle}>
                  Create or join a group to share documents with family
                </Text>
              </View>
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
              onPress={() => setShowJoinModal(true)}
            >
              <Ionicons name="enter-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.fab}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <FlatList
          data={sharedDocuments}
          renderItem={renderSharedDocument}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="share-social-outline" size={64} color="#9ca3af" />
              <Text style={styles.emptyTitle}>No shared documents</Text>
              <Text style={styles.emptySubtitle}>
                Documents shared with you will appear here
              </Text>
            </View>
          }
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      {/* Create Group Modal */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Create Family Group</Text>
            <TextInput
              style={styles.input}
              placeholder="Group name"
              value={newGroupName}
              onChangeText={setNewGroupName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewGroupName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  !newGroupName.trim() && styles.createButtonDisabled,
                ]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim()}
              >
                <Text style={styles.createButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join Group Modal */}
      <Modal visible={showJoinModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Join Family Group</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              autoFocus
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowJoinModal(false);
                  setInviteCode('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.createButton,
                  !inviteCode.trim() && styles.createButtonDisabled,
                ]}
                onPress={handleJoinGroup}
                disabled={!inviteCode.trim()}
              >
                <Text style={styles.createButtonText}>Join</Text>
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#eff6ff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  tabTextActive: {
    color: '#2563eb',
  },
  list: {
    padding: 16,
    paddingBottom: 100,
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  groupMeta: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  inviteSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  inviteLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
  },
  inviteCode: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inviteCodeText: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'monospace',
    color: '#1f2937',
    letterSpacing: 1,
  },
  inviteButton: {
    padding: 8,
  },
  groupActions: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
  },
  leaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  leaveButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
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
    textAlign: 'center',
    paddingHorizontal: 32,
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
