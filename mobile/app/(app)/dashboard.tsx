import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { usePermissions } from '../../src/hooks/usePermissions';
import { projectsApi, issuesApi, unitsApi } from '../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../src/components/Badge';

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const { currentUser } = useAuth();
  const { isSystemAdmin, isDepartmentHead, isProjectManager, isWorker } = usePermissions();
  const router = useRouter();

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });
  const unitsQuery = useQuery({
    queryKey: ['units'],
    queryFn: unitsApi.list,
    enabled: isSystemAdmin || isDepartmentHead,
  });

  const loading = projectsQuery.isLoading || issuesQuery.isLoading;
  const refreshing = projectsQuery.isFetching || issuesQuery.isFetching;

  function refresh() {
    projectsQuery.refetch();
    issuesQuery.refetch();
    unitsQuery.refetch();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0052CC" />
      </View>
    );
  }

  const projects = projectsQuery.data || [];
  const issues = issuesQuery.data || [];
  const nonRequestIssues = issues.filter((i) => !i.isRequest);
  const openIssues = nonRequestIssues.filter((i) => i.status !== 'Done');
  const myOpenIssues = nonRequestIssues.filter((i) => i.status !== 'Done' && i.assigneeId === currentUser?.id);
  const requests = issues.filter((i) => i.isRequest);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text style={styles.greeting}>Merhaba, {currentUser?.name}</Text>
        <Text style={styles.roleLabel}>{currentUser?.role?.replace('_', ' ')}</Text>

        <View style={styles.grid}>
          {(isSystemAdmin || isDepartmentHead) && (
            <StatCard label="Birim Sayısı" value={unitsQuery.data?.length ?? '—'} color="#0052CC" />
          )}
          <StatCard label="Erişilebilir Proje" value={projects.length} color="#00875A" />
          <StatCard label="Açık İş" value={openIssues.length} color="#FF991F" />
          {isWorker && <StatCard label="Bana Atanan Açık İş" value={myOpenIssues.length} color="#6554C0" />}
          {(isSystemAdmin || isDepartmentHead || isProjectManager) && (
            <StatCard label="Talep Sayısı" value={requests.length} color="#DE350B" />
          )}
        </View>

        {isWorker && myOpenIssues.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Bana Atanan Açık İşler</Text>
            {myOpenIssues.slice(0, 10).map((issue) => (
              <TouchableOpacity
                key={issue.id}
                style={styles.issueRow}
                onPress={() => router.push(`/(app)/issues/${issue.id}`)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.issueKey}>{issue.key}</Text>
                  <Text style={styles.issueTitle} numberOfLines={1}>{issue.title}</Text>
                </View>
                <View style={{ gap: 4, alignItems: 'flex-end' }}>
                  <StatusBadge status={issue.status} />
                  <PriorityBadge priority={issue.priority} />
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>Projeler</Text>
        {projects.length === 0 ? (
          <Text style={styles.emptyText}>Erişilebilir proje bulunamadı.</Text>
        ) : (
          projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.projectRow}
              onPress={() => router.push(`/(app)/projects/${p.id}`)}
            >
              <View style={[styles.projectDot, { backgroundColor: '#0052CC' }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.projectName}>{p.name}</Text>
                <Text style={styles.projectKey}>{p.key}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  greeting: { fontSize: 20, fontWeight: '700', color: '#172B4D' },
  roleLabel: { fontSize: 13, color: '#6B7280', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  card: {
    flexBasis: '47%', backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#172B4D' },
  cardLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#172B4D', marginBottom: 10 },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  projectRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8 },
  projectDot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  projectName: { fontSize: 14, fontWeight: '600', color: '#172B4D' },
  projectKey: { fontSize: 11, color: '#9CA3AF' },
  issueRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8,
    padding: 12, marginBottom: 8, justifyContent: 'space-between',
  },
  issueKey: { fontSize: 10, color: '#9CA3AF', fontWeight: '600' },
  issueTitle: { fontSize: 13, fontWeight: '600', color: '#172B4D', marginTop: 2 },
});
