import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

// Same palette as the web charts (reference data-viz palette, light).
export const VIZ = {
  s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a',
  text: '#0b0b0b', text2: '#52514e', muted: '#898781', grid: '#e1e0d9', surface: '#fcfcfb',
};
const SEQ = ['#f0efec', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

export type Series = { key: string; label: string; color: string };

export function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <View style={[styles.tile, { borderLeftColor: accent }]}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      {sub ? <Text style={styles.tileSub}>{sub}</Text> : null}
    </View>
  );
}

export function ChartCard({ title, subtitle, children, right }: { title: string; subtitle?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.cardSub}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

export function Legend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <View style={styles.legend}>
      {series.map((s) => (
        <View key={s.key} style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: s.color }]} />
          <Text style={styles.legendText}>{s.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** Tap a row to see its exact value (touch stand-in for the web hover tooltip). */
export function BarList({ data, format = (v: number) => String(v), color = VIZ.s1, limit, empty = 'Veri yok' }: {
  data: { key: string; label: string; value: number }[]; format?: (v: number) => string; color?: string; limit?: number; empty?: string;
}) {
  const rows = limit ? data.slice(0, limit) : data;
  const max = Math.max(1, ...rows.map((d) => d.value));
  if (rows.length === 0) return <Text style={styles.empty}>{empty}</Text>;
  return (
    <View style={{ gap: 8 }}>
      {rows.map((d) => (
        <View key={d.key} style={styles.barRow}>
          <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
          <View style={styles.barTrack}>
            <View style={{ height: 12, width: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: color, borderTopRightRadius: 4, borderBottomRightRadius: 4 }} />
          </View>
          <Text style={styles.barValue}>{format(d.value)}</Text>
        </View>
      ))}
      {limit && data.length > limit ? <Text style={styles.empty}>+{data.length - limit} diğer</Text> : null}
    </View>
  );
}

/** Horizontal stacked bars (part-to-whole per category) with a 2px gap between segments. */
export function StackedBars({ data, series, limit, onSelect, selectedKey, empty = 'Veri yok' }: {
  data: Record<string, any>[]; series: Series[]; limit?: number; onSelect?: (key: string) => void; selectedKey?: string; empty?: string;
}) {
  const rows = limit ? data.slice(0, limit) : data;
  if (rows.length === 0) return <Text style={styles.empty}>{empty}</Text>;
  const total = (d: any) => series.reduce((s, x) => s + (d[x.key] || 0), 0);
  const max = Math.max(1, ...rows.map(total));
  return (
    <View>
      <Legend series={series} />
      <View style={{ gap: 8 }}>
        {rows.map((d) => {
          const visible = series.filter((s) => d[s.key] > 0);
          const t = total(d);
          const Wrap: any = onSelect ? TouchableOpacity : View;
          return (
            <Wrap key={d.key} onPress={onSelect ? () => onSelect(d.key) : undefined}
              style={[styles.barRow, selectedKey === d.key && { backgroundColor: '#eef4fd', borderRadius: 6 }]}>
              <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
              <View style={styles.barTrack}>
                <View style={{ flexDirection: 'row', width: `${Math.max(2, (t / max) * 100)}%`, gap: 2 }}>
                  {visible.map((s, i) => (
                    <View key={s.key} style={{
                      flex: d[s.key], height: 12, backgroundColor: s.color,
                      borderTopRightRadius: i === visible.length - 1 ? 4 : 0, borderBottomRightRadius: i === visible.length - 1 ? 4 : 0,
                    }} />
                  ))}
                </View>
              </View>
              <Text style={styles.barValue}>{t}</Text>
            </Wrap>
          );
        })}
      </View>
    </View>
  );
}

/** Vertical columns over ordered x (months); 1 series, or 2–3 grouped/stacked. Tap a column for its values. */
export function Columns({ data, series, mode = 'grouped', height = 150, format = (v: number) => String(Math.round(v)) }: {
  data: Record<string, any>[]; series: Series[]; mode?: 'grouped' | 'stacked'; height?: number; format?: (v: number) => string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const stacked = mode === 'stacked' && series.length > 1;
  const totals = data.map((d) => (stacked ? series.reduce((s, x) => s + (d[x.key] || 0), 0) : Math.max(...series.map((x) => d[x.key] || 0))));
  const max = Math.max(1e-9, ...totals);
  if (data.length === 0 || totals.every((t) => !t)) return <Text style={styles.empty}>Veri yok</Text>;
  const maxIdx = totals.indexOf(Math.max(...totals));
  const sel = picked !== null ? data[picked] : null;

  return (
    <View>
      <Legend series={series} />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, borderBottomWidth: 1, borderBottomColor: VIZ.grid }}>
        {data.map((d, i) => (
          <TouchableOpacity key={d.key} activeOpacity={0.7} onPress={() => setPicked(picked === i ? null : i)}
            style={{ flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
            {i === maxIdx && <Text style={styles.colTop}>{format(totals[i])}</Text>}
            <View style={{ flexDirection: stacked ? 'column-reverse' : 'row', alignItems: 'flex-end', gap: 2, opacity: picked === null || picked === i ? 1 : 0.45 }}>
              {series.map((s) => {
                const v = d[s.key] || 0;
                const h = (v / max) * (height - 18);
                if (h <= 0) return null;
                return <View key={s.key} style={{ width: stacked ? 14 : Math.max(4, 14 / series.length + 2), height: Math.max(1, h), backgroundColor: s.color, borderTopLeftRadius: 3, borderTopRightRadius: 3 }} />;
              })}
            </View>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {data.map((d, i) => (
          <Text key={d.key} style={styles.colLabel} numberOfLines={1}>{data.length > 12 && i % 2 ? '' : d.label}</Text>
        ))}
      </View>
      {sel ? (
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>{sel.fullLabel || sel.label}</Text>
          {series.map((s) => (
            <Text key={s.key} style={styles.tipText}><Text style={{ color: s.color }}>■ </Text>{s.label}: <Text style={{ fontWeight: '800' }}>{format(sel[s.key] || 0)}</Text></Text>
          ))}
          {sel.hint ? <Text style={styles.tipHint}>{sel.hint}</Text> : null}
        </View>
      ) : <Text style={styles.tapHint}>Ayrıntı için bir sütuna dokunun.</Text>}
    </View>
  );
}

/** Weekday × hour grid (sequential blue); scrolls horizontally on narrow screens. */
export function HeatGrid({ rows, columns, max }: { rows: { key: string; label: string; cells: Record<string, number> }[]; columns: { key: string; label: string }[]; max: number }) {
  const step = (v: number) => (!v ? 0 : Math.min(SEQ.length - 1, 1 + Math.floor((v / Math.max(1, max)) * (SEQ.length - 2) - 1e-9)));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={{ flexDirection: 'row' }}>
          <View style={{ width: 70 }} />
          {columns.map((c) => <Text key={c.key} style={styles.heatHead}>{c.label}</Text>)}
        </View>
        {rows.map((r) => (
          <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.heatRowLabel} numberOfLines={1}>{r.label}</Text>
            {columns.map((c) => {
              const v = r.cells[c.key] || 0;
              const s = step(v);
              return (
                <View key={c.key} style={[styles.heatCell, { backgroundColor: SEQ[s] }]}>
                  {v ? <Text style={{ fontSize: 9, color: s >= 4 ? '#fff' : VIZ.text }}>{v}</Text> : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, minWidth: '46%', backgroundColor: '#fff', borderRadius: 10, padding: 10, borderLeftWidth: 4 },
  tileLabel: { fontSize: 11, fontWeight: '700', color: VIZ.text2 },
  tileValue: { fontSize: 20, fontWeight: '700', color: VIZ.text, marginTop: 2 },
  tileSub: { fontSize: 10, color: VIZ.muted, marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: VIZ.text },
  cardSub: { fontSize: 11, color: VIZ.muted, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 11, color: VIZ.text2 },
  empty: { fontSize: 12, color: VIZ.muted, fontStyle: 'italic' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 },
  barLabel: { width: '34%', fontSize: 12, color: VIZ.text2 },
  barTrack: { flex: 1 },
  barValue: { fontSize: 12, fontWeight: '700', color: VIZ.text, minWidth: 28, textAlign: 'right' },
  colTop: { fontSize: 10, fontWeight: '700', color: VIZ.text, marginBottom: 2 },
  colLabel: { flex: 1, fontSize: 9, color: VIZ.muted, textAlign: 'center', marginTop: 4 },
  tapHint: { fontSize: 10, color: VIZ.muted, marginTop: 6 },
  tipBox: { backgroundColor: '#F4F5F7', borderRadius: 8, padding: 8, marginTop: 8 },
  tipTitle: { fontSize: 12, fontWeight: '800', color: VIZ.text },
  tipText: { fontSize: 12, color: VIZ.text2 },
  tipHint: { fontSize: 11, color: VIZ.muted },
  heatHead: { width: 22, fontSize: 9, color: VIZ.muted, textAlign: 'center' },
  heatRowLabel: { width: 70, fontSize: 11, color: VIZ.text },
  heatCell: { width: 20, height: 20, margin: 1, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
});
