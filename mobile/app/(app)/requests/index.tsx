import React, { useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, ActivityIndicator, RefreshControl, TouchableOpacity, ScrollView, Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi, usersApi, projectsApi, unitsApi } from '../../../src/api/resources';
import CreateRequestSheet from '../../../src/components/CreateRequestSheet';
import PickerSheet from '../../../src/components/PickerSheet';
import { Kpi, KpiGrid, RequestRow, ui } from '../../../src/components/ui';
import { PRIORITIES, PRIORITY_LABELS, ROLES, THEME } from '../../../src/utils/constants';
import { usePermissions } from '../../../src/hooks/usePermissions';
import type { Issue } from '../../../src/api/types';
import { requestDurations, averageMs, formatDuration } from '../../../src/utils/durationUtils';
import { requestsToCsv, shareCsv } from '../../../src/utils/exportUtils';

const OPEN = ['To Do', 'In Progress', 'Onay Bekliyor'];
const GROUPS: Record<string, string> = { all: 'Tüm Talepler', open: 'Açık Talepler', closed: 'Kapanan Talepler', rejected: 'Geri Çevrilen Talepler' };
const SORTS: Record<string, string> = {
  date_desc: 'En Yeni Önce', date_asc: 'En Eski Önce', priority_asc: 'Öncelik: Yüksek → Düşük', priority_desc: 'Öncelik: Düşük → Yüksek',
};
const PRIORITY_ORDER = ['High', 'Medium', 'Low'];

type Picker = 'unit' | 'group' | 'priority' | 'sort' | 'visible' | null;

/** Talepler — same KPIs, filters, sort and export as the web's RequestList. */
export default function RequestsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, isExternalUser } = usePermissions();
  const [search, setSearch] = useState('');
  const [unitId, setUnitId] = useState<string | null>(null);
  const [group, setGroup] = useState('all');
  const [priority, setPriority] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('date_desc');
  const [picker, setPicker] = useState<Picker>(null);
  const [visibleFor, setVisibleFor] = useState<Issue | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const requestsQuery = useQuery({ queryKey: ['issues', { isRequest: true }], queryFn: () => issuesApi.list({ isRequest: true }) });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: !isExternalUser });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });

  const all = requestsQuery.data || [];
  const projects = projectsQuery.data || [];
  const units = unitsQuery.data || [];
  const users = usersQuery.data || [];
  const unitIdOf = (r: Issue) => projects.find((p) => p.id === r.projectId)?.unitId;
  const projectName = (r: Issue) => projects.find((p) => p.id === r.projectId)?.name;

  // Only units that actually have a visible request — same as the web filter.
  const availableUnits = useMemo(() => {
    const ids = new Set(all.map(unitIdOf).filter(Boolean));
    return units.filter((u) => ids.has(u.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, units, projects]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr');
    const list = all.filter((r) => {
      if (unitId && unitIdOf(r) !== unitId) return false;
      if (group === 'open' && !OPEN.includes(r.status)) return false;
      if (group === 'closed' && r.status !== 'Done') return false;
      if (group === 'rejected' && r.status !== 'Geri Çevrildi') return false;
      if (priority && r.priority !== priority) return false;
      if (q && !(r.title.toLocaleLowerCase('tr').includes(q) || r.key.toLowerCase().includes(q) || (r.description || '').toLocaleLowerCase('tr').includes(q))) return false;
      return true;
    });
    const time = (r: Issue) => +new Date(r.createdAt);
    const pri = (r: Issue) => PRIORITY_ORDER.indexOf(r.priority);
    if (sortBy === 'date_desc') list.sort((a, b) => time(b) - time(a));
    if (sortBy === 'date_asc') list.sort((a, b) => time(a) - time(b));
    if (sortBy === 'priority_asc') list.sort((a, b) => pri(a) - pri(b));
    if (sortBy === 'priority_desc') list.sort((a, b) => pri(b) - pri(a));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, search, unitId, group, priority, sortBy, projects]);

  const count = (fn: (r: Issue) => boolean) => all.filter(fn).length;
  const resolved = all.filter((r) => r.status === 'Done').map((r) => requestDurations(r));
  const avg = {
    waiting: averageMs(resolved.map((d: any) => d.waiting)),
    resolution: averageMs(resolved.map((d: any) => d.resolution)),
    total: averageMs(resolved.map((d: any) => d.total)),
  };
  const requesters = users.filter((u) => u.role === ROLES.EXTERNAL_USER && u.isActive !== false);

  async function exportCsv() {
    try {
      await shareCsv(requestsToCsv(filtered, projects, units, users), 'talepler.csv');
    } catch (err: any) {
      Alert.alert('Dışa aktarılamadı', err.message);
    }
  }

  async function addVisibleUser(userId: string) {
    const req = visibleFor;
    setPicker(null);
    setVisibleFor(null);
    if (!req) return;
    try {
      await issuesApi.addVisibleUser(req.id, userId);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  const unitLabel = unitId ? availableUnits.find((u) => u.id === unitId)?.unitCode : 'Daire Başkanlığı';
  const hasFilter = !!(search.trim() || unitId || group !== 'all' || priority);

  const header = (
    <View>
      <KpiGrid>
        <Kpi label="Toplam" value={all.length} icon="file-tray-outline" tone="navy" sub="Tüm talepler" onPress={() => setGroup('all')} active={group === 'all'} />
        <Kpi label="Bekleyen" value={count((r) => r.status === 'To Do')} icon="hourglass-outline" tone="warn" sub="Henüz işleme alınmadı" onPress={() => setGroup('open')} />
        <Kpi label="Çözüm aşamasında" value={count((r) => !['To Do', 'Done', 'Geri Çevrildi'].includes(r.status))} icon="sync-outline" tone="orange"
          sub="Devam eden ve onayda" onPress={() => setGroup('open')} active={group === 'open'} />
        <Kpi label="Çözülmüş" value={count((r) => r.status === 'Done')} icon="checkmark-circle-outline" tone="ok" sub="Tamamlanan talepler"
          onPress={() => setGroup('closed')} active={group === 'closed'} />
        <Kpi label="Geri çevrilmiş" value={count((r) => r.status === 'Geri Çevrildi')} icon="ban-outline" tone="danger" sub="Geri çevrilen talepler"
          onPress={() => setGroup('rejected')} active={group === 'rejected'} />
      </KpiGrid>

      {resolved.length > 0 && (
        <View style={[ui.card, styles.avg]}>
          <Text style={ui.sectionTitle}>Ortalama süreler · {resolved.length} çözülmüş talep</Text>
          <View style={{ flexDirection: 'row' }}>
            <Avg label="Bekleme" value={formatDuration(avg.waiting)} color={THEME.warn} />
            <Avg label="Çözüm" value={formatDuration(avg.resolution)} color={THEME.orange} />
            <Avg label="Toplam" value={formatDuration(avg.total)} color={THEME.ok} />
          </View>
        </View>
      )}

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={THEME.muted} />
        <TextInput style={styles.searchInput} placeholder="Başlık, açıklama veya numara ara..." placeholderTextColor={THEME.muted}
          value={search} onChangeText={setSearch} />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={17} color={THEME.muted} /></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {availableUnits.length > 0 && <Filter icon="business-outline" label={unitLabel || 'Daire Başkanlığı'} on={!!unitId} onPress={() => setPicker('unit')} />}
        <Filter icon="checkmark-circle-outline" label={group === 'all' ? 'Durum' : GROUPS[group]} on={group !== 'all'} onPress={() => setPicker('group')} />
        <Filter icon="flag-outline" label={priority ? PRIORITY_LABELS[priority] : 'Öncelik'} on={!!priority} onPress={() => setPicker('priority')} />
        <Filter icon="swap-vertical-outline" label={sortBy === 'date_desc' ? 'Sırala' : SORTS[sortBy]} on={sortBy !== 'date_desc'} onPress={() => setPicker('sort')} />
        <Filter icon="share-outline" label="Dışa Aktar" on={false} onPress={exportCsv} />
      </ScrollView>

      <Text style={styles.resultCount}>{filtered.length} talep bulundu</Text>
    </View>
  );

  if (requestsQuery.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={ui.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={requestsQuery.isFetching} onRefresh={() => requestsQuery.refetch()} />}
        ListEmptyComponent={(
          <View style={[ui.card, { alignItems: 'center', paddingVertical: 28 }]}>
            <Ionicons name="file-tray-outline" size={32} color="#94a3b8" />
            <Text style={styles.emptyTitle}>{hasFilter ? 'Arama kriterlerine uygun talep bulunamadı' : 'Henüz talep yok'}</Text>
            {!hasFilter && can('request.create') && (
              <TouchableOpacity style={[ui.btnPrimary, { marginTop: 12 }]} onPress={() => setCreateOpen(true)}>
                <Text style={ui.btnPrimaryText}>Talep Oluştur</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.rowCard}>
            <View style={{ flex: 1 }}>
              <RequestRow issue={item} projectName={projectName(item)} onPress={() => router.push(`/(app)/issues/${item.id}`)}
                extra={users.find((u) => u.id === item.assigneeId)?.name} />
            </View>
            {!isExternalUser && (
              <TouchableOpacity style={styles.eye} hitSlop={6} onPress={() => { setVisibleFor(item); setPicker('visible'); }}>
                <Ionicons name="eye-outline" size={17} color={THEME.muted} />
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {can('request.create') && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <PickerSheet
        visible={picker === 'unit'}
        title="Daire Başkanlığı"
        options={[{ key: '', label: 'Tüm Daire Başkanlıkları' }, ...availableUnits.map((u) => ({ key: u.id, label: `${u.unitCode} — ${u.name}` }))]}
        onSelect={(k) => { setUnitId(k || null); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'group'}
        title="Durum"
        options={Object.entries(GROUPS).map(([key, label]) => ({ key, label }))}
        onSelect={(k) => { setGroup(k); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'priority'}
        title="Öncelik"
        options={[{ key: '', label: 'Tüm Öncelikler' }, ...PRIORITIES.map((p) => ({ key: p, label: PRIORITY_LABELS[p] }))]}
        onSelect={(k) => { setPriority(k || null); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'sort'}
        title="Sırala"
        options={Object.entries(SORTS).map(([key, label]) => ({ key, label }))}
        onSelect={(k) => { setSortBy(k); setPicker(null); }}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'visible'}
        title={visibleFor ? `Talep sahibine görünür yap — ${visibleFor.key}` : 'Talep sahibine görünür yap'}
        options={requesters.filter((u) => !visibleFor?.visibleTo.includes(u.id)).map((u) => ({
          key: u.id, label: u.name, sublabel: u.email,
        }))}
        onSelect={addVisibleUser}
        onClose={() => { setPicker(null); setVisibleFor(null); }}
      />

      <CreateRequestSheet
        visible={createOpen}
        onCreated={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['issues'] }); }}
        onCancel={() => setCreateOpen(false)}
      />
    </SafeAreaView>
  );
}

function Filter({ icon, label, on, onPress }: { icon: any; label: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[ui.chip, on && ui.chipOn, styles.filter]} onPress={onPress}>
      <Ionicons name={icon} size={14} color={on ? THEME.navy : '#475569'} />
      <Text style={[ui.chipText, on && ui.chipTextOn]} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={12} color={on ? THEME.navy : '#94a3b8'} />
    </TouchableOpacity>
  );
}

function Avg({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.avgLabel}>{label}</Text>
      <Text style={[styles.avgValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avg: { marginBottom: 12 },
  avgLabel: { fontSize: 11, color: THEME.muted },
  avgValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: THEME.line,
    borderRadius: 12, paddingHorizontal: 12, marginBottom: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: THEME.ink },
  filters: { gap: 8, paddingBottom: 4 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  resultCount: { fontSize: 11, color: THEME.muted, marginTop: 8, marginBottom: 8 },
  rowCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1,
    borderColor: THEME.line, paddingHorizontal: 12, marginBottom: 8,
  },
  eye: { paddingTop: 14, paddingLeft: 8 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: THEME.ink, marginTop: 8, textAlign: 'center' },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 54, height: 54, borderRadius: 27,
    backgroundColor: THEME.orange, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
});
