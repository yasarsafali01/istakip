import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { unitsApi, usersApi, projectsApi, issuesApi, sprintsApi } from '../../../src/api/resources';
import PickerSheet from '../../../src/components/PickerSheet';
import CreateProjectSheet from '../../../src/components/CreateProjectSheet';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { useAuth } from '../../../src/context/AuthContext';
import { ROLES, THEME } from '../../../src/utils/constants';
import { inProject } from '../../../src/utils/access';
import { summarize } from '../../../src/utils/reportUtils';
import { formatDuration } from '../../../src/utils/durationUtils';
import { Empty, IssueKey, Meter, requestMetrics, ui } from '../../../src/components/ui';
import type { Issue, Project, Unit } from '../../../src/api/types';

/** Daire Başkanlıkları → (daire başkanlığı) → müdürlükler. Same as the web's UnitList. */
export default function UnitsScreen() {
  const { canManageUnits, canCreateProject } = usePermissions();
  const { currentUser } = useAuth();
  const router = useRouter();
  const { unit: unitParam } = useLocalSearchParams<{ unit?: string }>();
  const queryClient = useQueryClient();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });

  const [formOpen, setFormOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [departmentHeadId, setDepartmentHeadId] = useState('');
  const [headPickerOpen, setHeadPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projectSheet, setProjectSheet] = useState<{ project: Project | null } | null>(null);

  const users = usersQuery.data || [];
  const projects = projectsQuery.data || [];
  const issues = issuesQuery.data || [];
  const visibleUnits = (unitsQuery.data || []).filter((u) => currentUser?.role === ROLES.SYSTEM_ADMIN || u.id === currentUser?.unitId);
  // ?unit= opens a daire başkanlığı (the admin home links here); a single unit opens directly.
  const selectedUnit = visibleUnits.find((u) => u.id === unitParam) || (visibleUnits.length === 1 ? visibleUnits[0] : null);
  const unitProjects = selectedUnit ? projects.filter((p) => p.unitId === selectedUnit.id) : [];
  const sprintQueries = useQueries({
    queries: unitProjects.map((p) => ({ queryKey: ['sprints', p.id], queryFn: () => sprintsApi.listByProject(p.id) })),
  });
  const sprints = sprintQueries.flatMap((q) => q.data || []);

  const departmentHeads = users.filter((u) => u.isActive !== false && u.role === ROLES.DEPARTMENT_HEAD);
  const userName = (id?: string | null) => users.find((u) => u.id === id)?.name;
  const requestsOf = (pids: Set<string>) => issues.filter((i: Issue) => i.isRequest && pids.has(i.projectId));
  const isEdit = !!editingUnit;

  function resetForm() {
    setName('');
    setUnitCode('');
    setDepartmentHeadId('');
    setSubmitting(false);
    setEditingUnit(null);
  }

  function openEditForm(unit: Unit) {
    setEditingUnit(unit);
    setName(unit.name);
    setUnitCode(unit.unitCode);
    setDepartmentHeadId(unit.departmentHeadId || '');
    setFormOpen(true);
  }

  async function handleSubmit() {
    if (!name.trim() || (!isEdit && !unitCode.trim()) || !departmentHeadId) {
      Alert.alert('Uyarı', 'Ad, kod ve daire başkanı zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && editingUnit) {
        await unitsApi.update(editingUnit.id, { name: name.trim(), departmentHeadId });
      } else {
        await unitsApi.create({ name: name.trim(), unitCode: unitCode.trim().toUpperCase(), departmentHeadId });
      }
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setFormOpen(false);
      resetForm();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
      setSubmitting(false);
    }
  }

  function refresh() {
    unitsQuery.refetch();
    projectsQuery.refetch();
    issuesQuery.refetch();
    usersQuery.refetch();
  }

  if (unitsQuery.isLoading || projectsQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <Stack.Screen options={{ title: selectedUnit ? selectedUnit.name : 'Daire Başkanlıkları' }} />
      <ScrollView contentContainerStyle={ui.screen}
        refreshControl={<RefreshControl refreshing={unitsQuery.isFetching || issuesQuery.isFetching} onRefresh={refresh} />}>
        {selectedUnit ? (
          <>
            {visibleUnits.length > 1 && (
              <TouchableOpacity style={styles.back} onPress={() => router.setParams({ unit: '' })}>
                <Ionicons name="arrow-back" size={15} color={THEME.brand} />
                <Text style={styles.backText}>Daire Başkanlıkları</Text>
              </TouchableOpacity>
            )}
            <View style={styles.head}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.title} numberOfLines={2}>{selectedUnit.name}</Text>
                  <IssueKey value={selectedUnit.unitCode} />
                </View>
                <Text style={styles.desc}>Daire Başkanı: {userName(selectedUnit.departmentHeadId) || 'Atanmamış'} · {unitProjects.length} müdürlük</Text>
              </View>
            </View>
            {canCreateProject && (
              <TouchableOpacity style={[ui.btnPrimary, { marginBottom: 14 }]} onPress={() => setProjectSheet({ project: null })}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={ui.btnPrimaryText}>Yeni Müdürlük</Text>
              </TouchableOpacity>
            )}

            {unitProjects.length === 0 ? <View style={ui.card}><Empty text="Bu daire başkanlığında henüz müdürlük yok." /></View> : unitProjects.map((p) => {
              const list = requestsOf(new Set([p.id]));
              const m = requestMetrics(list);
              const sum = summarize(list);
              const activeSprint = sprints.find((s) => s.projectId === p.id && s.status === 'Active');
              const staff = users.filter((u) => u.isActive !== false && inProject(u, p.id)).length;
              return (
                <View key={p.id} style={[ui.card, styles.cardGap]}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{p.name}</Text>
                      <Text style={styles.cardSub}>{userName(p.managerId) || 'Müdür atanmamış'} · {staff} personel</Text>
                    </View>
                    {canCreateProject && (
                      <TouchableOpacity onPress={() => setProjectSheet({ project: p })} hitSlop={8}>
                        <Ionicons name="create-outline" size={19} color={THEME.muted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.stats}>
                    <Stat label="Açık" value={m.open.length} />
                    <Stat label="Atanmamış" value={m.unassigned.length} color={m.unassigned.length ? THEME.orange : undefined} />
                    <Stat label="Süresi aşan" value={m.breached.length} color={m.breached.length ? THEME.danger : undefined} />
                    <Stat label="Bu ay çözülen" value={m.resolvedThisMonth.length} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ flex: 1 }}><Meter pct={(sum.completionRate ?? 0) * 100} /></View>
                    <Text style={styles.rate}>{sum.completionRate === null ? '—' : `%${Math.round(sum.completionRate * 100)}`}</Text>
                  </View>
                  <Text style={styles.cardSub}>
                    Ort. çözüm: {formatDuration(sum.avgResolution)}{activeSprint ? ` · ${activeSprint.name}` : ''}
                  </Text>
                  <View style={styles.btnRow}>
                    <TouchableOpacity style={[ui.btnGhost, { flex: 1 }]} onPress={() => router.push(`/(app)/projects/${p.id}?tab=board`)}>
                      <Ionicons name="albums-outline" size={15} color={THEME.navy} />
                      <Text style={[ui.btnGhostText, { fontSize: 13 }]}>Aktif Talepler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[ui.btnGhost, { flex: 1 }]} onPress={() => router.push(`/(app)/projects/${p.id}?tab=backlog`)}>
                      <Ionicons name="list-outline" size={15} color={THEME.navy} />
                      <Text style={[ui.btnGhostText, { fontSize: 13 }]}>Bekleyen Talepler</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.desc}>{visibleUnits.length} daire başkanlığı · dokununca müdürlükleri açılır</Text>
            {canManageUnits && (
              <TouchableOpacity style={[ui.btnPrimary, { marginVertical: 12 }]} onPress={() => { resetForm(); setFormOpen(true); }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={ui.btnPrimaryText}>Yeni Daire Başkanlığı</Text>
              </TouchableOpacity>
            )}
            {visibleUnits.length === 0 ? <View style={ui.card}><Empty text="Henüz daire başkanlığı yok." /></View> : visibleUnits.map((u) => {
              const pids = new Set(projects.filter((p) => p.unitId === u.id).map((p) => p.id));
              const m = requestMetrics(requestsOf(pids));
              const staff = users.filter((x) => x.isActive !== false && x.unitId === u.id && x.role !== ROLES.EXTERNAL_USER).length;
              return (
                <TouchableOpacity key={u.id} style={[ui.card, styles.cardGap]} onPress={() => router.setParams({ unit: u.id })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={styles.icon}><Ionicons name="business-outline" size={17} color={THEME.navy} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{u.name}</Text>
                      <Text style={styles.cardSub}>{u.unitCode} · Daire Başkanı: {userName(u.departmentHeadId) || 'Atanmamış'}</Text>
                    </View>
                    {canManageUnits && (
                      <TouchableOpacity onPress={() => openEditForm(u)} hitSlop={8}>
                        <Ionicons name="create-outline" size={19} color={THEME.muted} />
                      </TouchableOpacity>
                    )}
                    <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
                  </View>
                  <View style={[styles.stats, { marginBottom: 0 }]}>
                    <Stat label="Müdürlük" value={pids.size} />
                    <Stat label="Personel" value={staff} />
                    <Stat label="Açık talep" value={m.open.length} />
                    <Stat label="Süresi aşan" value={m.breached.length} color={m.breached.length ? THEME.danger : undefined} />
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}
      </ScrollView>

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => { setFormOpen(false); resetForm(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{isEdit ? 'Daire Başkanlığını Düzenle' : 'Yeni Daire Başkanlığı'}</Text>
            <Text style={ui.label}>Daire Başkanlığı Adı *</Text>
            <TextInput style={ui.input} value={name} onChangeText={setName} placeholder="Bilgi İşlem Daire Başkanlığı" />
            <Text style={ui.label}>Daire Başkanlığı Kodu *</Text>
            <TextInput
              style={[ui.input, isEdit && styles.inputDisabled]}
              value={unitCode}
              onChangeText={(t) => setUnitCode(t.toUpperCase())}
              placeholder="BIGD"
              maxLength={10}
              autoCapitalize="characters"
              editable={!isEdit}
            />
            {isEdit && <Text style={styles.hint}>Daire başkanlığı kodu oluşturulduktan sonra değiştirilemez.</Text>}
            <Text style={ui.label}>Daire Başkanı *</Text>
            <TouchableOpacity style={ui.input} onPress={() => setHeadPickerOpen(true)}>
              <Text style={{ color: departmentHeadId ? THEME.ink : THEME.muted }}>{userName(departmentHeadId) || '— Seçin —'}</Text>
            </TouchableOpacity>
            <View style={styles.btnRow}>
              <TouchableOpacity style={[ui.btnGhost, { flex: 1 }]} onPress={() => { setFormOpen(false); resetForm(); }}>
                <Text style={ui.btnGhostText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ui.btnPrimary, { flex: 1 }]} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnPrimaryText}>{isEdit ? 'Kaydet' : 'Oluştur'}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PickerSheet
        visible={headPickerOpen}
        title="Daire Başkanı Seçin"
        options={departmentHeads.map((u) => ({ key: u.id, label: u.name }))}
        onSelect={(key) => { setDepartmentHeadId(key); setHeadPickerOpen(false); }}
        onClose={() => setHeadPickerOpen(false)}
      />

      <CreateProjectSheet
        visible={!!projectSheet}
        project={projectSheet?.project}
        defaultUnitId={selectedUnit?.id}
        onCreated={() => { setProjectSheet(null); queryClient.invalidateQueries({ queryKey: ['projects'] }); }}
        onCancel={() => setProjectSheet(null)}
      />
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { color: THEME.brand, fontWeight: '700', fontSize: 13 },
  head: { flexDirection: 'row', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', color: THEME.navy, flexShrink: 1 },
  desc: { fontSize: 12, color: THEME.muted, marginTop: 2 },
  cardGap: { marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  cardSub: { fontSize: 11, color: THEME.muted, marginTop: 3 },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: THEME.navySoft, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', marginVertical: 12 },
  statValue: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  statLabel: { fontSize: 10, color: THEME.muted, marginTop: 1 },
  rate: { fontSize: 12, fontWeight: '800', color: THEME.ok },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  formCard: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 28 },
  formTitle: { fontSize: 17, fontWeight: '800', color: THEME.navy },
  inputDisabled: { backgroundColor: '#f1f5f9', color: THEME.muted },
  hint: { fontSize: 11, color: THEME.muted, marginTop: 4 },
});
