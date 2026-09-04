import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi } from '../../../src/api/resources';
import CreateProjectSheet from '../../../src/components/CreateProjectSheet';
import { usePermissions } from '../../../src/hooks/usePermissions';
import type { Project } from '../../../src/api/types';

export default function ProjectsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canCreateProject } = usePermissions();
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const [createOpen, setCreateOpen] = useState(false);

  function renderItem({ item }: { item: Project }) {
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/projects/${item.id}`)}>
        <View style={styles.keyBadge}>
          <Text style={styles.keyText}>{item.key}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{item.name}</Text>
          {item.description ? <Text style={styles.desc} numberOfLines={1}>{item.description}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      {projectsQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>
      ) : (projectsQuery.data || []).length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>Erişilebilir proje bulunamadı.</Text></View>
      ) : (
        <FlatList
          data={projectsQuery.data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={projectsQuery.isFetching} onRefresh={() => projectsQuery.refetch()} />
          }
        />
      )}

      {canCreateProject && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <CreateProjectSheet
        visible={createOpen}
        onCreated={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['projects'] }); }}
        onCancel={() => setCreateOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF' },
  list: { padding: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  keyBadge: { backgroundColor: '#0052CC', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  keyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '600', color: '#172B4D' },
  desc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#0052CC', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
});
