import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import type { Issue, Project, RoleDef, User } from '../../api/types';
import { STATUS_COLORS, STATUS_LABELS, THEME } from '../../utils/constants';
import { timeAgo } from '../../utils/access';
import CreateRequestSheet from '../CreateRequestSheet';
import { Hero, HeroButton, Kpi, KpiGrid, Panel, Pill, Dot, SlaPill, Steps, IssueKey, OPEN_STATUSES, ui } from '../ui';

/** A request as its owner sees it: what it is, where it went and how far along it is. */
function TrackRow({ request, projectName, onPress }: { request: Issue; projectName?: string; onPress: () => void }) {
  const color = STATUS_COLORS[request.status] === '#DFE1E6' ? '#94a3b8' : STATUS_COLORS[request.status];
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowTop}>
        <IssueKey value={request.key} />
        <Text style={styles.rowTitle} numberOfLines={1}>{request.title}</Text>
        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
      </View>
      <View style={styles.rowMeta}>
        <Ionicons name="location-outline" size={12} color={THEME.muted} />
        <Text style={styles.rowMetaText} numberOfLines={1}>{projectName || '—'} · {timeAgo(request.createdAt)} açıldı</Text>
      </View>
      <View style={styles.rowPills}>
        <Pill label={STATUS_LABELS[request.status]} bg="#f1f5f9" color={THEME.ink} />
        <Dot color={color} />
        <SlaPill issue={request} />
      </View>
      <Steps status={request.status} compact />
    </TouchableOpacity>
  );
}

/**
 * Ana sayfa for requesters (Üniversite Personeli / Öğrenci): open a request in
 * one tap, follow where each one stands, rate the solved ones.
 */
export default function RequesterHome({ currentUser, issues, projects, roles }: {
  currentUser: User; issues: Issue[]; projects: Project[]; roles: RoleDef[];
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const mine = issues.filter((r) => r.isRequest && r.reporterId === currentUser.id)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const byId = Object.fromEntries(projects.map((p) => [p.id, p]));
  const open = mine.filter((r) => OPEN_STATUSES.includes(r.status));
  const inProgress = mine.filter((r) => r.status === 'In Progress');
  const done = mine.filter((r) => r.status === 'Done');
  const toRate = done.filter((r) => r.allowedActions?.rate);
  const closed = mine.filter((r) => !OPEN_STATUSES.includes(r.status))
    .sort((a, b) => +new Date(b.updatedAt || b.createdAt) - +new Date(a.updatedAt || a.createdAt));
  const roleName = roles.find((r) => r.key === currentUser.roleKey)?.name || 'Talep Sahibi';
  const openRequest = (id: string) => router.push(`/(app)/issues/${id}`);

  return (
    <>
      <Hero
        name={currentUser.name}
        eyebrow={roleName}
        sub="Bir birimden destek mi gerekiyor? Talebinizi açın, nerede olduğunu buradan takip edin."
        chips={[
          { label: `${open.length} açık talep`, icon: 'file-tray-outline' },
          ...(toRate.length ? [{ label: `${toRate.length} talep puanınızı bekliyor`, icon: 'star-outline' }] : []),
        ]}
        actions={(
          <>
            <HeroButton solid label="Yeni Talep Oluştur" icon="add" onPress={() => setCreateOpen(true)} />
            <HeroButton label="Tüm taleplerim" icon="list-outline" onPress={() => router.push('/(app)/requests')} />
          </>
        )}
      />

      <KpiGrid>
        <Kpi label="Açık talep" value={open.length} icon="file-tray-outline" tone="navy" sub="Sonuçlanmayı bekliyor" />
        <Kpi label="İşlemde" value={inProgress.length} icon="sync-outline" tone="orange" sub="Üzerinde çalışılıyor" />
        <Kpi label="Tamamlanan" value={done.length} icon="checkmark-circle-outline" tone="ok" sub={`Toplam ${mine.length} talepten`} />
        <Kpi label="Puan bekleyen" value={toRate.length} icon="star-outline" tone="warn" sub="Çözülen talebi değerlendirin" />
      </KpiGrid>

      {toRate.length > 0 && (
        <Panel title="Puanlamanızı bekleyenler" icon="star" iconColor={THEME.orange} count={toRate.length} hint="Açıp 1–5 yıldız verin"
          style={{ borderColor: THEME.orange, backgroundColor: THEME.orangeSoft }}>
          {toRate.slice(0, 4).map((r) => <TrackRow key={r.id} request={r} projectName={byId[r.projectId]?.name} onPress={() => openRequest(r.id)} />)}
        </Panel>
      )}

      <Panel title="Açık taleplerim" icon="file-tray-outline" count={open.length} hint="Talebinize dokunup detayını görün">
        {open.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={styles.empty}>Açık talebiniz yok.</Text>
            <TouchableOpacity style={[ui.btnPrimary, { marginTop: 10 }]} onPress={() => setCreateOpen(true)}>
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={ui.btnPrimaryText}>Yeni talep oluştur</Text>
            </TouchableOpacity>
          </View>
        ) : open.map((r) => <TrackRow key={r.id} request={r} projectName={byId[r.projectId]?.name} onPress={() => openRequest(r.id)} />)}
      </Panel>

      <Panel title="Son sonuçlananlar" icon="time-outline" hint="Tamamlanan, geri çevrilen, iptal edilen">
        {closed.length === 0 ? <Text style={styles.empty}>Henüz sonuçlanan talebiniz yok.</Text>
          : closed.slice(0, 6).map((r) => <TrackRow key={r.id} request={r} projectName={byId[r.projectId]?.name} onPress={() => openRequest(r.id)} />)}
      </Panel>

      <CreateRequestSheet
        visible={createOpen}
        onCreated={() => { setCreateOpen(false); queryClient.invalidateQueries({ queryKey: ['issues'] }); }}
        onCancel={() => setCreateOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: THEME.muted, textAlign: 'center', paddingVertical: 8 },
  row: { paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: THEME.ink },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  rowMetaText: { flex: 1, fontSize: 12, color: THEME.muted },
  rowPills: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
});
