import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../src/context/AuthContext';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { rolesApi } from '../../../src/api/resources';
import Avatar from '../../../src/components/Avatar';
import { ROLES, MANAGER_ROLES, BRAND } from '../../../src/utils/constants';

type Item = { icon: any; label: string; route: string; show: boolean };

/**
 * Menü tab: the screens that don't fit the 5-slot tab bar — profile, reports
 * and the Yönetim pages — each shown only to users allowed to open it (the
 * same conditions as the web sidebar).
 */
export default function MenuScreen() {
  const router = useRouter();
  const { currentUser, logout } = useAuth();
  const { can, isExternalUser } = usePermissions();
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });

  const roleName = (key?: string) => rolesQuery.data?.find((r) => r.key === key)?.name || key;
  const roleText = [roleName(currentUser?.roleKey), ...(currentUser?.extraRoles || []).map(roleName)].filter(Boolean).join(', ');
  const isManager = MANAGER_ROLES.includes(currentUser?.role || '');

  const sections: { title: string; items: Item[] }[] = [
    {
      title: 'Hesap',
      items: [{ icon: 'person-circle-outline', label: 'Profilim', route: '/(app)/profile', show: true }],
    },
    {
      title: 'Raporlar',
      items: [
        { icon: 'person-outline', label: 'Performansım', route: '/(app)/performance', show: !isExternalUser },
        { icon: 'bar-chart-outline', label: 'İstatistikler', route: '/(app)/reports', show: isManager },
      ],
    },
    {
      title: 'Yönetim',
      items: [
        { icon: 'people-outline', label: 'Kullanıcılar', route: '/(app)/users', show: can('user.assign_role') },
        { icon: 'list-outline', label: 'Talep Formları', route: '/(app)/forms', show: can('request_form.manage') },
        { icon: 'albums-outline', label: 'Ekipler ve Şablonlar', route: '/(app)/teams', show: can('team.manage') || can('template.manage') },
        {
          icon: 'business-outline', label: 'Daire Başkanlıkları', route: '/(app)/units',
          show: currentUser?.role === ROLES.SYSTEM_ADMIN || currentUser?.role === ROLES.DEPARTMENT_HEAD,
        },
        { icon: 'shield-checkmark-outline', label: 'Roller ve İzinler', route: '/(app)/roles', show: can('role.manage') },
      ],
    },
  ];

  function handleLogout() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.brand}>
          <Image source={require('../../../assets/logo.png')} style={{ width: 54, height: 46 }} resizeMode="contain" />
          <View style={{ flex: 1 }}>
            <Text style={styles.brandTitle}>Mersin Üniversitesi</Text>
            <Text style={styles.brandSub}>Talep Takip Sistemi</Text>
          </View>
        </View>

        <View style={styles.userCard}>
          <Avatar name={currentUser?.name || '?'} size={42} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.userName}>{currentUser?.name}</Text>
            <Text style={styles.userMeta} numberOfLines={2}>{roleText}</Text>
            <Text style={styles.userMeta}>{currentUser?.email}</Text>
          </View>
        </View>

        {sections.map((sec) => {
          const items = sec.items.filter((i) => i.show);
          if (items.length === 0) return null;
          return (
            <View key={sec.title} style={{ marginBottom: 16 }}>
              <Text style={styles.sectionTitle}>{sec.title}</Text>
              <View style={styles.group}>
                {items.map((it, idx) => (
                  <TouchableOpacity key={it.route} style={[styles.row, idx > 0 && styles.rowBorder]} onPress={() => router.push(it.route as any)}>
                    <Ionicons name={it.icon} size={20} color="#0052CC" />
                    <Text style={styles.rowLabel}>{it.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#C1C7D0" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#DE350B" />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  brandTitle: { fontSize: 16, fontWeight: '800', color: BRAND.navy },
  brandSub: { fontSize: 13, fontWeight: '700', color: BRAND.orange },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 20 },
  userName: { fontSize: 15, fontWeight: '700', color: '#172B4D' },
  userMeta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
  group: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 14 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#F1F2F4' },
  rowLabel: { flex: 1, fontSize: 14, color: '#172B4D', fontWeight: '600' },
  logout: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FDECEA', borderRadius: 12, paddingVertical: 14, marginTop: 4 },
  logoutText: { color: '#DE350B', fontWeight: '700', fontSize: 14 },
});
