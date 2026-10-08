import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { issuesApi, unitsApi, projectsApi, requestFormsApi } from '../api/resources';
import PickerSheet from './PickerSheet';
import DynamicQuestions from './DynamicQuestions';
import { PRIORITIES, PRIORITY_LABELS } from '../utils/constants';
import { usePermissions } from '../hooks/usePermissions';
import { validateAnswers, buildAnswersPayload } from '../utils/requestForm';
import type { RequestForm } from '../api/types';

interface Props {
  visible: boolean;
  onCreated: () => void;
  onCancel: () => void;
}

// Mirrors frontend/src/components/request/RequestForm.jsx: daire başkanlığı →
// müdürlük → talep türü (the müdürlük's forms, loaded live from the API, so a
// form designed on the web shows up here without an app update) → its questions.
export default function CreateRequestSheet({ visible, onCreated, onCancel }: Props) {
  const { can } = usePermissions();
  const unitsQuery = useQuery({ queryKey: ['units'], queryFn: unitsApi.list, enabled: visible });
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list, enabled: visible });

  const [unitId, setUnitId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [onBehalf, setOnBehalf] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [forms, setForms] = useState<RequestForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [formId, setFormId] = useState('');
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState<string[]>([]);

  const unitProjects = (projectsQuery.data || []).filter((p) => p.unitId === unitId);
  const selectedForm = forms.find((f) => f.id === formId);
  const questions = selectedForm?.questions || [];

  useEffect(() => {
    setForms([]);
    setFormId('');
    setAnswers({});
    setAnswerErrors({});
    if (!projectId) return undefined;
    let cancelled = false;
    setFormsLoading(true);
    requestFormsApi.listByProject(projectId)
      .then((list) => {
        if (cancelled) return;
        setForms(list);
        if (list.length === 1) setFormId(list[0].id);
      })
      .catch(() => { if (!cancelled) setForms([]); })
      .finally(() => { if (!cancelled) setFormsLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  function reset() {
    setUnitId(''); setProjectId(''); setTitle(''); setDescription(''); setPriority('Medium');
    setOnBehalf(false); setContactName(''); setContactPhone('');
    setErrors({}); setAnswers({}); setAnswerErrors({}); setFormId(''); setSubmitting(false);
  }

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!unitId) errs.unitId = 'Lütfen bir daire başkanlığı seçin.';
    if (!projectId) errs.projectId = 'Lütfen bir müdürlük seçin.';
    if (projectId && forms.length > 0 && !formId) errs.formId = 'Lütfen talep türünü seçin.';
    if (!title.trim()) errs.title = 'Talep başlığı zorunludur.';
    const aErrs = validateAnswers(questions, answers);
    setErrors(errs);
    setAnswerErrors(aErrs);
    if (Object.keys(errs).length || Object.keys(aErrs).length) return;

    setSubmitting(true);
    try {
      await issuesApi.create({
        projectId,
        title: title.trim(),
        description: description.trim(),
        priority,
        isRequest: true,
        ...(formId ? { requestFormId: formId, answers: buildAnswersPayload(questions, answers) } : {}),
        ...(onBehalf && can('helpdesk.create') ? { contactName: contactName.trim(), contactPhone: contactPhone.trim() } : {}),
      });
      reset();
      onCreated();
    } catch (err: any) {
      setErrors({ form: err.message });
      setSubmitting(false);
    }
  }

  const getUnitLabel = (id: string) => {
    const u = unitsQuery.data?.find((x) => x.id === id);
    return u ? `${u.name} (${u.unitCode})` : '';
  };
  const getProjectName = (id: string) => projectsQuery.data?.find((p) => p.id === id)?.name;
  const FieldError = ({ k }: { k: string }) => (errors[k] ? (
    <View style={styles.errorRow}><Ionicons name="alert-circle" size={14} color="#DE350B" /><Text style={styles.errorText}>{errors[k]}</Text></View>
  ) : null);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={() => { reset(); onCancel(); }}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <ScrollView style={styles.card} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Yeni Talep Oluştur</Text>

          {can('helpdesk.create') && (
            <View style={styles.behalfBox}>
              <TouchableOpacity style={styles.optionRow} onPress={() => setOnBehalf(!onBehalf)}>
                <Ionicons name={onBehalf ? 'checkbox' : 'square-outline'} size={20} color={onBehalf ? '#0052CC' : '#9CA3AF'} />
                <Text style={styles.optionText}>Bir kişi adına açıyorum (telefon / yüz yüze)</Text>
              </TouchableOpacity>
              {onBehalf && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Ad Soyad" value={contactName} onChangeText={setContactName} />
                  <TextInput style={[styles.input, { flex: 1 }]} placeholder="Telefon" keyboardType="phone-pad" value={contactPhone} onChangeText={setContactPhone} />
                </View>
              )}
            </View>
          )}

          <Text style={styles.label}>Daire Başkanlığı <Text style={styles.req}>*</Text></Text>
          <TouchableOpacity style={[styles.selectInput, errors.unitId && styles.inputError]} disabled={unitsQuery.isLoading} onPress={() => setUnitPickerOpen(true)}>
            <Text style={unitId ? styles.selectValue : styles.selectPlaceholder}>
              {unitsQuery.isLoading ? 'Yükleniyor...' : unitId ? getUnitLabel(unitId) : '— Daire başkanlığı seçin —'}
            </Text>
          </TouchableOpacity>
          <FieldError k="unitId" />

          {unitId ? (
            <>
              <Text style={styles.label}>Müdürlük <Text style={styles.req}>*</Text></Text>
              {unitProjects.length === 0 ? (
                <Text style={styles.hint}>Bu daire başkanlığına ait müdürlük bulunamadı.</Text>
              ) : (
                <TouchableOpacity style={[styles.selectInput, errors.projectId && styles.inputError]} onPress={() => setProjectPickerOpen(true)}>
                  <Text style={projectId ? styles.selectValue : styles.selectPlaceholder}>
                    {projectId ? getProjectName(projectId) : '— Müdürlük seçin —'}
                  </Text>
                </TouchableOpacity>
              )}
              <FieldError k="projectId" />
            </>
          ) : null}

          {/* Talep türü — müdürlüğün formları */}
          {formsLoading && <Text style={styles.muted}>Talep türleri yükleniyor…</Text>}
          {forms.length > 0 && (
            <>
              <Text style={styles.label}>Talep Türü <Text style={styles.req}>*</Text></Text>
              {forms.map((f) => {
                const active = f.id === formId;
                return (
                  <TouchableOpacity key={f.id} style={[styles.formCard, active && styles.formCardActive]}
                    onPress={() => { setFormId(f.id); setAnswers({}); setAnswerErrors({}); setErrors((e) => ({ ...e, formId: '' })); }}>
                    <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={18} color={active ? '#0052CC' : '#9CA3AF'} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.formName}>{f.name}</Text>
                      {f.description ? <Text style={styles.formDesc}>{f.description}</Text> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <FieldError k="formId" />
            </>
          )}

          {questions.length > 0 && (
            <View style={styles.questionsBox}>
              <Text style={styles.questionsTitle}>{selectedForm?.name} — Talep Bilgileri</Text>
              <DynamicQuestions
                questions={questions}
                answers={answers}
                onChange={(fn) => { setAnswers(fn); setAnswerErrors({}); }}
                errors={answerErrors}
                onBusy={(qid, busy) => setUploading((ids) => (busy ? [...ids, qid] : ids.filter((x) => x !== qid)))}
              />
            </View>
          )}

          <Text style={styles.label}>Başlık <Text style={styles.req}>*</Text></Text>
          <TextInput style={[styles.input, errors.title && styles.inputError]} value={title}
            onChangeText={(t) => { setTitle(t); if (errors.title) setErrors((e) => ({ ...e, title: '' })); }}
            placeholder="Talebinizi kısaca açıklayın" />
          <FieldError k="title" />

          <Text style={styles.label}>Açıklama</Text>
          <TextInput style={styles.textArea} value={description} onChangeText={setDescription}
            placeholder="Talebinizi detaylı açıklayın..." multiline />

          <Text style={styles.label}>Öncelik</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity key={p} style={[styles.priorityChip, priority === p && styles.priorityChipActive]} onPress={() => setPriority(p)}>
                <Text style={[styles.priorityChipText, priority === p && styles.priorityChipTextActive]}>{PRIORITY_LABELS[p]}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {errors.form ? <View style={styles.formError}><Text style={styles.errorText}>{errors.form}</Text></View> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { reset(); onCancel(); }}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, (submitting || uploading.length > 0) && { opacity: 0.6 }]}
              onPress={handleSubmit} disabled={submitting || uploading.length > 0}>
              {submitting ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.confirmText}>{uploading.length ? 'Dosyalar yükleniyor…' : 'Talep Oluştur'}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={unitPickerOpen}
        title="Daire Başkanlığı Seçin"
        options={(unitsQuery.data || []).map((u) => ({ key: u.id, label: `${u.name} (${u.unitCode})` }))}
        onSelect={(key) => {
          setUnitId(key);
          const list = (projectsQuery.data || []).filter((p) => p.unitId === key);
          setProjectId(list.length === 1 ? list[0].id : '');
          setUnitPickerOpen(false);
          setErrors((e) => ({ ...e, unitId: '' }));
        }}
        onClose={() => setUnitPickerOpen(false)}
      />
      <PickerSheet
        visible={projectPickerOpen}
        title="Müdürlük Seçin"
        options={unitProjects.map((p) => ({ key: p.id, label: p.name }))}
        onSelect={(key) => { setProjectId(key); setProjectPickerOpen(false); setErrors((e) => ({ ...e, projectId: '' })); }}
        onClose={() => setProjectPickerOpen(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: '92%' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#172B4D', marginBottom: 6, marginTop: 14 },
  req: { color: '#DE350B' },
  hint: { fontSize: 12, color: '#B45309', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 6 },
  muted: { fontSize: 12, color: '#9CA3AF', marginTop: 10 },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14 },
  inputError: { borderColor: '#DE350B', borderWidth: 1.5 },
  textArea: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },
  selectInput: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10 },
  selectValue: { fontSize: 14, color: '#172B4D' },
  selectPlaceholder: { fontSize: 14, color: '#9CA3AF' },
  behalfBox: { backgroundColor: '#F4F5F7', borderRadius: 8, padding: 10, marginTop: 6 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  optionText: { fontSize: 13, color: '#374151', flex: 1 },
  formCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, marginBottom: 6 },
  formCardActive: { borderColor: '#0052CC', borderWidth: 2, backgroundColor: '#EEF4FD' },
  formName: { fontSize: 14, fontWeight: '700', color: '#172B4D' },
  formDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  questionsBox: { marginTop: 14, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC' },
  questionsTitle: { fontSize: 12, fontWeight: '700', color: '#0052CC' },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  priorityChip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  priorityChipActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  priorityChipText: { fontSize: 12, color: '#374151' },
  priorityChipTextActive: { color: '#fff', fontWeight: '600' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  errorText: { fontSize: 12, color: '#DE350B', fontWeight: '600' },
  formError: { backgroundColor: '#FDECEA', borderRadius: 8, padding: 10, marginTop: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20, marginBottom: 24 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  confirmText: { color: '#fff', fontWeight: '600' },
});
