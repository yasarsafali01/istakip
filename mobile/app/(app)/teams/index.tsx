import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { projectsApi, teamsApi, templatesApi, usersApi } from '../../../src/api/resources';
import { usePermissions } from '../../../src/hooks/usePermissions';
import PickerSheet from '../../../src/components/PickerSheet';
import ProjectSelect from '../../../src/components/ProjectSelect';
import { ROLES } from '../../../src/utils/constants';
import type { TemplateKind, Team, ReplyTemplate } from '../../../src/api/types';

const KINDS: Record<TemplateKind, { label: string; help: string }> = {
  reply: { label: 'Cevap', help: 'Yorum kutusuna eklenebilecek hazır yanıtlar.' },
  resolution: { label: 'Çözüm', help: 'Talep tamamlanırken "Çözüm İçeriği" alanına eklenebilecek metinler.' },
};

/** Mirrors the web Ekipler ve Şablonlar page (templates first, then teams). */
export default function TeamsTemplatesScreen() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const projects = projectsQuery.data || [];
  const [projectId, setProjectId] = useState('');
  const pid = projectId || projects[0]?.id || '';
  const project = projects.find((p) => p.id === pid);

  const teamsQuery = useQuery({ queryKey: ['teams', pid], queryFn: () => teamsApi.listByProject(pid), enabled: !!pid });
  const templatesQuery = useQuery({ queryKey: ['templates', pid, 'all'], queryFn: () => templatesApi.listByProject(pid, { all: true }), enabled: !!pid });

  const [kind, setKind] = useState<TemplateKind>('reply');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [teamName, setTeamName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memberPickerTeam, setMemberPickerTeam] = useState<Team | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['teams', pid] });
    queryClient.invalidateQueries({ queryKey: ['templates', pid] });
  };
  const run = (fn: () => Promise<any>) => fn().then(refresh).catch((err: any) => Alert.alert('Hata', err.message));

  // Only this müdürlük's own staff can join its teams (backend enforces too)
  const staff = (usersQuery.data || []).filter(
    (u) => u.role !== ROLES.EXTERNAL_USER && (u.projectId === pid || u.id === project?.managerId)
  );
  const userName = (id: string) => usersQuery.data?.find((u) => u.id === id)?.name || id;
  const kindTemplates = (templatesQuery.data || []).filter((t) => (t.kind || 'reply') === kind);

  function addTemplate() {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = 'Şablon başlığı boş bırakılamaz.';
    if (!body.trim()) e.body = 'Şablon metni boş bırakılamaz.';
    setErrors(e);
    if (Object.keys(e).length) return;
    run(async () => { await templatesApi.create(pid, { kind, title: title.trim(), body: body.trim() }); setTitle(''); setBody(''); });
  }

  function addTeam() {
    if (!teamName.trim()) { setErrors({ team: 'Ekip adı boş bırakılamaz.' }); return; }
    setErrors({});
    run(async () => { await teamsApi.create(pid, teamName.trim()); setTeamName(''); });
  }

  const confirmDelete = (label: string, fn: () => Promise<any>) =>
    Alert.alert('Sil', `"${label}" silinecek.`, [{ text: 'Vazgeç', style: 'cancel' }, { text: 'Sil', style: 'destructive', onPress: () => run(fn) }]);

  const Err = ({ k }: { k: string }) => (errors[k] ? (
    <View style={styles.errorRow}><Ionicons name="alert-circle" size={14} color="#DE350B" /><Text style={styles.errorText}>{errors[k]}</Text></View>
  ) : null);

  if (projectsQuery.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ProjectSelect projects={projects} value={pid} onChange={setProjectId} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Şablonlar */}
        <Text style={styles.sectionTitle}>Şablonlar</Text>
        <View style={styles.card}>
          <View style={styles.tabs}>
            {(Object.keys(KINDS) as TemplateKind[]).map((k) => (
              <TouchableOpacity key={k} style={[styles.tab, kind === k && styles.tabActive]} onPress={() => { setKind(k); setErrors({}); }}>
                <Text style={[styles.tabText, kind === k && styles.tabTextActive]}>
                  {KINDS[k].label} ({(templatesQuery.data || []).filter((t) => (t.kind || 'reply') === k).length})
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.help}>{KINDS[kind].help} Yer tutucular: {'{TalepNo}'}, {'{TalepEdenAdı}'}, {'{MüdürlükAdı}'}, {'{BenimAdım}'}.</Text>

          {can('template.manage') && (
            <>
              <Text style={styles.label}>Şablon başlığı <Text style={styles.req}>*</Text></Text>
              <TextInput style={[styles.input, errors.title && styles.inputError]} value={title} onChangeText={(t) => { setTitle(t); setErrors((e) => ({ ...e, title: '' })); }} />
              <Err k="title" />
              <Text style={styles.label}>Şablon metni <Text style={styles.req}>*</Text></Text>
              <TextInput style={[styles.input, styles.textArea, errors.body && styles.inputError]} multiline value={body} onChangeText={(t) => { setBody(t); setErrors((e) => ({ ...e, body: '' })); }} />
              <Err k="body" />
              <TouchableOpacity style={styles.primaryBtn} onPress={addTemplate}>
                <Ionicons name="add" size={16} color="#fff" /><Text style={styles.primaryText}>{KINDS[kind].label} Şablonu Ekle</Text>
              </TouchableOpacity>
            </>
          )}

          {kindTemplates.length === 0 ? <Text style={styles.empty}>Henüz şablon yok.</Text> : kindTemplates.map((t: ReplyTemplate) => (
            <View key={t.id} style={[styles.item, !t.isActive && { opacity: 0.55 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.itemTitle}>{t.title}</Text>
                {can('template.manage') && (
                  <>
                    <TouchableOpacity onPress={() => run(() => templatesApi.update(t.id, { title: t.title, body: t.body, sortOrder: t.sortOrder, isActive: !t.isActive }))}>
                      <Text style={styles.link}>{t.isActive ? 'Pasifleştir' : 'Aktifleştir'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => confirmDelete(t.title, () => templatesApi.delete(t.id))} style={{ marginLeft: 12 }}>
                      <Ionicons name="trash-outline" size={16} color="#DE350B" />
                    </TouchableOpacity>
                  </>
                )}
              </View>
              <Text style={styles.itemBody}>{t.body}</Text>
            </View>
          ))}
        </View>

        {/* Ekipler */}
        <Text style={styles.sectionTitle}>Ekipler</Text>
        <View style={styles.card}>
          <Text style={styles.help}>Talepleri tek kişi yerine bir ekibe atayabilirsiniz. Ekiplere yalnızca bu müdürlüğün personeli eklenebilir.</Text>
          {can('team.manage') && (
            <>
              <Text style={styles.label}>Yeni ekip adı <Text style={styles.req}>*</Text></Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput style={[styles.input, { flex: 1 }, errors.team && styles.inputError]} value={teamName} onChangeText={(t) => { setTeamName(t); setErrors({}); }} placeholder="Örn. Ağ Ekibi" />
                <TouchableOpacity style={[styles.primaryBtn, { marginTop: 0 }]} onPress={addTeam}><Text style={styles.primaryText}>Ekle</Text></TouchableOpacity>
              </View>
              <Err k="team" />
            </>
          )}
          {(teamsQuery.data || []).length === 0 ? <Text style={styles.empty}>Henüz ekip yok.</Text> : (teamsQuery.data || []).map((t) => (
            <View key={t.id} style={styles.item}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles.itemTitle}>{t.name}</Text>
                {can('team.manage') && (
                  <TouchableOpacity onPress={() => confirmDelete(t.name, () => teamsApi.delete(t.id))}>
                    <Ionicons name="trash-outline" size={16} color="#DE350B" />
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.chips}>
                {t.memberIds.length === 0 && <Text style={styles.empty}>Üye yok</Text>}
                {t.memberIds.map((uid) => (
                  <View key={uid} style={styles.chip}>
                    <Text style={styles.chipText}>{userName(uid)}</Text>
                    {can('team.manage') && (
                      <TouchableOpacity hitSlop={8} onPress={() => run(() => teamsApi.removeMember(t.id, uid))}>
                        <Ionicons name="close" size={13} color="#6B7280" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {can('team.manage') && staff.some((u) => !t.memberIds.includes(u.id)) && (
                  <TouchableOpacity style={styles.addChip} onPress={() => setMemberPickerTeam(t)}>
                    <Ionicons name="add" size={13} color="#0052CC" /><Text style={[styles.chipText, { color: '#0052CC' }]}>Üye ekle</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <PickerSheet
        visible={!!memberPickerTeam}
        title="Üye ekle"
        options={staff.filter((u) => !memberPickerTeam?.memberIds.includes(u.id)).map((u) => ({ key: u.id, label: u.name }))}
        onSelect={(uid) => { const t = memberPickerTeam; setMemberPickerTeam(null); if (t) run(() => teamsApi.addMember(t.id, uid)); }}
        onClose={() => setMemberPickerTeam(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  tabs: { flexDirection: 'row', backgroundColor: '#F1F2F4', borderRadius: 8, padding: 3, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 7, borderRadius: 6, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff', elevation: 1 },
  tabText: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  tabTextActive: { color: '#0052CC', fontWeight: '800' },
  help: { fontSize: 11, color: '#6B7280', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '700', color: '#172B4D', marginTop: 10, marginBottom: 6 },
  req: { color: '#DE350B' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  inputError: { borderColor: '#DE350B', borderWidth: 1.5 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: '#DE350B', fontWeight: '600' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginTop: 10 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  empty: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 8 },
  item: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, marginTop: 10 },
  itemTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#172B4D' },
  itemBody: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  link: { fontSize: 11, color: '#0052CC', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F4F5F7', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 12, color: '#374151' },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: '#B7D3F6', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
});
