import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { ROLES } from '../../src/utils/constants';

export default function AppTabsLayout() {
  const { currentUser } = useAuth();
  const isExternalUser = currentUser?.role === ROLES.EXTERNAL_USER;
  const canManageUnits = currentUser?.role === ROLES.SYSTEM_ADMIN || currentUser?.role === ROLES.DEPARTMENT_HEAD;

  return (
    <Tabs screenOptions={{ headerShown: true, tabBarActiveTintColor: '#0052CC' }}>
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
    </Tabs>
  );
}
