import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { STATUS_COLORS, STATUS_LABELS, PRIORITY_COLORS, PRIORITY_LABELS, THEME } from '../utils/constants';
import { getSlaInfo, SLA_RISK_COLORS } from '../utils/slaUtils';
import { timeAgo } from '../utils/access';
import type { Issue, User } from '../api/types';
import Avatar from './Avatar';

/* Mobile counterpart of the web's DashboardKit (styles/dashboard.css): the same
   navy/orange hero, KPI tiles, panels and request rows. */

type Tone = 'navy' | 'orange' | 'ok' | 'warn' | 'danger' | 'violet';
const TONES: Record<Tone, [string, string]> = {
  navy: [THEME.navySoft, THEME.navy],
  orange: [THEME.orangeSoft, THEME.orange],
  ok: [THEME.okSoft, THEME.ok],
  warn: [THEME.warnSoft, THEME.warn],
  danger: [THEME.dangerSoft, THEME.danger],
  violet: [THEME.violetSoft, THEME.violet],
};

export const OPEN_STATUSES = ['To Do', 'In Progress', 'Onay Bekliyor'];
const isOpen = (i: Issue) => OPEN_STATUSES.includes(i.status);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

export function Hero({ name, eyebrow, sub, chips = [], actions }: {
  name: string; eyebrow: string; sub?: string; chips?: { label: string; icon?: any }[]; actions?: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <Text style={styles.heroEyebrow}>{eyebrow} · {today}</Text>
      <Text style={styles.heroTitle}>{greeting()}, {name}</Text>
      {sub ? <Text style={styles.heroSub}>{sub}</Text> : null}
      {chips.length > 0 && (
        <View style={styles.heroChips}>
          {chips.map((c) => (
            <View key={c.label} style={styles.heroChip}>
              {c.icon ? <Ionicons name={c.icon} size={13} color="#fff" /> : null}
              <Text style={styles.heroChipText}>{c.label}</Text>
            </View>
          ))}
        </View>
      )}
      {actions ? <View style={styles.heroActions}>{actions}</View> : null}
    </View>
  );
}

export function HeroButton({ label, icon, onPress, solid }: { label: string; icon?: any; onPress: () => void; solid?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.heroBtn, solid ? styles.heroBtnSolid : styles.heroBtnGhost]}>
      {icon ? <Ionicons name={icon} size={16} color={solid ? THEME.navy : '#fff'} /> : null}
      <Text style={[styles.heroBtnText, { color: solid ? THEME.navy : '#fff' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Kpi({ label, value, sub, icon, tone = 'navy', onPress, active }: {
  label: string; value: string | number; sub?: string; icon: any; tone?: Tone; onPress?: () => void; active?: boolean;
}) {
  const [bg, fg] = TONES[tone];
  const Wrap: any = onPress ? TouchableOpacity : View;
  return (
    <Wrap onPress={onPress} style={[styles.kpi, active && { borderColor: THEME.navy, borderWidth: 2 }]}>
      <View style={styles.kpiHead}>
        <Text style={styles.kpiLabel} numberOfLines={1}>{label}</Text>
        <View style={[styles.kpiIcon, { backgroundColor: bg }]}><Ionicons name={icon} size={15} color={fg} /></View>
      </View>
      <Text style={[styles.kpiValue, tone === 'danger' && Number(value) > 0 && { color: THEME.danger }]}>{value}</Text>
      {sub ? <Text style={styles.kpiSub} numberOfLines={2}>{sub}</Text> : null}
    </Wrap>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.kpiGrid}>{children}</View>;
}

export function Panel({ title, icon, iconColor = THEME.brand, count, hint, right, children, style }: {
  title: string; icon?: any; iconColor?: string; count?: number; hint?: string; right?: React.ReactNode;
  children: React.ReactNode; style?: ViewStyle;
}) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.panelHead}>
        {icon ? <Ionicons name={icon} size={17} color={iconColor} /> : null}
        <Text style={styles.panelTitle} numberOfLines={1}>{title}</Text>
        {count !== undefined ? <View style={styles.count}><Text style={styles.countText}>{count}</Text></View> : null}
        <View style={{ flex: 1 }} />
        {right}
      </View>
      {hint ? <Text style={styles.panelHint}>{hint}</Text> : null}
      <View style={{ marginTop: 6 }}>{children}</View>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Pill({ label, bg, color, icon }: { label: string; bg: string; color: string; icon?: any }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={11} color={color} /> : null}
      <Text style={[styles.pillText, { color }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function SlaPill({ issue }: { issue: Issue }) {
  const sla = getSlaInfo(issue);
  if (!sla || sla.risk === 'done') return null;
  const c = (SLA_RISK_COLORS as any)[sla.risk];
  return <Pill label={sla.label} bg={c.bg} color={c.text} />;
}

export function Meter({ pct, color = THEME.ok }: { pct: number; color?: string }) {
  return (
    <View style={styles.meter}><View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} /></View>
  );
}

export function IssueKey({ value }: { value: string | number }) {
  return <View style={styles.key}><Text style={styles.keyText}>{value}</Text></View>;
}

/** One request in a list: status bar, title, number · müdürlük · age, SLA and priority. */
export function RequestRow({ issue, projectName, onPress, extra }: { issue: Issue; projectName?: string; onPress: () => void; extra?: string }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowBar, { backgroundColor: STATUS_COLORS[issue.status] === '#DFE1E6' ? '#94a3b8' : STATUS_COLORS[issue.status] }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{issue.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {issue.key}{projectName ? ` · ${projectName}` : ''} · {timeAgo(issue.createdAt)}{extra ? ` · ${extra}` : ''}
        </Text>
        <View style={styles.rowPills}>
          <Dot color={PRIORITY_COLORS[issue.priority]} />
          <Text style={styles.rowSmall}>{PRIORITY_LABELS[issue.priority]} · {STATUS_LABELS[issue.status]}</Text>
          <SlaPill issue={issue} />
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
    </TouchableOpacity>
  );
}

export function RequestList({ issues, projectsById, onOpen, empty, limit = 6, extra }: {
  issues: Issue[]; projectsById: Record<string, { name: string }>; onOpen: (id: string) => void; empty: string; limit?: number;
  extra?: (i: Issue) => string | undefined;
}) {
  if (issues.length === 0) return <Empty text={empty} />;
  return (
    <>
      {issues.slice(0, limit).map((i) => (
        <RequestRow key={i.id} issue={i} projectName={projectsById[i.projectId]?.name} onPress={() => onOpen(i.id)} extra={extra?.(i)} />
      ))}
    </>
  );
}

const STACK_ORDER = ['To Do', 'In Progress', 'Onay Bekliyor', 'Done', 'Geri Çevrildi', 'Yönlendirildi', 'İptal Edildi'];
const stackColor = (s: string) => (STATUS_COLORS[s] === '#DFE1E6' ? '#94a3b8' : STATUS_COLORS[s]);

export function StatusStack({ issues }: { issues: Issue[] }) {
  const counts = STACK_ORDER.map((s) => [s, issues.filter((i) => i.status === s).length] as const).filter(([, n]) => n > 0);
  const total = issues.length;
  if (total === 0) return <Empty text="Henüz talep yok." />;
  return (
    <View>
      <View style={styles.stack}>
        {counts.map(([s, n]) => <View key={s} style={{ flex: n, backgroundColor: stackColor(s) }} />)}
      </View>
      <View style={styles.legendGrid}>
        {counts.map(([s, n]) => (
          <View key={s} style={styles.legendItem}>
            <Dot color={stackColor(s)} />
            <Text style={styles.legendText} numberOfLines={1}>{STATUS_LABELS[s]}</Text>
            <Text style={styles.legendValue}>{n}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Open work per person, busiest first; tap opens their profile. */
export function Workload({ issues, users, onPerson, limit = 7 }: { issues: Issue[]; users: User[]; onPerson: (id: string) => void; limit?: number }) {
  const counts: Record<string, number> = {};
  issues.filter((i) => isOpen(i) && i.assigneeId).forEach((i) => { counts[i.assigneeId!] = (counts[i.assigneeId!] || 0) + 1; });
  const rows = Object.entries(counts)
    .map(([id, n]) => ({ user: users.find((u) => u.id === id), n }))
    .filter((r) => r.user)
    .sort((a, b) => b.n - a.n)
    .slice(0, limit);
  if (rows.length === 0) return <Empty text="Üzerinde açık iş olan personel yok." />;
  const max = rows[0].n;
  return (
    <>
      {rows.map(({ user, n }) => (
        <TouchableOpacity key={user!.id} style={styles.workRow} onPress={() => onPerson(user!.id)}>
          <Avatar name={user!.name} color={user!.avatarColor} size={30} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.workName} numberOfLines={1}>{user!.name}</Text>
              <Text style={styles.workCount}>{n} iş</Text>
            </View>
            <Meter pct={(n / max) * 100} color={n === max ? THEME.orange : THEME.navy} />
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}

const STEPS = ['Açıldı', 'İşlemde', 'Onayda', 'Tamamlandı'];
const STEP_INDEX: Record<string, number> = { 'To Do': 0, 'In Progress': 1, 'Onay Bekliyor': 2, Done: 4 };

/** Where a request stands: filled = passed, orange = now. */
export function Steps({ status, compact }: { status: string; compact?: boolean }) {
  const at = STEP_INDEX[status];
  if (at === undefined) return null;
  return (
    <View style={{ flexDirection: 'row', gap: compact ? 4 : 6, marginTop: compact ? 8 : 12 }}>
      {STEPS.map((label, i) => {
        const done = i < at || at === 4;
        const current = i === at;
        const color = done ? THEME.navy : current ? THEME.orange : '#e2e8f0';
        return (
          <View key={label} style={{ flex: 1 }}>
            <View style={{ height: compact ? 5 : 6, borderRadius: 999, backgroundColor: color }} />
            <Text style={{ fontSize: compact ? 10 : 11, marginTop: 4, fontWeight: '700', color: done ? THEME.navy : current ? THEME.orange : '#94a3b8' }}
              numberOfLines={1}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Request counts used by every home page. */
export function requestMetrics(requests: Issue[]) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const open = requests.filter(isOpen);
  const rated = requests.filter((r) => r.rating);
  return {
    open,
    unassigned: open.filter((r) => !r.assigneeId && !r.assigneeTeamId && r.status !== 'Onay Bekliyor'),
    pending: requests.filter((r) => r.status === 'Onay Bekliyor'),
    breached: open.filter((r) => getSlaInfo(r)?.risk === 'breached'),
    atRisk: open.filter((r) => ['breached', 'warning'].includes((getSlaInfo(r) as any)?.risk)),
    today: requests.filter((r) => new Date(r.createdAt) >= todayStart),
    resolvedThisMonth: requests.filter((r) => r.status === 'Done' && r.resolvedAt && new Date(r.resolvedAt) >= monthStart),
    avgRating: rated.length ? rated.reduce((s, r) => s + (r.rating || 0), 0) / rated.length : null,
    ratingCount: rated.length,
  };
}

/** Open requests that most need a look: overdue first, then nearest deadline. */
export function attentionOrder(requests: Issue[]) {
  const rank: Record<string, number> = { breached: 0, warning: 1, ok: 2 };
  return requests.filter(isOpen).sort((a, b) => {
    const sa = getSlaInfo(a) as any;
    const sb = getSlaInfo(b) as any;
    const r = (rank[sa?.risk] ?? 3) - (rank[sb?.risk] ?? 3);
    if (r !== 0) return r;
    return (sa?.remainingMs ?? Infinity) - (sb?.remainingMs ?? Infinity);
  });
}

export function BrandHeader() {
  return <Image source={require('../../assets/logo.png')} style={{ width: 28, height: 24 }} resizeMode="contain" />;
}

export const ui = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 40, backgroundColor: THEME.canvas },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: THEME.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  card: { backgroundColor: THEME.surface, borderRadius: 14, borderWidth: 1, borderColor: THEME.line, padding: 14 },
  btnPrimary: { backgroundColor: THEME.navy, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnGhost: { borderWidth: 1, borderColor: THEME.line, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 },
  btnGhostText: { color: THEME.ink, fontWeight: '600', fontSize: 14 },
  input: { borderWidth: 1, borderColor: THEME.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, backgroundColor: '#fff', color: THEME.ink },
  label: { fontSize: 12, fontWeight: '700', color: THEME.muted, marginBottom: 6, marginTop: 12 },
  chip: { borderWidth: 1, borderColor: THEME.line, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipOn: { borderColor: THEME.navy, backgroundColor: THEME.navySoft },
  chipText: { fontSize: 13, color: '#475569', fontWeight: '500' },
  chipTextOn: { color: THEME.navy, fontWeight: '700' },
});

const styles = StyleSheet.create({
  hero: { backgroundColor: THEME.navy, borderRadius: 18, padding: 18, marginBottom: 14, overflow: 'hidden' },
  heroGlow: { position: 'absolute', right: -60, top: -80, width: 200, height: 200, borderRadius: 100, backgroundColor: THEME.orange, opacity: 0.35 },
  heroEyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  heroTitle: { color: '#fff', fontSize: 21, fontWeight: '800', marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroChipText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  heroBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10 },
  heroBtnSolid: { backgroundColor: '#fff' },
  heroBtnGhost: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  heroBtnText: { fontWeight: '700', fontSize: 13 },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  kpi: { flexBasis: '47%', flexGrow: 1, backgroundColor: THEME.surface, borderRadius: 14, borderWidth: 1, borderColor: THEME.line, padding: 12 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  kpiLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: THEME.muted },
  kpiIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 24, fontWeight: '800', color: THEME.ink, marginTop: 6 },
  kpiSub: { fontSize: 11, color: THEME.muted, marginTop: 2 },

  panel: { backgroundColor: THEME.surface, borderRadius: 14, borderWidth: 1, borderColor: THEME.line, padding: 14, marginBottom: 14 },
  panelHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  panelTitle: { fontSize: 15, fontWeight: '800', color: THEME.ink, flexShrink: 1 },
  panelHint: { fontSize: 11, color: THEME.muted, marginTop: 3 },
  count: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: THEME.navySoft, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '800', color: THEME.navy },
  empty: { fontSize: 13, color: THEME.muted, textAlign: 'center', paddingVertical: 16 },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },
  meter: { height: 6, borderRadius: 999, backgroundColor: '#eef2f7', overflow: 'hidden', marginTop: 5 },
  key: { backgroundColor: THEME.navySoft, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start' },
  keyText: { fontSize: 11, fontWeight: '800', color: THEME.navy },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  rowBar: { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  rowMeta: { fontSize: 12, color: THEME.muted, marginTop: 1 },
  rowPills: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5, flexWrap: 'wrap' },
  rowSmall: { fontSize: 11, color: THEME.muted },

  stack: { flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden', gap: 2, backgroundColor: '#eef2f7', marginBottom: 12 },
  legendGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  legendItem: { width: '50%', flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 8 },
  legendText: { flex: 1, fontSize: 12, color: THEME.muted },
  legendValue: { fontSize: 12, fontWeight: '800', color: THEME.ink },

  workRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  workName: { flex: 1, fontSize: 13, fontWeight: '700', color: THEME.ink },
  workCount: { fontSize: 12, fontWeight: '800', color: THEME.ink, marginLeft: 6 },
});
