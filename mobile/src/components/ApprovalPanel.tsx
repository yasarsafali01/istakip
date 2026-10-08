import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi } from '../api/resources';
import { usePermissions } from '../hooks/usePermissions';
import type { Issue, User } from '../api/types';

interface Props {
  issue: Issue;
  users?: User[];
  /** Shows the issue key/title row (approvals list). */
  header?: boolean;
  onOpen?: (issue: Issue) => void;
  onChanged: () => void;
}

/**
 * Mirrors the web's ApprovalPanel: a completion waiting for manager approval
 * ("Onay Bekliyor"). Users with issue.approve approve (→ Done) or reject with a
 * reason (→ In Progress); everyone else sees that it is waiting.
 */
export default function ApprovalPanel({ issue, users = [], header, onOpen, onChanged }: Props) {
  const { can } = usePermissions();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);

  const pc = issue.pendingCompletion;
  if (issue.status !== 'Onay Bekliyor' || !pc) return null;
  const canDecide = can('issue.approve');
  const submitter = users.find((u) => u.id === pc.submittedBy)?.name || 'Bilinmeyen kullanıcı';

  async function approve() {
    setBusy(true);
    try {
      const { stockWarning } = await issuesApi.approveCompletion(issue.id);
      onChanged();
      if (stockWarning) Alert.alert('Onaylandı', 'Kullanılan malzeme stokta yetersizdi, stok eksiye düştü.');
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (reason.trim().length < 5) {
      setReasonError('Ret gerekçesi boş bırakılamaz (en az 5 karakter).');
      return;
    }
    setBusy(true);
    try {
      await issuesApi.rejectCompletion(issue.id, reason.trim());
      setRejecting(false);
      setReason('');
      onChanged();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.card}>
      {header && (
        <TouchableOpacity onPress={() => onOpen?.(issue)} style={{ marginBottom: 6 }}>
          <Text style={styles.key}>{issue.key}</Text>
          <Text style={styles.issueTitle}>{issue.title}</Text>
        </TouchableOpacity>
      )}
      <View style={styles.headRow}>
        <Ionicons name="shield-checkmark" size={18} color="#8B5CF6" />
        <Text style={styles.headText}>Yönetici onayı bekleniyor</Text>
      </View>
      <Text style={styles.meta}>{submitter} · {new Date(pc.submittedAt).toLocaleString('tr-TR')} tamamladı</Text>
      <Text style={styles.noteLabel}>Çözüm İçeriği</Text>
      <Text style={styles.note}>{pc.resolutionNote}</Text>
      {pc.equipmentId ? <Text style={styles.meta}>Malzeme: {pc.quantity} adet (onaylanınca stoktan düşülecek)</Text> : null}

      {canDecide && !rejecting && (
        <View style={styles.actions}>
          <TouchableOpacity style={styles.approveBtn} onPress={approve} disabled={busy}>
            {busy ? <ActivityIndicator color="#fff" /> : <><Ionicons name="checkmark" size={16} color="#fff" /><Text style={styles.approveText}>Onayla ve Kapat</Text></>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => { setRejecting(true); setReasonError(''); }} disabled={busy}>
            <Ionicons name="close" size={16} color="#DE350B" /><Text style={styles.rejectText}>Reddet</Text>
          </TouchableOpacity>
        </View>
      )}

      {canDecide && rejecting && (
        <View style={{ marginTop: 8 }}>
          <Text style={styles.noteLabel}>Ret gerekçesi <Text style={{ color: '#DE350B' }}>*</Text></Text>
          <TextInput
            style={[styles.input, reasonError ? styles.inputError : null]}
            multiline
            autoFocus
            placeholder="Çalışana neyin eksik olduğunu açıklayın; iş Devam Ediyor durumuna döner."
            value={reason}
            onChangeText={(t) => { setReason(t); setReasonError(''); }}
          />
          {reasonError ? (
            <View style={styles.errorRow}><Ionicons name="alert-circle" size={14} color="#DE350B" /><Text style={styles.errorText}>{reasonError}</Text></View>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.approveBtn, { backgroundColor: '#DE350B' }]} onPress={reject} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.approveText}>Reddet ve Geri Gönder</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.plainBtn} onPress={() => setRejecting(false)} disabled={busy}>
              <Text style={styles.plainText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FAF7FF', borderLeftWidth: 4, borderLeftColor: '#8B5CF6', borderRadius: 10, padding: 12, marginBottom: 12 },
  key: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  issueTitle: { fontSize: 14, fontWeight: '700', color: '#172B4D' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headText: { fontSize: 13, fontWeight: '700', color: '#5B21B6' },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  noteLabel: { fontSize: 12, fontWeight: '700', color: '#172B4D', marginTop: 8, marginBottom: 4 },
  note: { fontSize: 13, color: '#374151', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  approveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#00875A', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  approveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  rejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#DE350B', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9 },
  rejectText: { color: '#DE350B', fontWeight: '700', fontSize: 13 },
  plainBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  plainText: { color: '#6B7280', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 13, minHeight: 60, textAlignVertical: 'top', backgroundColor: '#fff' },
  inputError: { borderColor: '#DE350B', borderWidth: 1.5 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: '#DE350B', fontWeight: '600' },
});
