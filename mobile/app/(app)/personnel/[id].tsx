import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Linking, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQuery } from '@tanstack/react-query';
import { usersApi, projectsApi, unitsApi, issuesApi, rolesApi, teamsApi } from '../../../src/api/resources';
import { useAuth } from '../../../src/context/AuthContext';
import Avatar from '../../../src/components/Avatar';
import PersonStats from '../../../src/components/PersonStats';
import { Pill, ui } from '../../../src/components/ui';
import { THEME } from '../../../src/utils/constants';
import { canViewPersonnel, projectIdsOf, formatDate } from '../../../src/utils/access';

/**
 * Personel Profili — opened by tapping a person's name (Kullanıcılar, iş yükü,
 * ekipler). Who they are, then the same work statistics as Performansım.
 */
export default function PersonnelProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { currentUser } = useAuth();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });

  const person = usersQuery.data?.find((u) => u.id === id);
  const projects = projectsQuery.data || [];
  const allowed = canViewPersonnel(currentUser, person, projects);
  // Teams can belong to any müdürlük of the person's daire başkanlığı.
  const unitProjects = person ? projects.filter((p) => p.unitId === person.unitId) : [];
  const teamQueries = useQueries({
    queries: (allowed ? unitProjects : []).map((p) => ({ queryKey: ['teams', p.id], queryFn: () => teamsApi.listByProject(p.id) })),
  });
  const teams = teamQueries.flatMap((q) => q.data || []).filter((t) => person && t.memberIds.includes(person.id));

  if (usersQuery.isLoading || projectsQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;
  }
  if (!person || !allowed) {
    return (
      <View style={styles.center}>
        <Stack.Screen options={{ title: 'Personel Profili' }} />
        <Ionicons name="person-circle-outline" size={40} color="#94a3b8" />
        <Text style={styles.emptyTitle}>Personel bulunamadı</Text>
        <Text style={styles.muted}>Bu kişi yönetim alanınızda değil ya da kaydı bulunmuyor.</Text>
      </View>
    );
  }

  const roleName = (key: string) => rolesQuery.data?.find((r) => r.key === key)?.name || key;
  const roles = [person.roleKey || person.role, ...(person.extraRoles || [])].map(roleName);
  const unitName = unitsQuery.data?.find((u) => u.id === person.unitId)?.name;
  const pids = projectIdsOf(person);
  const projectName = (pid: string) => projects.find((p) => p.id === pid)?.name || 'Müdürlük';
  const location = [person.building, person.floor && `${person.floor}. kat`, person.room && `Oda ${person.room}`].filter(Boolean).join(' · ');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <Stack.Screen options={{ title: person.name }} />
      <ScrollView contentContainerStyle={ui.screen}>
        <View style={[ui.card, styles.identity]}>
          <Avatar name={person.name} color={person.avatarColor} size={68} />
          <Text style={styles.name}>{person.name}</Text>
          <View style={styles.roles}>
            {roles.map((r) => <Pill key={r} label={r} bg={THEME.navySoft} color={THEME.navy} />)}
            {person.isActive === false && <Pill label="Pasif kullanıcı" bg="#e2e8f0" color="#475569" />}
          </View>
        </View>

        <View style={[ui.card, { marginBottom: 14 }]}>
          <Info icon="mail-outline" label="E-posta">
            <TouchableOpacity onPress={() => Linking.openURL(`mailto:${person.email}`)}>
              <Text style={[styles.value, { color: THEME.brand }]}>{person.email}</Text>
            </TouchableOpacity>
          </Info>
          <Info icon="business-outline" label="Daire Başkanlığı"><Text style={styles.value}>{unitName || '—'}</Text></Info>
          <Info icon="folder-outline" label="Müdürlükler">
            <View style={styles.chips}>
              {pids.length === 0 ? <Text style={styles.value}>—</Text> : pids.map((pid, i) => (
                <Pill key={pid} label={`${projectName(pid)}${i === 0 && pids.length > 1 ? ' (ana)' : ''}`} bg="#f1f5f9" color={THEME.ink} />
              ))}
            </View>
          </Info>
          <Info icon="people-outline" label="Ekipler">
            <View style={styles.chips}>
              {teams.length === 0 ? <Text style={styles.value}>—</Text> : teams.map((t) => <Pill key={t.id} label={t.name} bg="#f1f5f9" color={THEME.ink} />)}
            </View>
          </Info>
          <Info icon="location-outline" label="Konum"><Text style={styles.value}>{location || '—'}</Text></Info>
          <Info icon="calendar-outline" label="Kayıt tarihi"><Text style={styles.value}>{formatDate(person.createdAt)}</Text></Info>
          <Info icon="checkmark-circle-outline" label="Durum" last><Text style={styles.value}>{person.isActive === false ? 'Pasif' : 'Aktif'}</Text></Info>
        </View>

        {issuesQuery.data ? <PersonStats person={person} issues={issuesQuery.data} />
          : <ActivityIndicator color={THEME.navy} style={{ marginTop: 20 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Info({ icon, label, children, last }: { icon: any; label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <View style={[styles.info, !last && styles.infoBorder]}>
      <Ionicons name={icon} size={17} color={THEME.brand} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  muted: { fontSize: 13, color: THEME.muted, textAlign: 'center' },
  identity: { alignItems: 'center', marginBottom: 14, paddingVertical: 20 },
  name: { fontSize: 20, fontWeight: '800', color: THEME.navy, marginTop: 10 },
  roles: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 },
  info: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  infoBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  label: { fontSize: 11, color: THEME.muted, marginBottom: 3 },
  value: { fontSize: 14, fontWeight: '600', color: THEME.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
