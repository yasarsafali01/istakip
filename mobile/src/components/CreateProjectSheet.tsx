import React, { useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, unitsApi, usersApi } from '../api/resources';
import PickerSheet from './PickerSheet';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ROLES } from '../utils/constants';

interface Props {
  visible: boolean;
  onCreated: () => void;
  onCancel: () => void;
}

export default function CreateProjectSheet({ visible, onCreated, onCancel }: Props) {
  const { currentUser } = useAuth();
  const { isSystemAdmin } = usePermissions();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list, enabled: visible && isSystemAdmin });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: visible });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = useState(currentUser?.unitId || '');
  const [managerId, setManagerId] = useState('');
  const [hasInventory, setHasInventory] = useState(false);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const managers = (usersQuery.data || []).filter(
    (u) => u.role === ROLES.PROJECT_MANAGER && (!unitId || u.unitId === unitId)
  );

  function reset() {
    setName('');
    setDescription('');
    setUnitId(currentUser?.unitId || '');
    setManagerId('');
    setHasInventory(false);
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!name.trim() || !unitId || !managerId) {
      Alert.alert('Uyarı', 'Proje adı, birim ve yönetici zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      await projectsApi.create({ name: name.trim(), description: description.trim(), unitId, managerId, hasInventory });
      reset();
      onCreated();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
      setSubmitting(false);
    }
  }

  function getUnitName(id: string) {
    return unitsQuery.data?.find((u) => u.id === id)?.name;
  }
  function getUserName(id: string) {
    return usersQuery.data?.find((u) => u.id === id)?.name;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <ScrollView style={styles.card} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Yeni Proje</Text>

          <Text style={styles.label}>Proje Adı *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Proje adı..." />

          {isSystemAdmin && (
            <>
              <Text style={styles.label}>Birim *</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setUnitPickerOpen(true)}>
                <Text style={unitId ? styles.selectValue : styles.selectPlaceholder}>
                  {unitId ? getUnitName(unitId) : '— Birim seçin —'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.label}>Proje Yöneticisi *</Text>
          <TouchableOpacity style={styles.selectInput} onPress={() => setManagerPickerOpen(true)}>
            <Text style={managerId ? styles.selectValue : styles.selectPlaceholder}>
              {managerId ? getUserName(managerId) : '— Yönetici seçin —'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Açıklama</Text>
          <TextInput style={styles.textArea} value={description} onChangeText={setDescription} multiline placeholder="Açıklama..." />

          <View style={styles.switchRow}>
            <Text style={styles.label}>Stok Takip İsteniyor mu?</Text>
            <Switch value={hasInventory} onValueChange={setHasInventory} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onCancel(); }}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Oluştur</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={unitPickerOpen}
        title="Birim Seçin"
        options={(unitsQuery.data || []).map((u) => ({ key: u.id, label: `${u.name} (${u.unitCode})` }))}
        onSelect={(key) => { setUnitId(key); setManagerId(''); setUnitPickerOpen(false); }}
        onClose={() => setUnitPickerOpen(false)}
      />
      <PickerSheet
        visible={managerPickerOpen}
        title="Proje Yöneticisi Seçin"
        options={managers.map((u) => ({ key: u.id, label: u.name }))}
        onSelect={(key) => { setManagerId(key); setManagerPickerOpen(false); }}
        onClose={() => setManagerPickerOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '85%' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  textArea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  selectInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 },
  selectValue: { fontSize: 14, color: '#172B4D' },
  selectPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, marginBottom: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  confirmText: { color: '#fff', fontWeight: '600' },
});
