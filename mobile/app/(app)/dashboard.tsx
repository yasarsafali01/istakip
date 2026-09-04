import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery, useQueries } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { usePermissions } from '../../src/hooks/usePermissions';
import { projectsApi, issuesApi, unitsApi, sprintsApi, usersApi } from '../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../src/components/Badge';
import { PRIORITIES, PRIORITY_COLORS } from '../../src/utils/constants';
import type { Sprint } from '../../src/api/types';

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={[styles.card, { borderLeftColor: color }]}>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
    </View>
  );
}

function ActivePeriodCard({ sprint }: { sprint: Sprint | null }) {
  return (
    <View style={[styles.card, { borderLeftColor: '#008DA6' }]}>
      <Text style={styles.cardLabel}>Aktif Dönem</Text>
      {sprint ? (
        <>
          <Text style={styles.periodName}>{sprint.name}</Text>
          <Text style={styles.periodRange}>
            {new Date(sprint.startDate).toLocaleDateString('tr-TR')} – {new Date(sprint.endDate).toLocaleDateString('tr-TR')}
          </Text>
        </>
      ) : (
        <Text style={styles.periodName}>—</Text>
      )}
    </View>
  );
}

function PriorityBreakdown({ counts }: { counts: Record<string, number> }) {
  const maxCount = Math.max(...PRIORITIES.map((p) => counts[p] || 0), 1);
  return (
    <View style={styles.breakdownCard}>
      <Text style={styles.sectionTitle}>Öncelik Dağılımı</Text>
      {PRIORITIES.map((p) => {
        const count = counts[p] || 0;
        return (
          <View key={p} style={styles.breakdownRow}>
            <Text style={[styles.breakdownLabel, { color: PRIORITY_COLORS[p] }]}>{p}</Text>
            <View style={styles.breakdownBarTrack}>
              <View style={[styles.breakdownBarFill, { width: `${(count / maxCount) * 100}%`, backgroundColor: PRIORITY_COLORS[p] }]} />
            </View>
            <Text style={styles.breakdownCount}>{count}</Text>
          </View>
        );
      })}
    </View>
  );
}

export default function DashboardScreen() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const { isSystemAdmin, isDepartmentHead, isProjectManager, isWorker } = usePermissions();

  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const unitsQuery = useQuery({
    queryKey: ['units'],
    queryFn: unitsApi.list,
    enabled: isSystemAdmin || isDepartmentHead,
  });

  const projects = projectsQuery.data || [];
  const sprintQueries = useQueries({
    queries: projects.map((p) => ({
      queryKey: ['sprints', p.id],
      queryFn: () => sprintsApi.listByProject(p.id),
      enabled: projects.length > 0,
    })),
  });
  const allSprints = sprintQueries.flatMap((q) => q.data || []);

  const loading = projectsQuery.isLoading || issuesQuery.isLoading;
  const refreshing = projectsQuery.isFetching || issuesQuery.isFetching;

  function refresh() {
    projectsQuery.refetch();
    issuesQuery.refetch();
    unitsQuery.refetch();
    sprintQueries.forEach((q) => q.refetch());
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0052CC" />
      </View>
    );
  }

  const issues = issuesQuery.data || [];
  const nonRequestIssues = issues.filter((i) => !i.isRequest);
  const requests = issues.filter((i) => i.isRequest);

  // My project (PM/Worker have exactly one relevant project)
  const myProject = isProjectManager
    ? projects.find((p) => p.managerId === currentUser?.id)
    : isWorker
      ? projects.find((p) => p.id === currentUser?.projectId)
      : null;

  const scopedIssues = isWorker
    ? nonRequestIssues.filter((i) => i.projectId === myProject?.id && i.assigneeId === currentUser?.id)
    : isProjectManager
      ? nonRequestIssues.filter((i) => i.projectId === myProject?.id)
      : nonRequestIssues; // Admin/DeptHead already only receive their visible scope from the API

  const openCount = scopedIssues.filter((i) => i.status !== 'Done').length;
  const doneCount = scopedIssues.filter((i) => i.status === 'Done').length;
  const pendingCount = scopedIssues.filter((i) => !i.sprintId && i.status !== 'Done').length;

  const activeSprint = isProjectManager || isWorker
    ? allSprints.find((s) => s.projectId === myProject?.id && s.status === 'Active') || null
    : allSprints.find((s) => s.status === 'Active') || null;

  const priorityCounts: Record<string, number> = {};
  scopedIssues.forEach((i) => { priorityCounts[i.priority] = (priorityCounts[i.priority] || 0) + 1; });

  // PM-only: open-issue count per assignee ("Ekip İş Yükü")
  const teamWorkload: Record<string, number> = {};
  if (isProjectManager) {
    scopedIssues.filter((i) => i.assigneeId && i.status !== 'Done').forEach((i) => {
      teamWorkload[i.assigneeId!] = (teamWorkload[i.assigneeId!] || 0) + 1;
    });
  }
  function getUserName(id: string) {
    return usersQuery.data?.find((u) => u.id === id)?.name || id;
  }

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
            <StatCard label="Birim Sayısı" value={unitsQuery.data?.length ?? '—'} color="#6554C0" />
          )}
          <StatCard label="Bağlı Proje" value={isProjectManager || isWorker ? (myProject ? 1 : 0) : projects.length} color="#0052CC" />
          <ActivePeriodCard sprint={activeSprint} />
          <StatCard label={isWorker ? 'Bana Atanan' : 'Toplam İş'} value={scopedIssues.length} color="#FF7700" />
          <StatCard label="Açık İşler" value={openCount} color="#DE350B" />
          <StatCard label="Tamamlanan" value={doneCount} color="#00875A" />
          <StatCard label="Bekleyen İşler" value={pendingCount} color="#D4A000" />
          {(isSystemAdmin || isDepartmentHead || isProjectManager) && (
            <StatCard label="Talep Sayısı" value={requests.length} color="#FF991F" />
          )}
        </View>

        {isProjectManager ? (
          <View style={styles.breakdownCard}>
            <Text style={styles.sectionTitle}>Ekip İş Yükü</Text>
            {Object.keys(teamWorkload).length === 0 ? (
              <Text style={styles.emptyText}>Atanmış açık iş yok.</Text>
            ) : (
              Object.entries(teamWorkload).map(([userId, count]) => (
                <View key={userId} style={styles.workloadRow}>
                  <Text style={styles.workloadName}>{getUserName(userId)}</Text>
                  <View style={styles.workloadBadge}><Text style={styles.workloadBadgeText}>{count} iş</Text></View>
                </View>
              ))
            )}
          </View>
        ) : (
          <PriorityBreakdown counts={priorityCounts} />
        )}

        {isWorker && scopedIssues.filter((i) => i.status !== 'Done').length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Bana Atanan Açık İşler</Text>
            {scopedIssues.filter((i) => i.status !== 'Done').slice(0, 10).map((issue) => (
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  card: {
    flexBasis: '47%', backgroundColor: '#fff', borderRadius: 10, padding: 14,
    borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#172B4D' },
  cardLabel: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  periodName: { fontSize: 15, fontWeight: '700', color: '#008DA6', marginTop: 4 },
  periodRange: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#172B4D', marginBottom: 10, marginTop: 4 },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  breakdownCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 16, marginBottom: 20,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  breakdownLabel: { width: 60, fontSize: 12, fontWeight: '600' },
  breakdownBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#F4F5F7' },
  breakdownBarFill: { height: 8, borderRadius: 4 },
  breakdownCount: { width: 20, fontSize: 12, color: '#6B7280', textAlign: 'right' },
  workloadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  workloadName: { fontSize: 13, color: '#172B4D' },
  workloadBadge: { backgroundColor: '#0052CC', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  workloadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },
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
