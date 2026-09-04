import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  name: string;
  color?: string;
  size?: number;
}

export default function Avatar({ name, color = '#0052CC', size = 28 }: Props) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{initials || '?'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700' },
});
