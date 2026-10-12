import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../src/context/AuthContext';
import { usersApi, rolesApi, projectsApi, unitsApi, teamsApi } from '../../../src/api/resources';
import Avatar from '../../../src/components/Avatar';
import PickerSheet from '../../../src/components/PickerSheet';
import { ui } from '../../../src/components/ui';
import { ROLES, THEME } from '../../../src/utils/constants';
import { inProject, projectIdsOf } from '../../../src/utils/access';
import type { User, RoleDef, Project, Team } from '../../../src/api/types';

type Picker =
  | { user: User; mode: 'primary' | 'extra' | 'project' | 'team' }
  | null;

/**
 * Mirrors the web Kullanıcılar page: delegated, hierarchical role assignment
 * (only users in my scope, only roles below my level). A Daire Başkanı also
 * adds, edits and deletes the personnel of their daire başkanlığı and puts
 * each person in any number of its müdürlükler and teams.
 */
export default function UsersScreen() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picker, setPicker] = useState<Picker>(null);
  const [editing, setEditing] = useState<User | 'new' | null>(null);

  const isUnitAdmin = currentUser?.role === ROLES.DEPARTMENT_HEAD;
  const unitProjects = (projectsQuery.data || []).filter((p) => p.unitId === currentUser?.unitId);
  const teamQueries = useQueries({
    queries: (isUnitAdmin ? unitProjects : []).map((p) => ({ queryKey: ['teams', p.id], queryFn: () => teamsApi.listByProject(p.id) })),
  });
  const unitTeams: Team[] = teamQueries.flatMap((q) => q.data || []);

  const roles = rolesQuery.data || [];
  const roleByKey = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, r])), [roles]);
  const myLevel = currentUser?.level ?? 0;
  const managedProjectIds = (projectsQuery.data || []).filter((p) => p.managerId === currentUser?.id).map((p) => p.id);
  const primaryKey = (u: User) => u.roleKey || u.role;
  const extrasOf = (u: User) => u.extraRoles || [];
  const userLevel = (u: User) => Math.max(...[primaryKey(u), ...extrasOf(u)].map((k) => roleByKey[k]?.level ?? 0));
  const teamsOf = (u: User) => unitTeams.filter((t) => t.memberIds.includes(u.id));

  function inScope(u: User) {
    switch (currentUser?.scope) {
      case 'all': return true;
      case 'unit': return !!u.unitId && u.unitId === currentUser.unitId;
      case 'manager': return managedProjectIds.some((id) => inProject(u, id));
      default: return false;
    }
  }

  const q = query.trim().toLocaleLowerCase('tr');
  const subordinates = (usersQuery.data || [])
    .filter((u) => u.isActive !== false && u.id !== currentUser?.id && inScope(u) && userLevel(u) < myLevel)
    .filter((u) => !q || u.name.toLocaleLowerCase('tr').includes(q) || u.email.toLowerCase().includes(q));
  const assignable = roles.filter((r) => r.level < myLevel).sort((a, b) => b.level - a.level);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['users'] });
    queryClient.invalidateQueries({ queryKey: ['roles'] });
    queryClient.invalidateQueries({ queryKey: ['teams'] });
  }

  async function saveRoles(user: User, primary: string, extras: string[]) {
    setBusyId(user.id);
    try {
      await rolesApi.assign(user.id, primary, extras.filter((k) => k !== primary));
      refresh();
    } catch (err: any) {
      Alert.alert(user.name, err.message || 'Rol atanamadı');
    } finally {
      setBusyId(null);
    }
  }

  async function saveMembership(user: User, change: { projectIds?: string[]; teamIds?: string[] }) {
    setBusyId(user.id);
    try {
      await usersApi.update(user.id, {
        name: user.name, email: user.email,
        projectIds: change.projectIds ?? projectIdsOf(user),
        teamIds: change.teamIds ?? teamsOf(user).map((t) => t.id),
      });
      refresh();
    } catch (err: any) {
      Alert.alert(user.name, err.message || 'Kaydedilemedi');
    } finally {
      setBusyId(null);
    }
  }

  function deleteUser(user: User) {
    Alert.alert('Kullanıcıyı sil', `"${user.name}" silinecek: artık giriş yapamaz ve tüm ekiplerden çıkarılır. Geçmiş talep ve yorumlarında adı görünmeye devam eder.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try { await usersApi.remove(user.id); refresh(); } catch (err: any) { Alert.alert(user.name, err.message || 'Silinemedi'); }
        },
      },
    ]);
  }

  function onPick(key: string) {
    const p = picker;
    setPicker(null);
    if (!p) return;
    if (p.mode === 'primary') saveRoles(p.user, key, extrasOf(p.user));
    else if (p.mode === 'extra') saveRoles(p.user, primaryKey(p.user), [...extrasOf(p.user), key]);
    else if (p.mode === 'project') saveMembership(p.user, { projectIds: [...projectIdsOf(p.user), key] });
    else saveMembership(p.user, { teamIds: [...teamsOf(p.user).map((t) => t.id), key] });
  }

  const unitName = (id?: string | null) => unitsQuery.data?.find((u) => u.id === id)?.name;
  const projectName = (id?: string | null) => projectsQuery.data?.find((p) => p.id === id)?.name;

  if (usersQuery.isLoading || rolesQuery.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;

  let pickerTitle = '';
  let pickerOptions: { key: string; label: string; sublabel?: string }[] = [];
  if (picker?.mode === 'primary' || picker?.mode === 'extra') {
    pickerTitle = picker.mode === 'primary' ? 'Ana rolü değiştir' : 'Ek rol ekle';
    pickerOptions = assignable
      .filter((r) => (picker.mode === 'primary' ? true : r.key !== primaryKey(picker.user) && !extrasOf(picker.user).includes(r.key)))
      .map((r) => ({ key: r.key, label: r.name, sublabel: `Seviye ${r.level}` }));
  } else if (picker?.mode === 'project') {
    pickerTitle = 'Müdürlük ekle';
    pickerOptions = unitProjects.filter((p) => !projectIdsOf(picker.user).includes(p.id)).map((p) => ({ key: p.id, label: p.name }));
  } else if (picker?.mode === 'team') {
    pickerTitle = 'Ekip ekle';
    pickerOptions = unitTeams.filter((t) => !t.memberIds.includes(picker.user.id))
      .map((t) => ({ key: t.id, label: t.name, sublabel: projectName(t.projectId) }));
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <View style={styles.top}>
        <Text style={styles.intro}>
          {isUnitAdmin ? 'Daire başkanlığınızın personelini ekleyin, düzenleyin; rollerini, müdürlüklerini ve ekiplerini belirleyin.'
            : `Yönetim alanınızdaki kullanıcılara rol atayın. Yalnızca kendi seviyenizin (Seviye ${myLevel}) altındaki roller listelenir.`}
        </Text>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color="#94a3b8" />
            <TextInput style={styles.searchInput} placeholder="Kullanıcı ara…" value={query} onChangeText={setQuery} />
          </View>
          {isUnitAdmin && (
            <TouchableOpacity style={ui.btnPrimary} onPress={() => setEditing('new')}>
              <Ionicons name="person-add-outline" size={16} color="#fff" />
              <Text style={ui.btnPrimaryText}>Yeni</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <FlatList
        data={subordinates}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>Yönetim alanınızda kullanıcı yok.</Text>}
        renderItem={({ item: u }) => {
          const busy = busyId === u.id;
          const pids = projectIdsOf(u);
          return (
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <TouchableOpacity style={styles.who} onPress={() => router.push(`/(app)/personnel/${u.id}`)}>
                  <Avatar name={u.name} color={u.avatarColor} size={38} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.name}>{u.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{u.email}</Text>
                  </View>
                </TouchableOpacity>
                {busy && <ActivityIndicator color={THEME.navy} />}
                {isUnitAdmin && !busy && (
                  <>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setEditing(u)}><Ionicons name="create-outline" size={18} color={THEME.ink} /></TouchableOpacity>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => deleteUser(u)}><Ionicons name="trash-outline" size={18} color={THEME.danger} /></TouchableOpacity>
                  </>
                )}
              </View>

              <Text style={styles.label}>Daire başkanlığı / müdürlükler</Text>
              <Text style={styles.meta}>{unitName(u.unitId) || '—'}</Text>
              <View style={[styles.chips, { marginTop: 6 }]}>
                {pids.map((pid) => (
                  <View key={pid} style={styles.chip}>
                    <Text style={styles.chipText}>{projectName(pid) || 'Müdürlük'}</Text>
                    {isUnitAdmin && pids.length > 1 && (
                      <TouchableOpacity disabled={busy} hitSlop={8} onPress={() => saveMembership(u, { projectIds: pids.filter((x) => x !== pid) })}>
                        <Ionicons name="close" size={14} color={THEME.navy} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {isUnitAdmin && unitProjects.some((p) => !pids.includes(p.id)) && (
                  <TouchableOpacity style={styles.addChip} disabled={busy} onPress={() => setPicker({ user: u, mode: 'project' })}>
                    <Ionicons name="add" size={14} color={THEME.muted} />
                    <Text style={styles.addChipText}>Müdürlük ekle</Text>
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.label}>Ana rol</Text>
              <TouchableOpacity style={styles.select} disabled={busy} onPress={() => setPicker({ user: u, mode: 'primary' })}>
                <Text style={styles.selectText}>{roleByKey[primaryKey(u)]?.name || primaryKey(u)}</Text>
                <Ionicons name="chevron-down" size={16} color={THEME.muted} />
              </TouchableOpacity>
              <Text style={styles.label}>Ek roller</Text>
              <View style={styles.chips}>
                {extrasOf(u).map((k) => (
                  <View key={k} style={styles.chip}>
                    <Text style={styles.chipText}>{roleByKey[k]?.name || k}</Text>
                    <TouchableOpacity disabled={busy} hitSlop={8} onPress={() => saveRoles(u, primaryKey(u), extrasOf(u).filter((x) => x !== k))}>
                      <Ionicons name="close" size={14} color={THEME.navy} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addChip} disabled={busy} onPress={() => setPicker({ user: u, mode: 'extra' })}>
                  <Ionicons name="add" size={14} color={THEME.muted} />
                  <Text style={styles.addChipText}>Rol ekle</Text>
                </TouchableOpacity>
              </View>

              {isUnitAdmin && (
                <>
                  <Text style={styles.label}>Ekipler</Text>
                  <View style={styles.chips}>
                    {teamsOf(u).map((t) => (
                      <View key={t.id} style={styles.chip}>
                        <Text style={styles.chipText}>{t.name}</Text>
                        <TouchableOpacity disabled={busy} hitSlop={8}
                          onPress={() => saveMembership(u, { teamIds: teamsOf(u).filter((x) => x.id !== t.id).map((x) => x.id) })}>
                          <Ionicons name="close" size={14} color={THEME.navy} />
                        </TouchableOpacity>
                      </View>
                    ))}
                    {unitTeams.some((t) => !t.memberIds.includes(u.id)) ? (
                      <TouchableOpacity style={styles.addChip} disabled={busy} onPress={() => setPicker({ user: u, mode: 'team' })}>
                        <Ionicons name="add" size={14} color={THEME.muted} />
                        <Text style={styles.addChipText}>Ekip ekle</Text>
                      </TouchableOpacity>
                    ) : teamsOf(u).length === 0 ? <Text style={styles.meta}>Ekip yok</Text> : null}
                  </View>
                </>
              )}
            </View>
          );
        }}
      />
      <PickerSheet visible={!!picker} title={pickerTitle} options={pickerOptions} onSelect={onPick} onClose={() => setPicker(null)} />
      {isUnitAdmin && editing && (
        <UserForm
          user={editing === 'new' ? null : editing}
          projects={unitProjects}
          teams={unitTeams}
          roles={assignable}
          memberTeamIds={editing === 'new' ? [] : teamsOf(editing).map((t) => t.id)}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); refresh(); }}
        />
      )}
    </SafeAreaView>
  );
}

/** Add / edit a person of the daire başkanlığı, with their müdürlükler and teams. */
function UserForm({ user, projects, teams, roles, memberTeamIds, onClose, onSaved }: {
  user: User | null; projects: Project[]; teams: Team[]; roles: RoleDef[]; memberTeamIds: string[];
  onClose: () => void; onSaved: () => void;
}) {
  const isNew = !user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: roles.find((r) => r.key === ROLES.WORKER)?.key || roles[roles.length - 1]?.key || '',
    projectIds: user ? projectIdsOf(user) : [] as string[],
    teamIds: memberTeamIds,
  });
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toggle = (key: 'projectIds' | 'teamIds', id: string) =>
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));

  async function submit() {
    let problem = '';
    if (!form.name.trim()) problem = 'Ad soyad zorunludur.';
    else if (!form.email.includes('@')) problem = 'Geçerli bir e-posta girin.';
    else if (isNew && form.password.length < 6) problem = 'Şifre en az 6 karakter olmalı.';
    else if (!isNew && form.password && form.password.length < 6) problem = 'Yeni şifre en az 6 karakter olmalı.';
    else if (form.projectIds.length === 0) problem = 'En az bir müdürlük seçin.';
    if (problem) { Alert.alert('Uyarı', problem); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), email: form.email.trim(), projectIds: form.projectIds, teamIds: form.teamIds,
        ...(form.password ? { password: form.password } : {}),
      };
      if (isNew) await usersApi.create({ ...payload, password: form.password, role: form.role });
      else await usersApi.update(user!.id, payload);
      onSaved();
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Kaydedilemedi.');
      setSaving(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.sheetTitle}>{isNew ? 'Yeni Kullanıcı' : `Düzenle — ${user!.name}`}</Text>
          <Text style={ui.label}>Ad Soyad</Text>
          <TextInput style={ui.input} value={form.name} onChangeText={(t) => setForm((f) => ({ ...f, name: t }))} />
          <Text style={ui.label}>E-posta</Text>
          <TextInput style={ui.input} value={form.email} autoCapitalize="none" keyboardType="email-address"
            onChangeText={(t) => setForm((f) => ({ ...f, email: t }))} />
          <Text style={ui.label}>{isNew ? 'Şifre' : 'Yeni şifre (değişmeyecekse boş bırakın)'}</Text>
          <TextInput style={ui.input} value={form.password} secureTextEntry onChangeText={(t) => setForm((f) => ({ ...f, password: t }))} />
          {isNew && (
            <>
              <Text style={ui.label}>Rol</Text>
              <TouchableOpacity style={ui.input} onPress={() => setRolePickerOpen(true)}>
                <Text style={{ color: THEME.ink, fontWeight: '600' }}>{roles.find((r) => r.key === form.role)?.name || '—'}</Text>
              </TouchableOpacity>
            </>
          )}
          <Text style={ui.label}>Müdürlükler (birden fazla seçilebilir; ilk seçilen ana müdürlük olur)</Text>
          <View style={styles.chips}>
            {projects.map((p) => {
              const on = form.projectIds.includes(p.id);
              return (
                <TouchableOpacity key={p.id} style={[ui.chip, on && ui.chipOn, styles.inline]} onPress={() => toggle('projectIds', p.id)}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={15} color={on ? THEME.navy : '#94a3b8'} />
                  <Text style={[ui.chipText, on && ui.chipTextOn]}>{p.name}{on && form.projectIds[0] === p.id && form.projectIds.length > 1 ? ' · Ana' : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={ui.label}>Ekipler (birden fazla seçilebilir)</Text>
          {teams.length === 0 ? <Text style={styles.meta}>Daire başkanlığınızda henüz ekip yok.</Text> : projects.map((p) => {
            const pt = teams.filter((t) => t.projectId === p.id);
            if (pt.length === 0) return null;
            return (
              <View key={p.id} style={{ marginBottom: 8 }}>
                <Text style={styles.groupTitle}>{p.name}</Text>
                <View style={styles.chips}>
                  {pt.map((t) => {
                    const on = form.teamIds.includes(t.id);
                    return (
                      <TouchableOpacity key={t.id} style={[ui.chip, on && ui.chipOn]} onPress={() => toggle('teamIds', t.id)}>
                        <Text style={[ui.chipText, on && ui.chipTextOn]}>{t.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
          <View style={styles.sheetActions}>
            <TouchableOpacity style={ui.btnGhost} onPress={onClose}><Text style={ui.btnGhostText}>İptal</Text></TouchableOpacity>
            <TouchableOpacity style={ui.btnPrimary} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={ui.btnPrimaryText}>{isNew ? 'Kullanıcıyı Ekle' : 'Kaydet'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <PickerSheet
        visible={rolePickerOpen}
        title="Rol"
        options={roles.map((r) => ({ key: r.key, label: r.name, sublabel: `Seviye ${r.level}` }))}
        onSelect={(key) => { setForm((f) => ({ ...f, role: key })); setRolePickerOpen(false); }}
        onClose={() => setRolePickerOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { paddingHorizontal: 16, paddingTop: 12 },
  intro: { fontSize: 12, color: THEME.muted },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 10 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: THEME.line, borderRadius: 10, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },
  empty: { textAlign: 'center', color: THEME.muted, marginTop: 30 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: THEME.line, padding: 14, marginBottom: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: THEME.line, alignItems: 'center', justifyContent: 'center', marginLeft: 6 },
  name: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  meta: { fontSize: 12, color: THEME.muted },
  label: { fontSize: 11, fontWeight: '800', color: THEME.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: THEME.line, borderRadius: 10, padding: 10 },
  selectText: { fontSize: 14, color: THEME.ink, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: THEME.navySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, color: THEME.navy, fontWeight: '700' },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: THEME.line, borderStyle: 'dashed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  addChipText: { fontSize: 12, color: THEME.muted, fontWeight: '600' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  groupTitle: { fontSize: 12, fontWeight: '700', color: THEME.ink, marginBottom: 6 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, marginBottom: 4 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18, marginBottom: 24 },
});
