import React, { useState } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import PickerSheet from './PickerSheet';
import type { Project } from '../api/types';

/** Müdürlük chooser used by the per-müdürlük management screens. */
export default function ProjectSelect({ projects, value, onChange }: { projects: Project[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = projects.find((p) => p.id === value);
  if (projects.length <= 1) return null;
  return (
    <>
      <TouchableOpacity style={styles.select} onPress={() => setOpen(true)}>
        <Ionicons name="folder-outline" size={16} color="#0052CC" />
        <Text style={styles.text} numberOfLines={1}>{current?.name || '— Müdürlük seçin —'}</Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>
      <PickerSheet
        visible={open}
        title="Müdürlük Seçin"
        options={projects.map((p) => ({ key: p.id, label: p.name }))}
        onSelect={(id) => { onChange(id); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  select: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, marginHorizontal: 16, marginTop: 12 },
  text: { flex: 1, fontSize: 14, fontWeight: '600', color: '#172B4D' },
});
