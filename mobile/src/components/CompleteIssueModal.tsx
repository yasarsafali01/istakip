import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { issuesApi, inventoryApi } from '../api/resources';
import type { InventoryItem } from '../api/types';
import PickerSheet from './PickerSheet';

interface Props {
  visible: boolean;
  issueId: string | null;
  projectId?: string | null;
  hasInventory?: boolean;
  onDone: () => void;
  onCancel: () => void;
}

// Shared "Görevi Tamamla" flow — used from both the board (long-press → Done)
// and the issue detail screen, so the resolution-note + equipment-usage rules
// (Requirement 15 / .kiro task-done-modal spec) are enforced in exactly one
// place. Backend performs the actual stock deduction and returns a
// stockWarning flag rather than blocking on insufficient stock.
export default function CompleteIssueModal({ visible, issueId, projectId, hasInventory, onDone, onCancel }: Props) {
  const [resolutionNote, setResolutionNote] = useState('');
  const [usedEquipment, setUsedEquipment] = useState(false);
  const [equipment, setEquipment] = useState<InventoryItem[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<InventoryItem | null>(null);
  const [equipmentPickerOpen, setEquipmentPickerOpen] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && hasInventory && projectId) {
      inventoryApi.listByProject(projectId).then(setEquipment).catch(() => {});
    }
  }, [visible, hasInventory, projectId]);

  function reset() {
    setResolutionNote('');
    setUsedEquipment(false);
    setSelectedEquipment(null);
    setQuantity('');
    setSubmitting(false);
  }

  async function handleConfirm() {
    if (!issueId) return;
    if (resolutionNote.trim().length < 10) {
      Alert.alert('Uyarı', 'Çözüm notu en az 10 karakter olmalıdır.');
      return;
    }
    const qty = parseInt(quantity, 10);
    if (usedEquipment && (!selectedEquipment || !qty || qty <= 0)) {
      Alert.alert('Uyarı', 'Teçhizat seçildiğinde adet pozitif bir sayı olmalıdır.');
      return;
    }
    setSubmitting(true);
    try {
      const { stockWarning } = await issuesApi.complete(issueId, {
        resolutionNote: resolutionNote.trim(),
        usedEquipment,
        ...(usedEquipment && selectedEquipment ? { equipmentId: selectedEquipment.id, quantity: qty } : {}),
      });
      reset();
      onDone();
      if (stockWarning) {
        Alert.alert('Stok Uyarısı', 'Seçilen teçhizat için stok yetersiz kaldı, ancak işlem tamamlandı.');
      }
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
          <Text style={styles.title}>Görevi Tamamla</Text>
          <Text style={styles.label}>Çözüm İçeriği *</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Yapılan işi açıklayın (en az 10 karakter)..."
            value={resolutionNote}
            onChangeText={setResolutionNote}
          />

          {hasInventory && (
            <View style={styles.equipmentSection}>
              <Text style={styles.label}>Teçhizat kullandınız mı?</Text>
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, !usedEquipment && styles.toggleBtnActive]}
                  onPress={() => setUsedEquipment(false)}
                >
                  <Text style={[styles.toggleText, !usedEquipment && styles.toggleTextActive]}>Hayır</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, usedEquipment && styles.toggleBtnActive]}
                  onPress={() => setUsedEquipment(true)}
                >
                  <Text style={[styles.toggleText, usedEquipment && styles.toggleTextActive]}>Evet</Text>
                </TouchableOpacity>
              </View>

              {usedEquipment && (
                <>
                  <Text style={styles.label}>Teçhizat Adı *</Text>
                  <TouchableOpacity style={styles.selectInput} onPress={() => setEquipmentPickerOpen(true)}>
                    <Text style={selectedEquipment ? styles.selectValue : styles.selectPlaceholder}>
                      {selectedEquipment
                        ? `${selectedEquipment.name} (Stok: ${selectedEquipment.quantity} ${selectedEquipment.unit})`
                        : '— Teçhizat seçin —'}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.label}>Kullanılan Adet *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    placeholder="Adet girin"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                </>
              )}
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Onayla</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={equipmentPickerOpen}
        title="Teçhizat Seçin"
        options={equipment.map((e) => ({ key: e.id, label: e.name, sublabel: `Stok: ${e.quantity} ${e.unit}` }))}
        onSelect={(key) => {
          setSelectedEquipment(equipment.find((e) => e.id === key) || null);
          setEquipmentPickerOpen(false);
        }}
        onClose={() => setEquipmentPickerOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '85%' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  textArea: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14,
    minHeight: 100, textAlignVertical: 'top',
  },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  equipmentSection: { marginTop: 4 },
  toggleRow: { flexDirection: 'row', gap: 10 },
  toggleBtn: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 8 },
  toggleBtnActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  toggleText: { fontSize: 13, color: '#374151' },
  toggleTextActive: { color: '#fff', fontWeight: '600' },
  selectInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 },
  selectValue: { fontSize: 14, color: '#172B4D' },
  selectPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, marginBottom: 8 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#00875A', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  confirmText: { color: '#fff', fontWeight: '600' },
});
