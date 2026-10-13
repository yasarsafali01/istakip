import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../src/context/AuthContext';
import { THEME } from '../src/utils/constants';
import { DEMO_ACCOUNTS } from '../src/utils/demoAccounts';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      // Stack.Protected in app/_layout.tsx swaps to (app) automatically
      // once currentUser is set.
    } catch (err: any) {
      setError(err.message || 'Giriş başarısız oldu.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.brand}>
              <Image source={require('../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.title}>Mersin Üniversitesi</Text>
              <Text style={styles.product}>Talep Takip Sistemi</Text>
              <Text style={styles.subtitle}>Hesabınıza giriş yapın</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Text style={styles.label}>E-posta</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="ornek@kurum.edu.tr"
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Text style={styles.label}>Şifre</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={handleSubmit}
            />

            <TouchableOpacity
              style={[styles.button, (loading || !email || !password) && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || !email || !password}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}
            </TouchableOpacity>
          </View>

          {/* Demo credentials only in development; release builds hide them. */}
          {__DEV__ && (
          <View style={[styles.card, { marginTop: 14, padding: 0, overflow: 'hidden' }]}>
            <TouchableOpacity style={styles.demoHead} onPress={() => setDemoOpen((o) => !o)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.demoTitle}>🔑 Demo Giriş Bilgileri</Text>
                <Text style={styles.demoHint}>Şifre: pass123 · Admin: admin123 · dokunun, otomatik doldurulsun</Text>
              </View>
              <Ionicons name={demoOpen ? 'chevron-up' : 'chevron-down'} size={18} color={THEME.muted} />
            </TouchableOpacity>
            {demoOpen && DEMO_ACCOUNTS.map((g) => (
              <View key={g.group}>
                <View style={styles.groupHead}>
                  <View style={[styles.dot, { backgroundColor: g.color }]} />
                  <Text style={styles.groupText}>{g.group}</Text>
                </View>
                {g.accounts.map((acc) => {
                  const on = email === acc.email;
                  return (
                    <TouchableOpacity key={acc.email} style={[styles.acc, on && { backgroundColor: THEME.navySoft }]}
                      onPress={() => { setEmail(acc.email); setPassword(acc.password); setError(''); }}>
                      <View style={[styles.badge, { backgroundColor: g.color + '22' }]}>
                        <Text style={[styles.badgeText, { color: g.color }]}>{acc.badge}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.accName} numberOfLines={1}>{acc.label}</Text>
                        <Text style={styles.accMail} numberOfLines={1}>{acc.email}</Text>
                      </View>
                      {on && <Ionicons name="checkmark-circle" size={18} color={THEME.navy} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#eef1f8' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: THEME.line, padding: 22 },
  brand: { alignItems: 'center', marginBottom: 18 },
  logo: { width: 84, height: 84, marginBottom: 8 },
  title: { fontSize: 21, fontWeight: '800', color: THEME.navy },
  product: { fontSize: 14, fontWeight: '700', color: THEME.orange, marginTop: 2 },
  subtitle: { fontSize: 13, color: THEME.muted, marginTop: 8 },
  error: { backgroundColor: THEME.dangerSoft, color: THEME.danger, padding: 10, borderRadius: 10, marginBottom: 6, fontSize: 13, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '600', color: THEME.ink, marginBottom: 6, marginTop: 10 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: THEME.line, color: THEME.ink,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  button: { backgroundColor: THEME.navy, borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  demoHead: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  demoTitle: { fontSize: 14, fontWeight: '800', color: THEME.ink },
  demoHint: { fontSize: 11, color: THEME.muted, marginTop: 2 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f4f5f7', paddingHorizontal: 16, paddingVertical: 7 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  groupText: { fontSize: 12, fontWeight: '700', color: '#42526E' },
  acc: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, minWidth: 60, alignItems: 'center' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  accName: { fontSize: 13, fontWeight: '600', color: THEME.ink },
  accMail: { fontSize: 11, color: THEME.muted },
});
