import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Switch,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { projectsApi, unitsApi, usersApi } from '../api/resources';
import PickerSheet from './PickerSheet';
import Avatar from './Avatar';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { ROLES, THEME } from '../utils/constants';
import { inProject, projectIdsOf } from '../utils/access';
import type { Project } from '../api/types';

interface Props {
  visible: boolean;
  project?: Project | null; // when set, edits this project instead of creating one
  defaultUnitId?: string; // preselects the daire başkanlığı when creating
  onCreated: (saved?: Project) => void;
  onCancel: () => void;
}

/** Yeni Müdürlük / Müdürlük Bilgileri — same fields as the web form, incl. personnel. */
export default function CreateProjectSheet({ visible, project, defaultUnitId, onCreated, onCancel }: Props) {
  const { currentUser } = useAuth();
  const { isSystemAdmin } = usePermissions();
  const queryClient = useQueryClient();
  const isEdit = !!project;
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list, enabled: visible && isSystemAdmin && !isEdit });
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: usersApi.list, enabled: visible });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unitId, setUnitId] = useState(currentUser?.unitId || '');
  const [managerId, setManagerId] = useState('');
  const [hasInventory, setHasInventory] = useState(false);
  const [staffIds, setStaffIds] = useState<string[]>([]);
  const [staffQuery, setStaffQuery] = useState('');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [managerPickerOpen, setManagerPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const users = useMemo(() => (usersQuery.data || []).filter((u) => u.isActive !== false), [usersQuery.data]);
  const managers = users.filter((u) => u.role === ROLES.PROJECT_MANAGER && (!unitId || u.unitId === unitId));
  // Anyone active in the daire başkanlığı; one person may serve in several müdürlükler.
  const unitStaff = users.filter((u) => u.role !== ROLES.EXTERNAL_USER && !!unitId && u.unitId === unitId);
  // Someone whose only müdürlük is this one can't be unticked.
  const locked = new Set(project ? unitStaff.filter((u) => {
    const ids = projectIdsOf(u);
    return ids.length === 1 && ids[0] === project.id;
  }).map((u) => u.id) : []);
  const q = staffQuery.trim().toLocaleLowerCase('tr');
  const shownStaff = unitStaff.filter((u) => !q || u.name.toLocaleLowerCase('tr').includes(q) || u.email.toLowerCase().includes(q));

  useEffect(() => {
    if (!visible) return;
    if (project) {
      setName(project.name);
      setDescription(project.description || '');
      setUnitId(project.unitId);
      setManagerId(project.managerId);
      setHasInventory(project.hasInventory);
    } else if (defaultUnitId) {
      setUnitId(defaultUnitId);
    }
  }, [visible, project, defaultUnitId]);

  useEffect(() => {
    if (visible && project && usersQuery.data) {
      setStaffIds(usersQuery.data.filter((u) => u.isActive !== false && inProject(u, project.id)).map((u) => u.id));
    }
  }, [visible, project, usersQuery.data]);

  function reset() {
    setName('');
    setDescription('');
    setUnitId(currentUser?.unitId || '');
    setManagerId('');
    setHasInventory(false);
    setStaffIds([]);
    setStaffQuery('');
    setSubmitting(false);
  }

  const toggleStaff = (id: string) =>
    setStaffIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  async function handleSubmit() {
    if (!name.trim() || (!isEdit && !unitId) || !managerId) {
      Alert.alert('Uyarı', 'Müdürlük adı, daire başkanlığı ve müdür zorunludur.');
      return;
    }
    setSubmitting(true);
    try {
      let saved: Project;
      if (isEdit && project) {
        saved = await projectsApi.update(project.id, { name: name.trim(), description: description.trim(), managerId, hasInventory });
        await projectsApi.setMembers(project.id, staffIds);
      } else {
        saved = await projectsApi.create({ name: name.trim(), description: description.trim(), unitId, managerId, hasInventory });
        if (staffIds.length > 0) await projectsApi.setMembers(saved.id, staffIds);
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      reset();
      onCreated(saved);
    } catch (err: any) {
      Alert.alert('Hata', err.message);
      setSubmitting(false);
    }
  }

  const unitName = (id: string) => unitsQuery.data?.find((u) => u.id === id)?.name;
  const userName = (id: string) => users.find((u) => u.id === id)?.name;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <ScrollView style={styles.card} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>{isEdit ? 'Müdürlük Bilgileri' : 'Yeni Müdürlük'}</Text>

          <Text style={styles.label}>Müdürlük Adı *</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Müdürlük adı..." />

          {isSystemAdmin && !isEdit && (
            <>
              <Text style={styles.label}>Daire Başkanlığı *</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setUnitPickerOpen(true)}>
                <Text style={unitId ? styles.selectValue : styles.selectPlaceholder}>
                  {unitId ? unitName(unitId) : '— Daire başkanlığı seçin —'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          <Text style={styles.label}>Müdür *</Text>
          <TouchableOpacity style={styles.selectInput} onPress={() => setManagerPickerOpen(true)}>
            <Text style={managerId ? styles.selectValue : styles.selectPlaceholder}>
              {managerId ? userName(managerId) : '— Müdür seçin —'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Personel ({staffIds.length} seçili)</Text>
          {!unitId ? (
            <Text style={styles.hint}>Personel seçmek için önce daire başkanlığını seçin.</Text>
          ) : (
            <View style={styles.staffBox}>
              <TextInput style={[styles.input, { marginBottom: 6 }]} value={staffQuery} onChangeText={setStaffQuery} placeholder="Personel ara…" />
              {shownStaff.length === 0 ? <Text style={styles.hint}>Eşleşen personel yok.</Text> : shownStaff.map((u) => {
                const checked = staffIds.includes(u.id);
                const isLocked = locked.has(u.id);
                const others = projectIdsOf(u).filter((id) => id !== project?.id).length;
                return (
                  <TouchableOpacity key={u.id} style={styles.staffRow} disabled={isLocked} onPress={() => toggleStaff(u.id)}>
                    <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={20} color={isLocked ? '#cbd5e1' : checked ? THEME.navy : '#94a3b8'} />
                    <Avatar name={u.name} color={u.avatarColor} size={24} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.staffName}>{u.name}</Text>
                      {isLocked ? <Text style={styles.staffMeta}>Başka müdürlüğü yok, çıkarılamaz</Text>
                        : others > 0 ? <Text style={styles.staffMeta}>{others} başka müdürlükte de görevli</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <Text style={styles.hint}>Bir personel birden fazla müdürlükte görev alabilir.</Text>

          <Text style={styles.label}>Açıklama</Text>
          <TextInput style={styles.textArea} value={description} onChangeText={setDescription} multiline placeholder="Açıklama..." />

          <View style={styles.switchRow}>
            <Text style={[styles.label, { marginTop: 0 }]}>Stok Takip İsteniyor mu?</Text>
            <Switch value={hasInventory} onValueChange={setHasInventory} />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onCancel(); }}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>{isEdit ? 'Kaydet' : 'Müdürlük Oluştur'}</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={unitPickerOpen}
        title="Daire Başkanlığı Seçin"
        options={(unitsQuery.data || []).map((u) => ({ key: u.id, label: `${u.name} (${u.unitCode})` }))}
        onSelect={(key) => { setUnitId(key); setManagerId(''); setStaffIds([]); setUnitPickerOpen(false); }}
        onClose={() => setUnitPickerOpen(false)}
      />
      <PickerSheet
        visible={managerPickerOpen}
        title="Müdür Seçin"
        options={managers.map((u) => ({ key: u.id, label: u.name }))}
        onSelect={(key) => { setManagerId(key); setManagerPickerOpen(false); }}
        onClose={() => setManagerPickerOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: '90%' },
  title: { fontSize: 17, fontWeight: '800', color: THEME.ink, marginBottom: 8 },
  label: { fontSize: 12, fontWeight: '700', color: THEME.muted, marginBottom: 6, marginTop: 14 },
  hint: { fontSize: 11, color: THEME.muted, marginTop: 4 },
  input: { borderWidth: 1, borderColor: THEME.line, borderRadius: 10, padding: 10, fontSize: 14, color: THEME.ink },
  textArea: { borderWidth: 1, borderColor: THEME.line, borderRadius: 10, padding: 10, fontSize: 14, minHeight: 70, textAlignVertical: 'top' },
  selectInput: { borderWidth: 1, borderColor: THEME.line, borderRadius: 10, padding: 11 },
  selectValue: { fontSize: 14, color: THEME.ink, fontWeight: '600' },
  selectPlaceholder: { fontSize: 14, color: '#94a3b8' },
  staffBox: { borderWidth: 1, borderColor: THEME.line, borderRadius: 12, padding: 8 },
  staffRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  staffName: { fontSize: 14, fontWeight: '600', color: THEME.ink },
  staffMeta: { fontSize: 11, color: THEME.muted },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, marginBottom: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 11 },
  cancelText: { color: THEME.muted, fontWeight: '600' },
  confirmBtn: { backgroundColor: THEME.navy, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  confirmText: { color: '#fff', fontWeight: '700' },
});
