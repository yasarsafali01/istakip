import React from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { ROLES } from '../../src/utils/constants';

export default function AppTabsLayout() {
  const { currentUser, logout } = useAuth();
  const isExternalUser = currentUser?.role === ROLES.EXTERNAL_USER;
  const canManageUnits = currentUser?.role === ROLES.SYSTEM_ADMIN || currentUser?.role === ROLES.DEPARTMENT_HEAD;

  function handleLogout() {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinizden emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => logout() },
    ]);
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#0052CC',
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={{ paddingHorizontal: 16 }}>
            <Ionicons name="log-out-outline" size={22} color="#DE350B" />
          </TouchableOpacity>
        ),
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Panel',
          href: isExternalUser ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projeler',
          href: isExternalUser ? null : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="folder-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: isExternalUser ? 'Taleplerim' : 'Talepler',
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="units"
        options={{
          title: 'Birimler',
          href: canManageUnits ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" size={size} color={color} />,
        }}
      />

      {/* Nested detail routes — reachable via push navigation, but must not
          appear as their own tab bar entries. */}
      <Tabs.Screen name="projects/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="issues/[id]" options={{ href: null }} />
    </Tabs>
  );
}
