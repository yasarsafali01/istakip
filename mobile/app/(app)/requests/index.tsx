import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator, RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi, usersApi, projectsApi, unitsApi } from '../../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../../src/components/Badge';
import CreateRequestSheet from '../../../src/components/CreateRequestSheet';
import { PRIORITIES, PRIORITY_LABELS } from '../../../src/utils/constants';
import { usePermissions } from '../../../src/hooks/usePermissions';
import type { Issue } from '../../../src/api/types';
import { getSlaInfo, SLA_RISK_COLORS } from '../../../src/utils/slaUtils';
import { requestDurations, averageMs, formatDuration } from '../../../src/utils/durationUtils';

export default function RequestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [unitFilter, setUnitFilter] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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

  // Average waiting / resolution / total over resolved requests (same as the web list header)
  const resolved = (requestsQuery.data || []).filter((r) => r.status === 'Done').map((r) => requestDurations(r));
  const avg = {
    waiting: averageMs(resolved.map((d: any) => d.waiting)),
    resolution: averageMs(resolved.map((d: any) => d.resolution)),
    total: averageMs(resolved.map((d: any) => d.total)),
  };

  function getUserName(id?: string | null) {
    if (!id) return null;
    return usersQuery.data?.find((u) => u.id === id)?.name;
  }

  function renderItem({ item }: { item: Issue }) {
    const assigneeName = getUserName(item.assigneeId);
    const sla = getSlaInfo(item);
    const slaColors = sla ? (SLA_RISK_COLORS as Record<string, { bg: string; text: string }>)[sla.risk] : null;
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/issues/${item.id}`)}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardKey}>{item.key}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
        {item.requestFormName ? <Text style={styles.formName}>{item.requestFormName}</Text> : null}
        <View style={styles.cardFooter}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <PriorityBadge priority={item.priority} />
            {sla && slaColors && sla.risk !== 'done' ? (
              <View style={[styles.sla, { backgroundColor: slaColors.bg }]}><Text style={[styles.slaText, { color: slaColors.text }]}>{sla.label}</Text></View>
            ) : null}
          </View>
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
            <Text style={[styles.chipText, priorityFilter === p && styles.chipTextActive]}>{PRIORITY_LABELS[p]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {resolved.length > 0 && (
        <View style={styles.avgStrip}>
          <Ionicons name="time-outline" size={14} color="#42526E" />
          <Text style={styles.avgLabel}>Ort. ({resolved.length} çözülmüş)</Text>
          <Text style={styles.avgItem}>Bekleme <Text style={{ color: '#B45309', fontWeight: '800' }}>{formatDuration(avg.waiting)}</Text></Text>
          <Text style={styles.avgItem}>Çözüm <Text style={{ color: '#C2410C', fontWeight: '800' }}>{formatDuration(avg.resolution)}</Text></Text>
          <Text style={styles.avgItem}>Toplam <Text style={{ color: '#047857', fontWeight: '800' }}>{formatDuration(avg.total)}</Text></Text>
        </View>
      )}

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

      {can('request.create') && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <CreateRequestSheet
        visible={createOpen}
        onCreated={() => {
          setCreateOpen(false);
          queryClient.invalidateQueries({ queryKey: ['issues'] });
        }}
        onCancel={() => setCreateOpen(false)}
      />
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
  formName: { fontSize: 11, color: '#0052CC', fontWeight: '700', marginTop: -4, marginBottom: 8 },
  sla: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  slaText: { fontSize: 10, fontWeight: '700' },
  avgStrip: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 6, padding: 8, borderRadius: 8, backgroundColor: '#F4F5F7' },
  avgLabel: { fontSize: 11, color: '#42526E', fontWeight: '700' },
  avgItem: { fontSize: 11, color: '#42526E' },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#0052CC', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
});
