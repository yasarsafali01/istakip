import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi, usersApi } from '../../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../../src/components/Badge';
import type { Issue } from '../../../src/api/types';

export default function RequestsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const requestsQuery = useQuery({
    queryKey: ['issues', { isRequest: true }],
    queryFn: () => issuesApi.list({ isRequest: true }),
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const filtered = useMemo(() => {
    const all = requestsQuery.data || [];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(
      (r) => r.title.toLowerCase().includes(q) || r.key.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
    );
  }, [requestsQuery.data, search]);

  function getUserName(id?: string | null) {
    if (!id) return null;
    return usersQuery.data?.find((u) => u.id === id)?.name;
  }

  function renderItem({ item }: { item: Issue }) {
    const assigneeName = getUserName(item.assigneeId);
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/issues/${item.id}`)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardKey}>{item.key}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        <View style={styles.cardFooter}>
          <PriorityBadge priority={item.priority} />
          <Text style={styles.assignee}>{assigneeName || 'Atanmamış'}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Talep ara..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {requestsQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {search ? 'Arama kriterlerine uygun talep bulunamadı' : 'Henüz talep yok'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={requestsQuery.isFetching} onRefresh={() => requestsQuery.refetch()} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6',
    marginHorizontal: 16, marginTop: 12, marginBottom: 4, borderRadius: 8, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },
  list: { padding: 16, paddingTop: 8 },
  card: {
    backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardKey: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  cardTitle: { fontSize: 14, fontWeight: '600', color: '#172B4D', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  assignee: { fontSize: 12, color: '#6B7280' },
});
