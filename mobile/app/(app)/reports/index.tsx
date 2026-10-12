import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueries, useQuery } from '@tanstack/react-query';
import { usersApi, issuesApi, projectsApi, unitsApi, teamsApi } from '../../../src/api/resources';
import { ChartCard, Columns, BarList, StackedBars, HeatGrid, VIZ } from '../../../src/components/MiniCharts';
import PickerSheet from '../../../src/components/PickerSheet';
import { Kpi, KpiGrid, ui } from '../../../src/components/ui';
import { STATUS_LABELS, PRIORITY_LABELS, THEME } from '../../../src/utils/constants';
import { formatDuration } from '../../../src/utils/durationUtils';
import {
  MONTHS, WEEKDAYS, applyFilters, summarize, monthlyTrend, monthlyResolution, monthlySla, ratingDistribution, outcomeBy,
  resolutionBy, groupStats, userPeriodMatrix, openingHeatmap, answerDistribution, countBy, percent,
} from '../../../src/utils/reportUtils';
import type { Issue } from '../../../src/api/types';
import { statRowsCsv, recordsToCsv, shareCsv } from '../../../src/utils/exportUtils';

const ALL = 'all';
const NO_FORM = '(Talep türü seçilmeden açılanlar)';
const TREND_SERIES = [{ key: 'opened', label: 'Açılan', color: VIZ.s1 }, { key: 'completed', label: 'Tamamlanan', color: VIZ.s2 }];
const OUTCOME_SERIES = [
  { key: 'done', label: 'Tamamlanan', color: VIZ.s1 },
  { key: 'open', label: 'Açık', color: VIZ.s2 },
  { key: 'closed', label: 'Geri çevrilen / iptal', color: VIZ.s3 },
];
const SLA_SERIES = [{ key: 'onTime', label: 'Süresinde', color: VIZ.s1 }, { key: 'late', label: 'Gecikmeli', color: VIZ.s2 }];
const STATUS_ORDER = ['To Do', 'In Progress', 'Onay Bekliyor', 'Done', 'Geri Çevrildi', 'İptal Edildi', 'Yönlendirildi'];
const PRIORITY_ORDER = ['High', 'Medium', 'Low'];
const KINDS: Record<string, string> = { [ALL]: 'Talepler ve işler', request: 'Yalnızca talepler', task: 'Yalnızca iç işler' };
const fmtRating = (r: number | null) => (r === null || r === undefined ? '—' : `${r.toFixed(1)} / 5`);
const fmtHours = (h: number) => (h >= 10 ? `${Math.round(h)} sa` : `${h.toFixed(1).replace('.', ',')} sa`);
const HOUR_COLS = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: h % 3 === 0 ? String(h).padStart(2, '0') : '' }));

type PickerKind = 'year' | 'month' | 'unit' | 'project' | 'kind' | 'form' | 'person' | null;

/**
 * Raporlar → İstatistikler (web: ReportsPage). Every number comes from the
 * issues the user can see (scoped by the backend); filters apply to all sections.
 */
export default function ReportsScreen() {
  const router = useRouter();
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const projects = projectsQuery.data || [];
  const teamQueries = useQueries({ queries: projects.map((p) => ({ queryKey: ['teams', p.id], queryFn: () => teamsApi.listByProject(p.id) })) });
  const teamsById = Object.fromEntries(teamQueries.flatMap((q) => q.data || []).map((t) => [t.id, t]));

  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const unitsById = useMemo(() => Object.fromEntries((unitsQuery.data || []).map((u) => [u.id, u])), [unitsQuery.data]);
  const usersById = useMemo(() => Object.fromEntries((usersQuery.data || []).map((u) => [u.id, u])), [usersQuery.data]);
  const scoped: Issue[] = useMemo(() => (issuesQuery.data || []).filter((i) => projectsById[i.projectId]), [issuesQuery.data, projectsById]);

  const [f, setF] = useState({ year: String(new Date().getFullYear()), month: ALL, unitId: '', projectId: '', kind: ALL, formName: '', assigneeId: '' });
  const set = (patch: Partial<typeof f>) => setF((s) => ({ ...s, ...patch }));
  const [picker, setPicker] = useState<PickerKind>(null);
  const [matrixMetric, setMatrixMetric] = useState<'completed' | 'assigned'>('completed');
  const [matrixPeriod, setMatrixPeriod] = useState<'month' | 'year'>('month');
  const [selectedForm, setSelectedForm] = useState('');

  const filtered: Issue[] = useMemo(() => applyFilters(scoped, f, projectsById), [scoped, f, projectsById]);
  const yearless = useMemo(() => applyFilters(scoped, { ...f, month: ALL, year: ALL }, projectsById), [scoped, f, projectsById]);
  const trend = useMemo(() => monthlyTrend(yearless, f.year), [yearless, f.year]);
  const resolutionTrend = useMemo(() => monthlyResolution(yearless, f.year), [yearless, f.year]);
  const slaTrend = useMemo(() => monthlySla(yearless, f.year), [yearless, f.year]);
  const sum = useMemo(() => summarize(filtered), [filtered]);

  if (issuesQuery.isLoading || projectsQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;
  }

  const years = [...new Set([new Date().getFullYear(), ...scoped.filter((i) => i.createdAt).map((i) => new Date(i.createdAt).getFullYear())])].sort((a, b) => b - a);
  const units = [...new Set(projects.map((p) => p.unitId))].map((id) => unitsById[id]).filter(Boolean);
  const formNames = [...new Set(scoped.map((i) => i.requestFormName).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, 'tr')) as string[];
  const assignees = [...new Set(scoped.map((i) => i.assigneeId).filter(Boolean))].map((id) => usersById[id!]).filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  const projectName = (id: string) => projectsById[id]?.name || '—';
  const userName = (id: string) => usersById[id]?.name || 'Bilinmeyen';

  const statusData = STATUS_ORDER.map((s) => ({ key: s, label: STATUS_LABELS[s] || s, value: filtered.filter((i) => i.status === s).length })).filter((d) => d.value > 0);
  const priorityData = PRIORITY_ORDER.map((p) => ({ key: p, label: PRIORITY_LABELS[p], value: filtered.filter((i) => i.priority === p).length }));
  const ratingData = ratingDistribution(filtered);
  const requesterData = countBy(filtered.filter((i) => i.isRequest), (i: Issue) => i.reporterId, (id: string) => userName(id));
  const projectOutcome = outcomeBy(filtered, (i: Issue) => i.projectId, projectName);
  const projectResolution = resolutionBy(filtered, (i: Issue) => i.projectId, projectName);
  const userOutcome = outcomeBy(filtered, (i: Issue) => i.assigneeId, userName);
  const userResolution = resolutionBy(filtered, (i: Issue) => i.assigneeId, userName);
  const requests = filtered.filter((i) => i.isRequest);
  const formOutcome = outcomeBy(requests, (i: Issue) => i.requestFormName || NO_FORM, (k: string) => k);
  const activeForm = formOutcome.some((r: any) => r.key === selectedForm) ? selectedForm : (formOutcome.find((r: any) => r.key !== NO_FORM)?.key || '');
  const formRequests = requests.filter((i) => (i.requestFormName || NO_FORM) === activeForm);
  const formQuestions: string[] = [...new Set(formRequests.flatMap((i) => (i.requestAnswers || [])
    .filter((a) => ['select', 'radio', 'checkbox', 'boolean'].includes(a.type)).map((a) => a.label)))];
  const matrix = userPeriodMatrix(yearless, { metric: matrixMetric, period: matrixPeriod, year: f.year });
  const matrixRows = [...matrix.rows.entries()].map(([id, cells]: any) => ({ key: id, label: userName(id), cells }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
  const heat = openingHeatmap(filtered);
  const heatRows = WEEKDAYS.map((d: string, idx: number) => ({ key: d, label: d, cells: Object.fromEntries(heat.grid[idx].map((v: number, h: number) => [String(h), v])) }));
  const projectRows = groupStats(filtered, (i: Issue) => i.projectId)
    .map((r: any) => ({ ...r, name: projectName(r.key), unit: unitsById[projectsById[r.key]?.unitId]?.name || '' }));
  const csvSuffix = `${f.year}${f.month !== ALL ? `-${f.month}` : ''}`;
  const unitRows = groupStats(filtered, (i: Issue) => projectsById[i.projectId]?.unitId).map((r: any) => ({ ...r, name: unitsById[r.key]?.name || '—' }));
  const userRows = groupStats(filtered, (i: Issue) => i.assigneeId).map((r: any) => ({ ...r, name: userName(r.key) }));
  const formRows = groupStats(requests, (i: Issue) => i.requestFormName || NO_FORM).map((r: any) => ({ ...r, name: r.key }));
  const teamRows = groupStats(filtered, (i: Issue) => i.assigneeTeamId).map((r: any) => ({ ...r, name: teamsById[r.key]?.name || 'Silinmiş ekip' }));

  const filterChips: { kind: PickerKind; label: string; on: boolean }[] = [
    { kind: 'year', label: f.year === ALL ? 'Tüm yıllar' : f.year, on: true },
    { kind: 'month', label: f.month === ALL ? 'Tüm aylar' : MONTHS[Number(f.month) - 1], on: f.month !== ALL },
    ...(units.length > 1 ? [{ kind: 'unit' as PickerKind, label: f.unitId ? unitsById[f.unitId]?.name : 'Daire başkanlığı', on: !!f.unitId }] : []),
    ...(projects.length > 1 ? [{ kind: 'project' as PickerKind, label: f.projectId ? projectName(f.projectId) : 'Müdürlük', on: !!f.projectId }] : []),
    { kind: 'kind', label: KINDS[f.kind], on: f.kind !== ALL },
    ...(formNames.length ? [{ kind: 'form' as PickerKind, label: f.formName ? (f.formName === '__none__' ? 'Talep türü yok' : f.formName) : 'Talep türü', on: !!f.formName }] : []),
    { kind: 'person', label: f.assigneeId ? userName(f.assigneeId) : 'Personel', on: !!f.assigneeId },
  ];
  const anyFilter = f.month !== ALL || f.unitId || f.projectId || f.kind !== ALL || f.formName || f.assigneeId;

  let pickerOptions: { key: string; label: string }[] = [];
  if (picker === 'year') pickerOptions = [{ key: ALL, label: 'Tüm yıllar' }, ...years.map((y) => ({ key: String(y), label: String(y) }))];
  if (picker === 'month') pickerOptions = [{ key: ALL, label: 'Tüm aylar' }, ...MONTHS.map((m: string, i: number) => ({ key: String(i + 1), label: m }))];
  if (picker === 'unit') pickerOptions = [{ key: '', label: 'Tüm daire başkanlıkları' }, ...units.map((u) => ({ key: u.id, label: u.name }))];
  if (picker === 'project') pickerOptions = [{ key: '', label: 'Tüm müdürlükler' }, ...projects.filter((p) => !f.unitId || p.unitId === f.unitId).map((p) => ({ key: p.id, label: p.name }))];
  if (picker === 'kind') pickerOptions = Object.entries(KINDS).map(([key, label]) => ({ key, label }));
  if (picker === 'form') pickerOptions = [{ key: '', label: 'Tüm talep türleri' }, ...formNames.map((n) => ({ key: n, label: n })), { key: '__none__', label: '(Talep türü yok)' }];
  if (picker === 'person') pickerOptions = [{ key: '', label: 'Tüm personel' }, ...assignees.map((u) => ({ key: u.id, label: u.name }))];
  function onPick(key: string) {
    if (picker === 'year') set({ year: key });
    if (picker === 'month') set({ month: key });
    if (picker === 'unit') set({ unitId: key, projectId: '' });
    if (picker === 'project') set({ projectId: key });
    if (picker === 'kind') set({ kind: key });
    if (picker === 'form') set({ formName: key });
    if (picker === 'person') set({ assigneeId: key });
    setPicker(null);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <ScrollView contentContainerStyle={ui.screen}
        refreshControl={<RefreshControl refreshing={issuesQuery.isFetching} onRefresh={() => issuesQuery.refetch()} />}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filterChips.map((c) => (
            <TouchableOpacity key={c.kind} style={[ui.chip, c.on && ui.chipOn, styles.chip]} onPress={() => setPicker(c.kind)}>
              <Text style={[ui.chipText, c.on && ui.chipTextOn]} numberOfLines={1}>{c.label}</Text>
              <Ionicons name="chevron-down" size={13} color={c.on ? THEME.navy : '#94a3b8'} />
            </TouchableOpacity>
          ))}
          {anyFilter ? (
            <TouchableOpacity style={styles.clear} onPress={() => set({ month: ALL, unitId: '', projectId: '', kind: ALL, formName: '', assigneeId: '' })}>
              <Text style={styles.clearText}>Temizle</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <TouchableOpacity style={styles.dl}
          onPress={() => shareCsv(recordsToCsv(filtered, projects, usersQuery.data || []), `istatistikler-${csvSuffix}.csv`)
            .catch((e) => Alert.alert('İndirilemedi', e.message))}>
          <Ionicons name="download-outline" size={16} color={THEME.navy} />
          <Text style={styles.dlText}>İndir ({filtered.length} kayıt)</Text>
        </TouchableOpacity>

        <KpiGrid>
          <Kpi label="Toplam kayıt" value={sum.total} icon="ticket-outline" tone="navy" sub={`${sum.open} açık`} />
          <Kpi label="Tamamlanan" value={sum.done} icon="checkmark-circle-outline" tone="ok" sub={`Tamamlanma ${percent(sum.completionRate)}`} />
          <Kpi label="Ort. çözüm süresi" value={formatDuration(sum.avgResolution)} icon="time-outline" tone="violet" sub={`Bekleme: ${formatDuration(sum.avgWaiting)}`} />
          <Kpi label="SLA uyumu" value={percent(sum.slaRate)} icon="shield-checkmark-outline" tone="orange" sub={`${sum.slaCount} çözülmüş talepte`} />
          <Kpi label="Memnuniyet" value={fmtRating(sum.avgRating)} icon="star-outline" tone="warn" sub={`${sum.ratingCount} değerlendirme`} />
          <Kpi label="Geri çevrilen" value={sum.rejected} icon="close-circle-outline" tone="danger" sub={`${sum.cancelled} iptal · ${sum.forwarded} yönlendirildi`} />
        </KpiGrid>

        <Text style={ui.sectionTitle}>Genel eğilim</Text>
        <ChartCard title="Açılan ve tamamlanan talepler" subtitle="Açılanlar açılış, tamamlananlar kapanış ayına göre">
          <Columns data={trend} series={TREND_SERIES} />
        </ChartCard>
        <ChartCard title="Aylık ortalama çözüm süresi" subtitle="Saat">
          <Columns data={resolutionTrend.map((d: any) => ({ ...d, hint: `${d.count} talep` }))} series={[{ key: 'value', label: 'Ort. çözüm', color: VIZ.s1 }]} format={fmtHours} />
        </ChartCard>

        <Text style={ui.sectionTitle}>Durum, öncelik ve memnuniyet</Text>
        <ChartCard title="Duruma göre"><BarList data={statusData} /></ChartCard>
        <ChartCard title="Önceliğe göre"><BarList data={priorityData} /></ChartCard>
        <ChartCard title="Memnuniyet puanları" subtitle={`${sum.ratingCount} değerlendirme · ortalama ${fmtRating(sum.avgRating)}`}>
          <Columns data={ratingData} series={[{ key: 'value', label: 'Değerlendirme', color: VIZ.s1 }]} height={120} />
        </ChartCard>

        <Text style={ui.sectionTitle}>Hizmet süresi (SLA)</Text>
        <ChartCard title="Aylık süresinde / gecikmeli çözülen" subtitle="Yüksek 8 sa · Orta 24 sa · Düşük 72 sa hedef">
          <Columns data={slaTrend} series={SLA_SERIES} mode="stacked" />
        </ChartCard>

        <Text style={ui.sectionTitle}>Müdürlükler</Text>
        <ChartCard title="Müdürlüklere göre kayıtlar" subtitle="Renkler sonucu gösterir">
          <StackedBars data={projectOutcome} series={OUTCOME_SERIES} limit={12} />
        </ChartCard>
        <ChartCard title="Müdürlüklere göre ortalama çözüm süresi" subtitle="Uzundan kısaya">
          <BarList data={projectResolution as any} format={formatDuration} limit={12} empty="Henüz çözülmüş talep yok" />
        </ChartCard>

        <Text style={ui.sectionTitle}>Personel</Text>
        <ChartCard title="Personele göre kayıtlar">
          <StackedBars data={userOutcome} series={OUTCOME_SERIES} limit={15} empty="Atanmış kayıt yok" />
        </ChartCard>
        <ChartCard title="Personele göre ortalama çözüm süresi" subtitle="Uzundan kısaya">
          <BarList data={userResolution as any} format={formatDuration} limit={15} empty="Henüz çözülmüş talep yok" />
        </ChartCard>
        <ChartCard title={`Personel × ${matrixPeriod === 'year' ? 'yıl' : 'ay'}`}
          subtitle={matrixMetric === 'completed' ? 'Tamamladığı kayıt sayısı' : 'Kendisine atanan kayıt sayısı'}>
          <View style={styles.toggleRow}>
            {([['completed', 'Tamamlanan'], ['assigned', 'Atanan']] as const).map(([k, l]) => (
              <TouchableOpacity key={k} style={[ui.chip, matrixMetric === k && ui.chipOn]} onPress={() => setMatrixMetric(k)}>
                <Text style={[ui.chipText, matrixMetric === k && ui.chipTextOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
            {([['month', 'Ay'], ['year', 'Yıl']] as const).map(([k, l]) => (
              <TouchableOpacity key={k} style={[ui.chip, matrixPeriod === k && ui.chipOn]} onPress={() => setMatrixPeriod(k)}>
                <Text style={[ui.chipText, matrixPeriod === k && ui.chipTextOn]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {matrixRows.length === 0 ? <Text style={styles.muted}>Veri yok</Text>
            : <HeatGrid columns={matrix.columns} rows={matrixRows} max={matrix.max} />}
        </ChartCard>

        <Text style={ui.sectionTitle}>Talep türleri ve form cevapları</Text>
        <ChartCard title="Talep türlerine göre talepler" subtitle="Bir türe dokunun, cevaplarını aşağıda görün">
          <StackedBars data={formOutcome} series={OUTCOME_SERIES} onSelect={setSelectedForm} selectedKey={activeForm} empty="Bu filtrelerde talep yok" />
        </ChartCard>
        <ChartCard title={activeForm ? `“${activeForm}” formundaki cevaplar` : 'Form cevapları'} subtitle={activeForm ? `${formRequests.length} talep` : undefined}>
          {!activeForm || activeForm === NO_FORM ? <Text style={styles.muted}>Cevapları görmek için yukarıdan bir talep türü seçin.</Text>
            : formQuestions.length === 0 ? <Text style={styles.muted}>Bu formda seçmeli soru yok; metin cevapları burada özetlenmez.</Text>
              : formQuestions.map((q) => (
                <View key={q} style={{ marginBottom: 12 }}>
                  <Text style={styles.question}>{q}</Text>
                  <BarList data={answerDistribution(formRequests, q)} limit={8} />
                </View>
              ))}
        </ChartCard>

        <Text style={ui.sectionTitle}>Talep sahipleri ve zamanlama</Text>
        <ChartCard title="En çok talep açanlar" subtitle="İlk 10"><BarList data={requesterData} limit={10} empty="Talep yok" /></ChartCard>
        <ChartCard title="Talepler ne zaman açılıyor?" subtitle="Haftanın günü × saat">
          <HeatGrid columns={HOUR_COLS} rows={heatRows} max={heat.max} />
        </ChartCard>

        <Text style={ui.sectionTitle}>Detaylı tablolar</Text>
        <StatTable title="Müdürlük bazında" rows={projectRows} csv={() => statRowsCsv('Müdürlük', projectRows, true)} csvName={`mudurluk-raporu-${csvSuffix}.csv`} />
        {unitRows.length > 1 && (
          <StatTable title="Daire başkanlığı bazında" rows={unitRows} csv={() => statRowsCsv('Daire Başkanlığı', unitRows)} csvName={`daire-baskanligi-raporu-${csvSuffix}.csv`} />
        )}
        <StatTable title="Personel bazında" hint="Profili açmak için dokunun" rows={userRows}
          csv={() => statRowsCsv('Personel', userRows)} csvName={`personel-raporu-${csvSuffix}.csv`}
          onPress={(key) => usersById[key] && router.push(`/(app)/personnel/${key}`)} />
        <StatTable title="Talep türlerinin karşılaştırması" rows={formRows} csv={() => statRowsCsv('Talep Türü', formRows)} csvName={`talep-turu-raporu-${csvSuffix}.csv`} />
        <StatTable title="Ekip bazında" rows={teamRows} csv={() => statRowsCsv('Ekip', teamRows)} csvName={`ekip-raporu-${csvSuffix}.csv`} />
      </ScrollView>
      <PickerSheet visible={!!picker} title="Filtre" options={pickerOptions} onSelect={onPick} onClose={() => setPicker(null)} />
    </SafeAreaView>
  );
}

/** Mobile version of the web DataTable: one card per row with its key numbers, busiest first. */
function StatTable({ title, hint, rows, onPress, csv, csvName }: {
  title: string; hint?: string; rows: any[]; onPress?: (key: string) => void; csv?: () => string; csvName?: string;
}) {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  const share = csv && csvName && rows.length > 0 ? (
    <TouchableOpacity style={styles.csvBtn} onPress={() => shareCsv(csv(), csvName).catch((e) => Alert.alert('Dışa aktarılamadı', e.message))}>
      <Ionicons name="download-outline" size={14} color={THEME.navy} />
      <Text style={styles.csvText}>CSV</Text>
    </TouchableOpacity>
  ) : undefined;
  return (
    <ChartCard title={title} subtitle={hint} right={share}>
      {sorted.length === 0 ? <Text style={styles.muted}>Kayıt yok</Text> : sorted.map((r) => (
        <TouchableOpacity key={r.key ?? r.name} style={styles.tableRow} disabled={!onPress} onPress={() => onPress?.(r.key)}>
          <View style={styles.tableHead}>
            <Text style={[styles.tableName, onPress && { color: THEME.brand }]} numberOfLines={1}>{r.name}</Text>
            <Text style={styles.tableRate}>{percent(r.completionRate)}</Text>
          </View>
          <View style={styles.tableStats}>
            {[['Toplam', r.total], ['Açık', r.open], ['Onayda', r.pendingApproval], ['Tamam', r.done], ['Geri', r.rejected]].map(([l, v]) => (
              <View key={l} style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.tableValue}>{v}</Text>
                <Text style={styles.tableLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.tableMeta}>
            Bekleme {formatDuration(r.avgWaiting)} · Çözüm {formatDuration(r.avgResolution)} · Memnuniyet {fmtRating(r.avgRating)}
          </Text>
        </TouchableOpacity>
      ))}
    </ChartCard>
  );
}

const styles = StyleSheet.create({
  dl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: THEME.line, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 9, marginBottom: 12 },
  dlText: { fontSize: 13, fontWeight: '700', color: THEME.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: { gap: 8, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 220 },
  clear: { justifyContent: 'center', paddingHorizontal: 6 },
  clearText: { color: THEME.danger, fontWeight: '700', fontSize: 13 },
  muted: { fontSize: 12, color: THEME.muted, fontStyle: 'italic' },
  question: { fontSize: 13, fontWeight: '700', color: THEME.ink, marginBottom: 6 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  tableRow: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  tableHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tableName: { flex: 1, fontSize: 14, fontWeight: '800', color: THEME.ink },
  tableRate: { fontSize: 12, fontWeight: '800', color: THEME.ok },
  tableStats: { flexDirection: 'row', marginTop: 8 },
  tableValue: { fontSize: 15, fontWeight: '800', color: THEME.ink },
  tableLabel: { fontSize: 10, color: THEME.muted },
  csvBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: THEME.line, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  csvText: { fontSize: 12, fontWeight: '700', color: THEME.navy },
  tableMeta: { fontSize: 11, color: THEME.muted, marginTop: 6 },
});
