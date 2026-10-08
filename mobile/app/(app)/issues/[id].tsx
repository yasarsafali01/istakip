import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, Alert, Modal,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  issuesApi, usersApi, commentsApi, activitiesApi, projectsApi, teamsApi, templatesApi, filesApi,
} from '../../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../../src/components/Badge';
import Avatar from '../../../src/components/Avatar';
import PickerSheet from '../../../src/components/PickerSheet';
import CompleteIssueModal from '../../../src/components/CompleteIssueModal';
import ApprovalPanel from '../../../src/components/ApprovalPanel';
import { useAuth } from '../../../src/context/AuthContext';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { MANUAL_STATUSES, STATUS_LABELS, ROLES, MANAGER_ROLES } from '../../../src/utils/constants';
import { requestDurations, formatDuration } from '../../../src/utils/durationUtils';
import { getSlaInfo, SLA_RISK_COLORS } from '../../../src/utils/slaUtils';
import { formatAnswer, formatBytes } from '../../../src/utils/requestForm';
import { fillTemplate } from '../../../src/utils/templateUtils';
import type { FileRef } from '../../../src/api/types';

const TERMINAL = ['Done', 'Geri Çevrildi', 'İptal Edildi', 'Yönlendirildi'];

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { can, isExternalUser, isSystemAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState('');
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [visiblePickerOpen, setVisiblePickerOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');

  const issueQuery = useQuery({ queryKey: ['issue', id], queryFn: () => issuesApi.get(id!) });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const commentsQuery = useQuery({ queryKey: ['comments', id], queryFn: () => commentsApi.listByIssue(id!) });
  const activitiesQuery = useQuery({ queryKey: ['activities', id], queryFn: () => activitiesApi.listByIssue(id!) });
  const projectId = issueQuery.data?.projectId;
  const projectQuery = useQuery({ queryKey: ['project', projectId], queryFn: () => projectsApi.get(projectId!), enabled: !!projectId && !isExternalUser });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const teamsQuery = useQuery({ queryKey: ['teams', projectId], queryFn: () => teamsApi.listByProject(projectId!), enabled: !!projectId && !isExternalUser });
  const templatesQuery = useQuery({
    queryKey: ['templates', projectId, 'reply'],
    queryFn: () => templatesApi.listByProject(projectId!, { kind: 'reply' }),
    enabled: !!projectId && !isExternalUser,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['issue', id] });
    queryClient.invalidateQueries({ queryKey: ['activities', id] });
    queryClient.invalidateQueries({ queryKey: ['comments', id] });
    queryClient.invalidateQueries({ queryKey: ['issues'] });
  }
  const run = (fn: () => Promise<any>) => fn().then(invalidate).catch((err: any) => Alert.alert('Hata', err.message));

  const issue = issueQuery.data;
  const project = projectQuery.data || projectsQuery.data?.find((p) => p.id === projectId);
  const users = usersQuery.data || [];
  const getUserName = (userId?: string | null) => (userId ? users.find((u) => u.id === userId)?.name : undefined);

  if (issueQuery.isLoading || !issue) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;
  }

  const isOwn = issue.reporterId === currentUser?.id;
  const isTerminal = TERMINAL.includes(issue.status);
  const pendingLocked = issue.status === 'Onay Bekliyor' && !can('issue.approve');
  const canChangeStatus = can('issue.status') && !isExternalUser && issue.status !== 'Geri Çevrildi' && !pendingLocked;
  // Mirrors backend CanChangeAssignee: issue.assign, and the reporter can't assign their own issue.
  const canAssign = !!currentUser && !isExternalUser && !isOwn && can('issue.assign');
  const canClone = issue.isRequest && can('issue.clone') && (!isExternalUser || isOwn);
  const canForward = issue.isRequest && can('issue.forward') && !isTerminal;
  const canCancel = issue.isRequest && isOwn && !isTerminal;
  const canDelete = can('issue.delete') && isOwn; // kimse kendi açmadığı talebi silemez
  const canReject = MANAGER_ROLES.includes(currentUser?.role || '') && issue.status !== 'Geri Çevrildi' && !isTerminal;
  const canRate = issue.isRequest && isOwn && issue.status === 'Done' && !issue.ratedAt;

  const team = issue.assigneeTeamId ? teamsQuery.data?.find((t) => t.id === issue.assigneeTeamId) : undefined;
  const assigneeName = getUserName(issue.assigneeId) || (team ? `${team.name} (ekip)` : undefined);
  const reporterName = getUserName(issue.reporterId);
  const sla = getSlaInfo(issue);
  const slaColors = sla ? (SLA_RISK_COLORS as Record<string, { bg: string; text: string }>)[sla.risk] : null;
  const d = requestDurations(issue);

  // Assignable people: mirrors web — Worker scoped to the müdürlük, PM/DeptHead to their scope.
  const assignableUsers = users.filter((u) => {
    if (u.role === ROLES.EXTERNAL_USER) return false;
    if (isSystemAdmin) return true;
    if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
    if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
    if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
    return false;
  });
  const externalUsersToAdd = users.filter((u) => u.role === ROLES.EXTERNAL_USER && !issue.visibleTo.includes(u.id));
  const forwardTargets = (projectsQuery.data || []).filter((p) => p.id !== issue.projectId);

  function handleStatusChange(newStatus: string) {
    if (newStatus === 'Done') { setDoneModalOpen(true); return; }
    run(() => issuesApi.updateStatus(issue!.id, newStatus));
  }

  function handleAssign(key: string) {
    setAssigneePickerOpen(false);
    if (key.startsWith('team:')) run(() => issuesApi.assignTeam(issue!.id, key.slice(5)));
    else run(() => issuesApi.updateAssignee(issue!.id, key === '__none__' ? null : key.slice(5)));
  }

  function handleForward(targetId: string) {
    setForwardOpen(false);
    Alert.alert('Talebi yönlendir', 'Talep seçilen müdürlüğe taşınır, ataması kaldırılır ve durumu "Yönlendirildi" olur.', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Yönlendir', onPress: () => run(() => issuesApi.forward(issue!.id, targetId, '')) },
    ]);
  }

  function handleCancel() {
    Alert.alert('Talebi iptal et', 'Bu talep iptal edilecek. Emin misiniz?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'İptal Et', style: 'destructive', onPress: () => run(() => issuesApi.cancel(issue!.id)) },
    ]);
  }

  function handleDelete() {
    Alert.alert('Talebi sil', `"${issue!.title}" silinecek. Bu işlem geri alınamaz.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await issuesApi.delete(issue!.id);
            queryClient.invalidateQueries({ queryKey: ['issues'] });
            router.back();
          } catch (err: any) { Alert.alert('Hata', err.message); }
        },
      },
    ]);
  }

  async function handleReject() {
    if (!rejectReason.trim()) { setRejectError('Geri çevirme gerekçesi boş bırakılamaz.'); return; }
    try {
      await issuesApi.updateStatus(issue!.id, 'Geri Çevrildi');
      await issuesApi.updateAssignee(issue!.id, issue!.reporterId);
      await commentsApi.create(issue!.id, `🚫 **Talep Geri Çevrildi**\n\n${rejectReason.trim()}`);
      setRejectOpen(false);
      setRejectReason('');
      invalidate();
    } catch (err: any) { Alert.alert('Hata', err.message); }
  }

  async function handleClone() {
    try {
      const cloned = await issuesApi.clone(issue!.id);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      router.replace(`/(app)/issues/${cloned.id}`);
    } catch (err: any) { Alert.alert('Hata', err.message); }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    try {
      await commentsApi.create(issue!.id, commentText.trim());
      setCommentText('');
      invalidate();
    } catch (err: any) { Alert.alert('Hata', err.message); }
  }

  function applyReplyTemplate(templateId: string) {
    setTemplatePickerOpen(false);
    const t = templatesQuery.data?.find((x) => x.id === templateId);
    if (t) setCommentText(fillTemplate(t.body, { issue, project, currentUser, reporterName }));
  }

  async function handleRate() {
    if (!rating) { Alert.alert('Uyarı', 'Lütfen 1-5 arasında bir puan seçin.'); return; }
    run(() => issuesApi.rate(issue!.id, rating, ratingComment.trim()));
  }

  const openFile = (f: FileRef) => filesApi.open(f).catch((err: any) => Alert.alert('Dosya açılamadı', err.message));

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen options={{ title: issue.key, headerBackTitle: 'Geri' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {sla && slaColors && (
            <View style={[styles.sla, { backgroundColor: slaColors.bg }]}>
              <Text style={[styles.slaText, { color: slaColors.text }]}>{sla.label}</Text>
            </View>
          )}
        </View>
        {issue.requestFormName ? <Text style={styles.formBadge}>{issue.requestFormName}</Text> : null}
        <Text style={styles.title}>{issue.title}</Text>
        <Text style={styles.description}>{issue.description || 'Açıklama eklenmemiş.'}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Atanan</Text>
            <TouchableOpacity style={styles.personRow} disabled={!canAssign} onPress={() => setAssigneePickerOpen(true)}>
              {assigneeName && !team && <Avatar name={assigneeName} size={22} />}
              {team && <Ionicons name="people" size={18} color="#0052CC" />}
              <Text style={[styles.metaValue, canAssign && styles.metaValueLink]}>{assigneeName || 'Atanmamış'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Talep Eden</Text>
            <View style={styles.personRow}>
              {reporterName && <Avatar name={reporterName} size={22} />}
              <Text style={styles.metaValue}>{reporterName || '—'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Müdürlük</Text>
            <Text style={[styles.metaValue, { marginLeft: 0 }]}>{project?.name || '—'}</Text>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Açılış</Text>
            <Text style={[styles.metaValue, { marginLeft: 0 }]}>{new Date(issue.createdAt).toLocaleString('tr-TR')}</Text>
          </View>
        </View>
        {issue.contactName || issue.contactPhone ? (
          <View style={styles.contactBox}>
            <Ionicons name="call-outline" size={16} color="#42526E" />
            <Text style={styles.contactText}>Adına açılan: {issue.contactName || '—'} {issue.contactPhone ? `· ${issue.contactPhone}` : ''}</Text>
          </View>
        ) : null}

        {/* Süreler */}
        <View style={styles.durRow}>
          {[
            ['Bekleme', d.waiting, '#D4A000'],
            ['Çözüm', d.resolution, '#FF991F'],
            ['Toplam', d.total, '#00875A'],
          ].map(([label, part, color]: any) => (
            <View key={label} style={[styles.durBox, { borderLeftColor: color }]}>
              <Text style={styles.durLabel}>{label} Süresi</Text>
              <Text style={[styles.durValue, { color }]}>{formatDuration(part?.ms ?? null)}</Text>
              <Text style={styles.durHint}>{!part ? 'Kayıt yok' : part.ongoing ? 'devam ediyor' : ' '}</Text>
            </View>
          ))}
        </View>

        {/* Talep Bilgileri (form cevapları) */}
        {issue.requestAnswers?.length > 0 && (
          <View style={styles.answersBox}>
            <Text style={styles.sectionTitle}>Talep Bilgileri</Text>
            {issue.requestAnswers.map((a) => (
              <View key={a.questionId} style={{ marginBottom: 8 }}>
                <Text style={styles.answerLabel}>{a.label}</Text>
                {a.type === 'file' ? (a.value || []).map((f: FileRef) => (
                  <TouchableOpacity key={f.id} style={styles.fileLink} onPress={() => openFile(f)}>
                    <Ionicons name="attach" size={15} color="#0052CC" />
                    <Text style={styles.fileLinkText}>{f.name}</Text>
                    <Text style={styles.durHint}>({formatBytes(f.size)})</Text>
                  </TouchableOpacity>
                )) : <Text style={styles.answerValue}>{formatAnswer(a)}</Text>}
              </View>
            ))}
          </View>
        )}

        <ApprovalPanel issue={issue} users={users} onChanged={invalidate} />

        {/* Eylemler */}
        <View style={styles.actionRow}>
          {canClone && <ActionBtn icon="copy-outline" label="Klonla" onPress={handleClone} />}
          {canForward && <ActionBtn icon="arrow-redo-outline" label="Yönlendir" onPress={() => setForwardOpen(true)} />}
          {canCancel && <ActionBtn icon="ban-outline" label="İptal Et" onPress={handleCancel} />}
          {canReject && <ActionBtn icon="close-circle-outline" label="Geri Çevir" danger onPress={() => { setRejectOpen(true); setRejectError(''); }} />}
          {canDelete && <ActionBtn icon="trash-outline" label="Sil" danger onPress={handleDelete} />}
        </View>

        {/* Puanlama */}
        {(canRate || issue.ratedAt) && issue.isRequest && (
          <View style={styles.ratingBox}>
            <Text style={styles.sectionTitle}>Memnuniyet</Text>
            {issue.ratedAt ? (
              <>
                <Text style={styles.stars}>{'★'.repeat(issue.rating || 0)}{'☆'.repeat(5 - (issue.rating || 0))}</Text>
                {issue.ratingComment ? <Text style={styles.answerValue}>{issue.ratingComment}</Text> : null}
              </>
            ) : (
              <>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                      <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={28} color="#F59E0B" />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[styles.commentInput, { marginTop: 8 }]} placeholder="Yorumunuz (isteğe bağlı)"
                  value={ratingComment} onChangeText={setRatingComment} multiline />
                <TouchableOpacity style={[styles.sendBtn, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={handleRate}>
                  <Text style={styles.sendBtnText}>Puanla</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {issue.isRequest && !isExternalUser && (
          <View style={styles.visibleSection}>
            <Text style={styles.sectionTitle}>Görünür Kullanıcılar</Text>
            {issue.visibleTo.map((uid) => <Text key={uid} style={styles.visibleUserText}>• {getUserName(uid) || uid}</Text>)}
            {externalUsersToAdd.length > 0 && can('issue.share') && (
              <TouchableOpacity onPress={() => setVisiblePickerOpen(true)}>
                <Text style={styles.addVisibleBtnText}>+ Kullanıcı Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {canChangeStatus && (
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Durum Değiştir</Text>
            <View style={styles.statusButtons}>
              {MANUAL_STATUSES.filter((s) => s !== issue.status && s !== 'Geri Çevrildi').map((s) => (
                <TouchableOpacity key={s} style={styles.statusBtn} onPress={() => handleStatusChange(s)}>
                  <Text style={styles.statusBtnText}>{STATUS_LABELS[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Yorumlar ({commentsQuery.data?.length ?? 0})</Text>
        {(commentsQuery.data || []).map((c) => (
          <View key={c.id} style={styles.commentRow}>
            <Avatar name={getUserName(c.authorId) || '?'} size={26} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.commentAuthor}>{getUserName(c.authorId) || 'Bilinmeyen'}</Text>
              <Text style={styles.commentText}>{c.text}</Text>
            </View>
          </View>
        ))}

        {!isExternalUser || isOwn ? (
          <>
            {(templatesQuery.data || []).length > 0 && (
              <TouchableOpacity onPress={() => setTemplatePickerOpen(true)} style={styles.templateBtn}>
                <Ionicons name="document-text-outline" size={14} color="#0052CC" />
                <Text style={styles.addVisibleBtnText}>Cevap şablonu ekle</Text>
              </TouchableOpacity>
            )}
            <View style={styles.commentInputRow}>
              <TextInput style={styles.commentInput} placeholder="Yorum yaz..." value={commentText} onChangeText={setCommentText} multiline />
              <TouchableOpacity style={styles.sendBtn} onPress={handleAddComment} disabled={!commentText.trim()}>
                <Text style={styles.sendBtnText}>Gönder</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Aktivite</Text>
        {(activitiesQuery.data || []).map((a) => (
          <View key={a.id} style={styles.activityRow}>
            <Text style={styles.activityText}>
              <Text style={{ fontWeight: '700' }}>{getUserName(a.userId) || 'Bilinmeyen'} </Text>
              {a.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      <CompleteIssueModal
        visible={doneModalOpen}
        issueId={issue.id}
        projectId={issue.projectId}
        hasInventory={project?.hasInventory}
        issue={issue}
        projectName={project?.name}
        reporterName={reporterName}
        onDone={() => { setDoneModalOpen(false); invalidate(); }}
        onCancel={() => setDoneModalOpen(false)}
      />

      <PickerSheet
        visible={assigneePickerOpen}
        title="Kişi veya Ekip Ata"
        options={[
          { key: '__none__', label: '— Atanmamış —' },
          ...assignableUsers.map((u) => ({ key: `user:${u.id}`, label: u.name, sublabel: 'Kişi' })),
          ...(teamsQuery.data || []).map((t) => ({ key: `team:${t.id}`, label: t.name, sublabel: `Ekip · ${t.memberIds.length} üye` })),
        ]}
        onSelect={handleAssign}
        onClose={() => setAssigneePickerOpen(false)}
      />
      <PickerSheet
        visible={visiblePickerOpen}
        title="Görünürlük Ekle"
        options={externalUsersToAdd.map((u) => ({ key: u.id, label: u.name }))}
        onSelect={(uid) => { setVisiblePickerOpen(false); run(() => issuesApi.addVisibleUser(issue.id, uid)); }}
        onClose={() => setVisiblePickerOpen(false)}
      />
      <PickerSheet
        visible={forwardOpen}
        title="Hangi müdürlüğe yönlendirilsin?"
        options={forwardTargets.map((p) => ({ key: p.id, label: p.name }))}
        onSelect={handleForward}
        onClose={() => setForwardOpen(false)}
      />
      <PickerSheet
        visible={templatePickerOpen}
        title="Cevap Şablonu"
        options={(templatesQuery.data || []).map((t) => ({ key: t.id, label: t.title, sublabel: t.body.slice(0, 60) }))}
        onSelect={applyReplyTemplate}
        onClose={() => setTemplatePickerOpen(false)}
      />

      <Modal visible={rejectOpen} transparent animationType="slide" onRequestClose={() => setRejectOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Talebi Geri Çevir</Text>
            <Text style={styles.durHint}>Talep açan kişiye geri gönderilir ve durumu "Geri Çevrildi" olur.</Text>
            <Text style={styles.answerLabel}>Gerekçe <Text style={{ color: '#DE350B' }}>*</Text></Text>
            <TextInput style={[styles.commentInput, rejectError ? { borderColor: '#DE350B', borderWidth: 1.5 } : null]}
              multiline value={rejectReason} onChangeText={(t) => { setRejectReason(t); setRejectError(''); }}
              placeholder="Örn. yanlış müdürlüğe açılmış, eksik bilgi…" />
            {rejectError ? <Text style={styles.errorText}>{rejectError}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setRejectOpen(false)} style={{ padding: 10 }}><Text style={{ color: '#6B7280', fontWeight: '600' }}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleReject} style={[styles.sendBtn, { backgroundColor: '#DE350B' }]}><Text style={styles.sendBtnText}>Geri Çevir</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function ActionBtn({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, danger && { borderColor: '#FCA5A5' }]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={danger ? '#DE350B' : '#374151'} />
      <Text style={[styles.actionBtnText, danger && { color: '#DE350B' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  sla: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  slaText: { fontSize: 11, fontWeight: '700' },
  formBadge: { alignSelf: 'flex-start', backgroundColor: '#EEF4FD', color: '#0052CC', fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '700', color: '#172B4D', marginBottom: 8 },
  description: { fontSize: 14, color: '#42526E', marginBottom: 16, lineHeight: 20 },
  metaRow: { flexDirection: 'row', marginBottom: 12, gap: 20 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '700', marginBottom: 4 },
  metaValue: { fontSize: 13, color: '#172B4D', marginLeft: 6 },
  metaValueLink: { color: '#0052CC', fontWeight: '600' },
  personRow: { flexDirection: 'row', alignItems: 'center' },
  contactBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F4F5F7', borderRadius: 8, padding: 8, marginBottom: 12 },
  contactText: { fontSize: 12, color: '#42526E', flex: 1 },
  durRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  durBox: { flex: 1, borderWidth: 1, borderColor: '#E5E7EB', borderLeftWidth: 3, borderRadius: 8, padding: 8 },
  durLabel: { fontSize: 10, color: '#6B7280', fontWeight: '700' },
  durValue: { fontSize: 14, fontWeight: '800', marginTop: 2 },
  durHint: { fontSize: 10, color: '#9CA3AF' },
  answersBox: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, marginBottom: 14 },
  answerLabel: { fontSize: 12, fontWeight: '700', color: '#172B4D', marginTop: 6, marginBottom: 2 },
  answerValue: { fontSize: 13, color: '#42526E' },
  fileLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  fileLinkText: { fontSize: 13, color: '#0052CC', fontWeight: '600' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  ratingBox: { marginBottom: 16 },
  stars: { fontSize: 22, color: '#F59E0B' },
  visibleSection: { marginBottom: 16 },
  visibleUserText: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  addVisibleBtnText: { fontSize: 12, color: '#0052CC', fontWeight: '600' },
  statusSection: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#172B4D', marginBottom: 10, marginTop: 6, textTransform: 'uppercase' },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  statusBtnText: { fontSize: 12, color: '#374151' },
  commentRow: { flexDirection: 'row', marginBottom: 12 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#172B4D' },
  commentText: { fontSize: 13, color: '#42526E', backgroundColor: '#F4F5F7', padding: 8, borderRadius: 6, marginTop: 2 },
  templateBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'flex-end' },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 13, minHeight: 40 },
  sendBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  activityRow: { marginBottom: 8 },
  activityText: { fontSize: 12, color: '#42526E' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  errorText: { fontSize: 12, color: '#DE350B', fontWeight: '600', marginTop: 4 },
});
