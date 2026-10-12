import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '../../../src/api/resources';
import { ui } from '../../../src/components/ui';
import { THEME } from '../../../src/utils/constants';

/** Müdürlükler → (müdürlük) → Stok Takip. Same as the web page: not built yet. */
export default function InventoryScreen() {
  const { project: projectId } = useLocalSearchParams<{ project?: string }>();
  const router = useRouter();
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const project = projectsQuery.data?.find((p) => p.id === projectId);

  return (
    <View style={styles.wrap}>
      <Stack.Screen options={{ title: project ? `${project.name} — Stok` : 'Stok Takip' }} />
      <View style={[ui.card, styles.card]}>
        <Ionicons name="cube-outline" size={46} color={THEME.navy} />
        <Text style={styles.title}>Stok Durumu</Text>
        <Text style={styles.text}>Bu özellik yakında gelecek. Stok şimdilik iş tamamlanırken kullanılan malzemeyle düşülüyor.</Text>
        {projectId ? (
          <TouchableOpacity style={[ui.btnGhost, { marginTop: 16 }]} onPress={() => router.push(`/(app)/projects/${projectId}`)}>
            <Text style={ui.btnGhostText}>Müdürlüğe Dön</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: THEME.canvas, padding: 16 },
  card: { alignItems: 'center', paddingVertical: 36 },
  title: { fontSize: 18, fontWeight: '800', color: THEME.ink, marginTop: 12 },
  text: { fontSize: 13, color: THEME.muted, textAlign: 'center', marginTop: 6, lineHeight: 19 },
});
