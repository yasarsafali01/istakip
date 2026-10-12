import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Issue, Project, Sprint, Unit, User } from '../../api/types';
import { ROLES, THEME } from '../../utils/constants';
import { inProject } from '../../utils/access';
import { summarize } from '../../utils/reportUtils';
import { formatDuration } from '../../utils/durationUtils';
import {
  Hero, HeroButton, Kpi, KpiGrid, Panel, RequestList, StatusStack, Workload, Meter, IssueKey,
  requestMetrics, attentionOrder, OPEN_STATUSES,
} from '../ui';

/* Sistem Yöneticisi and Personel home pages — same content as the web's StaffHomes. */

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

/* ── Sistem Yöneticisi ─────────────────────────────────────────────────────── */
export function AdminHome({ currentUser, issues, projects, users, units, sprints }: Data) {
  const router = useRouter();
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const requests = issues.filter((i) => i.isRequest);
  const m = requestMetrics(requests);
  const staff = users.filter((u) => u.isActive !== false && u.role !== ROLES.EXTERNAL_USER);
  const activeSprints = sprints.filter((s) => s.status === 'Active').length;
  const openIssue = (id: string) => router.push(`/(app)/issues/${id}`);

  return (
    <>
      <Hero
        name={currentUser.name}
        eyebrow="Sistem Yöneticisi"
        sub="Mersin Üniversitesi · tüm daire başkanlıkları"
        chips={[
          { label: `${units.length} daire başkanlığı`, icon: 'business-outline' },
          { label: `${projects.length} müdürlük`, icon: 'folder-outline' },
          { label: `${staff.length} personel`, icon: 'people-outline' },
          { label: `${m.today.length} talep bugün`, icon: 'mail-unread-outline' },
          ...(activeSprints ? [{ label: `${activeSprints} aktif dönem`, icon: 'calendar-outline' }] : []),
        ]}
        actions={(
          <>
            <HeroButton solid label="İstatistikler" icon="bar-chart-outline" onPress={() => router.push('/(app)/reports')} />
            <HeroButton label="Daire Başkanlıkları" icon="business-outline" onPress={() => router.push('/(app)/units')} />
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

      <Panel title="Daire başkanlıklarının durumu" icon="business-outline" hint="Dokununca müdürlükleri açılır">
        {units.length === 0 ? <Text style={styles.empty}>Henüz daire başkanlığı yok.</Text> : units.map((u) => {
          const pids = new Set(projects.filter((p) => p.unitId === u.id).map((p) => p.id));
          const list = requests.filter((r) => pids.has(r.projectId));
          const pm = requestMetrics(list);
          const sum = summarize(list);
          const rate = sum.completionRate;
          return (
            <TouchableOpacity key={u.id} style={styles.unitRow} onPress={() => router.push(`/(app)/units?unit=${u.id}`)}>
              <View style={styles.unitHead}>
                <IssueKey value={u.unitCode} />
                <Text style={styles.unitName} numberOfLines={1}>{u.name}</Text>
                <Text style={styles.unitRate}>{rate === null ? '—' : `%${Math.round(rate * 100)}`}</Text>
              </View>
              <Meter pct={(rate ?? 0) * 100} />
              <View style={styles.unitStats}>
                <Stat label="Açık" value={pm.open.length} />
                <Stat label="Atanmamış" value={pm.unassigned.length} color={pm.unassigned.length ? THEME.orange : undefined} />
                <Stat label="Onayda" value={pm.pending.length} />
                <Stat label="Süresi aşan" value={pm.breached.length} color={pm.breached.length ? THEME.danger : undefined} />
                <Stat label="Bu ay çözülen" value={pm.resolvedThisMonth.length} />
              </View>
              <Text style={styles.unitAvg}>{pids.size} müdürlük · Ort. çözüm: {formatDuration(sum.avgResolution)}</Text>
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

/* ── Personel ──────────────────────────────────────────────────────────────── */
export function WorkerHome({ currentUser, issues, projects: allProjects, sprints }: Data) {
  const router = useRouter();
  const projects = allProjects.filter((p) => inProject(currentUser, p.id));
  const ids = new Set(projects.map((p) => p.id));
  const byId = projects.length > 1 ? Object.fromEntries(projects.map((p) => [p.id, p])) : {};
  const teams = currentUser.teams || [];
  const teamIds = new Set(teams.map((t) => t.teamId));
  const teamName = (id?: string | null) => teams.find((t) => t.teamId === id)?.teamName || 'Ekip';

  const mine = issues.filter((i) => i.assigneeId === currentUser.id);
  const m = requestMetrics(mine);
  const sum = summarize(mine);
  const teamQueue = issues.filter((i) => !i.assigneeId && !!i.assigneeTeamId && teamIds.has(i.assigneeTeamId) && OPEN_STATUSES.includes(i.status));
  const backlog = mine.filter((i) => !i.isRequest && !i.sprintId && OPEN_STATUSES.includes(i.status));
  const done = mine.filter((i) => i.status === 'Done')
    .sort((a, b) => +new Date(b.resolvedAt || b.updatedAt) - +new Date(a.resolvedAt || a.updatedAt));
  const main = projects[0];
  const activeSprint = sprints.find((s) => s.status === 'Active' && ids.has(s.projectId));
  const openIssue = (id: string) => router.push(`/(app)/issues/${id}`);

  return (
    <>
      <Hero
        name={currentUser.name}
        eyebrow="Personel"
        sub={projects.length ? projects.map((p) => p.name).join(' · ') : 'Henüz bir müdürlüğe bağlı değilsiniz.'}
        chips={[
          { label: `${m.open.length} açık işiniz var`, icon: 'checkbox-outline' },
          ...(teams.length ? [{ label: `${teams.length} ekip`, icon: 'people-outline' }] : []),
          ...(activeSprint ? [{ label: activeSprint.name, icon: 'calendar-outline' }] : []),
        ]}
        actions={main ? (
          <>
            <HeroButton solid label="Aktif Talepler" icon="albums-outline" onPress={() => router.push(`/(app)/projects/${main.id}?tab=board`)} />
            <HeroButton label="Bekleyen Talepler" icon="list-outline" onPress={() => router.push(`/(app)/projects/${main.id}?tab=backlog`)} />
            <HeroButton label="Performansım" icon="bar-chart-outline" onPress={() => router.push('/(app)/performance')} />
          </>
        ) : undefined}
      />

      <KpiGrid>
        <Kpi label="Üzerimdeki açık" value={m.open.length} icon="checkbox-outline" tone="navy" sub="Talepler + iç işler" />
        <Kpi label="Ekibime gelen" value={teamQueue.length} icon="people-outline" tone="orange" sub="Ekibe atanmış, sahipsiz" />
        <Kpi label="Onayda" value={m.pending.length} icon="shield-checkmark-outline" tone="violet" sub="Müdür onayı bekliyor" />
        <Kpi label="Süresi aşan" value={m.breached.length} icon="alarm-outline" tone="danger" sub="Hedef süreyi geçen" />
        <Kpi label="Bu ay çözdüğüm" value={m.resolvedThisMonth.length} icon="checkmark-circle-outline" tone="ok" sub={`Ort. çözüm: ${formatDuration(sum.avgResolution)}`} />
        <Kpi label="Memnuniyet" value={fmtRating(m.avgRating)} icon="star-outline" tone="warn" sub={`${m.ratingCount} değerlendirme · 5 üzerinden`} />
      </KpiGrid>

      <Panel title="Üzerimdeki işler" icon="person-outline" count={m.open.length} hint="Süresi aşan ve dolmak üzere olanlar önce">
        <RequestList issues={attentionOrder(mine)} projectsById={byId} onOpen={openIssue} limit={8}
          empty="Üzerinizde açık iş yok." extra={(i) => (i.isRequest ? undefined : 'İç iş')} />
      </Panel>

      <Panel title="Ekibime gelen talepler" icon="people-outline" iconColor={THEME.orange} count={teamQueue.length} hint="Açıp üzerinize alın">
        <RequestList issues={attentionOrder(teamQueue)} projectsById={byId} onOpen={openIssue}
          empty={teams.length ? 'Ekibinizi bekleyen talep yok.' : 'Herhangi bir ekipte değilsiniz.'}
          extra={(i) => teamName(i.assigneeTeamId)} />
      </Panel>

      <Panel title="İşlerimin durumu" icon="pie-chart-outline" hint={`${mine.length} kayıt`}>
        <StatusStack issues={mine} />
      </Panel>

      <Panel title="Aya atanmamış işlerim" icon="list-outline" count={backlog.length} hint="Bekleyen iç işler">
        <RequestList issues={backlog} projectsById={byId} onOpen={openIssue} empty="Bekleyen işiniz yok." />
      </Panel>

      <Panel title="Son tamamladıklarım" icon="pulse-outline">
        <RequestList issues={done} projectsById={byId} onOpen={openIssue} limit={5} empty="Henüz tamamlanan iş yok." />
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
  unitRow: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  unitHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unitName: { flex: 1, fontSize: 14, fontWeight: '800', color: THEME.ink },
  unitRate: { fontSize: 12, fontWeight: '800', color: THEME.ok },
  unitStats: { flexDirection: 'row', marginTop: 10 },
  unitAvg: { fontSize: 11, color: THEME.muted, marginTop: 6 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800', color: THEME.ink },
  statLabel: { fontSize: 10, color: THEME.muted, marginTop: 1 },
});
