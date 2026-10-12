import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, issuesApi } from '../../../src/api/resources';
import CreateProjectSheet from '../../../src/components/CreateProjectSheet';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { IssueKey, ui } from '../../../src/components/ui';
import { THEME } from '../../../src/utils/constants';
import type { Project } from '../../../src/api/types';

type Link = { icon: any; label: string; route: string; count?: number; tone?: string; show: boolean };

/**
 * Müdürlükler tab — like the web sidebar: each müdürlük expands to everything
 * that belongs to it (talepler, onaylar, formlar, ekipler, stok, bilgiler).
 */
export default function ProjectsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can, canCreateProject, isWorker } = usePermissions();
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const issuesQuery = useQuery({ queryKey: ['issues'], queryFn: () => issuesApi.list() });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);

  const projects = projectsQuery.data || [];
  const issues = issuesQuery.data || [];
  const single = projects.length === 1;
  const toggle = (id: string) => setOpen((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  function linksFor(p: Project): Link[] {
    const mine = issues.filter((i) => i.projectId === p.id);
    const backlog = mine.filter((i) => !i.sprintId && i.status !== 'Geri Çevrildi').length;
    const waiting = mine.filter((i) => i.status === 'Onay Bekliyor').length;
    return [
      { icon: 'albums-outline', label: 'Aktif Talepler', route: `/(app)/projects/${p.id}?tab=board`, show: true },
      { icon: 'list-outline', label: 'Bekleyen Talepler', route: `/(app)/projects/${p.id}?tab=backlog`, count: backlog, show: true },
      { icon: 'shield-checkmark-outline', label: 'Onay Bekleyenler', route: `/(app)/projects/${p.id}?tab=approvals`, count: waiting, tone: THEME.violet, show: can('issue.approve') },
      { icon: 'document-text-outline', label: 'Talep Formları', route: `/(app)/forms?project=${p.id}`, show: !isWorker && can('request_form.manage') },
      { icon: 'people-outline', label: 'Ekipler ve Şablonlar', route: `/(app)/teams?project=${p.id}`, show: !isWorker && (can('team.manage') || can('template.manage')) },
      { icon: 'cube-outline', label: 'Stok Takip', route: `/(app)/inventory?project=${p.id}`, show: p.hasInventory },
    ];
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      {projectsQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>
      ) : (
        <ScrollView contentContainerStyle={ui.screen}
          refreshControl={<RefreshControl refreshing={projectsQuery.isFetching} onRefresh={() => { projectsQuery.refetch(); issuesQuery.refetch(); }} />}>
          {projects.length === 0 ? <Text style={styles.emptyText}>Erişilebilir müdürlük bulunamadı.</Text> : null}
          {projects.map((p) => {
            const expanded = single || open.has(p.id);
            const openCount = issues.filter((i) => i.projectId === p.id && ['To Do', 'In Progress', 'Onay Bekliyor'].includes(i.status)).length;
            return (
              <View key={p.id} style={[styles.card, expanded && styles.cardOpen]}>
                <TouchableOpacity style={[styles.head, expanded && styles.headOpen]} onPress={() => !single && toggle(p.id)} activeOpacity={single ? 1 : 0.7}>
                  {!single && <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={18} color={expanded ? THEME.navy : '#94a3b8'} />}
                  <IssueKey value={p.key} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.meta}>{openCount} açık talep</Text>
                  </View>
                </TouchableOpacity>
                {expanded && (
                  <View style={styles.links}>
                    {linksFor(p).filter((l) => l.show).map((l) => (
                      <TouchableOpacity key={l.label} style={styles.link} onPress={() => router.push(l.route as any)}>
                        <Ionicons name={l.icon} size={18} color={THEME.navy} />
                        <Text style={styles.linkText}>{l.label}</Text>
                        {l.count ? (
                          <View style={[styles.count, l.tone ? { backgroundColor: THEME.violetSoft } : null]}>
                            <Text style={[styles.countText, l.tone ? { color: l.tone } : null]}>{l.count}</Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                      </TouchableOpacity>
                    ))}
                    {can('project.edit') && !isWorker && (
                      <TouchableOpacity style={styles.link} onPress={() => setEditing(p)}>
                        <Ionicons name="settings-outline" size={18} color={THEME.navy} />
                        <Text style={styles.linkText}>Müdürlük Bilgileri</Text>
                        <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {canCreateProject && (
            <TouchableOpacity style={[ui.btnGhost, { borderStyle: 'dashed', marginTop: 4 }]} onPress={() => setCreateOpen(true)}>
              <Ionicons name="add" size={18} color={THEME.navy} />
              <Text style={[ui.btnGhostText, { color: THEME.navy }]}>Yeni Müdürlük</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      <CreateProjectSheet
        visible={createOpen || !!editing}
        project={editing}
        onCreated={() => {
          setCreateOpen(false);
          setEditing(null);
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }}
        onCancel={() => { setCreateOpen(false); setEditing(null); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: THEME.muted, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: THEME.surface, borderRadius: 14, borderWidth: 1, borderColor: THEME.line, marginBottom: 10, overflow: 'hidden' },
  cardOpen: { borderColor: '#c7d2fe' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  headOpen: { backgroundColor: '#eef2ff' },
  name: { fontSize: 15, fontWeight: '800', color: THEME.navy },
  meta: { fontSize: 12, color: THEME.muted, marginTop: 1 },
  links: { paddingHorizontal: 8, paddingBottom: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  linkText: { flex: 1, fontSize: 14, fontWeight: '600', color: THEME.ink },
  count: { minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: THEME.navySoft, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 11, fontWeight: '800', color: THEME.navy },
});
