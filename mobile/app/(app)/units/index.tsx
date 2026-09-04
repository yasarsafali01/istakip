import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, KeyboardAvoidingView, Platform, Alert, RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { unitsApi, usersApi } from '../../../src/api/resources';
import PickerSheet from '../../../src/components/PickerSheet';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { ROLES } from '../../../src/utils/constants';
import type { Unit } from '../../../src/api/types';

export default function UnitsScreen() {
  const { isSystemAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list });

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [unitCode, setUnitCode] = useState('');
  const [departmentHeadId, setDepartmentHeadId] = useState('');
  const [headPickerOpen, setHeadPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const departmentHeads = (usersQuery.data || []).filter((u) => u.role === ROLES.DEPARTMENT_HEAD);

  function resetForm() {
    setName('');
    setUnitCode('');
    setDepartmentHeadId('');
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!name.trim() || !unitCode.trim() || !departmentHeadId) {
      Alert.alert('Uyarı', 'Ad, kod ve daire başkanı zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      await unitsApi.create({ name: name.trim(), unitCode: unitCode.trim().toUpperCase(), departmentHeadId });
      queryClient.invalidateQueries({ queryKey: ['units'] });
      setFormOpen(false);
      resetForm();
    } catch (err: any) {
      Alert.alert('Hata', err.message);
      setSubmitting(false);
    }
  }

  function getHeadName(id?: string | null) {
    return usersQuery.data?.find((u) => u.id === id)?.name;
  }

  function renderItem({ item }: { item: Unit }) {
    return (
      <View style={styles.card}>
        <View style={styles.keyBadge}><Text style={styles.keyText}>{item.unitCode}</Text></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.head}>{getHeadName(item.departmentHeadId) || 'Daire başkanı atanmamış'}</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      {unitsQuery.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>
      ) : (
        <FlatList
          data={unitsQuery.data}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={unitsQuery.isFetching} onRefresh={() => unitsQuery.refetch()} />}
          ListEmptyComponent={<Text style={styles.emptyText}>Henüz birim yok.</Text>}
        />
      )}

      {isSystemAdmin && (
        <TouchableOpacity style={styles.fab} onPress={() => setFormOpen(true)}>
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      )}

      <Modal visible={formOpen} animationType="slide" transparent onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Yeni Birim</Text>

            <Text style={styles.label}>Birim Adı *</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Bilgi İşlem Daire Başkanlığı" />

            <Text style={styles.label}>Birim Kodu *</Text>
            <TextInput
              style={styles.input}
              value={unitCode}
              onChangeText={(t) => setUnitCode(t.toUpperCase())}
              placeholder="BIGD"
              maxLength={10}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>Daire Başkanı *</Text>
            <TouchableOpacity style={styles.selectInput} onPress={() => setHeadPickerOpen(true)}>
              <Text style={departmentHeadId ? styles.selectValue : styles.selectPlaceholder}>
                {getHeadName(departmentHeadId) || '— Seçin —'}
              </Text>
            </TouchableOpacity>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setFormOpen(false); resetForm(); }}>
                <Text style={styles.cancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Oluştur</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <PickerSheet
        visible={headPickerOpen}
        title="Daire Başkanı Seçin"
        options={departmentHeads.map((u) => ({ key: u.id, label: u.name }))}
        onSelect={(key) => { setDepartmentHeadId(key); setHeadPickerOpen(false); }}
        onClose={() => setHeadPickerOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginTop: 40 },
  list: { padding: 16 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 10,
    padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  keyBadge: { backgroundColor: '#00875A', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  keyText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  name: { fontSize: 14, fontWeight: '600', color: '#172B4D' },
  head: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  fab: {
    position: 'absolute', right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#0052CC', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
  },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  formCard: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  formTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  selectInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 },
  selectValue: { fontSize: 14, color: '#172B4D' },
  selectPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  confirmText: { color: '#fff', fontWeight: '600' },
});
