import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, sprintsApi, issuesApi, usersApi, teamsApi } from '../../../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../../../src/components/Badge';
import PickerSheet from '../../../../src/components/PickerSheet';
import CompleteIssueModal from '../../../../src/components/CompleteIssueModal';
import CreateIssueSheet from '../../../../src/components/CreateIssueSheet';
import CreateSprintSheet from '../../../../src/components/CreateSprintSheet';
import CreateProjectSheet from '../../../../src/components/CreateProjectSheet';
import ApprovalPanel from '../../../../src/components/ApprovalPanel';
import { usePermissions } from '../../../../src/hooks/usePermissions';
import { STATUSES, MANUAL_STATUSES, STATUS_LABELS, ROLES } from '../../../../src/utils/constants';
import type { Issue, Sprint } from '../../../../src/api/types';

type ViewMode = 'board' | 'backlog' | 'approvals' | 'sprints';
const SPRINT_STATUS_LABELS: Record<string, string> = { Planned: 'Planlandı', Active: 'Aktif', Completed: 'Kapalı' };

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canApprove = can('issue.approve');

  const [view, setView] = useState<ViewMode>('board');
  const [statusPickerIssue, setStatusPickerIssue] = useState<Issue | null>(null);
  const [sprintPickerIssue, setSprintPickerIssue] = useState<Issue | null>(null);
  // Unassigned issue going to the active month: pick a person or team first (as on the web)
  const [assignBeforeSprint, setAssignBeforeSprint] = useState<{ issue: Issue; sprintId: string } | null>(null);
  const [doneModalIssue, setDoneModalIssue] = useState<Issue | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);

  const projectQuery = useQuery({ queryKey: ['project', id], queryFn: () => projectsApi.get(id!) });
  const sprintsQuery = useQuery({ queryKey: ['sprints', id], queryFn: () => sprintsApi.listByProject(id!) });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const teamsQuery = useQuery({ queryKey: ['teams', id], queryFn: () => teamsApi.listByProject(id!) });
  const allIssuesQuery = useQuery({ queryKey: ['issues', { projectId: id }], queryFn: () => issuesApi.list({ projectId: id! }) });
  const activeSprint = sprintsQuery.data?.find((s) => s.status === 'Active');

  const allIssues = (allIssuesQuery.data || []).filter((i) => i.status !== 'Geri Çevrildi');
  const boardIssues = activeSprint ? allIssues.filter((i) => i.sprintId === activeSprint.id) : [];
  const backlogIssues = allIssues.filter((i) => !i.sprintId);
  const pendingApproval = (allIssuesQuery.data || []).filter((i) => i.status === 'Onay Bekliyor' && i.pendingCompletion);

  const project = projectQuery.data;
  const members = (usersQuery.data || []).filter(
    (u) => u.role !== ROLES.EXTERNAL_USER && (u.projectId === id || project?.managerId === u.id)
  );

  function invalidateIssues() {
    queryClient.invalidateQueries({ queryKey: ['issues'] });
  }

  async function applyStatusChange(issue: Issue, newStatus: string) {
    setStatusPickerIssue(null);
    if (newStatus === 'Done' || newStatus === 'Onay Bekliyor') {
      setDoneModalIssue(issue);
      return;
    }
    try {
      await issuesApi.updateStatus(issue.id, newStatus);
      invalidateIssues();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  function openStatusPicker(issue: Issue) {
    if (!can('issue.status')) return;
    if (issue.status === 'Onay Bekliyor' && !canApprove) {
      Alert.alert('Onay bekliyor', 'Onay bekleyen talebin durumunu yalnızca yönetici değiştirebilir.');
      return;
    }
    setStatusPickerIssue(issue);
  }

  async function applySprintAssign(issue: Issue, sprintId: string) {
    setSprintPickerIssue(null);
    if (sprintId === activeSprint?.id && !issue.assigneeId && !issue.assigneeTeamId) {
      setAssignBeforeSprint({ issue, sprintId });
      return;
    }
    try {
      await issuesApi.moveSprint(issue.id, sprintId === '__backlog__' ? null : sprintId);
      invalidateIssues();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  async function assignThenMove(key: string) {
    const pending = assignBeforeSprint;
    setAssignBeforeSprint(null);
    if (!pending) return;
    try {
      if (key.startsWith('team:')) await issuesApi.assignTeam(pending.issue.id, key.slice(5));
      else await issuesApi.updateAssignee(pending.issue.id, key.slice(5));
      await issuesApi.moveSprint(pending.issue.id, pending.sprintId);
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
    Alert.alert('Ayı Kapat', 'Bu ayı kapatmak istediğinizden emin misiniz? Tamamlanmamış talepler bekleyen taleplere taşınacak.', [
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
    ]);
  }

  if (projectQuery.isLoading || sprintsQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;
  }

  const boardStatuses = STATUSES.filter((s) => s !== 'Geri Çevrildi');
  const nonCompletedSprints = (sprintsQuery.data || []).filter((s) => s.status !== 'Completed');
  const userName = (uid?: string | null) => (uid ? usersQuery.data?.find((u) => u.id === uid)?.name : undefined);
  const teamName = (tid?: string | null) => (tid ? teamsQuery.data?.find((t) => t.id === tid)?.name : undefined);

  const tabs: [ViewMode, string][] = [
    ['board', 'Aktif'],
    ['backlog', 'Bekleyen'],
    ...(canApprove ? [['approvals', `Onay${pendingApproval.length ? ` (${pendingApproval.length})` : ''}`] as [ViewMode, string]] : []),
    ['sprints', 'Aylar'],
  ];

  function IssueCard({ issue, showSprintAction }: { issue: Issue; showSprintAction?: boolean }) {
    const who = userName(issue.assigneeId) || (teamName(issue.assigneeTeamId) ? `${teamName(issue.assigneeTeamId)} (ekip)` : 'Atanmamış');
    return (
      <TouchableOpacity style={styles.issueCard} onPress={() => router.push(`/(app)/issues/${issue.id}`)} onLongPress={() => openStatusPicker(issue)}>
        <Text style={styles.issueKey}>{issue.key}</Text>
        <Text style={styles.issueTitle} numberOfLines={2}>{issue.title}</Text>
        <View style={styles.issueFooter}>
          <PriorityBadge priority={issue.priority} />
          {issue.isRequest && <StatusBadge status="Talep" />}
          <Text style={styles.assignee} numberOfLines={1}>{who}</Text>
          {showSprintAction && can('issue.sprint') && (
            <TouchableOpacity style={styles.assignChip} onPress={() => setSprintPickerIssue(issue)}>
              <Text style={styles.assignChipText}>Aya Ata</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // "Tüm Aylar" + per-month totals for the Aylar tab
  const sprintCounts = (sprintId?: string) => {
    const list = sprintId ? allIssues.filter((i) => i.sprintId === sprintId) : allIssues.filter((i) => i.sprintId);
    const done = list.filter((i) => i.status === 'Done').length;
    return { total: list.length, done, open: list.length - done };
  };
  const allMonths = sprintCounts();

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: project?.name || 'Müdürlük',
          headerRight: can('project.edit')
            ? () => (
                <TouchableOpacity onPress={() => setEditProjectOpen(true)} style={{ padding: 4 }}>
                  <Ionicons name="create-outline" size={22} color="#0052CC" />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <View style={styles.segmentRow}>
        {tabs.map(([v, label]) => (
          <TouchableOpacity key={v} style={[styles.segment, view === v && styles.segmentActive]} onPress={() => setView(v)}>
            <Text style={[styles.segmentText, view === v && styles.segmentTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {allIssuesQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>
      ) : (
        <>
          {view === 'board' && (
            !activeSprint ? (
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>Aktif ay bulunmuyor</Text>
                <Text style={styles.emptyDesc}>"Aylar" sekmesinden bir ay başlatın.</Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.container}>
                <Text style={styles.pageTitle}>Aktif Talepler</Text>
                <View style={styles.sprintBadge}><Text style={styles.sprintBadgeText}>{activeSprint.name}</Text></View>
                <Text style={styles.hint}>Durumu değiştirmek için karta uzun basın.</Text>
                {boardStatuses.map((status) => {
                  const columnIssues = boardIssues.filter((i) => i.status === status);
                  return (
                    <View key={status} style={styles.column}>
                      <Text style={styles.columnTitle}>{STATUS_LABELS[status]} ({columnIssues.length})</Text>
                      {columnIssues.length === 0 ? <Text style={styles.columnEmpty}>—</Text>
                        : columnIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                    </View>
                  );
                })}
              </ScrollView>
            )
          )}

          {view === 'backlog' && (
            <ScrollView contentContainerStyle={styles.container}>
              <Text style={styles.pageTitle}>Bekleyen Talepler ({backlogIssues.length})</Text>
              {backlogIssues.length === 0 ? <Text style={styles.emptyDesc}>Bekleyen talep yok.</Text>
                : backlogIssues.map((issue) => <IssueCard key={issue.id} issue={issue} showSprintAction />)}
            </ScrollView>
          )}

          {view === 'approvals' && (
            <ScrollView contentContainerStyle={styles.container}>
              <Text style={styles.pageTitle}>Onay Bekleyen Tamamlanmış Talepler</Text>
              <Text style={styles.hint}>Onayladığınızda talep kapanır; reddettiğinizde gerekçenizle Devam Ediyor durumuna döner.</Text>
              {pendingApproval.length === 0 ? <Text style={styles.emptyDesc}>Onay bekleyen talep yok.</Text>
                : pendingApproval.map((issue) => (
                  <ApprovalPanel key={issue.id} issue={issue} users={usersQuery.data} header
                    onOpen={(i) => router.push(`/(app)/issues/${i.id}`)} onChanged={invalidateIssues} />
                ))}
            </ScrollView>
          )}

          {view === 'sprints' && (
            <ScrollView contentContainerStyle={styles.container}>
              <View style={[styles.sprintRow, { backgroundColor: '#EEF4FD' }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sprintName}>Tüm Aylar</Text>
                  <Text style={styles.sprintStatus}>{allMonths.total} talep · {allMonths.done} tamamlandı · {allMonths.open} devam</Text>
                </View>
              </View>
              {(sprintsQuery.data || []).length === 0 ? <Text style={styles.emptyDesc}>Henüz dönem yok.</Text>
                : [...(sprintsQuery.data || [])].reverse().map((sprint) => {
                  const c = sprintCounts(sprint.id);
                  return (
                    <View key={sprint.id} style={styles.sprintRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sprintName}>{sprint.name}</Text>
                        <Text style={styles.sprintStatus}>{SPRINT_STATUS_LABELS[sprint.status]} · {c.total} talep · {c.done} tamamlandı</Text>
                      </View>
                      {can('sprint.manage') && sprint.status === 'Planned' && (
                        <TouchableOpacity style={styles.sprintActionBtn} onPress={() => handleStartSprint(sprint)}>
                          <Text style={styles.sprintActionText}>Başlat</Text>
                        </TouchableOpacity>
                      )}
                      {can('sprint.manage') && sprint.status === 'Active' && (
                        <TouchableOpacity style={[styles.sprintActionBtn, styles.sprintActionDanger]} onPress={() => handleCompleteSprint(sprint)}>
                          <Text style={[styles.sprintActionText, styles.sprintActionDangerText]}>Kapat</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
            </ScrollView>
          )}
        </>
      )}

      {can('issue.create') && (view === 'board' || view === 'backlog') && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}
      {can('sprint.manage') && view === 'sprints' && (
        <TouchableOpacity style={styles.fab} onPress={() => setCreateSprintOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <PickerSheet
        visible={!!statusPickerIssue}
        title="Durum Değiştir"
        options={MANUAL_STATUSES.filter((s) => s !== statusPickerIssue?.status && s !== 'Geri Çevrildi')
          .map((s) => ({ key: s, label: STATUS_LABELS[s], sublabel: s === 'Done' && !canApprove ? 'Yönetici onayına gönderilir' : undefined }))}
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
      <PickerSheet
        visible={!!assignBeforeSprint}
        title="Aktif aya atamadan önce kişi veya ekip seçin"
        options={[
          ...members.map((u) => ({ key: `user:${u.id}`, label: u.name, sublabel: 'Kişi' })),
          ...(teamsQuery.data || []).map((t) => ({ key: `team:${t.id}`, label: t.name, sublabel: `Ekip · ${t.memberIds.length} üye` })),
        ]}
        onSelect={assignThenMove}
        onClose={() => setAssignBeforeSprint(null)}
      />

      <CompleteIssueModal
        visible={!!doneModalIssue}
        issueId={doneModalIssue?.id || null}
        projectId={id}
        hasInventory={project?.hasInventory}
        issue={doneModalIssue}
        projectName={project?.name}
        reporterName={userName(doneModalIssue?.reporterId)}
        onDone={() => { setDoneModalIssue(null); invalidateIssues(); }}
        onCancel={() => setDoneModalIssue(null)}
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
        onCreated={() => { setCreateSprintOpen(false); queryClient.invalidateQueries({ queryKey: ['sprints', id] }); }}
        onCancel={() => setCreateSprintOpen(false)}
      />
      {project && (
        <CreateProjectSheet
          visible={editProjectOpen}
          project={project}
          onCreated={() => {
            setEditProjectOpen(false);
            queryClient.invalidateQueries({ queryKey: ['project', id] });
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }}
          onCancel={() => setEditProjectOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#172B4D', marginBottom: 4 },
  emptyDesc: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 12 },
  container: { padding: 16, paddingBottom: 80 },
  pageTitle: { fontSize: 15, fontWeight: '800', color: '#172B4D', marginBottom: 8 },
  segmentRow: { flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: '#F1F2F4', borderRadius: 8, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  segmentText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  segmentTextActive: { color: '#0052CC', fontWeight: '800' },
  hint: { fontSize: 11, color: '#9CA3AF', marginBottom: 12, fontStyle: 'italic' },
  sprintBadge: { alignSelf: 'flex-start', backgroundColor: '#E3FCEF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8 },
  sprintBadgeText: { color: '#006644', fontSize: 12, fontWeight: '700' },
  column: { marginBottom: 20 },
  columnTitle: { fontSize: 13, fontWeight: '800', color: '#42526E', marginBottom: 8, textTransform: 'uppercase' },
  columnEmpty: { fontSize: 12, color: '#C1C7D0', fontStyle: 'italic', paddingVertical: 8 },
  issueCard: { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  issueKey: { fontSize: 10, color: '#9CA3AF', fontWeight: '600', marginBottom: 2 },
  issueTitle: { fontSize: 13, fontWeight: '600', color: '#172B4D', marginBottom: 8 },
  issueFooter: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  assignee: { flex: 1, fontSize: 11, color: '#6B7280' },
  assignChip: { borderWidth: 1, borderColor: '#0052CC', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  assignChipText: { fontSize: 10, color: '#0052CC', fontWeight: '600' },
  sprintRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 8, padding: 14, marginBottom: 8 },
  sprintName: { fontSize: 14, fontWeight: '700', color: '#172B4D' },
  sprintStatus: { fontSize: 11, color: '#6B7280', marginTop: 2 },
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
