import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import PickerSheet from './PickerSheet';
import { filesApi } from '../api/resources';
import type { RequestQuestion, FileRef } from '../api/types';
import { visibleQuestions, acceptedExtensions, formatBytes, MAX_UPLOAD_MB, FILE_CATEGORIES } from '../utils/requestForm';

type Answers = Record<string, any>;

interface Props {
  questions: RequestQuestion[];
  answers: Answers;
  onChange: (updater: (prev: Answers) => Answers) => void;
  errors?: Record<string, string>;
  onBusy?: (questionId: string, busy: boolean) => void;
  /** Form-builder preview: file questions list picked files without uploading. */
  preview?: boolean;
}

/**
 * Mobile counterpart of the web's DynamicQuestions: renders a request form's
 * questions (visibility rules shared via utils/requestForm). On a phone every
 * question takes the full width — the web's side-by-side widths don't apply.
 */
export default function DynamicQuestions({ questions, answers, onChange, errors = {}, onBusy, preview = false }: Props) {
  const [pickerFor, setPickerFor] = useState<RequestQuestion | null>(null);
  const shown: RequestQuestion[] = visibleQuestions(questions, answers);
  const set = (id: string, value: any) => onChange((prev) => ({ ...prev, [id]: value }));

  return (
    <View>
      {shown.map((q) => {
        const err = errors[q.id];
        const value = answers[q.id];
        const options = q.options.filter((o) => o.trim());
        return (
          <View key={q.id} style={styles.field}>
            {q.type !== 'boolean' && (
              <Text style={styles.label}>{q.label}{q.required ? <Text style={styles.req}> *</Text> : null}</Text>
            )}

            {(q.type === 'text' || q.type === 'number' || q.type === 'textarea' || q.type === 'date') && (
              <TextInput
                style={[styles.input, q.type === 'textarea' && styles.textArea, err && styles.inputError]}
                value={value || ''}
                onChangeText={(t) => set(q.id, t)}
                placeholder={q.type === 'date' ? 'YYYY-AA-GG (örn. 2026-10-08)' : q.placeholder}
                keyboardType={q.type === 'number' ? 'decimal-pad' : q.type === 'date' ? 'numbers-and-punctuation' : 'default'}
                multiline={q.type === 'textarea'}
              />
            )}

            {q.type === 'select' && (
              <TouchableOpacity style={[styles.input, err && styles.inputError]} onPress={() => setPickerFor(q)}>
                <Text style={value ? styles.value : styles.placeholder}>{value || '— Seçin —'}</Text>
              </TouchableOpacity>
            )}

            {q.type === 'radio' && options.map((o) => (
              <TouchableOpacity key={o} style={styles.optionRow} onPress={() => set(q.id, o)}>
                <Ionicons name={value === o ? 'radio-button-on' : 'radio-button-off'} size={20} color={value === o ? '#0052CC' : '#9CA3AF'} />
                <Text style={styles.optionText}>{o}</Text>
              </TouchableOpacity>
            ))}

            {q.type === 'checkbox' && options.map((o) => {
              const picked: string[] = Array.isArray(value) ? value : [];
              const on = picked.includes(o);
              return (
                <TouchableOpacity key={o} style={styles.optionRow}
                  onPress={() => set(q.id, on ? picked.filter((p) => p !== o) : [...picked, o])}>
                  <Ionicons name={on ? 'checkbox' : 'square-outline'} size={20} color={on ? '#0052CC' : '#9CA3AF'} />
                  <Text style={styles.optionText}>{o}</Text>
                </TouchableOpacity>
              );
            })}

            {q.type === 'boolean' && (
              <TouchableOpacity style={styles.optionRow} onPress={() => set(q.id, value !== true)}>
                <Ionicons name={value === true ? 'checkbox' : 'square-outline'} size={22} color={value === true ? '#0052CC' : '#9CA3AF'} />
                <Text style={[styles.optionText, { fontWeight: '700', color: '#172B4D' }]}>
                  {q.label}{q.required ? <Text style={styles.req}> *</Text> : null}
                </Text>
              </TouchableOpacity>
            )}

            {q.type === 'file' && (
              <FileQuestion q={q} value={value} preview={preview} onChange={(v) => set(q.id, v)} onBusy={(b) => onBusy?.(q.id, b)} />
            )}

            {q.helpText ? <Text style={styles.help}>{q.helpText}</Text> : null}
            {err ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={14} color="#DE350B" />
                <Text style={styles.errorText}>{err}</Text>
              </View>
            ) : null}
          </View>
        );
      })}

      <PickerSheet
        visible={!!pickerFor}
        title={pickerFor?.label || ''}
        options={(pickerFor?.options || []).filter((o) => o.trim()).map((o) => ({ key: o, label: o }))}
        onSelect={(key) => { if (pickerFor) set(pickerFor.id, key); setPickerFor(null); }}
        onClose={() => setPickerFor(null)}
      />
    </View>
  );
}

/** File answer: picks with the system document picker and uploads immediately. */
function FileQuestion({ q, value, onChange, onBusy, preview }: {
  q: RequestQuestion; value: any; onChange: (v: FileRef[]) => void; onBusy: (b: boolean) => void; preview?: boolean;
}) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const files: FileRef[] = Array.isArray(value) ? value : [];
  const max = q.settings?.maxFiles || 1;
  const exts: string[] = acceptedExtensions(q.settings);
  const remaining = max - files.length - uploading;
  const acceptLabel = q.settings?.accept?.length
    ? FILE_CATEGORIES.filter((c: any) => q.settings.accept!.includes(c.key)).map((c: any) => c.label).join(', ')
    : 'Görsel, PDF, Office, metin, arşiv';

  async function pick() {
    setError('');
    const res = await DocumentPicker.getDocumentAsync({ multiple: remaining > 1, copyToCacheDirectory: true });
    if (res.canceled || !res.assets) return;
    let picked = res.assets;
    if (picked.length > remaining) {
      setError(`En fazla ${max} dosya yükleyebilirsiniz.`);
      picked = picked.slice(0, Math.max(remaining, 0));
    }
    if (preview) {
      onChange([...files, ...picked.map((a, i) => ({ id: `preview-${Date.now()}-${i}`, name: a.name, size: a.size || 0 }))]);
      return;
    }
    let next = files;
    setUploading((u) => u + picked.length);
    onBusy(true);
    for (const a of picked) {
      const ext = `.${a.name.split('.').pop()?.toLowerCase()}`;
      try {
        if (!exts.includes(ext)) throw new Error('bu dosya türüne izin verilmiyor');
        if (a.size && a.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error(`dosya ${MAX_UPLOAD_MB} MB'tan büyük`);
        const saved = await filesApi.upload(a);
        next = [...next, saved];
        onChange(next);
      } catch (e: any) {
        setError(`${a.name}: ${e.message || 'yüklenemedi'}`);
      } finally {
        setUploading((u) => u - 1);
      }
    }
    onBusy(false);
  }

  return (
    <View>
      {files.map((f) => (
        <View key={f.id} style={styles.fileRow}>
          <Ionicons name="attach" size={16} color="#0052CC" />
          <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
          <Text style={styles.fileSize}>{formatBytes(f.size)}</Text>
          <TouchableOpacity onPress={() => onChange(files.filter((x) => x.id !== f.id))} hitSlop={8}>
            <Ionicons name="close" size={18} color="#DE350B" />
          </TouchableOpacity>
        </View>
      ))}
      {uploading > 0 && (
        <View style={styles.fileRow}><ActivityIndicator size="small" color="#0052CC" /><Text style={styles.fileName}>Yükleniyor…</Text></View>
      )}
      {remaining > 0 && (
        <TouchableOpacity style={styles.fileBtn} onPress={pick}>
          <Ionicons name="cloud-upload-outline" size={18} color="#0052CC" />
          <Text style={styles.fileBtnText}>{files.length ? 'Dosya ekle' : 'Dosya seç'}</Text>
        </TouchableOpacity>
      )}
      <Text style={styles.help}>{acceptLabel} · en fazla {max} dosya · dosya başına {MAX_UPLOAD_MB} MB</Text>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#172B4D', marginBottom: 6 },
  req: { color: '#DE350B' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: '#DE350B', borderWidth: 1.5 },
  value: { fontSize: 14, color: '#172B4D' },
  placeholder: { fontSize: 14, color: '#9CA3AF' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  optionText: { fontSize: 14, color: '#374151', flex: 1 },
  help: { fontSize: 11, color: '#6B7280', marginTop: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: '#DE350B', fontWeight: '600' },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 8, marginBottom: 6, backgroundColor: '#fff' },
  fileName: { flex: 1, fontSize: 13, color: '#172B4D' },
  fileSize: { fontSize: 11, color: '#9CA3AF' },
  fileBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#0052CC', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  fileBtnText: { color: '#0052CC', fontWeight: '600', fontSize: 13 },
});
