import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, sprintsApi, issuesApi, usersApi, teamsApi } from '../../../../src/api/resources';
import PickerSheet from '../../../../src/components/PickerSheet';
import CompleteIssueModal from '../../../../src/components/CompleteIssueModal';
import CreateIssueSheet from '../../../../src/components/CreateIssueSheet';
import CreateSprintSheet from '../../../../src/components/CreateSprintSheet';
import CreateProjectSheet from '../../../../src/components/CreateProjectSheet';
import ApprovalPanel from '../../../../src/components/ApprovalPanel';
import Avatar from '../../../../src/components/Avatar';
import { Kpi, KpiGrid, Panel, IssueKey, SlaPill, Pill, Dot, Meter, Empty, ui } from '../../../../src/components/ui';
import { usePermissions } from '../../../../src/hooks/usePermissions';
import {
  STATUSES, MANUAL_STATUSES, STATUS_LABELS, STATUS_COLORS, PRIORITIES, PRIORITY_LABELS, PRIORITY_COLORS, ROLES, THEME,
} from '../../../../src/utils/constants';
import { inProject, timeAgo } from '../../../../src/utils/access';
import type { Issue, Sprint } from '../../../../src/api/types';

type ViewMode = 'board' | 'backlog' | 'approvals' | 'sprints';
const SPRINT_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  Planned: { label: 'Planlandı', bg: '#f1f5f9', fg: '#475569' },
  Active: { label: 'Aktif', bg: THEME.okSoft, fg: THEME.ok },
  Completed: { label: 'Kapalı', bg: THEME.navySoft, fg: THEME.navy },
};
const columnColor = (s: string) => (STATUS_COLORS[s] === '#DFE1E6' ? '#94a3b8' : STATUS_COLORS[s]);

export default function ProjectDetailScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, isWorker } = usePermissions();
  const canApprove = can('issue.approve');

  const [view, setView] = useState<ViewMode>((tab as ViewMode) || 'board');
  useEffect(() => { if (tab) setView(tab as ViewMode); }, [tab]);
  const [statusPickerIssue, setStatusPickerIssue] = useState<Issue | null>(null);
  const [sprintPickerIssue, setSprintPickerIssue] = useState<Issue | null>(null);
  // Unassigned issue going to the active month: pick a person or team first (as on the web)
  const [assignBeforeSprint, setAssignBeforeSprint] = useState<{ issue: Issue; sprintId: string } | null>(null);
  const [doneModalIssue, setDoneModalIssue] = useState<Issue | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

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
  const users = usersQuery.data || [];
  // Personnel of this müdürlük (a person may serve in several) and its manager.
  const members = users.filter((u) => u.isActive !== false && u.role !== ROLES.EXTERNAL_USER && (inProject(u, id) || project?.managerId === u.id));

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
    // Decided by the backend (pending approval, rejected, scope...)
    if (!issue.allowedActions?.changeStatus) {
      if (issue.status === 'Onay Bekliyor') Alert.alert('Onay bekliyor', 'Onay bekleyen talebin durumunu yalnızca yönetici değiştirebilir.');
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
    return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;
  }

  const boardStatuses = STATUSES.filter((s) => s !== 'Geri Çevrildi');
  const nonCompletedSprints = (sprintsQuery.data || []).filter((s) => s.status !== 'Completed');
  const teams = teamsQuery.data || [];

  const tabs: [ViewMode, string, number?][] = [
    ['board', 'Aktif'],
    ['backlog', 'Bekleyen', backlogIssues.length],
    ...(canApprove ? [['approvals', 'Onay', pendingApproval.length] as [ViewMode, string, number]] : []),
    ['sprints', 'Aylar'],
  ];

  function IssueCard({ issue, showSprintAction }: { issue: Issue; showSprintAction?: boolean }) {
    const assignee = users.find((u) => u.id === issue.assigneeId);
    const team = teams.find((t) => t.id === issue.assigneeTeamId);
    return (
      <TouchableOpacity style={styles.card} onPress={() => router.push(`/(app)/issues/${issue.id}`)} onLongPress={() => openStatusPicker(issue)}>
        <View style={styles.cardTop}>
          <IssueKey value={issue.key} />
          <SlaPill issue={issue} />
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{issue.title}</Text>
        <View style={styles.cardFoot}>
          <View style={styles.inline}>
            <Dot color={PRIORITY_COLORS[issue.priority]} />
            <Text style={styles.small}>{PRIORITY_LABELS[issue.priority]}</Text>
            {issue.requestFormName ? <Pill label={issue.requestFormName} bg={THEME.navySoft} color={THEME.navy} />
              : !issue.isRequest ? <Pill label="İç iş" bg="#f1f5f9" color="#475569" /> : <Text style={styles.small}>· {timeAgo(issue.createdAt)}</Text>}
          </View>
          {assignee ? <Avatar name={assignee.name} color={assignee.avatarColor} size={24} />
            : team ? <View style={styles.teamIcon}><Ionicons name="people" size={13} color={THEME.navy} /></View>
              : <Pill label="Atanmamış" bg={THEME.orangeSoft} color={THEME.orange} />}
        </View>
        {showSprintAction && issue.allowedActions?.moveSprint && (activeSprint || nonCompletedSprints.length > 0) && (
          <TouchableOpacity style={styles.assignChip}
            onPress={() => (activeSprint ? applySprintAssign(issue, activeSprint.id) : setSprintPickerIssue(issue))}
            onLongPress={() => setSprintPickerIssue(issue)}>
            <Ionicons name="add" size={14} color={THEME.navy} />
            <Text style={styles.assignChipText}>{activeSprint ? 'Aktif aya ata' : 'Bir aya ata'}</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  // ── Board numbers ──
  const total = boardIssues.length;
  const done = boardIssues.filter((i) => i.status === 'Done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  // ── Backlog filters ──
  const priorityCount = (p: string) => backlogIssues.filter((i) => i.priority === p).length;
  const filteredBacklog = backlogIssues
    .filter((i) => !priorityFilter || i.priority === priorityFilter)
    .filter((i) => !assigneeFilter || i.assigneeId === assigneeFilter)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  // ── Months ──
  const sprintCounts = (sprintId?: string) => {
    const list = sprintId ? allIssues.filter((i) => i.sprintId === sprintId) : allIssues.filter((i) => i.sprintId);
    const d = list.filter((i) => i.status === 'Done').length;
    return { list, total: list.length, done: d, open: list.length - d };
  };
  const pickedSprintId = selectedSprintId || activeSprint?.id || null;
  const pickedPeople = (() => {
    const list = sprintCounts(pickedSprintId || undefined).list;
    const ids = [...new Set(list.map((i) => i.assigneeId).filter(Boolean))] as string[];
    return ids.map((uid) => {
      const mine = list.filter((i) => i.assigneeId === uid);
      return { user: users.find((u) => u.id === uid), total: mine.length, done: mine.filter((i) => i.status === 'Done').length };
    }).filter((x) => x.user);
  })();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: project?.name || 'Müdürlük',
          headerRight: can('project.edit') && !isWorker
            ? () => (
                <TouchableOpacity onPress={() => setEditProjectOpen(true)} style={{ padding: 4 }}>
                  <Ionicons name="settings-outline" size={22} color={THEME.navy} />
                </TouchableOpacity>
              )
            : undefined,
        }}
      />

      <View style={styles.tabs}>
        {tabs.map(([v, label, count]) => (
          <TouchableOpacity key={v} style={[styles.tab, view === v && styles.tabOn]} onPress={() => setView(v)}>
            <Text style={[styles.tabText, view === v && styles.tabTextOn]}>{label}</Text>
            {count ? (
              <View style={[styles.tabCount, v === 'approvals' && { backgroundColor: THEME.violetSoft }]}>
                <Text style={[styles.tabCountText, v === 'approvals' && { color: THEME.violet }]}>{count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {allIssuesQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>
      ) : (
        <ScrollView contentContainerStyle={[ui.screen, { paddingBottom: 90 }]}
          refreshControl={<RefreshControl refreshing={allIssuesQuery.isFetching} onRefresh={() => { allIssuesQuery.refetch(); sprintsQuery.refetch(); }} />}>
          {view === 'board' && (
            !activeSprint ? (
              <View style={styles.emptyBox}>
                <Ionicons name="calendar-outline" size={32} color="#94a3b8" />
                <Text style={styles.emptyTitle}>Aktif ay bulunmuyor</Text>
                <Text style={styles.emptyDesc}>"Aylar" sekmesinden bir ay başlatın.</Text>
              </View>
            ) : (
              <>
                <KpiGrid>
                  <Kpi label="Toplam iş" value={total} icon="clipboard-outline" tone="navy" sub={activeSprint.name} />
                  <Kpi label="Yapılacak" value={boardIssues.filter((i) => i.status === 'To Do').length} icon="hourglass-outline" tone="orange" sub="Henüz başlanmadı" />
                  <Kpi label="Devam eden" value={boardIssues.filter((i) => i.status === 'In Progress').length} icon="sync-outline" tone="violet" sub="Üzerinde çalışılıyor" />
                  <Kpi label="Tamamlanan" value={done} icon="checkmark-circle-outline" tone="ok" sub={total ? `%${pct} tamamlandı` : 'Kayıt yok'} />
                </KpiGrid>
                <View style={[ui.card, styles.periodBar]}>
                  <Ionicons name="calendar-outline" size={17} color={THEME.navy} />
                  <Pill label={activeSprint.name} bg={THEME.okSoft} color={THEME.ok} />
                  <View style={{ flex: 1 }}><Meter pct={pct} /></View>
                  <Text style={styles.pct}>%{pct}</Text>
                </View>
                <Text style={styles.hint}>Durumu değiştirmek için karta uzun basın.</Text>
                {boardStatuses.map((status) => {
                  const columnIssues = boardIssues.filter((i) => i.status === status);
                  return (
                    <View key={status} style={styles.column}>
                      <View style={styles.columnHead}>
                        <Dot color={columnColor(status)} size={9} />
                        <Text style={styles.columnTitle}>{STATUS_LABELS[status]}</Text>
                        <View style={styles.tabCount}><Text style={styles.tabCountText}>{columnIssues.length}</Text></View>
                      </View>
                      {columnIssues.length === 0 ? <Text style={styles.columnEmpty}>Kayıt yok</Text>
                        : columnIssues.map((issue) => <IssueCard key={issue.id} issue={issue} />)}
                    </View>
                  );
                })}
              </>
            )
          )}

          {view === 'backlog' && (
            <>
              <KpiGrid>
                <Kpi label="Bekleyen" value={backlogIssues.length} icon="alert-circle-outline" tone="navy"
                  sub={`${backlogIssues.filter((i) => !i.assigneeId && !i.assigneeTeamId).length} tanesi atanmamış`} />
                {[...PRIORITIES].reverse().map((p) => {
                  const tone = ({ High: 'danger', Medium: 'warn', Low: 'navy' } as const)[p];
                  const on = priorityFilter === p;
                  return (
                    <Kpi key={p} label={`${PRIORITY_LABELS[p]} öncelik`} value={priorityCount(p)} icon="flag-outline" tone={tone} active={on}
                      sub={on ? 'Süzülüyor · kaldırmak için dokunun' : 'Dokunun: listeyi süz'} onPress={() => setPriorityFilter(on ? '' : p)} />
                  );
                })}
              </KpiGrid>
              <View style={styles.filterRow}>
                <TouchableOpacity style={[ui.chip, assigneeFilter && ui.chipOn, styles.inline]} onPress={() => setAssigneePickerOpen(true)}>
                  <Ionicons name="person-outline" size={14} color={assigneeFilter ? THEME.navy : '#475569'} />
                  <Text style={[ui.chipText, assigneeFilter && ui.chipTextOn]}>{assigneeFilter ? users.find((u) => u.id === assigneeFilter)?.name : 'Atanan'}</Text>
                </TouchableOpacity>
                {(priorityFilter || assigneeFilter) ? (
                  <TouchableOpacity onPress={() => { setPriorityFilter(''); setAssigneeFilter(''); }}>
                    <Text style={styles.clear}>Temizle</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Panel title="Bekleyen talepler" icon="list-outline" count={filteredBacklog.length}>
                {filteredBacklog.length === 0 ? <Empty text={priorityFilter ? `${PRIORITY_LABELS[priorityFilter]} öncelikli bekleyen talep yok.` : 'Bekleyen talep yok.'} />
                  : filteredBacklog.map((issue) => <IssueCard key={issue.id} issue={issue} showSprintAction />)}
              </Panel>
            </>
          )}

          {view === 'approvals' && (
            <>
              <Text style={styles.hint}>Onayladığınızda talep kapanır; reddettiğinizde gerekçenizle Devam Ediyor durumuna döner.</Text>
              {pendingApproval.length === 0 ? <Empty text="Onay bekleyen talep yok." />
                : pendingApproval.map((issue) => (
                  <ApprovalPanel key={issue.id} issue={issue} users={users} header
                    onOpen={(i) => router.push(`/(app)/issues/${i.id}`)} onChanged={invalidateIssues} />
                ))}
            </>
          )}

          {view === 'sprints' && (
            <>
              {(sprintsQuery.data || []).length === 0 ? <Empty text="Henüz dönem yok." />
                : [...(sprintsQuery.data || [])].reverse().map((sprint) => {
                  const c = sprintCounts(sprint.id);
                  const st = SPRINT_STATUS[sprint.status];
                  const p = c.total ? Math.round((c.done / c.total) * 100) : 0;
                  const picked = pickedSprintId === sprint.id;
                  return (
                    <TouchableOpacity key={sprint.id} style={[ui.card, styles.sprintRow, picked && { borderColor: THEME.navy }]} onPress={() => setSelectedSprintId(sprint.id)}>
                      <View style={styles.inline}>
                        <Text style={styles.sprintName}>{sprint.name}</Text>
                        <Pill label={st.label} bg={st.bg} color={st.fg} />
                        <View style={{ flex: 1 }} />
                        {can('sprint.manage') && sprint.status === 'Planned' && (
                          <TouchableOpacity style={[styles.sprintBtn, { backgroundColor: THEME.ok }]} onPress={() => handleStartSprint(sprint)}>
                            <Text style={styles.sprintBtnText}>Başlat</Text>
                          </TouchableOpacity>
                        )}
                        {can('sprint.manage') && sprint.status === 'Active' && (
                          <TouchableOpacity style={[styles.sprintBtn, { backgroundColor: THEME.dangerSoft }]} onPress={() => handleCompleteSprint(sprint)}>
                            <Text style={[styles.sprintBtnText, { color: THEME.danger }]}>Kapat</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={[styles.inline, { marginTop: 8 }]}>
                        <View style={{ flex: 1 }}><Meter pct={p} /></View>
                        <Text style={styles.small}>{c.done}/{c.total} · %{p}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              {pickedSprintId && (
                <Panel title={`${sprintsQuery.data?.find((s) => s.id === pickedSprintId)?.name || ''} — personel ve işler`} icon="people-outline"
                  hint={`${members.length} personel`}>
                  {pickedPeople.length === 0 ? <Empty text="Bu ayda atanmış iş yok." /> : pickedPeople.map(({ user, total: t, done: d }) => (
                    <TouchableOpacity key={user!.id} style={styles.personRow} onPress={() => router.push(`/(app)/personnel/${user!.id}`)}>
                      <Avatar name={user!.name} color={user!.avatarColor} size={32} />
                      <View style={{ flex: 1 }}>
                        <View style={styles.inline}>
                          <Text style={[styles.sprintName, { flex: 1, fontSize: 14 }]} numberOfLines={1}>{user!.name}</Text>
                          <Text style={styles.small}>{d}/{t}</Text>
                        </View>
                        <Meter pct={t ? (d / t) * 100 : 0} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </Panel>
              )}
            </>
          )}
        </ScrollView>
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
          ...teams.map((t) => ({ key: `team:${t.id}`, label: t.name, sublabel: `Ekip · ${t.memberIds.length} üye` })),
        ]}
        onSelect={assignThenMove}
        onClose={() => setAssignBeforeSprint(null)}
      />
      <PickerSheet
        visible={assigneePickerOpen}
        title="Atanan kişiye göre süz"
        options={[{ key: '', label: 'Tüm kişiler' }, ...members.map((u) => ({ key: u.id, label: u.name }))]}
        onSelect={(key) => { setAssigneeFilter(key); setAssigneePickerOpen(false); }}
        onClose={() => setAssigneePickerOpen(false)}
      />

      <CompleteIssueModal
        visible={!!doneModalIssue}
        issueId={doneModalIssue?.id || null}
        projectId={id}
        hasInventory={project?.hasInventory}
        issue={doneModalIssue}
        projectName={project?.name}
        reporterName={users.find((u) => u.id === doneModalIssue?.reporterId)?.name}
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
  emptyBox: { alignItems: 'center', paddingVertical: 50, gap: 6 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  emptyDesc: { fontSize: 13, color: THEME.muted, textAlign: 'center' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: '#e8edf3', borderRadius: 12, padding: 4, gap: 4 },
  tab: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5, paddingVertical: 8, borderRadius: 9 },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, color: THEME.muted, fontWeight: '700' },
  tabTextOn: { color: THEME.navy, fontWeight: '800' },
  tabCount: { minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: THEME.navySoft, alignItems: 'center', justifyContent: 'center' },
  tabCountText: { fontSize: 11, fontWeight: '800', color: THEME.navy },
  hint: { fontSize: 12, color: THEME.muted, marginBottom: 12 },
  periodBar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingVertical: 10 },
  pct: { fontSize: 12, fontWeight: '800', color: THEME.ok },
  column: { backgroundColor: '#eef1f6', borderRadius: 14, padding: 10, marginBottom: 14 },
  columnHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 4 },
  columnTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: THEME.ink },
  columnEmpty: { fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#d5dce6', borderRadius: 10 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e6eaf0', borderRadius: 12, padding: 12, marginBottom: 8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: THEME.ink, marginBottom: 8, lineHeight: 19 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  small: { fontSize: 11, color: THEME.muted },
  teamIcon: { width: 24, height: 24, borderRadius: 8, backgroundColor: THEME.navySoft, alignItems: 'center', justifyContent: 'center' },
  assignChip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 10, borderWidth: 1, borderColor: THEME.navy, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  assignChipText: { fontSize: 12, color: THEME.navy, fontWeight: '700' },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  clear: { fontSize: 13, color: THEME.danger, fontWeight: '700' },
  sprintRow: { marginBottom: 10 },
  sprintName: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  sprintBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  sprintBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 54, height: 54, borderRadius: 27,
    backgroundColor: THEME.navy, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
});
