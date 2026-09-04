import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator, RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi, usersApi, projectsApi, unitsApi } from '../../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../../src/components/Badge';
import { PRIORITIES } from '../../../src/utils/constants';
import type { Issue } from '../../../src/api/types';

export default function RequestsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<string | null>(null);

  const requestsQuery = useQuery({
    queryKey: ['issues', { isRequest: true }],
    queryFn: () => issuesApi.list({ isRequest: true }),
  });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });

  function getUnitIdForIssue(issue: Issue) {
    return projectsQuery.data?.find((p) => p.id === issue.projectId)?.unitId;
  }

  // Only units that actually have at least one visible request — mirrors the
  // web UnitFilter's "sadece görünür taleplerde bulunan birimler" behavior.
  const availableUnits = useMemo(() => {
    const unitIds = new Set((requestsQuery.data || []).map((r) => getUnitIdForIssue(r)).filter(Boolean));
    return (unitsQuery.data || []).filter((u) => unitIds.has(u.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestsQuery.data, unitsQuery.data, projectsQuery.data]);

  const filtered = useMemo(() => {
    let list = requestsQuery.data || [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) => r.title.toLowerCase().includes(q) || r.key.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q)
      );
    }
    if (priorityFilter) {
      list = list.filter((r) => r.priority === priorityFilter);
    }
    if (unitFilter) {
      list = list.filter((r) => getUnitIdForIssue(r) === unitFilter);
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestsQuery.data, search, priorityFilter, unitFilter, projectsQuery.data]);

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}>
        {availableUnits.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={[styles.chip, unitFilter === u.id && styles.chipActive]}
            onPress={() => setUnitFilter(unitFilter === u.id ? null : u.id)}
          >
            <Text style={[styles.chipText, unitFilter === u.id && styles.chipTextActive]}>{u.unitCode}</Text>
          </TouchableOpacity>
        ))}
        {PRIORITIES.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, priorityFilter === p && styles.chipActive]}
            onPress={() => setPriorityFilter(priorityFilter === p ? null : p)}
          >
            <Text style={[styles.chipText, priorityFilter === p && styles.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.resultCount}>{filtered.length} talep bulundu</Text>

      {requestsQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>
            {search || priorityFilter || unitFilter ? 'Arama kriterlerine uygun talep bulunamadı' : 'Henüz talep yok'}
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
    marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 8, paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },
  filterRow: { flexGrow: 0, marginBottom: 4 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  chipText: { fontSize: 11, color: '#374151', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  resultCount: { fontSize: 11, color: '#9CA3AF', marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  list: { padding: 16, paddingTop: 4 },
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
