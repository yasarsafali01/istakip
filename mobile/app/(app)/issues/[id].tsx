import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, Alert, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  issuesApi, usersApi, commentsApi, activitiesApi, projectsApi, unitsApi, templatesApi, filesApi,
} from '../../../src/api/resources';
import Avatar from '../../../src/components/Avatar';
import PickerSheet from '../../../src/components/PickerSheet';
import CompleteIssueModal from '../../../src/components/CompleteIssueModal';
import ApprovalPanel from '../../../src/components/ApprovalPanel';
import { IssueKey, Pill, Dot, SlaPill, Steps, ui } from '../../../src/components/ui';
import { useAuth } from '../../../src/context/AuthContext';
import {
  MANUAL_STATUSES, STATUS_LABELS, PRIORITIES, PRIORITY_LABELS, PRIORITY_COLORS, ROLES, THEME,
} from '../../../src/utils/constants';
import { requestDurations, formatDuration } from '../../../src/utils/durationUtils';
import { formatAnswer, formatBytes } from '../../../src/utils/requestForm';
import { fillTemplate } from '../../../src/utils/templateUtils';
import { timeAgo, formatDate } from '../../../src/utils/access';
import type { FileRef, IssueActions } from '../../../src/api/types';

const CLOSED_BANNERS: Record<string, { text: string; bg: string; fg: string }> = {
  'Geri Çevrildi': { text: 'Bu talep geri çevrildi. Nedeni yorumlarda yer alıyor.', bg: THEME.dangerSoft, fg: THEME.danger },
  'İptal Edildi': { text: 'Talep sahibi bu talebi iptal etti.', bg: '#f1f5f9', fg: '#475569' },
  Yönlendirildi: { text: 'Bu talep başka bir müdürlüğe yönlendirildi.', bg: THEME.violetSoft, fg: THEME.violet },
};
const NO_ACTIONS: IssueActions = {
  edit: false, delete: false, changeStatus: false, complete: false, approve: false, assign: false, reject: false,
  forward: false, cancel: false, rate: false, clone: false, share: false, moveSprint: false, editDates: false, comment: false,
};

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
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
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ title: '', description: '', priority: 'Medium', projectId: '' });
  const [pickProjectOpen, setPickProjectOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dates, setDates] = useState({ resolvedAt: '', timeSpent: '' });

  const issueQuery = useQuery({ queryKey: ['issue', id], queryFn: () => issuesApi.get(id!) });
  const issue = issueQuery.data;
  const actions = issue?.allowedActions || NO_ACTIONS;
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const commentsQuery = useQuery({ queryKey: ['comments', id], queryFn: () => commentsApi.listByIssue(id!) });
  const activitiesQuery = useQuery({ queryKey: ['activities', id], queryFn: () => activitiesApi.listByIssue(id!) });
  const projectId = issue?.projectId;
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  // People and teams the backend accepts as assignee (same rule it validates with).
  const assigneesQuery = useQuery({
    queryKey: ['assignees', id, projectId], queryFn: () => issuesApi.assignees(id!), enabled: !!issue && actions.assign,
  });
  const templatesQuery = useQuery({
    queryKey: ['templates', projectId, 'reply'],
    queryFn: () => templatesApi.listByProject(projectId!, { kind: 'reply' }),
    enabled: !!projectId && actions.comment && currentUser?.role !== ROLES.EXTERNAL_USER,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['issue', id] });
    queryClient.invalidateQueries({ queryKey: ['activities', id] });
    queryClient.invalidateQueries({ queryKey: ['comments', id] });
    queryClient.invalidateQueries({ queryKey: ['assignees', id] });
    queryClient.invalidateQueries({ queryKey: ['issues'] });
  }
  const run = (fn: () => Promise<any>) => fn().then(invalidate).catch((err: any) => Alert.alert('Hata', err.message));

  if (issueQuery.isLoading || !issue) {
    return <View style={styles.center}><ActivityIndicator size="large" color={THEME.navy} /></View>;
  }

  const projects = projectsQuery.data || [];
  const project = projects.find((p) => p.id === projectId);
  const unit = unitsQuery.data?.find((u) => u.id === project?.unitId);
  const users = usersQuery.data || [];
  const userName = (uid?: string | null) => (uid ? users.find((u) => u.id === uid)?.name : undefined);
  const assignee = users.find((u) => u.id === issue.assigneeId);
  const reporter = users.find((u) => u.id === issue.reporterId);
  const team = issue.assigneeTeamId ? assigneesQuery.data?.teams.find((t) => t.id === issue.assigneeTeamId) : undefined;
  const d = requestDurations(issue);
  const banner = CLOSED_BANNERS[issue.status];
  const statusTargets = MANUAL_STATUSES.filter((s) => s !== issue.status && s !== 'Geri Çevrildi');
  const requesters = users.filter((u) => u.isActive !== false && u.role === ROLES.EXTERNAL_USER && !issue.visibleTo.includes(u.id));
  const forwardTargets = projects.filter((p) => p.id !== issue.projectId);
  const unitProjects = projects.filter((p) => p.unitId === project?.unitId);
  const hasAnswers = issue.requestAnswers?.length > 0;

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
    if (t) setCommentText(fillTemplate(t.body, { issue, project, currentUser, reporterName: reporter?.name }));
  }

  function handleRate() {
    if (!rating) { Alert.alert('Uyarı', 'Lütfen 1-5 arasında bir puan seçin.'); return; }
    run(() => issuesApi.rate(issue!.id, rating, ratingComment.trim()));
  }

  function openEdit() {
    setEdit({ title: issue!.title, description: issue!.description || '', priority: issue!.priority, projectId: issue!.projectId });
    setEditOpen(true);
  }
  async function saveEdit() {
    if (!edit.title.trim()) { Alert.alert('Uyarı', 'Başlık boş olamaz.'); return; }
    try {
      await issuesApi.update(issue!.id, {
        title: edit.title.trim(), description: edit.description, priority: edit.priority as any, projectId: edit.projectId,
      });
      setEditOpen(false);
      invalidate();
    } catch (err: any) { Alert.alert('Hata', err.message); }
  }

  function openDates() {
    setDates({ resolvedAt: issue!.resolvedAt ? issue!.resolvedAt.substring(0, 10) : '', timeSpent: String(issue!.timeSpent || '') });
    setDatesOpen(true);
  }
  async function saveDates() {
    const minutes = parseInt(dates.timeSpent || '0', 10);
    if (Number.isNaN(minutes) || minutes < 0) { Alert.alert('Uyarı', 'Harcanan zaman negatif olamaz.'); return; }
    if (dates.resolvedAt && !/^\d{4}-\d{2}-\d{2}$/.test(dates.resolvedAt)) { Alert.alert('Uyarı', 'Tarihi YYYY-AA-GG biçiminde girin.'); return; }
    try {
      await issuesApi.updateDates(issue!.id, dates.resolvedAt ? new Date(dates.resolvedAt).toISOString() : null, minutes);
      setDatesOpen(false);
      invalidate();
    } catch (err: any) { Alert.alert('Hata', err.message); }
  }

  const openFile = (f: FileRef) => filesApi.open(f).catch((err: any) => Alert.alert('Dosya açılamadı', err.message));
  const hasToolbar = (actions.changeStatus && statusTargets.length > 0) || actions.assign || actions.edit || actions.forward
    || actions.clone || actions.reject || actions.cancel || actions.delete;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME.canvas }} edges={['bottom']}>
      <Stack.Screen options={{ title: 'Talep Detayı', headerBackTitle: 'Geri' }} />
      <ScrollView contentContainerStyle={ui.screen} keyboardShouldPersistTaps="handled">
        {/* ── Başlık alanı ── */}
        <View style={[ui.card, { marginBottom: 12 }]}>
          <View style={styles.crumbs}>
            <IssueKey value={issue.key} />
            <Text style={styles.crumbText} numberOfLines={1}>{[unit?.name, project?.name].filter(Boolean).join(' / ')}</Text>
          </View>
          <Text style={styles.title}>{issue.title}</Text>
          <View style={styles.metaWrap}>
            <Pill label={STATUS_LABELS[issue.status]} bg="#f1f5f9" color={THEME.ink} />
            <View style={styles.inline}><Dot color={PRIORITY_COLORS[issue.priority]} /><Text style={styles.metaText}>{PRIORITY_LABELS[issue.priority]}</Text></View>
            {issue.requestFormName ? <Pill label={issue.requestFormName} bg={THEME.navySoft} color={THEME.navy} icon="pricetag-outline" /> : null}
            <SlaPill issue={issue} />
          </View>
          {reporter && (
            <View style={[styles.inline, { marginTop: 8 }]}>
              <Avatar name={reporter.name} color={reporter.avatarColor} size={18} />
              <Text style={styles.metaText}><Text style={{ fontWeight: '700', color: THEME.ink }}>{reporter.name}</Text> açtı · {timeAgo(issue.createdAt)}</Text>
            </View>
          )}
          {banner ? (
            <View style={[styles.banner, { backgroundColor: banner.bg }]}>
              <Ionicons name="ban-outline" size={17} color={banner.fg} />
              <Text style={[styles.bannerText, { color: banner.fg }]}>{banner.text}</Text>
            </View>
          ) : <Steps status={issue.status} />}
        </View>

        {/* ── İşlemler ── */}
        {hasToolbar && (
          <View style={[ui.card, { marginBottom: 12 }]}>
            {actions.changeStatus && statusTargets.length > 0 && (
              <>
                <Text style={ui.sectionTitle}>Durumu değiştir</Text>
                <View style={styles.wrap}>
                  {statusTargets.map((s) => (
                    <TouchableOpacity key={s} onPress={() => handleStatusChange(s)}
                      style={[styles.statusBtn, s === 'Done' && { backgroundColor: THEME.ok, borderColor: THEME.ok }]}>
                      {s === 'Done' && <Ionicons name="checkmark-circle" size={15} color="#fff" />}
                      <Text style={[styles.statusBtnText, s === 'Done' && { color: '#fff' }]}>{STATUS_LABELS[s]}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
            <View style={[styles.wrap, actions.changeStatus && statusTargets.length > 0 && { marginTop: 12 }]}>
              {actions.assign && <ActionBtn icon="person-add-outline" label="Ata" primary onPress={() => setAssigneePickerOpen(true)} />}
              {actions.edit && <ActionBtn icon="create-outline" label="Düzenle" onPress={openEdit} />}
              {actions.forward && <ActionBtn icon="arrow-redo-outline" label="Yönlendir" onPress={() => setForwardOpen(true)} />}
              {actions.clone && <ActionBtn icon="copy-outline" label="Klonla" onPress={handleClone} />}
              {actions.reject && <ActionBtn icon="close-circle-outline" label="Geri Çevir" warn onPress={() => { setRejectOpen(true); setRejectError(''); }} />}
              {actions.cancel && <ActionBtn icon="ban-outline" label="İptal Et" onPress={handleCancel} />}
              {actions.delete && <ActionBtn icon="trash-outline" label="Sil" danger onPress={handleDelete} />}
            </View>
          </View>
        )}

        <ApprovalPanel issue={issue} users={users} onChanged={invalidate} />

        {/* ── Talep bilgileri / açıklama ── */}
        {hasAnswers && (
          <View style={{ marginBottom: 12 }}>
            <Text style={ui.sectionTitle}>Talep Bilgileri</Text>
            {issue.requestAnswers.map((a) => (
              <View key={a.questionId} style={styles.answer}>
                <Text style={styles.answerQ}>{a.label}</Text>
                {a.type === 'file' ? (a.value || []).map((f: FileRef) => (
                  <TouchableOpacity key={f.id} style={styles.fileLink} onPress={() => openFile(f)}>
                    <Ionicons name="attach" size={15} color={THEME.brand} />
                    <Text style={styles.fileLinkText}>{f.name}</Text>
                    <Text style={styles.hint}>({formatBytes(f.size)})</Text>
                  </TouchableOpacity>
                )) : <Text style={styles.answerA}>{formatAnswer(a) || '—'}</Text>}
              </View>
            ))}
          </View>
        )}
        {(issue.description || !hasAnswers) && (
          <View style={{ marginBottom: 12 }}>
            <Text style={ui.sectionTitle}>Açıklama</Text>
            <View style={styles.answer}>
              <Text style={[styles.answerA, { fontWeight: '400' }]}>{issue.description || 'Açıklama eklenmemiş.'}</Text>
            </View>
          </View>
        )}

        {/* ── Süreler ── */}
        <Text style={ui.sectionTitle}>Süreler</Text>
        <View style={styles.durRow}>
          {[
            ['Bekleme', d.waiting, THEME.warn],
            ['Çözüm', d.resolution, THEME.orange],
            ['Toplam', d.total, THEME.ok],
          ].map(([label, part, color]: any) => (
            <View key={label} style={[styles.durBox, { borderLeftColor: color }]}>
              <Text style={styles.durLabel}>{label}</Text>
              <Text style={[styles.durValue, { color }]}>{formatDuration(part?.ms ?? null)}</Text>
              <Text style={styles.hint}>{!part ? 'Kayıt yok' : part.ongoing ? 'Devam ediyor' : ' '}</Text>
            </View>
          ))}
        </View>

        {/* ── Kişiler ── */}
        <View style={[ui.card, { marginBottom: 12 }]}>
          <Text style={ui.sectionTitle}>Kişiler</Text>
          <TouchableOpacity style={styles.person} disabled={!actions.assign} onPress={() => setAssigneePickerOpen(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.personRole}>Atanan</Text>
              <View style={[styles.inline, { marginTop: 4 }]}>
                {assignee ? (
                  <><Avatar name={assignee.name} color={assignee.avatarColor} size={28} /><Text style={styles.personName}>{assignee.name}</Text></>
                ) : issue.assigneeTeamId ? (
                  <><Ionicons name="people" size={20} color={THEME.navy} /><Text style={styles.personName}>{team?.name || 'Ekip'}</Text><Pill label="Ekip" bg={THEME.navySoft} color={THEME.navy} /></>
                ) : <Pill label="Atanmamış" bg={THEME.orangeSoft} color={THEME.orange} />}
              </View>
            </View>
            {actions.assign && <Text style={styles.link}>Değiştir</Text>}
          </TouchableOpacity>
          <View style={[styles.person, styles.personBorder]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.personRole}>Talep sahibi</Text>
              <View style={[styles.inline, { marginTop: 4 }]}>
                {reporter ? <><Avatar name={reporter.name} color={reporter.avatarColor} size={28} />
                  <View><Text style={styles.personName}>{reporter.name}</Text><Text style={styles.hint}>{reporter.email}</Text></View></>
                  : <Text style={styles.metaText}>—</Text>}
              </View>
            </View>
          </View>
          {issue.contactName ? (
            <View style={[styles.person, styles.personBorder]}>
              <View>
                <Text style={styles.personRole}>Adına açılan kişi</Text>
                <Text style={[styles.personName, { marginLeft: 0, marginTop: 4 }]}>{issue.contactName}</Text>
                {issue.contactPhone ? <Text style={styles.hint}>{issue.contactPhone}</Text> : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* ── Detaylar ── */}
        <View style={[ui.card, { marginBottom: 12 }]}>
          <View style={styles.inline}>
            <Text style={[ui.sectionTitle, { flex: 1, marginBottom: 0 }]}>Detaylar</Text>
            {actions.editDates && <TouchableOpacity onPress={openDates}><Text style={styles.link}>Tarihleri düzenle</Text></TouchableOpacity>}
          </View>
          <Field label="Öncelik" value={PRIORITY_LABELS[issue.priority]} />
          <Field label="Müdürlük" value={project?.name || '—'} />
          <Field label="Çözülüş" value={issue.resolvedAt ? formatDate(issue.resolvedAt) : '—'} />
          <Field label="Harcanan zaman" value={issue.timeSpent ? `${issue.timeSpent} dk` : '—'} />
          <Field label="Oluşturulma" value={timeAgo(issue.createdAt) || '—'} />
          <Field label="Son güncelleme" value={timeAgo(issue.updatedAt) || '—'} />
        </View>

        {/* ── Puanlama ── */}
        {(actions.rate || issue.ratedAt) && issue.isRequest && (
          <View style={[ui.card, { marginBottom: 12 }, actions.rate && { borderColor: THEME.orange, backgroundColor: THEME.orangeSoft }]}>
            <Text style={ui.sectionTitle}>Çözüm değerlendirmesi</Text>
            {issue.ratedAt ? (
              <>
                <Text style={styles.stars}>{'★'.repeat(issue.rating || 0)}{'☆'.repeat(5 - (issue.rating || 0))}</Text>
                {issue.ratingComment ? <Text style={styles.answerA}>"{issue.ratingComment}"</Text> : null}
              </>
            ) : (
              <>
                <Text style={[styles.metaText, { marginBottom: 6 }]}>Talebiniz çözüldü. Hizmeti puanlar mısınız?</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity key={n} onPress={() => setRating(n)} hitSlop={6}>
                      <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={30} color="#F59E0B" />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={[ui.input, { marginTop: 8 }]} placeholder="Yorumunuz (isteğe bağlı)" value={ratingComment} onChangeText={setRatingComment} multiline />
                <TouchableOpacity style={[ui.btnPrimary, { alignSelf: 'flex-start', marginTop: 8 }]} onPress={handleRate}>
                  <Text style={ui.btnPrimaryText}>Puanı Gönder</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── Görünür kullanıcılar ── */}
        {issue.isRequest && actions.share && (
          <View style={[ui.card, { marginBottom: 12 }]}>
            <Text style={ui.sectionTitle}>Görünür kullanıcılar</Text>
            {issue.visibleTo.length === 0 ? <Text style={styles.hint}>Kimse eklenmemiş.</Text>
              : issue.visibleTo.map((uid) => <Text key={uid} style={styles.metaText}>• {userName(uid) || uid}</Text>)}
            {requesters.length > 0 && (
              <TouchableOpacity onPress={() => setVisiblePickerOpen(true)} style={{ marginTop: 6 }}>
                <Text style={styles.link}>+ Talep sahibi ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Aktivite ── */}
        <View style={styles.tabs}>
          {([['comments', `Yorumlar (${commentsQuery.data?.length ?? 0})`], ['history', 'Geçmiş']] as const).map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.tab, tab === key && styles.tabOn]} onPress={() => setTab(key)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {tab === 'comments' ? (
          <>
            {(commentsQuery.data || []).length === 0 ? <Text style={[styles.hint, { marginBottom: 10 }]}>Henüz yorum yok.</Text> : null}
            {(commentsQuery.data || []).map((c) => {
              const author = users.find((u) => u.id === c.authorId);
              return (
                <View key={c.id} style={styles.commentRow}>
                  <Avatar name={author?.name || '?'} color={author?.avatarColor} size={28} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.commentAuthor}>{author?.name || 'Bilinmeyen'} <Text style={styles.hint}>· {timeAgo(c.createdAt)}</Text></Text>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              );
            })}
            {actions.comment && (
              <>
                {(templatesQuery.data || []).length > 0 && (
                  <TouchableOpacity onPress={() => setTemplatePickerOpen(true)} style={[styles.inline, { marginBottom: 6 }]}>
                    <Ionicons name="document-text-outline" size={14} color={THEME.brand} />
                    <Text style={styles.link}>Cevap şablonu ekle</Text>
                  </TouchableOpacity>
                )}
                <View style={styles.commentInputRow}>
                  <TextInput style={[ui.input, { flex: 1 }]} placeholder="Yorum yaz..." value={commentText} onChangeText={setCommentText} multiline />
                  <TouchableOpacity style={ui.btnPrimary} onPress={handleAddComment} disabled={!commentText.trim()}>
                    <Ionicons name="send" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </>
        ) : (
          (activitiesQuery.data || []).map((a) => (
            <View key={a.id} style={styles.activityRow}>
              <Dot color={THEME.navy} />
              <Text style={styles.activityText}>
                <Text style={{ fontWeight: '700' }}>{userName(a.userId) || 'Bilinmeyen'} </Text>
                {a.description} <Text style={styles.hint}>· {timeAgo(a.createdAt)}</Text>
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <CompleteIssueModal
        visible={doneModalOpen}
        issueId={issue.id}
        projectId={issue.projectId}
        hasInventory={project?.hasInventory}
        issue={issue}
        projectName={project?.name}
        reporterName={reporter?.name}
        onDone={() => { setDoneModalOpen(false); invalidate(); }}
        onCancel={() => setDoneModalOpen(false)}
      />

      <PickerSheet
        visible={assigneePickerOpen}
        title="Kişi veya Ekip Ata"
        options={[
          { key: '__none__', label: '— Atanmamış —' },
          ...(assigneesQuery.data?.users || []).map((u) => ({ key: `user:${u.id}`, label: u.name, sublabel: 'Kişi' })),
          ...(assigneesQuery.data?.teams || []).map((t) => ({ key: `team:${t.id}`, label: t.name, sublabel: `Ekip · ${t.memberCount} üye` })),
        ]}
        onSelect={handleAssign}
        onClose={() => setAssigneePickerOpen(false)}
      />
      <PickerSheet
        visible={visiblePickerOpen}
        title="Görünürlük Ekle"
        options={requesters.map((u) => ({ key: u.id, label: u.name }))}
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
      <PickerSheet
        visible={pickProjectOpen}
        title="Müdürlük"
        options={unitProjects.map((p) => ({ key: p.id, label: p.name }))}
        onSelect={(pid) => { setEdit((e) => ({ ...e, projectId: pid })); setPickProjectOpen(false); }}
        onClose={() => setPickProjectOpen(false)}
      />

      {/* Geri çevir */}
      <Modal visible={rejectOpen} transparent animationType="slide" onRequestClose={() => setRejectOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Talebi Geri Çevir</Text>
            <Text style={styles.hint}>Talep, açan kişiye geri gönderilir ve durumu "Geri Çevrildi" olur.</Text>
            <Text style={ui.label}>Gerekçe *</Text>
            <TextInput style={[ui.input, { minHeight: 80, textAlignVertical: 'top' }, rejectError ? { borderColor: THEME.danger } : null]}
              multiline value={rejectReason} onChangeText={(t) => { setRejectReason(t); setRejectError(''); }}
              placeholder="Örn. yanlış müdürlüğe açılmış, eksik bilgi…" />
            {rejectError ? <Text style={styles.errorText}>{rejectError}</Text> : null}
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setRejectOpen(false)} style={ui.btnGhost}><Text style={ui.btnGhostText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleReject} style={[ui.btnPrimary, { backgroundColor: THEME.warn }]}><Text style={ui.btnPrimaryText}>Geri Çevir</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Düzenle */}
      <Modal visible={editOpen} transparent animationType="slide" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            <Text style={styles.sheetTitle}>Talebi Düzenle</Text>
            <Text style={ui.label}>Başlık *</Text>
            <TextInput style={ui.input} value={edit.title} onChangeText={(t) => setEdit((e) => ({ ...e, title: t }))} />
            <Text style={ui.label}>Açıklama</Text>
            <TextInput style={[ui.input, { minHeight: 90, textAlignVertical: 'top' }]} multiline value={edit.description}
              onChangeText={(t) => setEdit((e) => ({ ...e, description: t }))} />
            <Text style={ui.label}>Öncelik</Text>
            <View style={styles.wrap}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity key={p} style={[ui.chip, edit.priority === p && ui.chipOn]} onPress={() => setEdit((e) => ({ ...e, priority: p }))}>
                  <Text style={[ui.chipText, edit.priority === p && ui.chipTextOn]}>{PRIORITY_LABELS[p]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {unitProjects.length > 1 && (
              <>
                <Text style={ui.label}>Müdürlük</Text>
                <TouchableOpacity style={ui.input} onPress={() => setPickProjectOpen(true)}>
                  <Text style={{ color: THEME.ink, fontWeight: '600' }}>{projects.find((p) => p.id === edit.projectId)?.name || '—'}</Text>
                </TouchableOpacity>
              </>
            )}
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setEditOpen(false)} style={ui.btnGhost}><Text style={ui.btnGhostText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveEdit} style={ui.btnPrimary}><Text style={ui.btnPrimaryText}>Kaydet</Text></TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tarihler */}
      <Modal visible={datesOpen} transparent animationType="slide" onRequestClose={() => setDatesOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Tarihleri Düzenle</Text>
            <Text style={ui.label}>Çözülüş tarihi (YYYY-AA-GG)</Text>
            <TextInput style={ui.input} value={dates.resolvedAt} placeholder="2026-10-12" onChangeText={(t) => setDates((x) => ({ ...x, resolvedAt: t }))} />
            <Text style={ui.label}>Harcanan zaman (dakika)</Text>
            <TextInput style={ui.input} keyboardType="number-pad" value={dates.timeSpent} onChangeText={(t) => setDates((x) => ({ ...x, timeSpent: t }))} />
            <View style={styles.sheetActions}>
              <TouchableOpacity onPress={() => setDatesOpen(false)} style={ui.btnGhost}><Text style={ui.btnGhostText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveDates} style={ui.btnPrimary}><Text style={ui.btnPrimaryText}>Kaydet</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function ActionBtn({ icon, label, onPress, danger, warn, primary }: {
  icon: any; label: string; onPress: () => void; danger?: boolean; warn?: boolean; primary?: boolean;
}) {
  const color = primary ? '#fff' : danger ? THEME.danger : warn ? THEME.warn : THEME.ink;
  return (
    <TouchableOpacity onPress={onPress}
      style={[styles.actionBtn, primary && { backgroundColor: THEME.navy, borderColor: THEME.navy },
        danger && { borderColor: '#fca5a5' }, warn && { borderColor: '#fcd34d' }]}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  crumbs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  crumbText: { flex: 1, fontSize: 12, color: THEME.muted },
  title: { fontSize: 20, fontWeight: '800', color: THEME.ink, marginTop: 10, marginBottom: 8 },
  metaWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, color: THEME.muted },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 10, marginTop: 12 },
  bannerText: { flex: 1, fontSize: 13, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: THEME.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  statusBtnText: { fontSize: 13, fontWeight: '700', color: THEME.ink },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: THEME.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  actionBtnText: { fontSize: 13, fontWeight: '700' },
  answer: { backgroundColor: '#fafbfd', borderWidth: 1, borderColor: '#edf1f6', borderRadius: 12, padding: 12, marginBottom: 8 },
  answerQ: { fontSize: 11, fontWeight: '700', color: THEME.muted, marginBottom: 3 },
  answerA: { fontSize: 14, fontWeight: '600', color: THEME.ink },
  fileLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  fileLinkText: { fontSize: 13, color: THEME.brand, fontWeight: '700' },
  hint: { fontSize: 11, color: THEME.muted },
  durRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  durBox: { flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: '#edf1f6', borderLeftWidth: 3, borderRadius: 12, padding: 10 },
  durLabel: { fontSize: 10, color: THEME.muted, fontWeight: '800', textTransform: 'uppercase' },
  durValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  person: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  personBorder: { borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  personRole: { fontSize: 10, fontWeight: '800', color: THEME.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  personName: { fontSize: 14, fontWeight: '700', color: THEME.ink },
  link: { fontSize: 13, color: THEME.brand, fontWeight: '700' },
  field: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  fieldLabel: { fontSize: 13, color: THEME.muted },
  fieldValue: { fontSize: 13, fontWeight: '700', color: THEME.ink, flexShrink: 1, textAlign: 'right' },
  stars: { fontSize: 24, color: '#F59E0B' },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, backgroundColor: '#e8edf3', borderRadius: 12, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 13, fontWeight: '700', color: THEME.muted },
  tabTextOn: { color: THEME.ink },
  commentRow: { flexDirection: 'row', marginBottom: 12 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: THEME.ink },
  commentText: { fontSize: 13, color: '#334155', backgroundColor: '#fff', borderWidth: 1, borderColor: '#edf1f6', padding: 10, borderRadius: 10, marginTop: 4 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'flex-end' },
  activityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 10 },
  activityText: { flex: 1, fontSize: 13, color: '#334155', marginTop: -3 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: THEME.ink, marginBottom: 6 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  errorText: { fontSize: 12, color: THEME.danger, fontWeight: '700', marginTop: 4 },
});
