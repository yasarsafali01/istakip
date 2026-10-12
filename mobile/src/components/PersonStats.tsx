import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { personMonthlyCsv, shareCsv } from '../utils/exportUtils';
import type { Issue, User } from '../api/types';
import { THEME } from '../utils/constants';
import { formatDuration } from '../utils/durationUtils';
import {
  WEEKDAYS, summarize, personalMonthly, resolvedByYear, resolutionBuckets, timeHeatmap, countBy,
} from '../utils/reportUtils';
import { ChartCard, Columns, BarList, HeatGrid, VIZ } from './MiniCharts';
import { Kpi, KpiGrid, ui } from './ui';

const ALL = 'all';
const TASKS = '__tasks__';
const NO_FORM = '__none__';
const fmtHours = (h: number) => (h >= 10 ? `${Math.round(h)} sa` : `${h.toFixed(1).replace('.', ',')} sa`);
const fmtRating = (r: number | null) => (r === null || r === undefined ? '—' : `${r.toFixed(1)} / 5`);
// Mobile heat grid: every 3rd hour as a column keeps it readable on a phone.
const HOUR_COLS = Array.from({ length: 24 }, (_, h) => ({ key: String(h), label: h % 3 === 0 ? String(h).padStart(2, '0') : '' }));
const heatRows = (heat: { grid: number[][] }) => WEEKDAYS.map((d: string, idx: number) => ({
  key: d, label: d, cells: Object.fromEntries(heat.grid[idx].map((v, h) => [String(h), v])),
}));

/**
 * One person's work numbers — same as the web's PersonStats: resolved per
 * month / year (switchable by talep türü), working time and when they work.
 * Used by Performansım and Personel Profili.
 */
export default function PersonStats({ person, issues }: { person: User; issues: Issue[] }) {
  const mine = useMemo(() => issues.filter((i) => i.assigneeId === person.id), [issues, person.id]);
  const years = useMemo(() => {
    const ys = new Set(mine.filter((i) => i.resolvedAt).map((i) => new Date(i.resolvedAt!).getFullYear()));
    ys.add(new Date().getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [mine]);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const formOptions = useMemo(
    () => [...new Set(mine.filter((i) => i.isRequest).map((i) => i.requestFormName).filter(Boolean))].sort((a, b) => a!.localeCompare(b!, 'tr')) as string[],
    [mine]
  );
  const [form, setForm] = useState(ALL);
  const scoped = useMemo(() => mine.filter((i) => {
    if (form === ALL) return true;
    if (form === TASKS) return !i.isRequest;
    if (form === NO_FORM) return i.isRequest && !i.requestFormName;
    return i.requestFormName === form;
  }), [mine, form]);

  const sum = useMemo(() => summarize(scoped), [scoped]);
  const monthly = useMemo(() => personalMonthly(scoped, year), [scoped, year]);
  const yearly = useMemo(() => resolvedByYear(scoped), [scoped]);
  const buckets = useMemo(() => resolutionBuckets(scoped), [scoped]);
  const startHeat = useMemo(() => timeHeatmap(scoped, 'startedAt'), [scoped]);
  const doneHeat = useMemo(() => timeHeatmap(scoped, 'resolvedAt'), [scoped]);
  const byForm = countBy(mine.filter((i) => i.status === 'Done'),
    (i: Issue) => (i.isRequest ? (i.requestFormName || '(Talep türü yok)') : 'İç işler'));

  const now = new Date();
  const thisMonth = monthly.find((m: any) => m.key === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const yearResolved = monthly.reduce((s: number, m: any) => s + m.resolved, 0);
  const yearWork = monthly.reduce((s: number, m: any) => s + m.workHours, 0);
  const hasLogged = monthly.some((m: any) => m.loggedHours > 0);
  const formTabs: [string, string][] = [[ALL, 'Tümü'], ...formOptions.map((n) => [n, n] as [string, string]), [NO_FORM, 'Türsüz'], [TASKS, 'İç işler']];

  function download() {
    const slug = person.name.toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-');
    shareCsv(personMonthlyCsv(monthly), `performans-${slug}-${year}.csv`).catch((e) => Alert.alert('İndirilemedi', e.message));
  }

  return (
    <View>
      <TouchableOpacity style={styles.dl} onPress={download}>
        <Ionicons name="download-outline" size={16} color={THEME.navy} />
        <Text style={styles.dlText}>İndir ({year})</Text>
      </TouchableOpacity>
      {/* Yıl ve talep türü */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {years.map((y) => (
          <TouchableOpacity key={y} style={[ui.chip, year === String(y) && ui.chipOn]} onPress={() => setYear(String(y))}>
            <Text style={[ui.chipText, year === String(y) && ui.chipTextOn]}>{y}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {formTabs.map(([v, label]) => (
          <TouchableOpacity key={v} style={[ui.chip, form === v && ui.chipOn]} onPress={() => setForm(v)}>
            <Text style={[ui.chipText, form === v && ui.chipTextOn]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {mine.length === 0 && <Text style={styles.warn}>{person.name} adına atanmış talep yok.</Text>}

      <KpiGrid>
        <Kpi label="Bu ay çözdüğü" value={thisMonth?.resolved ?? 0} icon="checkmark-circle-outline" tone="ok" sub={`${year} toplamı: ${yearResolved}`} />
        <Kpi label="Tüm zamanlar" value={sum.done} icon="ticket-outline" tone="navy" sub={`${sum.total} atanmış kayıttan`} />
        <Kpi label="Üzerindeki açık" value={sum.todo + sum.inProgress} icon="hourglass-outline" tone="orange" sub={`${sum.todo} yapılacak · ${sum.inProgress} devam`} />
        <Kpi label="Onay bekleyen" value={sum.pendingApproval} icon="shield-checkmark-outline" tone="violet" sub="Yönetici onayında" />
        <Kpi label="Ort. çözüm süresi" value={formatDuration(sum.avgResolution)} icon="time-outline" tone="warn" sub={`${year} çalışma: ${fmtHours(yearWork)}`} />
        <Kpi label="Memnuniyet" value={fmtRating(sum.avgRating)} icon="star-outline" tone="warn" sub={`${sum.ratingCount} değerlendirme`} />
      </KpiGrid>

      <Text style={ui.sectionTitle}>Çözülen talepler</Text>
      <ChartCard title={`Aylık çözülen talepler — ${year}`} subtitle="Kapanış ayına göre">
        <Columns data={monthly} series={[{ key: 'resolved', label: 'Çözülen', color: VIZ.s1 }]} />
      </ChartCard>
      <ChartCard title="Yıllık çözülen talepler">
        <Columns data={yearly} series={[{ key: 'value', label: 'Çözülen', color: VIZ.s1 }]} height={110} />
      </ChartCard>
      <ChartCard title="Talep türüne göre çözdükleri" subtitle="Tüm zamanlar — tür seçiminden bağımsız">
        <BarList data={byForm} empty="Henüz çözülmüş talep yok" />
      </ChartCard>

      <Text style={ui.sectionTitle}>Çalışma süreleri</Text>
      <ChartCard title={`Aylık toplam çalışma süresi — ${year}`}
        subtitle={hasLogged ? 'Çözüm süreleri toplamı ve elle girilen harcanan zaman (saat)' : 'O ay çözülen taleplerin çözüm süreleri toplamı (saat)'}>
        <Columns data={monthly} format={fmtHours}
          series={hasLogged
            ? [{ key: 'workHours', label: 'Çözüm süresi', color: VIZ.s1 }, { key: 'loggedHours', label: 'Harcanan zaman', color: VIZ.s2 }]
            : [{ key: 'workHours', label: 'Çözüm süresi', color: VIZ.s1 }]} />
      </ChartCard>
      <ChartCard title={`Aylık ortalama çözüm süresi — ${year}`} subtitle="Talep başına (saat)">
        <Columns data={monthly} series={[{ key: 'avgHours', label: 'Ort. çözüm', color: VIZ.s1 }]} format={fmtHours} />
      </ChartCard>
      <ChartCard title="Çözüm süresi dağılımı" subtitle="Talepler ne kadar sürede çözülüyor (tüm zamanlar)">
        <BarList data={buckets} />
      </ChartCard>

      <Text style={ui.sectionTitle}>Çalışma zamanları</Text>
      <ChartCard title="Talepleri işleme aldığı saatler" subtitle="Haftanın günü × saat">
        <HeatGrid columns={HOUR_COLS} rows={heatRows(startHeat)} max={startHeat.max} />
      </ChartCard>
      <ChartCard title="Talepleri kapattığı saatler" subtitle="Haftanın günü × saat">
        <HeatGrid columns={HOUR_COLS} rows={heatRows(doneHeat)} max={doneHeat.max} />
      </ChartCard>
    </View>
  );
}

const styles = StyleSheet.create({
  dl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: THEME.line, backgroundColor: '#fff', borderRadius: 10, paddingVertical: 9, marginBottom: 12 },
  dlText: { fontSize: 13, fontWeight: '700', color: THEME.navy },
  filters: { gap: 8, paddingBottom: 10 },
  warn: { backgroundColor: THEME.warnSoft, color: THEME.warn, fontWeight: '700', padding: 12, borderRadius: 12, marginBottom: 12 },
});
