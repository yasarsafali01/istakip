import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, sprintsApi, issuesApi } from '../../../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../../../src/components/Badge';
import PickerSheet from '../../../../src/components/PickerSheet';
import CompleteIssueModal from '../../../../src/components/CompleteIssueModal';
import CreateIssueSheet from '../../../../src/components/CreateIssueSheet';
import CreateSprintSheet from '../../../../src/components/CreateSprintSheet';
import { usePermissions } from '../../../../src/hooks/usePermissions';
import { STATUSES } from '../../../../src/utils/constants';
import type { Issue, Sprint } from '../../../../src/api/types';

type ViewMode = 'board' | 'backlog' | 'sprints';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canManageIssues } = usePermissions();

  const [view, setView] = useState<ViewMode>('board');
  const [statusPickerIssue, setStatusPickerIssue] = useState<Issue | null>(null);
  const [sprintPickerIssue, setSprintPickerIssue] = useState<Issue | null>(null);
  const [doneModalIssueId, setDoneModalIssueId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id!) });
  const sprintsQuery = useQuery({ queryKey: ['sprints', id], queryFn: () => sprintsApi.listByProject(id!) });
  const activeSprint = sprintsQuery.data?.find((s) => s.status === 'Active');

  const boardIssuesQuery = useQuery({
    queryKey: ['issues', { projectId: id, sprintId: activeSprint?.id }],
    queryFn: () => issuesApi.list({ projectId: id!, sprintId: activeSprint?.id }),
    enabled: view === 'board' && !!activeSprint,
  });

  const backlogIssuesQuery = useQuery({
    queryKey: ['issues', { projectId: id, backlog: true }],
    queryFn: () => issuesApi.list({ projectId: id!, backlog: true }),
    enabled: view === 'backlog',
  });

  function invalidateIssues() {
    queryClient.invalidateQueries({ queryKey: ['issues'] });
  }

  async function applyStatusChange(issue: Issue, newStatus: string) {
    setStatusPickerIssue(null);
    if (newStatus === 'Done') {
      setDoneModalIssueId(issue.id);
      return;
    }
    try {
      await issuesApi.updateStatus(issue.id, newStatus);
      invalidateIssues();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  async function applySprintAssign(issue: Issue, sprintId: string) {
    setSprintPickerIssue(null);
    try {
      await issuesApi.moveSprint(issue.id, sprintId === '__backlog__' ? null : sprintId);
      invalidateIssues();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  async function handleStartSprint(sprint: Sprint) {
    try {
      await sprintsApi.start(sprint.id);
      queryClient.invalidateQueries({ queryKey: ['sprints', id] });
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  function handleCompleteSprint(sprint: Sprint) {
    Alert.alert(
      'Ayı Kapat',
      'Bu ayı kapatmak istediğinizden emin misiniz? Tamamlanmamış işler backlog\'a taşınacak.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kapat', style: 'destructive', onPress: async () => {
            try {
              await sprintsApi.complete(sprint.id);
              queryClient.invalidateQueries({ queryKey: ['sprints', id] });
              invalidateIssues();
            } catch (err: any) {
              Alert.alert('Hata', err.message);
            }
          },
        },
      ]
    );
  }

  if (projectQuery.isLoading || sprintsQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;
  }

  const boardStatuses = STATUSES.filter((s) => s !== 'Geri Çevrildi');
  const nonCompletedSprints = (sprintsQuery.data || []).filter((s) => s.status !== 'Completed');

  function IssueCard({ issue, showSprintAction }: { issue: Issue; showSprintAction?: boolean }) {
    return (
      <TouchableOpacity
        style={styles.issueCard}
        onPress={() => router.push(`/(app)/issues/${issue.id}`)}
        onLongPress={() => canManageIssues && setStatusPickerIssue(issue)}
      >
        <Text style={styles.issueKey}>{issue.key}</Text>
        <Text style={styles.issueTitle} numberOfLines={2}>{issue.title}</Text>
        <View style={styles.issueFooter}>
          <PriorityBadge priority={issue.priority} />
          {issue.isRequest && <StatusBadge status="Talep" />}
          {showSprintAction && canManageIssues && (
            <TouchableOpacity style={styles.assignChip} onPress={() => setSprintPickerIssue(issue)}>
              <Text style={styles.assignChipText}>Aya Ata</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen options={{ title: projectQuery.data?.key || 'Proje' }} />

      <View style={styles.segmentRow}>
        {(['board', 'backlog', 'sprints'] as ViewMode[]).map((v) => (
          <TouchableOpacity
            key={v}
            style={[styles.segment, view === v && styles.segmentActive]}
            onPress={() => setView(v)}
          >
            <Text style={[styles.segmentText, view === v && styles.segmentTextActive]}>
              {v === 'board' ? 'Board' : v === 'backlog' ? 'Backlog' : 'Aylar'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === 'board' && (
        !activeSprint ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>Aktif ay bulunmuyor</Text>
            <Text style={styles.emptyDesc}>"Aylar" sekmesinden bir ay başlatın.</Text>
          </View>
        ) : boardIssuesQuery.isLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.sprintBadge}>
              <Text style={styles.sprintBadgeText}>{activeSprint.name}</Text>
            </View>
            <Text style={styles.hint}>Durumu değiştirmek için karta uzun basın.</Text>
            {boardStatuses.map((status) => {
              const columnIssues = (boardIssuesQuery.data || []).filter((i) => i.status === status);
              return (
                <View key={status} style={styles.column}>
                  <Text style={styles.columnTitle}>{status} ({columnIssues.length})</Text>
                  {columnIssues.length === 0 ? (
                    <Text style={styles.columnEmpty}>—</Text>
                  ) : (
                    columnIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)
                  )}
                </View>
              );
            })}
          </ScrollView>
        )
      )}

      {view === 'backlog' && (
        backlogIssuesQuery.isLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>
        ) : (backlogIssuesQuery.data || []).length === 0 ? (
          <View style={styles.center}><Text style={styles.emptyDesc}>Backlog boş.</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.container}>
            {(backlogIssuesQuery.data || []).map((issue) => (
              <IssueCard key={issue.id} issue={issue} showSprintAction />
            ))}
          </ScrollView>
        )
      )}

      {view === 'sprints' && (
        <ScrollView contentContainerStyle={styles.container}>
          {(sprintsQuery.data || []).length === 0 ? (
            <Text style={styles.emptyDesc}>Henüz dönem yok.</Text>
          ) : (
            [...(sprintsQuery.data || [])].reverse().map((sprint) => (
              <View key={sprint.id} style={styles.sprintRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sprintName}>{sprint.name}</Text>
                  <Text style={styles.sprintStatus}>{sprint.status}</Text>
                </View>
                {canManageIssues && sprint.status === 'Planned' && (
                  <TouchableOpacity style={styles.sprintActionBtn} onPress={() => handleStartSprint(sprint)}>
                    <Text style={styles.sprintActionText}>Başlat</Text>
                  </TouchableOpacity>
                )}
                {canManageIssues && sprint.status === 'Active' && (
                  <TouchableOpacity style={[styles.sprintActionBtn, styles.sprintActionDanger]} onPress={() => handleCompleteSprint(sprint)}>
                    <Text style={[styles.sprintActionText, styles.sprintActionDangerText]}>Kapat</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {canManageIssues && view !== 'sprints' && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}
      {canManageIssues && view === 'sprints' && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateSprintOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <PickerSheet
        visible={!!statusPickerIssue}
        title="Durum Değiştir"
        options={STATUSES.filter((s) => s !== statusPickerIssue?.status).map((s) => ({ key: s, label: s }))}
        onSelect={(key) => statusPickerIssue && applyStatusChange(statusPickerIssue, key)}
        onClose={() => setStatusPickerIssue(null)}
      />

      <PickerSheet
        visible={!!sprintPickerIssue}
        title="Bir Aya Ata"
        options={nonCompletedSprints.map((s) => ({ key: s.id, label: s.name, sublabel: s.status === 'Active' ? 'Aktif' : undefined }))}
        onSelect={(key) => sprintPickerIssue && applySprintAssign(sprintPickerIssue, key)}
        onClose={() => setSprintPickerIssue(null)}
      />

      <CompleteIssueModal
        visible={!!doneModalIssueId}
        issueId={doneModalIssueId}
        projectId={id}
        hasInventory={projectQuery.data?.hasInventory}
        onDone={() => { setDoneModalIssueId(null); invalidateIssues(); }}
        onCancel={() => setDoneModalIssueId(null)}
      />

      <CreateIssueSheet
        visible={createOpen}
        projectId={id!}
        onCreated={() => { setCreateOpen(false); invalidateIssues(); }}
        onCancel={() => setCreateOpen(false)}
      />

      <CreateSprintSheet
        visible={createSprintOpen}
        projectId={id!}
        onCreated={() => {
          setCreateSprintOpen(false);
          queryClient.invalidateQueries({ queryKey: ['sprints', id] });
        }}
        onCancel={() => setCreateSprintOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#172B4D', marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  container: { padding: 16, paddingBottom: 80 },
  segmentRow: { flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: '#F1F2F4', borderRadius: 8, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  segmentText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  segmentTextActive: { color: '#172B4D' },
  hint: { fontSize: 11, color: '#9CA3AF', marginBottom: 12, fontStyle: 'italic' },
  sprintBadge: { alignSelf: 'flex-start', backgroundColor: '#E3FCEF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 },
  sprintBadgeText: { color: '#006644', fontSize: 12, fontWeight: '700' },
  column: { marginBottom: 20 },
  columnTitle: { fontSize: 13, fontWeight: '700', color: '#42526E', marginBottom: 8, textTransform: 'uppercase' },
  columnEmpty: { fontSize: 12, color: '#C1C7D0', fontStyle: 'italic', paddingVertical: 8 },
  issueCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  issueKey: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  issueTitle: { fontSize: 13, fontWeight: '600', color: '#172B4D', marginBottom: 8 },
  issueFooter: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  assignChip: { marginLeft: 'auto', borderWidth: 1, borderColor: '#0052CC', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  assignChipText: { fontSize: 10, color: '#0052CC', fontWeight: '600' },
  sprintRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 8 },
  sprintName: { fontSize: 14, fontWeight: '600', color: '#172B4D' },
  sprintStatus: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  sprintActionBtn: { backgroundColor: '#00875A', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  sprintActionDanger: { backgroundColor: '#FDECEA' },
  sprintActionText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  sprintActionDangerText: { color: '#DE350B' },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#0052CC', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
});
