import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { issuesApi, unitsApi, projectsApi } from '../api/resources';
import PickerSheet from './PickerSheet';
import { PRIORITIES } from '../utils/constants';

interface Props {
  visible: boolean;
  onCreated: () => void;
  onCancel: () => void;
}

// Mirrors frontend/src/components/request/RequestForm.jsx — available to
// every role (not just External_User), matching the web "Yeni Talep" button.
export default function CreateRequestSheet({ visible, onCreated, onCancel }: Props) {
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list, enabled: visible });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list, enabled: visible });

  const [unitId, setUnitId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const unitProjects = (projectsQuery.data || []).filter((p) => p.unitId === unitId);

  function reset() {
    setUnitId('');
    setProjectId('');
    setTitle('');
    setDescription('');
    setPriority('Medium');
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!title.trim() || !unitId || !projectId) {
      Alert.alert('Uyarı', 'Birim, proje ve başlık zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      await issuesApi.create({
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority: priority as any,
        isRequest: true,
      });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
      setSubmitting(false);
    }
  }

  function getUnitLabel(id: string) {
    const u = unitsQuery.data?.find((x) => x.id === id);
    return u ? `${u.name} (${u.unitCode})` : '';
  }
  function getProjectName(id: string) {
    return projectsQuery.data?.find((p) => p.id === id)?.name;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onCancel(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <ScrollView style={styles.card} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Yeni Talep Oluştur</Text>

          <Text style={styles.label}>Birim *</Text>
          <TouchableOpacity
            style={styles.selectInput}
            disabled={unitsQuery.isLoading}
            onPress={() => setUnitPickerOpen(true)}
          >
            <Text style={unitId ? styles.selectValue : styles.selectPlaceholder}>
              {unitsQuery.isLoading ? 'Yükleniyor...' : unitId ? getUnitLabel(unitId) : '— Birim seçin —'}
            </Text>
          </TouchableOpacity>

          {unitId && (
            <>
              <Text style={styles.label}>Proje *</Text>
              {unitProjects.length === 0 ? (
                <Text style={styles.hint}>Bu birime ait proje bulunamadı.</Text>
              ) : (
                <TouchableOpacity style={styles.selectInput} onPress={() => setProjectPickerOpen(true)}>
                  <Text style={projectId ? styles.selectValue : styles.selectPlaceholder}>
                    {projectId ? getProjectName(projectId) : '— Proje seçin —'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}

          <Text style={styles.label}>Başlık *</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Talebinizi kısaca açıklayın" />

          <Text style={styles.label}>Açıklama</Text>
          <TextInput
            style={styles.textArea}
            value={description}
            onChangeText={setDescription}
            placeholder="Talebinizi detaylı açıklayın..."
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
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onCancel(); }}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Talep Oluştur</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={unitPickerOpen}
        title="Birim Seçin"
        options={(unitsQuery.data || []).map((u) => ({ key: u.id, label: `${u.name} (${u.unitCode})` }))}
        onSelect={(key) => { setUnitId(key); setProjectId(''); setUnitPickerOpen(false); }}
        onClose={() => setUnitPickerOpen(false)}
      />
      <PickerSheet
        visible={projectPickerOpen}
        title="Proje Seçin"
        options={unitProjects.map((p) => ({ key: p.id, label: p.name }))}
        onSelect={(key) => { setProjectId(key); setProjectPickerOpen(false); }}
        onClose={() => setProjectPickerOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '85%' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  hint: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  selectInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 },
  selectValue: { fontSize: 14, color: '#172B4D' },
  selectPlaceholder: { fontSize: 14, color: '#9CA3AF' },
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
