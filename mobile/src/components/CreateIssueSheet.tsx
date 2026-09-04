import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { issuesApi } from '../api/resources';
import { PRIORITIES } from '../utils/constants';

interface Props {
  visible: boolean;
  projectId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export default function CreateIssueSheet({ visible, projectId, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!title.trim()) {
      Alert.alert('Uyarı', 'Başlık zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      await issuesApi.create({ projectId, title: title.trim(), description: description.trim(), priority: priority as any, type: 'Task' as any });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
      setSubmitting(false);
    }
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <ScrollView style={styles.card} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Yeni Issue Oluştur</Text>

          <Text style={styles.label}>Başlık *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Issue başlığı..." />

          <Text style={styles.label}>Açıklama</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Açıklama..."
            multiline
          />

          <Text style={styles.label}>Öncelik</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.priorityChip, priority === p && styles.priorityChipActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priorityChipText, priority === p && styles.priorityChipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Oluştur</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '85%' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityChip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  priorityChipActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  priorityChipText: { fontSize: 12, color: '#374151' },
  priorityChipTextActive: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, marginBottom: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  confirmText: { color: '#fff', fontWeight: '600' },
});
