import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../src/context/AuthContext';
import { usersApi, rolesApi, projectsApi, unitsApi } from '../../../src/api/resources';
import Avatar from '../../../src/components/Avatar';
import PickerSheet from '../../../src/components/PickerSheet';
import type { User } from '../../../src/api/types';

/**
 * Mirrors the web Kullanıcılar page: delegated, hierarchical role assignment —
 * only users in my management scope, only roles below my level. A user has a
 * primary role plus any number of extra roles (access is the union).
 */
export default function UsersScreen() {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ user: User; mode: 'primary' | 'extra' } | null>(null);

  const roles = rolesQuery.data || [];
  const roleByKey = useMemo(() => Object.fromEntries(roles.map((r) => [r.key, r])), [roles]);
  const myLevel = currentUser?.level ?? 0;
  const managedProjectIds = new Set((projectsQuery.data || []).filter((p) => p.managerId === currentUser?.id).map((p) => p.id));
  const primaryKey = (u: User) => u.roleKey || u.role;
  const extrasOf = (u: User) => u.extraRoles || [];
  const userLevel = (u: User) => Math.max(...[primaryKey(u), ...extrasOf(u)].map((k) => roleByKey[k]?.level ?? 0));

  function inScope(u: User) {
    switch (currentUser?.scope) {
      case 'all': return true;
      case 'unit': return !!u.unitId && u.unitId === currentUser.unitId;
      case 'manager': return !!u.projectId && managedProjectIds.has(u.projectId);
      default: return false;
    }
  }

  const q = query.trim().toLowerCase();
  const subordinates = (usersQuery.data || [])
    .filter((u) => u.id !== currentUser?.id && inScope(u) && userLevel(u) < myLevel)
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  const assignable = roles.filter((r) => r.level < myLevel).sort((a, b) => b.level - a.level);

  async function save(user: User, primary: string, extras: string[]) {
    setBusyId(user.id);
    try {
      await rolesApi.assign(user.id, primary, extras.filter((k) => k !== primary));
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    } catch (err: any) {
      Alert.alert(user.name, err.message || 'Rol atanamadı');
    } finally {
      setBusyId(null);
    }
  }

  function onPick(key: string) {
    const p = picker;
    setPicker(null);
    if (!p) return;
    if (p.mode === 'primary') save(p.user, key, extrasOf(p.user));
    else save(p.user, primaryKey(p.user), [...extrasOf(p.user), key]);
  }

  const unitName = (id?: string | null) => unitsQuery.data?.find((u) => u.id === id)?.name;
  const projectName = (id?: string | null) => projectsQuery.data?.find((p) => p.id === id)?.name;

  if (usersQuery.isLoading || rolesQuery.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;

  const pickerOptions = picker
    ? assignable
      .filter((r) => (picker.mode === 'primary' ? true : r.key !== primaryKey(picker.user) && !extrasOf(picker.user).includes(r.key)))
      .map((r) => ({ key: r.key, label: r.name, sublabel: `Seviye ${r.level}` }))
    : [];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Text style={styles.intro}>
        Yönetim alanınızdaki kullanıcılara rol atayın. Bir kullanıcının bir ana rolü ve istediği kadar ek rolü olabilir.
        Yalnızca kendi seviyenizin (Seviye {myLevel}) altındaki roller listelenir.
      </Text>
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput style={styles.searchInput} placeholder="Kullanıcı ara…" value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        data={subordinates}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4 }}
        ListEmptyComponent={<Text style={styles.empty}>Yönetim alanınızda rol atayabileceğiniz bir kullanıcı yok.</Text>}
        renderItem={({ item: u }) => {
          const busy = busyId === u.id;
          return (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Avatar name={u.name} size={34} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.name}>{u.name}</Text>
                  <Text style={styles.meta}>{[unitName(u.unitId), projectName(u.projectId)].filter(Boolean).join(' · ') || u.email}</Text>
                </View>
                {busy && <ActivityIndicator color="#0052CC" />}
              </View>
              <Text style={styles.label}>Ana Rol</Text>
              <TouchableOpacity style={styles.select} disabled={busy} onPress={() => setPicker({ user: u, mode: 'primary' })}>
                <Text style={styles.selectText}>{roleByKey[primaryKey(u)]?.name || primaryKey(u)}</Text>
                <Ionicons name="chevron-down" size={16} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.label}>Ek Roller</Text>
              <View style={styles.chips}>
                {extrasOf(u).map((k) => (
                  <View key={k} style={styles.chip}>
                    <Text style={styles.chipText}>{roleByKey[k]?.name || k}</Text>
                    <TouchableOpacity disabled={busy} hitSlop={8} onPress={() => save(u, primaryKey(u), extrasOf(u).filter((x) => x !== k))}>
                      <Ionicons name="close" size={14} color="#0052CC" />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addChip} disabled={busy} onPress={() => setPicker({ user: u, mode: 'extra' })}>
                  <Ionicons name="add" size={14} color="#6B7280" />
                  <Text style={styles.addChipText}>Rol ekle</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      <PickerSheet
        visible={!!picker}
        title={picker?.mode === 'primary' ? 'Ana rolü değiştir' : 'Ek rol ekle'}
        options={pickerOptions}
        onSelect={onPick}
        onClose={() => setPicker(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { fontSize: 12, color: '#6B7280', marginHorizontal: 16, marginTop: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', marginHorizontal: 16, marginVertical: 10, borderRadius: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 30 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  name: { fontSize: 14, fontWeight: '700', color: '#172B4D' },
  meta: { fontSize: 12, color: '#6B7280' },
  label: { fontSize: 12, fontWeight: '700', color: '#172B4D', marginTop: 6, marginBottom: 4 },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 },
  selectText: { fontSize: 14, color: '#172B4D' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF4FD', borderWidth: 1, borderColor: '#B7D3F6', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, color: '#0052CC', fontWeight: '600' },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: '#D1D5DB', borderStyle: 'dashed', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  addChipText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
});
