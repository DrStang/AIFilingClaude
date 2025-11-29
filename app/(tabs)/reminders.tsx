import { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@/stores/auth-store';
import { getUpcomingReminders } from '@/lib/document-service';
import { supabase } from '@/lib/supabase';
import { format, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';

interface Reminder {
  id: string;
  document_id: string;
  user_id: string;
  reminder_type: string;
  reminder_date: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  is_notified: boolean;
  created_at: string;
  updated_at: string;
  documents: any;
}

export default function RemindersScreen() {
  const { user } = useAuthStore();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReminders = async () => {
    if (!user) return;

    try {
      const data = await getUpcomingReminders(user.id);
      setReminders(data);
    } catch (error) {
      console.error('Error loading reminders:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [user]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReminders();
  };

  const getReminderIcon = (type: string) => {
    const icons: { [key: string]: any } = {
      warranty_expiration: 'shield-checkmark',
      insurance_renewal: 'umbrella',
      tax_deadline: 'calculator',
      lease_expiration: 'home',
      medical_followup: 'medical',
      car_maintenance: 'car',
      contract_renewal: 'document-text',
      custom: 'notifications',
    };
    return icons[type] || 'notifications';
  };

  const getDateLabel = (dateStr: string) => {
    const date = new Date(dateStr);

    if (isPast(date) && !isToday(date)) {
      return 'Overdue';
    }
    if (isToday(date)) {
      return 'Today';
    }
    if (isTomorrow(date)) {
      return 'Tomorrow';
    }

    const daysUntil = differenceInDays(date, new Date());
    if (daysUntil <= 7) {
      return `In ${daysUntil} days`;
    }

    return format(date, 'MMM d, yyyy');
  };

  const getDateColor = (dateStr: string) => {
    const date = new Date(dateStr);

    if (isPast(date) && !isToday(date)) {
      return '#ef4444'; // Red for overdue
    }
    if (isToday(date) || isTomorrow(date)) {
      return '#f59e0b'; // Amber for today/tomorrow
    }

    const daysUntil = differenceInDays(date, new Date());
    if (daysUntil <= 7) {
      return '#3b82f6'; // Blue for this week
    }

    return '#6b7280'; // Gray for future
  };

  const handleMarkComplete = async (reminderId: string) => {
    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_completed: true })
        .eq('id', reminderId);

      if (error) throw error;

      setReminders(reminders.filter((r) => r.id !== reminderId));
      Alert.alert('Success', 'Reminder marked as complete');
    } catch (error) {
      Alert.alert('Error', 'Failed to update reminder');
    }
  };

  const renderReminder = ({ item }: { item: Reminder }) => (
    <TouchableOpacity
      style={styles.reminderCard}
      onPress={() => router.push(`/document/${item.document_id}`)}
    >
      <View style={styles.reminderIcon}>
        <Ionicons
          name={getReminderIcon(item.reminder_type)}
          size={24}
          color="#2563eb"
        />
      </View>

      <View style={styles.reminderInfo}>
        <Text style={styles.reminderTitle}>{item.title}</Text>
        {item.description && (
          <Text style={styles.reminderDescription}>{item.description}</Text>
        )}
        <View style={styles.reminderMeta}>
          <Text
            style={[
              styles.reminderDate,
              { color: getDateColor(item.reminder_date) },
            ]}
          >
            {getDateLabel(item.reminder_date)}
          </Text>
          <Text style={styles.reminderType}>
            {item.reminder_type.replace(/_/g, ' ').toUpperCase()}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.completeButton}
        onPress={() => handleMarkComplete(item.id)}
      >
        <Ionicons name="checkmark-circle-outline" size={28} color="#10b981" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {reminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyTitle}>No upcoming reminders</Text>
          <Text style={styles.emptySubtitle}>
            Reminders will appear here when documents have expiration dates,
            renewals, or deadlines
          </Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          renderItem={renderReminder}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  list: {
    padding: 16,
  },
  reminderCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  reminderDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  reminderMeta: {
    flexDirection: 'row',
    gap: 12,
  },
  reminderDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  reminderType: {
    fontSize: 12,
    color: '#6b7280',
  },
  completeButton: {
    padding: 4,
  },
});
