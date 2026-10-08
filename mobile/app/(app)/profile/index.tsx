import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../src/context/AuthContext';
import { usersApi } from '../../../src/api/resources';
import Avatar from '../../../src/components/Avatar';

/** Mirrors the web Profilim page: location, notification channels, password. */
export default function ProfileScreen() {
  const { currentUser, refreshUser } = useAuth();
  const [building, setBuilding] = useState(currentUser?.building || '');
  const [floor, setFloor] = useState(currentUser?.floor || '');
  const [room, setRoom] = useState(currentUser?.room || '');
  const [notifyEmail, setNotifyEmail] = useState(currentUser?.notifyEmail ?? true);
  const [notifySms, setNotifySms] = useState(currentUser?.notifySms ?? false);
  const [notifyPush, setNotifyPush] = useState(currentUser?.notifyPush ?? true);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const [pwSaving, setPwSaving] = useState(false);

  async function saveProfile() {
    setSaving(true);
    try {
      await usersApi.updateMe({ building, floor, room, notifyEmail, notifySms, notifyPush });
      await refreshUser();
      Alert.alert('Kaydedildi', 'Profil bilgileriniz güncellendi.');
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    const errs: Record<string, string> = {};
    if (!currentPassword) errs.current = 'Mevcut şifre boş bırakılamaz.';
    if (newPassword.length < 6) errs.next = 'Yeni şifre en az 6 karakter olmalıdır.';
    if (newPassword !== newPassword2) errs.repeat = 'Şifreler eşleşmiyor.';
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setPwSaving(true);
    try {
      await usersApi.changePassword(currentPassword, newPassword);
      setCurrentPassword(''); setNewPassword(''); setNewPassword2('');
      Alert.alert('Şifre değiştirildi', 'Yeni şifreniz bir sonraki girişte geçerli.');
    } catch (err: any) {
      setPwErrors({ current: err.message });
    } finally {
      setPwSaving(false);
    }
  }

  const PwError = ({ k }: { k: string }) => (pwErrors[k] ? (
    <View style={styles.errorRow}><Ionicons name="alert-circle" size={14} color="#DE350B" /><Text style={styles.errorText}>{pwErrors[k]}</Text></View>
  ) : null);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.userCard}>
          <Avatar name={currentUser?.name || '?'} size={48} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.name}>{currentUser?.name}</Text>
            <Text style={styles.meta}>{currentUser?.email}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Konum</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Bina</Text>
          <TextInput style={styles.input} value={building} onChangeText={setBuilding} placeholder="Örn. Rektörlük" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kat</Text>
              <TextInput style={styles.input} value={floor} onChangeText={setFloor} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Oda</Text>
              <TextInput style={styles.input} value={room} onChangeText={setRoom} />
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Bildirimler</Text>
        <View style={styles.card}>
          {[
            ['Uygulama içi bildirim', notifyPush, setNotifyPush],
            ['E-posta', notifyEmail, setNotifyEmail],
            ['SMS', notifySms, setNotifySms],
          ].map(([label, value, setter]: any) => (
            <View key={label} style={styles.switchRow}>
              <Text style={styles.switchLabel}>{label}</Text>
              <Switch value={value} onValueChange={setter} />
            </View>
          ))}
          <Text style={styles.hint}>E-posta ve SMS tercihleri kaydedilir; gönderim ileride etkinleştirilecek.</Text>
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={saveProfile} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Kaydet</Text>}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Şifre Değiştir</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Mevcut şifre <Text style={styles.req}>*</Text></Text>
          <TextInput style={[styles.input, pwErrors.current && styles.inputError]} secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} />
          <PwError k="current" />
          <Text style={styles.label}>Yeni şifre <Text style={styles.req}>*</Text></Text>
          <TextInput style={[styles.input, pwErrors.next && styles.inputError]} secureTextEntry value={newPassword} onChangeText={setNewPassword} />
          <PwError k="next" />
          <Text style={styles.label}>Yeni şifre (tekrar) <Text style={styles.req}>*</Text></Text>
          <TextInput style={[styles.input, pwErrors.repeat && styles.inputError]} secureTextEntry value={newPassword2} onChangeText={setNewPassword2} />
          <PwError k="repeat" />
        </View>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: '#172B4D' }]} onPress={changePassword} disabled={pwSaving}>
          {pwSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Şifreyi Değiştir</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  userCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '700', color: '#172B4D' },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 16, marginBottom: 6, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#172B4D', marginTop: 8, marginBottom: 6 },
  req: { color: '#DE350B' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  inputError: { borderColor: '#DE350B', borderWidth: 1.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  switchLabel: { fontSize: 14, color: '#172B4D' },
  hint: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },
  primaryBtn: { backgroundColor: '#0052CC', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 12 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: '#DE350B', fontWeight: '600' },
});
