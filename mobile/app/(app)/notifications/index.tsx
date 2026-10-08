import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../../../src/api/resources';
import type { AppNotification } from '../../../src/api/types';

const ICONS: Record<string, any> = {
  assigned: 'person-add-outline',
  status_change: 'swap-horizontal-outline',
  comment: 'chatbubble-outline',
  forwarded: 'arrow-redo-outline',
  rated: 'star-outline',
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

/** Mirrors the web's NotificationBell list: tap to open the request, marks it read. */
export default function NotificationsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const listQuery = useQuery({ queryKey: ['notifications'], queryFn: notificationsApi.list });
  const items = listQuery.data || [];
  const unread = items.filter((n) => !n.readAt).length;

  function refreshCounts() {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }

  async function open(n: AppNotification) {
    if (!n.readAt) {
      await notificationsApi.markRead(n.id).catch(() => {});
      refreshCounts();
    }
    if (n.issueId) router.push(`/(app)/issues/${n.issueId}`);
  }

  async function markAll() {
    await notificationsApi.markAllRead().catch(() => {});
    refreshCounts();
  }

  if (listQuery.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <View style={styles.topRow}>
        <Text style={styles.count}>{unread} okunmamış</Text>
        {unread > 0 && (
          <TouchableOpacity onPress={markAll}><Text style={styles.markAll}>Tümünü okundu yap</Text></TouchableOpacity>
        )}
      </View>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={listQuery.isFetching} onRefresh={() => listQuery.refetch()} />}
        ListEmptyComponent={<Text style={styles.empty}>Bildiriminiz yok.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, !item.readAt && styles.cardUnread]} onPress={() => open(item)}>
            <Ionicons name={ICONS[item.type] || 'notifications-outline'} size={20} color={item.readAt ? '#9CA3AF' : '#0052CC'} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, !item.readAt && { fontWeight: '800' }]}>{item.title}</Text>
              {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.readAt && <View style={styles.dot} />}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  count: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  markAll: { fontSize: 12, color: '#0052CC', fontWeight: '700' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40 },
  card: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8 },
  cardUnread: { backgroundColor: '#EEF4FD' },
  title: { fontSize: 13, color: '#172B4D', fontWeight: '600' },
  body: { fontSize: 12, color: '#42526E', marginTop: 2 },
  time: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#0052CC', marginTop: 6 },
});
