import React, { useMemo, useState } from 'react';
import { View, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { usersApi, issuesApi } from '../../../src/api/resources';
import { useAuth } from '../../../src/context/AuthContext';
import { usePermissions } from '../../../src/hooks/usePermissions';
import PersonStats from '../../../src/components/PersonStats';
import PickerSheet from '../../../src/components/PickerSheet';
import Avatar from '../../../src/components/Avatar';
import { ui } from '../../../src/components/ui';
import { MANAGER_ROLES, THEME } from '../../../src/utils/constants';

/** Raporlar → Performansım (web: PerformancePage). Managers can pick anyone whose work they can see. */
export default function PerformanceScreen() {
  const { currentUser } = useAuth();
  const { role } = usePermissions();
  const isManager = MANAGER_ROLES.includes(role || '');
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });
  const [personId, setPersonId] = useState(currentUser?.id || '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const users = usersQuery.data || [];
  const people = useMemo(() => {
    const ids = new Set((issuesQuery.data || []).map((i) => i.assigneeId).filter(Boolean) as string[]);
    if (currentUser) ids.add(currentUser.id);
    return [...ids].map((uid) => users.find((u) => u.id === uid)).filter(Boolean).sort((a, b) => a!.name.localeCompare(b!.name, 'tr'));
  }, [issuesQuery.data, users, currentUser]);
  const person = users.find((u) => u.id === personId) || currentUser;

  if (!issuesQuery.data || !person) return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <ScrollView contentContainerStyle={ui.screen}>
        <TouchableOpacity style={[ui.card, styles.person]} disabled={!isManager || people.length < 2} onPress={() => setPickerOpen(true)}>
          <Avatar name={person.name} color={person.avatarColor} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{person.name}{person.id === currentUser?.id ? ' (ben)' : ''}</Text>
            <Text style={styles.muted}>{isManager && people.length > 1 ? 'Başka bir personeli görmek için dokunun' : 'Kişisel performans'}</Text>
          </View>
          {isManager && people.length > 1 && <Ionicons name="chevron-down" size={18} color={THEME.muted} />}
        </TouchableOpacity>
        {/* key: switching person resets year / talep türü filters */}
        <PersonStats key={person.id} person={person} issues={issuesQuery.data} />
      </ScrollView>
      <PickerSheet
        visible={pickerOpen}
        title="Personel"
        options={people.map((u) => ({ key: u!.id, label: u!.id === currentUser?.id ? `${u!.name} (ben)` : u!.name }))}
        onSelect={(key) => { setPersonId(key); setPickerOpen(false); }}
        onClose={() => setPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  name: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  muted: { fontSize: 12, color: THEME.muted },
});
