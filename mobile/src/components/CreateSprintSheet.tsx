import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { sprintsApi } from '../api/resources';

const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

interface Props {
  visible: boolean;
  projectId: string;
  onCreated: () => void;
  onCancel: () => void;
}

export default function CreateSprintSheet({ visible, projectId, onCreated, onCancel }: Props) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [submitting, setSubmitting] = useState(false);
  const yearOptions = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await sprintsApi.create(projectId, { month, year });
      onCreated();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Yeni Aylık Dönem</Text>

          <Text style={styles.label}>Ay</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {MONTH_NAMES.map((name, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.chip, month === idx + 1 && styles.chipActive]}
                onPress={() => setMonth(idx + 1)}
              >
                <Text style={[styles.chipText, month === idx + 1 && styles.chipTextActive]}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Yıl</Text>
          <View style={styles.chipRow}>
            {yearOptions.map((y) => (
              <TouchableOpacity key={y} style={[styles.chip, year === y && styles.chipActive]} onPress={() => setYear(y)}>
                <Text style={[styles.chipText, year === y && styles.chipTextActive]}>{y}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Oluştur</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, marginRight: 6 },
  chipActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  confirmText: { color: '#fff', fontWeight: '600' },
});
