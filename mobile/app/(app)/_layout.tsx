import React from 'react';
import { View, Text, Image } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/context/AuthContext';
import { notificationsApi } from '../../src/api/resources';
import { ROLES, BRAND } from '../../src/utils/constants';

// Small brand mark in every header (logo + short name), like the web top bar.
function HeaderBrand({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 24 }} resizeMode="contain" />
      <Text style={{ fontSize: 16, fontWeight: '700', color: BRAND.navy }} numberOfLines={1}>{title}</Text>
    </View>
  );
}

export default function AppTabsLayout() {
  const { currentUser } = useAuth();
  const isExternalUser = currentUser?.role === ROLES.EXTERNAL_USER;

  // Unread notifications badge, refreshed every minute.
  const unreadQuery = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000,
  });
  const unread = unreadQuery.data?.count || 0;

  return (
    <Tabs
      // External_User has no "dashboard" tab, so their landing tab is "requests".
      initialRouteName={isExternalUser ? 'requests/index' : 'dashboard'}
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#0052CC',
        headerTitle: ({ children }) => <HeaderBrand title={String(children)} />,
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
          title: 'Müdürlükler',
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
        name="notifications/index"
        options={{
          title: 'Bildirimler',
          tabBarBadge: unread > 0 ? (unread > 99 ? '99+' : unread) : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="menu/index"
        options={{
          title: 'Menü',
          tabBarIcon: ({ color, size }) => <Ionicons name="menu-outline" size={size} color={color} />,
        }}
      />

      {/* Reached from the Menü tab or by push navigation — not tab bar entries. */}
      <Tabs.Screen name="units" options={{ href: null, title: 'Daire Başkanlıkları' }} />
      <Tabs.Screen name="roles" options={{ href: null, title: 'Roller' }} />
      <Tabs.Screen name="users/index" options={{ href: null, title: 'Kullanıcılar' }} />
      <Tabs.Screen name="profile/index" options={{ href: null, title: 'Profilim' }} />
      <Tabs.Screen name="teams/index" options={{ href: null, title: 'Ekipler ve Şablonlar' }} />
      <Tabs.Screen name="forms/index" options={{ href: null, title: 'Talep Formları' }} />
      <Tabs.Screen name="reports/index" options={{ href: null, title: 'İstatistikler' }} />
      <Tabs.Screen name="performance/index" options={{ href: null, title: 'Performansım' }} />
      <Tabs.Screen name="projects/[id]/index" options={{ href: null }} />
      <Tabs.Screen name="issues/[id]" options={{ href: null }} />
    </Tabs>
  );
}
