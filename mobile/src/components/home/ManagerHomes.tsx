import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Issue, Project, Sprint, Unit, User } from '../../api/types';
import { usePermissions } from '../../hooks/usePermissions';
import { ROLES, THEME } from '../../utils/constants';
import { inProject } from '../../utils/access';
import { summarize } from '../../utils/reportUtils';
import { formatDuration } from '../../utils/durationUtils';
import {
  Hero, HeroButton, Kpi, KpiGrid, Panel, RequestList, StatusStack, Workload, Meter, IssueKey,
  requestMetrics, attentionOrder, OPEN_STATUSES,
} from '../ui';

const fmtRating = (r: number | null) => (r === null ? '—' : r.toFixed(1).replace('.', ','));
const byNewest = (a: Issue, b: Issue) => +new Date(b.updatedAt || b.createdAt) - +new Date(a.updatedAt || a.createdAt);

interface Data {
  currentUser: User;
  issues: Issue[];
  projects: Project[];
  users: User[];
  units: Unit[];
  sprints: Sprint[];
}

/* ── Daire Başkanı ─────────────────────────────────────────────────────────── */
export function DepartmentHeadHome({ currentUser, issues: allIssues, projects: allProjects, users, units, sprints }: Data) {
  const router = useRouter();
  const unit = units.find((u) => u.id === currentUser.unitId);
  const projects = useMemo(() => allProjects.filter((p) => p.unitId === currentUser.unitId), [allProjects, currentUser.unitId]);
  const ids = new Set(projects.map((p) => p.id));
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const issues = allIssues.filter((i) => ids.has(i.projectId));
  const requests = issues.filter((i) => i.isRequest);
  const m = requestMetrics(requests);
  const staff = users.filter((u) => u.isActive !== false && u.unitId === currentUser.unitId && u.role !== ROLES.EXTERNAL_USER);
  const activeSprints = sprints.filter((s) => s.status === 'Active' && ids.has(s.projectId)).length;
  const openIssue = (id: string) => router.push(`/(app)/issues/${id}`);

  return (
    <>
      <Hero
        name={currentUser.name}
        eyebrow="Daire Başkanı"
        sub={unit?.name}
        chips={[
          { label: `${projects.length} müdürlük`, icon: 'business-outline' },
          { label: `${staff.length} personel`, icon: 'people-outline' },
          { label: `${m.today.length} talep bugün`, icon: 'mail-unread-outline' },
          ...(activeSprints ? [{ label: `${activeSprints} aktif dönem`, icon: 'calendar-outline' }] : []),
        ]}
        actions={(
          <>
            <HeroButton solid label="İstatistikler" icon="bar-chart-outline" onPress={() => router.push('/(app)/reports')} />
            <HeroButton label="Kullanıcılar" icon="people-outline" onPress={() => router.push('/(app)/users')} />
          </>
        )}
      />

      <KpiGrid>
        <Kpi label="Açık talep" value={m.open.length} icon="file-tray-outline" tone="navy" sub="Yapılacak + devam eden + onayda" />
        <Kpi label="Atanmamış" value={m.unassigned.length} icon="help-circle-outline" tone="orange" sub="Kimseye verilmemiş" />
        <Kpi label="Onay bekleyen" value={m.pending.length} icon="shield-checkmark-outline" tone="violet" sub="Müdür onayında" />
        <Kpi label="Süresi aşan" value={m.breached.length} icon="alarm-outline" tone="danger" sub="Hedef süreyi geçen" />
        <Kpi label="Bu ay çözülen" value={m.resolvedThisMonth.length} icon="checkmark-circle-outline" tone="ok" sub={`Toplam ${requests.length} talepten`} />
        <Kpi label="Memnuniyet" value={fmtRating(m.avgRating)} icon="star-outline" tone="warn" sub={`${m.ratingCount} değerlendirme · 5 üzerinden`} />
      </KpiGrid>

      <Panel title="Müdürlüklerin durumu" icon="business-outline" hint="Dokununca müdürlük açılır">
        {projects.length === 0 ? <Text style={styles.empty}>Daire başkanlığınızda müdürlük yok.</Text> : projects.map((p) => {
          const list = requests.filter((r) => r.projectId === p.id);
          const pm = requestMetrics(list);
          const sum = summarize(list);
          const rate = sum.completionRate;
          return (
            <TouchableOpacity key={p.id} style={styles.projectRow} onPress={() => router.push(`/(app)/projects/${p.id}?tab=board`)}>
              <View style={styles.projectHead}>
                <IssueKey value={p.key} />
                <Text style={styles.projectName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.projectRate}>{rate === null ? '—' : `%${Math.round(rate * 100)}`}</Text>
              </View>
              <Meter pct={(rate ?? 0) * 100} />
              <View style={styles.projectStats}>
                <Stat label="Açık" value={pm.open.length} />
                <Stat label="Atanmamış" value={pm.unassigned.length} color={pm.unassigned.length ? THEME.orange : undefined} />
                <Stat label="Onayda" value={pm.pending.length} />
                <Stat label="Süresi aşan" value={pm.breached.length} color={pm.breached.length ? THEME.danger : undefined} />
                <Stat label="Bu ay çözülen" value={pm.resolvedThisMonth.length} />
              </View>
              <Text style={styles.projectAvg}>Ort. çözüm: {formatDuration(sum.avgResolution)}</Text>
            </TouchableOpacity>
          );
        })}
      </Panel>

      <Panel title="Talep durumları" icon="pie-chart-outline" hint={`${requests.length} talep`}>
        <StatusStack issues={requests} />
      </Panel>

      <Panel title="Dikkat gerektiren talepler" icon="warning-outline" iconColor={THEME.danger} count={m.atRisk.length}
        hint="Süresi aşan ve dolmak üzere olanlar önce">
        <RequestList issues={attentionOrder(requests)} projectsById={byId} onOpen={openIssue} empty="Açık talep yok, her şey yolunda." />
      </Panel>

      <Panel title="Personel iş yükü" icon="people-outline" hint="Üzerindeki açık işler">
        <Workload issues={issues} users={users} onPerson={(id) => router.push(`/(app)/personnel/${id}`)} />
      </Panel>

      <Panel title="Son hareketler" icon="pulse-outline" hint="En son güncellenen talepler">
        <RequestList issues={[...requests].sort(byNewest)} projectsById={byId} onOpen={openIssue} empty="Henüz talep yok." />
      </Panel>
    </>
  );
}

/* ── Müdür ─────────────────────────────────────────────────────────────────── */
export function ProjectManagerHome({ currentUser, issues: allIssues, projects: allProjects, users, sprints }: Data) {
  const router = useRouter();
  const { can } = usePermissions();
  const projects = allProjects.filter((p) => p.managerId === currentUser.id);
  const ids = new Set(projects.map((p) => p.id));
  const byId = projects.length > 1 ? Object.fromEntries(projects.map((p) => [p.id, p])) : {};
  const issues = allIssues.filter((i) => ids.has(i.projectId));
  const requests = issues.filter((i) => i.isRequest);
  const m = requestMetrics(requests);
  const sum = summarize(requests);
  const main = projects[0];
  const activeSprint = sprints.find((s) => s.status === 'Active' && ids.has(s.projectId));
  const staff = users.filter((u) => u.isActive !== false && projects.some((p) => inProject(u, p.id)));
  const openTasks = issues.filter((i) => !i.isRequest && OPEN_STATUSES.includes(i.status)).length;
  const approvalsProject = projects.find((p) => m.pending.some((r) => r.projectId === p.id)) || main;
  const openIssue = (id: string) => router.push(`/(app)/issues/${id}`);

  if (!main) return <Hero name={currentUser.name} eyebrow="Müdür" sub="Henüz yönettiğiniz bir müdürlük yok." />;

  return (
    <>
      <Hero
        name={currentUser.name}
        eyebrow="Müdür"
        sub={projects.map((p) => p.name).join(' · ')}
        chips={[
          { label: `${staff.length} personel`, icon: 'people-outline' },
          { label: `${m.today.length} talep bugün`, icon: 'mail-unread-outline' },
          { label: `${openTasks} açık iç iş`, icon: 'albums-outline' },
          ...(activeSprint ? [{ label: activeSprint.name, icon: 'calendar-outline' }] : []),
        ]}
        actions={(
          <>
            <HeroButton solid label="Aktif Talepler" icon="albums-outline" onPress={() => router.push(`/(app)/projects/${main.id}?tab=board`)} />
            {can('request_form.manage') && (
              <HeroButton label="Talep Formları" icon="document-text-outline" onPress={() => router.push(`/(app)/forms?project=${main.id}`)} />
            )}
          </>
        )}
      />

      <KpiGrid>
        <Kpi label="Açık talep" value={m.open.length} icon="file-tray-outline" tone="navy" sub="Yapılacak + devam eden + onayda" />
        <Kpi label="Atanmamış" value={m.unassigned.length} icon="help-circle-outline" tone="orange" sub="Atanmayı bekliyor" />
        <Kpi label="Onayınızı bekleyen" value={m.pending.length} icon="shield-checkmark-outline" tone="violet" sub="Dokunun: onay ekranı"
          onPress={() => router.push(`/(app)/projects/${approvalsProject.id}?tab=approvals`)} />
        <Kpi label="Süresi aşan" value={m.breached.length} icon="alarm-outline" tone="danger" sub="Hedef süreyi geçen" />
        <Kpi label="Bu ay çözülen" value={m.resolvedThisMonth.length} icon="checkmark-circle-outline" tone="ok" sub={`Memnuniyet: ${fmtRating(m.avgRating)} / 5`} />
        <Kpi label="Ort. çözüm süresi" value={formatDuration(sum.avgResolution)} icon="time-outline" tone="warn" sub="İşleme alındıktan çözülene" />
      </KpiGrid>

      <Panel title="Onayınızı bekleyenler" icon="shield-checkmark-outline" iconColor={THEME.violet} count={m.pending.length}
        hint="Açıp onaylayın ya da geri gönderin">
        <RequestList issues={[...m.pending].sort(byNewest)} projectsById={byId} onOpen={openIssue} empty="Onay bekleyen iş yok." />
      </Panel>

      <Panel title="Atanmamış talepler" icon="help-circle-outline" iconColor={THEME.orange} count={m.unassigned.length}
        hint="Açıp bir kişiye ya da ekibe atayın">
        <RequestList issues={attentionOrder(m.unassigned)} projectsById={byId} onOpen={openIssue} empty="Atanmamış talep yok." />
      </Panel>

      <Panel title="Süresi dolmak üzere olanlar" icon="alarm-outline" iconColor={THEME.danger} count={m.atRisk.length}
        hint="Süresi aşan ve dolmak üzere olanlar önce">
        <RequestList issues={attentionOrder(requests)} projectsById={byId} onOpen={openIssue} empty="Açık talep yok, her şey yolunda."
          extra={(r) => (r.assigneeId ? users.find((u) => u.id === r.assigneeId)?.name : r.assigneeTeamId ? 'Ekibe atandı' : 'Atanmamış')} />
      </Panel>

      <Panel title="Ekip iş yükü" icon="people-outline" hint="Üzerindeki açık işler">
        <Workload issues={issues} users={users} onPerson={(id) => router.push(`/(app)/personnel/${id}`)} />
      </Panel>

      <Panel title="Talep durumları" icon="pie-chart-outline" hint={`${requests.length} talep`}>
        <StatusStack issues={requests} />
      </Panel>

      <Panel title="Son hareketler" icon="pulse-outline" hint="En son güncellenen talepler">
        <RequestList issues={[...requests].sort(byNewest)} projectsById={byId} onOpen={openIssue} limit={5} empty="Henüz talep yok." />
      </Panel>
    </>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, color ? { color } : null]}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: THEME.muted, textAlign: 'center', paddingVertical: 16 },
  projectRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  projectHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projectName: { flex: 1, fontSize: 14, fontWeight: '800', color: THEME.ink },
  projectRate: { fontSize: 12, fontWeight: '800', color: THEME.ok },
  projectStats: { flexDirection: 'row', marginTop: 10 },
  projectAvg: { fontSize: 11, color: THEME.muted, marginTop: 6 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  statLabel: { fontSize: 10, color: THEME.muted, marginTop: 1 },
});
