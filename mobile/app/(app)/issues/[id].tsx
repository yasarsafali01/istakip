import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TextInput,
  TouchableOpacity, Alert,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { issuesApi, usersApi, commentsApi, activitiesApi, projectsApi } from '../../../src/api/resources';
import { StatusBadge, PriorityBadge } from '../../../src/components/Badge';
import Avatar from '../../../src/components/Avatar';
import PickerSheet from '../../../src/components/PickerSheet';
import CompleteIssueModal from '../../../src/components/CompleteIssueModal';
import { useAuth } from '../../../src/context/AuthContext';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { STATUSES, ROLES } from '../../../src/utils/constants';

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const { canManageIssues, isWorker, isExternalUser, isSystemAdmin } = usePermissions();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState('');
  const [doneModalOpen, setDoneModalOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [visiblePickerOpen, setVisiblePickerOpen] = useState(false);

  const issueQuery = useQuery({ queryKey: ['issue', id], queryFn: () => issuesApi.get(id!) });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });
  const commentsQuery = useQuery({ queryKey: ['comments', id], queryFn: () => commentsApi.listByIssue(id!) });
  const activitiesQuery = useQuery({ queryKey: ['activities', id], queryFn: () => activitiesApi.listByIssue(id!) });
  const projectQuery = useQuery({
    queryKey: ['project', issueQuery.data?.projectId],
    queryFn: () => projectsApi.get(issueQuery.data!.projectId),
    enabled: !!issueQuery.data,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['issue', id] });
    queryClient.invalidateQueries({ queryKey: ['activities', id] });
    queryClient.invalidateQueries({ queryKey: ['issues'] });
  }

  const issue = issueQuery.data;
  const project = projectQuery.data;
  const canChangeStatus = issue && (canManageIssues || isWorker);

  // Mirrors backend CanChangeAssignee: External_User never; reporter can't
  // assign their own issue; System_Admin always; DeptHead/PM within scope.
  const canAssign =
    issue && currentUser && !isExternalUser && issue.reporterId !== currentUser.id &&
    (isSystemAdmin || canManageIssues);

  const canClone = issue?.isRequest && (canManageIssues || issue.reporterId === currentUser?.id);

  async function handleStatusChange(newStatus: string) {
    if (!issue) return;
    if (newStatus === 'Done') {
      setDoneModalOpen(true);
      return;
    }
    try {
      await issuesApi.updateStatus(issue.id, newStatus);
      invalidate();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  async function handleAssigneeSelect(userId: string) {
    if (!issue) return;
    setAssigneePickerOpen(false);
    try {
      await issuesApi.updateAssignee(issue.id, userId === '__none__' ? null : userId);
      invalidate();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  async function handleClone() {
    if (!issue) return;
    try {
      const cloned = await issuesApi.clone(issue.id);
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      router.replace(`/(app)/issues/${cloned.id}`);
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  async function handleAddVisibleUser(userId: string) {
    if (!issue) return;
    setVisiblePickerOpen(false);
    try {
      await issuesApi.addVisibleUser(issue.id, userId);
      invalidate();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  async function handleAddComment() {
    if (!issue || !commentText.trim()) return;
    try {
      await commentsApi.create(issue.id, commentText.trim());
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['comments', id] });
      queryClient.invalidateQueries({ queryKey: ['activities', id] });
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    }
  }

  function getUserName(userId?: string | null) {
    if (!userId) return null;
    return usersQuery.data?.find((u) => u.id === userId)?.name;
  }

  if (issueQuery.isLoading || !issue) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0052CC" />
      </View>
    );
  }

  const assigneeName = getUserName(issue.assigneeId);
  const reporterName = getUserName(issue.reporterId);

  // Assignable users: mirrors permissionUtils.js — Worker scoped to the
  // project, PM/DeptHead to their scope, System_Admin to everyone.
  const assignableUsers = (usersQuery.data || []).filter((u) => {
    if (u.role === ROLES.EXTERNAL_USER) return false;
    if (isSystemAdmin) return true;
    if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
    if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
    if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
    return false;
  });

  const externalUsersToAdd = (usersQuery.data || []).filter(
    (u) => u.role === ROLES.EXTERNAL_USER && !issue.visibleTo.includes(u.id)
  );

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <Stack.Screen options={{ title: issue.key, headerBackTitle: 'Geri' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
        </View>
        <Text style={styles.title}>{issue.title}</Text>
        <Text style={styles.description}>{issue.description || 'Açıklama eklenmemiş.'}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Atanan</Text>
            <TouchableOpacity
              style={styles.personRow}
              disabled={!canAssign}
              onPress={() => setAssigneePickerOpen(true)}
            >
              {assigneeName && <Avatar name={assigneeName} size={22} />}
              <Text style={[styles.metaValue, canAssign && styles.metaValueLink]}>
                {assigneeName || 'Atanmamış'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Raporlayan</Text>
            <View style={styles.personRow}>
              {reporterName && <Avatar name={reporterName} size={22} />}
              <Text style={styles.metaValue}>{reporterName || '—'}</Text>
            </View>
          </View>
        </View>

        {canClone && (
          <TouchableOpacity style={styles.cloneBtn} onPress={handleClone}>
            <Text style={styles.cloneBtnText}>Klonla</Text>
          </TouchableOpacity>
        )}

        {issue.isRequest && !isExternalUser && (
          <View style={styles.visibleSection}>
            <Text style={styles.sectionTitle}>Görünür Kullanıcılar</Text>
            {issue.visibleTo.length > 0 && (
              <View style={{ marginBottom: 8 }}>
                {issue.visibleTo.map((uid) => (
                  <Text key={uid} style={styles.visibleUserText}>• {getUserName(uid) || uid}</Text>
                ))}
              </View>
            )}
            {externalUsersToAdd.length > 0 && (
              <TouchableOpacity style={styles.addVisibleBtn} onPress={() => setVisiblePickerOpen(true)}>
                <Text style={styles.addVisibleBtnText}>+ Kullanıcı Ekle</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {canChangeStatus && (
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Durum Değiştir</Text>
            <View style={styles.statusButtons}>
              {STATUSES.filter((s) => s !== issue.status && s !== 'Geri Çevrildi').map((s) => (
                <TouchableOpacity key={s} style={styles.statusBtn} onPress={() => handleStatusChange(s)}>
                  <Text style={styles.statusBtnText}>{s}</Text>
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

        {!isExternalUser || issue.reporterId === currentUser?.id ? (
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Yorum yaz..."
              value={commentText}
              onChangeText={setCommentText}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleAddComment} disabled={!commentText.trim()}>
              <Text style={styles.sendBtnText}>Gönder</Text>
            </TouchableOpacity>
          </View>
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
        onDone={() => { setDoneModalOpen(false); invalidate(); }}
        onCancel={() => setDoneModalOpen(false)}
      />

      <PickerSheet
        visible={assigneePickerOpen}
        title="Atanan Kişiyi Değiştir"
        options={[
          { key: '__none__', label: '— Atanmamış —' },
          ...assignableUsers.map((u) => ({ key: u.id, label: u.name })),
        ]}
        onSelect={handleAssigneeSelect}
        onClose={() => setAssigneePickerOpen(false)}
      />

      <PickerSheet
        visible={visiblePickerOpen}
        title="Görünürlük Ekle"
        options={externalUsersToAdd.map((u) => ({ key: u.id, label: u.name }))}
        onSelect={handleAddVisibleUser}
        onClose={() => setVisiblePickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  title: { fontSize: 18, fontWeight: '700', color: '#172B4D', marginBottom: 8 },
  description: { fontSize: 14, color: '#42526E', marginBottom: 16, lineHeight: 20 },
  metaRow: { flexDirection: 'row', marginBottom: 16, gap: 20 },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 11, color: '#9CA3AF', fontWeight: '600', marginBottom: 4 },
  metaValue: { fontSize: 13, color: '#172B4D', marginLeft: 6 },
  metaValueLink: { color: '#0052CC', fontWeight: '600' },
  personRow: { flexDirection: 'row', alignItems: 'center' },
  cloneBtn: {
    alignSelf: 'flex-start', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 6, marginBottom: 16,
  },
  cloneBtnText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  visibleSection: { marginBottom: 20 },
  visibleUserText: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  addVisibleBtn: { alignSelf: 'flex-start' },
  addVisibleBtnText: { fontSize: 12, color: '#0052CC', fontWeight: '600' },
  statusSection: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#172B4D', marginBottom: 10, marginTop: 6, textTransform: 'uppercase' },
  statusButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  statusBtnText: { fontSize: 12, color: '#374151' },
  commentRow: { flexDirection: 'row', marginBottom: 12 },
  commentAuthor: { fontSize: 12, fontWeight: '700', color: '#172B4D' },
  commentText: { fontSize: 13, color: '#42526E', backgroundColor: '#F4F5F7', padding: 8, borderRadius: 6, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginBottom: 20, alignItems: 'flex-end' },
  commentInput: { flex: 1, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 13, minHeight: 40 },
  sendBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  activityRow: { marginBottom: 8 },
  activityText: { fontSize: 12, color: '#42526E' },
});
