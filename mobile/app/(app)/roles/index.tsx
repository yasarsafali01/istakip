import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Modal, ScrollView, TextInput,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { rolesApi, PermissionInfo } from '../../../src/api/resources';
import { SCOPE_LABELS } from '../../../src/utils/constants';
import type { RoleDef } from '../../../src/api/types';

type Form = { key: string | null; name: string; description: string; scope: string; level: number; permissions: string[]; isSystem: boolean; userCount: number };
const EMPTY: Form = { key: null, name: '', description: '', scope: 'project', level: 50, permissions: [], isSystem: false, userCount: 0 };

/**
 * Mirrors the web "Roller ve İzinler" page: role definitions (permission set,
 * data scope, level). System_Admin is locked; built-in roles keep their scope
 * and level; only unused custom roles can be deleted. Who holds which role is
 * managed on the Kullanıcılar screen.
 */
export default function RolesScreen() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: ['roles'], queryFn: rolesApi.list });
  const catalogQuery = useQuery({ queryKey: ['permissions'], queryFn: rolesApi.permissions });
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const locked = form?.key === 'System_Admin';
  const groups = (catalogQuery.data || []).reduce<Record<string, PermissionInfo[]>>((acc, p) => {
    (acc[p.group] = acc[p.group] || []).push(p);
    return acc;
  }, {});

  function edit(r: RoleDef) {
    setError('');
    setForm({ key: r.key, name: r.name, description: r.description, scope: r.scope, level: r.level, permissions: r.permissions, isSystem: r.isSystem, userCount: r.userCount });
  }

  function toggle(key: string) {
    if (!form || locked) return;
    setForm({ ...form, permissions: form.permissions.includes(key) ? form.permissions.filter((p) => p !== key) : [...form.permissions, key] });
  }

  async function save() {
    if (!form) return;
    if (!form.name.trim()) { setError('Rol adı boş bırakılamaz.'); return; }
    setSaving(true);
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), scope: form.scope, level: form.level, permissions: form.permissions };
      if (form.key) await rolesApi.update(form.key, body);
      else await rolesApi.create(body);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setForm(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function remove() {
    if (!form?.key) return;
    Alert.alert('Rolü sil', `"${form.name}" silinecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await rolesApi.remove(form.key!);
            queryClient.invalidateQueries({ queryKey: ['roles'] });
            setForm(null);
          } catch (err: any) { setError(err.message); }
        },
      },
    ]);
  }

  if (rolesQuery.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <FlatList
        data={rolesQuery.data || []}
        keyExtractor={(r) => r.key}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        ListHeaderComponent={<Text style={styles.intro}>Bir role dokunarak izinlerini, kapsamını ve seviyesini düzenleyin. Kullanıcılara rol atamak için Menü → Kullanıcılar.</Text>}
        renderItem={({ item: r }) => (
          <TouchableOpacity style={styles.card} onPress={() => edit(r)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.roleName}>{r.name}</Text>
              {r.isSystem && <Text style={styles.badge}>Yerleşik</Text>}
            </View>
            {r.description ? <Text style={styles.desc}>{r.description}</Text> : null}
            <View style={styles.metaRow}>
              <Text style={styles.metaBadge}>{SCOPE_LABELS[r.scope] || r.scope}</Text>
              <Text style={styles.metaBadge}>Seviye {r.level}</Text>
              <Text style={styles.metaBadge}>{r.permissions.length} izin</Text>
              <Text style={styles.metaBadge}><Ionicons name="people" size={11} /> {r.userCount}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => { setError(''); setForm(EMPTY); }}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={!!form} animationType="slide" transparent onRequestClose={() => setForm(null)}>
        <View style={styles.overlay}>
          <ScrollView style={styles.sheet} keyboardShouldPersistTaps="handled">
            {form && (
              <>
                <Text style={styles.sheetTitle}>{form.key ? 'Rolü Düzenle' : 'Yeni Rol'}</Text>
                {locked && <Text style={styles.lockNote}>Sistem Yöneticisi rolü kilitlidir; her izne sahiptir.</Text>}
                <Text style={styles.label}>Rol adı <Text style={styles.req}>*</Text></Text>
                <TextInput style={[styles.input, error && !form.name.trim() ? styles.inputError : null]} editable={!locked}
                  value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="Örn. Daire Başkan Yardımcısı" />
                <Text style={styles.label}>Açıklama</Text>
                <TextInput style={styles.input} editable={!locked} value={form.description} onChangeText={(t) => setForm({ ...form, description: t })} />

                <Text style={styles.label}>Veri kapsamı</Text>
                <View style={styles.chips}>
                  {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                    <TouchableOpacity key={value} disabled={locked || form.isSystem} onPress={() => setForm({ ...form, scope: value })}
                      style={[styles.chip, form.scope === value && styles.chipActive, (locked || form.isSystem) && { opacity: 0.6 }]}>
                      <Text style={[styles.chipText, form.scope === value && styles.chipTextActive]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Seviye (yüksek = daha yetkili)</Text>
                <TextInput style={styles.input} keyboardType="number-pad" editable={!locked && !form.isSystem}
                  value={String(form.level)} onChangeText={(t) => setForm({ ...form, level: Number(t.replace(/\D/g, '')) || 0 })} />

                <Text style={styles.label}>İzinler</Text>
                {Object.entries(groups).map(([group, perms]) => (
                  <View key={group} style={{ marginBottom: 8 }}>
                    <Text style={styles.group}>{group}</Text>
                    {perms.map((p) => {
                      const on = locked || form.permissions.includes(p.key);
                      return (
                        <TouchableOpacity key={p.key} style={styles.permRow} onPress={() => toggle(p.key)} disabled={locked}>
                          <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? '#0052CC' : '#9CA3AF'} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.permLabel}>{p.label}</Text>
                            <Text style={styles.permDesc}>{p.description}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}

                {error ? <Text style={styles.error}>{error}</Text> : null}
                <View style={styles.actions}>
                  {form.key && !form.isSystem && (
                    <TouchableOpacity onPress={remove} disabled={form.userCount > 0} style={{ marginRight: 'auto', opacity: form.userCount > 0 ? 0.4 : 1 }}>
                      <Text style={{ color: '#DE350B', fontWeight: '700' }}>{form.userCount > 0 ? 'Kullanıcısı var' : 'Sil'}</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => setForm(null)} style={{ padding: 10 }}><Text style={{ color: '#6B7280', fontWeight: '600' }}>Kapat</Text></TouchableOpacity>
                  {!locked && (
                    <TouchableOpacity onPress={save} disabled={saving} style={styles.saveBtn}>
                      {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  intro: { fontSize: 12, color: '#6B7280', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  roleName: { fontSize: 15, fontWeight: '700', color: '#172B4D' },
  badge: { fontSize: 10, color: '#42526E', backgroundColor: '#F1F2F4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  desc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  metaBadge: { fontSize: 11, color: '#42526E', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 52, height: 52, borderRadius: 26, backgroundColor: '#0052CC', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '92%' },
  sheetTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  lockNote: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#172B4D', marginTop: 12, marginBottom: 6 },
  req: { color: '#DE350B' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  inputError: { borderColor: '#DE350B', borderWidth: 1.5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  group: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 },
  permRow: { flexDirection: 'row', gap: 8, paddingVertical: 6 },
  permLabel: { fontSize: 13, fontWeight: '600', color: '#172B4D' },
  permDesc: { fontSize: 11, color: '#6B7280' },
  error: { color: '#DE350B', fontWeight: '600', marginTop: 8 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 16, marginBottom: 30 },
  saveBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  saveText: { color: '#fff', fontWeight: '700' },
});
