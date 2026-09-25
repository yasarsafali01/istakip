import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { rolesApi } from '../../../src/api/resources';
import { api } from '../../../src/api/client';
import { useAuth } from '../../../src/context/AuthContext';
import PickerSheet from '../../../src/components/PickerSheet';
import Avatar from '../../../src/components/Avatar';
import type { User } from '../../../src/api/types';

const SCOPE_LABELS: Record<string, string> = {
  all: 'Tüm sistem',
  unit: 'Kendi birimi',
  manager: 'Yönettiği projeler',
  project: 'Atandığı proje',
  own: 'Yalnızca kendi talepleri',
};

// Role assignment. Role definitions (which permissions each role has) are edited
// on the web app; here an admin can see them and change who holds which role.
export default function RolesScreen() {
  const queryClient = useQueryClient();
  const { currentUser } = useAuth();
  const [pickerUser, setPickerUser] = useState<User | null>(null);
  const [view, setView] = useState<'users' | 'roles'>('users');

  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  // Raw users (not role-mapped) so each row shows the real assigned role
  const usersQuery = useQuery({ queryKey: ['users-raw'], queryFn: () => api.get<User[]>('/users') });

  const roles = rolesQuery.data || [];
  const roleName = (key: string) => roles.find((r) => r.key === key)?.name || key;

  async function assign(roleKey: string) {
    const user = pickerUser;
    setPickerUser(null);
    if (!user) return;
    try {
      await rolesApi.assign(user.id, roleKey);
      queryClient.invalidateQueries({ queryKey: ['users-raw'] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  if (rolesQuery.isLoading || usersQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#2563eb" /></View>;
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <View style={styles.segment}>
        {(['users', 'roles'] as const).map((v) => (
          <TouchableOpacity key={v} style={[styles.segBtn, view === v && styles.segBtnActive]} onPress={() => setView(v)}>
            <Text style={[styles.segText, view === v && styles.segTextActive]}>
              {v === 'users' ? 'Kullanıcılar' : 'Roller'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === 'users' ? (
        <FlatList
          data={usersQuery.data || []}
          keyExtractor={(u) => u.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isMe = item.id === currentUser?.id;
            return (
              <TouchableOpacity style={styles.card} disabled={isMe} onPress={() => setPickerUser(item)}>
                <Avatar name={item.name} color={item.avatarColor} size={38} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.sub}>{item.email}</Text>
                </View>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>{roleName(item.role as string)}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <FlatList
          data={roles}
          keyExtractor={(r) => r.key}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.roleCard}>
              <View style={styles.roleHead}>
                <Text style={styles.name}>{item.name}</Text>
                {item.isSystem && <Text style={styles.badge}>Yerleşik</Text>}
              </View>
              {!!item.description && <Text style={styles.sub}>{item.description}</Text>}
              <Text style={styles.meta}>
                {item.permissions.length} izin · {SCOPE_LABELS[item.scope] || item.scope} · {item.userCount} kullanıcı
              </Text>
            </View>
          )}
        />
      )}

      <PickerSheet
        visible={!!pickerUser}
        title={pickerUser ? `${pickerUser.name} — rol seç` : 'Rol seç'}
        options={roles.map((r) => ({ key: r.key, label: r.name, sublabel: SCOPE_LABELS[r.scope] }))}
        onSelect={assign}
        onClose={() => setPickerUser(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', margin: 16, marginBottom: 4, backgroundColor: '#F1F5F9', borderRadius: 10, padding: 3 },
  segBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  segBtnActive: { backgroundColor: '#fff' },
  segText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  segTextActive: { color: '#2563eb' },
  list: { padding: 16, paddingTop: 8 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 12,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0',
  },
  roleCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  roleHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  sub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  meta: { fontSize: 11, color: '#94A3B8', marginTop: 8 },
  badge: { fontSize: 10, color: '#475569', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  rolePill: { backgroundColor: '#EFF6FF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rolePillText: { fontSize: 11, color: '#2563eb', fontWeight: '600' },
});
