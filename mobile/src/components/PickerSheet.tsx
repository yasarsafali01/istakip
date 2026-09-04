import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';

export interface PickerOption {
  key: string;
  label: string;
  sublabel?: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: PickerOption[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

// Generic bottom-sheet picker — used for status/assignee/sprint selection.
// Substitutes for board drag-and-drop on mobile (long-press a card instead).
export default function PickerSheet({ visible, title, options, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.option} onPress={() => onSelect(item.key)}>
                <Text style={styles.optionLabel}>{item.label}</Text>
                {item.sublabel ? <Text style={styles.optionSublabel}>{item.sublabel}</Text> : null}
              </TouchableOpacity>
            )}
            style={{ maxHeight: 360 }}
          />
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>İptal</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, paddingBottom: 28 },
  title: { fontSize: 15, fontWeight: '700', color: '#172B4D', marginBottom: 12 },
  option: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F2F4' },
  optionLabel: { fontSize: 14, color: '#172B4D' },
  optionSublabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cancelBtn: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  cancelText: { fontSize: 14, color: '#DE350B', fontWeight: '600' },
});
