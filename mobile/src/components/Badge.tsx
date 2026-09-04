import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { STATUS_COLORS, PRIORITY_COLORS } from '../utils/constants';

interface Props {
  label: string;
  bg?: string;
  color?: string;
}

export default function Badge({ label, bg, color }: Props) {
  return (
    <View style={[styles.badge, { backgroundColor: bg || '#EEE' }]}>
      <Text style={[styles.text, { color: color || '#333' }]}>{label}</Text>
    </View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const bg = STATUS_COLORS[status] || '#DFE1E6';
  // Light backgrounds get dark text, dark backgrounds get white text.
  const dark = ['To Do'].includes(status);
  return <Badge label={status} bg={dark ? bg + '33' : bg} color={dark ? '#42526E' : '#fff'} />;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] || '#666';
  return <Badge label={priority} bg={color + '22'} color={color} />;
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600' },
});
