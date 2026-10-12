import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Modal, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, requestFormsApi } from '../../../src/api/resources';
import ProjectSelect from '../../../src/components/ProjectSelect';
import { useLocalSearchParams } from 'expo-router';
import PickerSheet from '../../../src/components/PickerSheet';
import DynamicQuestions from '../../../src/components/DynamicQuestions';
import {
  QUESTION_TYPES, QUESTION_TYPE_BY_KEY, QUESTION_WIDTHS, FILE_CATEGORIES, isChoiceType, isConditionSource,
  hasPlaceholder, newQuestion, uuidv4, validateForm,
} from '../../../src/utils/requestForm';
import type { RequestForm, RequestQuestion } from '../../../src/api/types';

type Draft = { name: string; description: string; isActive: boolean; questions: RequestQuestion[] };
const toQ = (q: RequestQuestion): RequestQuestion => ({ ...q, options: q.options || [], showIf: q.showIf || null, width: q.width || 12, settings: q.settings || {} });
const toDraft = (f: RequestForm): Draft => ({ name: f.name, description: f.description || '', isActive: f.isActive, questions: (f.questions || []).map(toQ) });

/**
 * Mobile Talep Formları — same data and rules as the web builder (forms per
 * müdürlük, questions with type/options/required/width/condition/file
 * settings), adapted to touch: up/down arrows instead of drag-and-drop and a
 * full-screen sheet to edit one question. Saved forms are what requesters see
 * on both web and mobile.
 */
export default function FormsScreen() {
  const projectsQuery = useQuery({ queryKey: ['projects'], queryFn: projectsApi.list });
  const projects = projectsQuery.data || [];
  // Opened from Müdürlükler → (müdürlük) → Talep Formları
  const { project: projectParam } = useLocalSearchParams<{ project?: string }>();
  const [projectId, setProjectId] = useState(projectParam || '');
  const pid = projectId || projects[0]?.id || '';

  const [forms, setForms] = useState<RequestForm[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RequestQuestion | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, any>>({});
  const [newFormOpen, setNewFormOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNameError, setNewNameError] = useState('');

  const selected = forms.find((f) => f.id === selectedId) || null;
  const saved = useMemo(() => (selected ? toDraft(selected) : null), [selected]);
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(saved);
  const questions = draft?.questions || [];
  const formErrors: Record<string, string[]> = useMemo(() => validateForm(questions), [questions]);

  function openForm(f: RequestForm | null) {
    setSelectedId(f?.id || null);
    setDraft(f ? toDraft(f) : null);
  }

  useEffect(() => {
    if (!pid) return;
    setLoading(true);
    requestFormsApi.listByProject(pid, true)
      .then((list) => { setForms(list); openForm(list[0] || null); })
      .catch((err) => Alert.alert('Hata', err.message))
      .finally(() => setLoading(false));
  }, [pid]);

  const confirmDiscard = (then: () => void) => {
    if (!dirty) { then(); return; }
    Alert.alert('Kaydedilmemiş değişiklikler', 'Devam ederseniz kaybolacak.', [
      { text: 'Vazgeç', style: 'cancel' }, { text: 'Değişiklikleri at', style: 'destructive', onPress: then },
    ]);
  };
  // Switching müdürlük from the Müdürlükler tab while this screen stays mounted.
  useEffect(() => {
    if (projectParam && projectParam !== projectId) confirmDiscard(() => setProjectId(projectParam));
  }, [projectParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const setQuestions = (fn: (qs: RequestQuestion[]) => RequestQuestion[]) => setDraft((d) => (d ? { ...d, questions: fn(d.questions) } : d));

  function move(idx: number, dir: -1 | 1) {
    setQuestions((qs) => {
      const next = [...qs];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return qs;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function removeQuestion(q: RequestQuestion) {
    const deps = questions.filter((x) => x.showIf?.questionId === q.id).length;
    Alert.alert('Soruyu sil', deps ? `Bu soruya bağlı ${deps} koşullu soru var; silinirse koşulsuz hale gelirler.` : `"${q.label || 'Bu soru'}" silinecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive',
        onPress: () => setQuestions((qs) => qs.filter((x) => x.id !== q.id).map((x) => (x.showIf?.questionId === q.id ? { ...x, showIf: null } : x))),
      },
    ]);
  }

  function saveQuestion(q: RequestQuestion, prevType: string) {
    setQuestions((qs) => qs.map((x) => {
      if (x.id === q.id) return q;
      // conditions on a question whose answer kind changed are dropped (same rule as the web)
      const kindChanged = !isConditionSource(q.type) || (q.type === 'boolean') !== (prevType === 'boolean');
      if (x.showIf?.questionId === q.id && q.type !== prevType && kindChanged) return { ...x, showIf: null };
      return x;
    }));
    setEditing(null);
  }

  async function save() {
    if (!draft || !selected || !saved) return;
    if (!draft.name.trim()) { Alert.alert('Uyarı', 'Talep türü adı boş olamaz.'); return; }
    const errCount = Object.keys(formErrors).length;
    if (errCount) { Alert.alert('Düzeltilmesi gereken sorular', `${errCount} soruda eksik var (kırmızı işaretli).`); return; }
    setSaving(true);
    try {
      let result = selected;
      if (draft.name !== saved.name || draft.description !== saved.description || draft.isActive !== saved.isActive) {
        result = await requestFormsApi.update(selected.id, { name: draft.name.trim(), description: draft.description.trim(), isActive: draft.isActive });
      }
      if (JSON.stringify(draft.questions) !== JSON.stringify(saved.questions)) {
        result = await requestFormsApi.saveQuestions(selected.id, draft.questions.map((q) => ({
          ...q, options: isChoiceType(q.type) ? q.options.map((o: string) => o.trim()).filter(Boolean) : [],
        })));
      }
      setForms((fs) => fs.map((f) => (f.id === result.id ? result : f)));
      setDraft(toDraft(result));
      Alert.alert('Kaydedildi', result.isActive ? 'Yeni talepler bu formu görecek.' : 'Form pasif; talep ekranında görünmüyor.');
    } catch (err: any) {
      Alert.alert('Hata', err.message);
    } finally {
      setSaving(false);
    }
  }

  async function createForm() {
    if (!newName.trim()) { setNewNameError('Talep türü adı boş bırakılamaz.'); return; }
    try {
      const created = await requestFormsApi.create(pid, { name: newName.trim(), description: '' });
      setForms((fs) => [...fs, created]);
      openForm(created);
      setNewFormOpen(false);
      setNewName('');
    } catch (err: any) { Alert.alert('Hata', err.message); }
  }

  async function duplicateForm() {
    if (!selected) return;
    if (dirty) { Alert.alert('Uyarı', 'Çoğaltmadan önce değişiklikleri kaydedin.'); return; }
    try {
      const copy = await requestFormsApi.duplicate(selected.id);
      setForms((fs) => [...fs, copy]);
      openForm(copy);
    } catch (err: any) { Alert.alert('Hata', err.message); }
  }

  function deleteForm() {
    if (!selected) return;
    Alert.alert('Talep türünü sil', `"${selected.name}" ve tüm soruları silinecek. Bu türle açılmış talepler cevaplarını korur.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          try {
            await requestFormsApi.remove(selected.id);
            const rest = forms.filter((f) => f.id !== selected.id);
            setForms(rest);
            openForm(rest[0] || null);
          } catch (err: any) { Alert.alert('Hata', err.message); }
        },
      },
    ]);
  }

  if (projectsQuery.isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#0052CC" /></View>;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <ProjectSelect projects={projects} value={pid} onChange={(id) => confirmDiscard(() => setProjectId(id))} />

      {/* Talep türleri: üstte sekmeler */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.tabsRow}>
        {forms.map((f) => {
          const active = f.id === selectedId;
          return (
            <TouchableOpacity key={f.id} style={[styles.formTab, active && styles.formTabActive]} onPress={() => confirmDiscard(() => openForm(f))}>
              <Text style={[styles.formTabText, active && { color: '#fff' }]}>{active && draft ? draft.name || 'Adsız' : f.name}{active && dirty ? ' •' : ''}</Text>
              {!f.isActive && <Text style={styles.passive}>Pasif</Text>}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity style={styles.newTab} onPress={() => { setNewName(''); setNewNameError(''); setNewFormOpen(true); }}>
          <Ionicons name="add" size={16} color="#0052CC" /><Text style={styles.newTabText}>Yeni talep türü</Text>
        </TouchableOpacity>
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color="#0052CC" /></View> : !draft ? (
        <View style={styles.center}><Text style={styles.empty}>Bu müdürlüğün henüz talep formu yok. "Yeni talep türü" ile başlayın.</Text></View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.label}>Talep türü adı <Text style={styles.req}>*</Text></Text>
            <TextInput style={styles.input} value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} />
            <Text style={styles.label}>Kısa açıklama</Text>
            <TextInput style={styles.input} value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} placeholder="Talep sahibi türü seçerken görür" />
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>{draft.isActive ? 'Aktif — talep ekranında seçilebilir' : 'Pasif — talep ekranında görünmez'}</Text>
              <Switch value={draft.isActive} onValueChange={(v) => setDraft({ ...draft, isActive: v })} />
            </View>
            <View style={styles.toolRow}>
              <ToolBtn icon="eye-outline" label="Önizle" onPress={() => { setPreviewAnswers({}); setPreviewOpen(true); }} />
              <ToolBtn icon="copy-outline" label="Çoğalt" onPress={duplicateForm} />
              <ToolBtn icon="trash-outline" label="Sil" danger onPress={deleteForm} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Sorular ({questions.length})</Text>
          {questions.length === 0 && <Text style={styles.empty}>Bu talep türünün henüz sorusu yok.</Text>}
          {questions.map((q, idx) => {
            const meta = QUESTION_TYPE_BY_KEY[q.type];
            const errs = formErrors[q.id];
            return (
              <View key={q.id} style={[styles.qCard, errs && { borderColor: '#DE350B' }]}>
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => setEditing(q)}>
                  <Text style={styles.qNum}>{idx + 1}.</Text>
                  <Ionicons name={(meta?.icon || 'help-outline') as any} size={18} color="#0052CC" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.qLabel} numberOfLines={2}>{q.label || `Yeni ${meta?.label.toLowerCase()} sorusu`}</Text>
                    <Text style={styles.qMeta}>
                      {meta?.label}{q.required ? ' · Zorunlu' : ''}{q.showIf ? ' · Koşullu' : ''}{q.width !== 12 ? ` · ${QUESTION_WIDTHS.find((w: any) => w.width === q.width)?.short}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="create-outline" size={18} color="#6B7280" />
                </TouchableOpacity>
                {errs && <Text style={styles.qError}>{errs.join(' ')}</Text>}
                <View style={styles.qActions}>
                  <IconBtn icon="arrow-up" onPress={() => move(idx, -1)} disabled={idx === 0} />
                  <IconBtn icon="arrow-down" onPress={() => move(idx, 1)} disabled={idx === questions.length - 1} />
                  <IconBtn icon="copy-outline" onPress={() => setQuestions((qs) => {
                    const i = qs.findIndex((x) => x.id === q.id);
                    const copy = { ...q, id: uuidv4(), label: q.label ? `${q.label} (kopya)` : '', options: [...q.options] };
                    return [...qs.slice(0, i + 1), copy, ...qs.slice(i + 1)];
                  })} />
                  <IconBtn icon="trash-outline" danger onPress={() => removeQuestion(q)} />
                </View>
              </View>
            );
          })}

          <TouchableOpacity style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <Ionicons name="add-circle-outline" size={18} color="#0052CC" /><Text style={styles.addBtnText}>Soru ekle</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {draft && (
        <View style={styles.saveBar}>
          <Text style={styles.saveInfo}>{dirty ? 'Kaydedilmemiş değişiklik' : 'Kaydedildi'}</Text>
          <TouchableOpacity disabled={!dirty || saving} onPress={() => setDraft(saved)} style={{ padding: 10, opacity: dirty ? 1 : 0.4 }}>
            <Text style={{ color: '#6B7280', fontWeight: '700' }}>Geri al</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={!dirty || saving} onPress={save} style={[styles.saveBtn, (!dirty || saving) && { opacity: 0.5 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
          </TouchableOpacity>
        </View>
      )}

      <PickerSheet
        visible={addOpen}
        title="Soru tipi"
        options={QUESTION_TYPES.map((t: any) => ({ key: t.type, label: t.label, sublabel: t.hint }))}
        onSelect={(type) => {
          setAddOpen(false);
          const q = newQuestion(type);
          setQuestions((qs) => [...qs, q]);
          setEditing(q);
        }}
        onClose={() => setAddOpen(false)}
      />

      {editing && (
        <QuestionEditor
          question={editing}
          earlier={questions.slice(0, Math.max(0, questions.findIndex((x) => x.id === editing.id)))}
          onCancel={() => setEditing(null)}
          onSave={saveQuestion}
        />
      )}

      <Modal visible={previewOpen} animationType="slide" onRequestClose={() => setPreviewOpen(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{draft?.name} — önizleme</Text>
            <TouchableOpacity onPress={() => setPreviewOpen(false)}><Ionicons name="close" size={24} color="#172B4D" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <Text style={styles.empty}>Talep sahibinin göreceği form. Dosya seçimi önizlemede yüklenmez.</Text>
            <DynamicQuestions questions={questions} answers={previewAnswers} onChange={(fn) => setPreviewAnswers(fn)} preview />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={newFormOpen} transparent animationType="fade" onRequestClose={() => setNewFormOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.modalTitle}>Yeni talep türü</Text>
            <Text style={styles.label}>Talep türü adı <Text style={styles.req}>*</Text></Text>
            <TextInput style={[styles.input, newNameError ? styles.inputError : null]} autoFocus value={newName}
              onChangeText={(t) => { setNewName(t); setNewNameError(''); }} placeholder="Örn. Arıza Bildirimi" />
            {newNameError ? <Text style={styles.qError}>{newNameError}</Text> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
              <TouchableOpacity onPress={() => setNewFormOpen(false)} style={{ padding: 10 }}><Text style={{ color: '#6B7280', fontWeight: '700' }}>İptal</Text></TouchableOpacity>
              <TouchableOpacity onPress={createForm} style={styles.saveBtn}><Text style={styles.saveText}>Oluştur</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** Full-screen editor for one question; changes apply to the draft on "Tamam". */
function QuestionEditor({ question, earlier, onCancel, onSave }: {
  question: RequestQuestion; earlier: RequestQuestion[]; onCancel: () => void; onSave: (q: RequestQuestion, prevType: string) => void;
}) {
  const [q, setQ] = useState<RequestQuestion>(question);
  const [options, setOptions] = useState<string[]>(question.options);
  const [bulk, setBulk] = useState<string | null>(null); // null = one by one, string = bulk text
  const [typeOpen, setTypeOpen] = useState(false);
  const [parentOpen, setParentOpen] = useState(false);
  const [valueOpen, setValueOpen] = useState(false);
  const sources = earlier.filter((x) => isConditionSource(x.type));
  const parent = q.showIf ? sources.find((s) => s.id === q.showIf!.questionId) : undefined;
  const parentValues: [string, string][] = parent?.type === 'boolean'
    ? [['true', 'Evet (işaretli)'], ['false', 'Hayır (işaretsiz)']]
    : (parent?.options || []).filter((o) => o.trim()).map((o) => [o, o]);

  function changeType(type: any) {
    setTypeOpen(false);
    const next: RequestQuestion = { ...q, type };
    if (isChoiceType(type) && !isChoiceType(q.type)) { next.options = ['Seçenek 1', 'Seçenek 2']; setOptions(next.options); setBulk(null); }
    if (!isChoiceType(type)) { next.options = []; setOptions([]); setBulk(null); }
    if (!hasPlaceholder(type)) next.placeholder = '';
    if (type !== q.type) next.settings = type === 'file' ? { maxFiles: 1, accept: [] } : {};
    setQ(next);
  }

  function done() {
    const raw = bulk !== null ? bulk.split('\n') : options;
    const final = { ...q, options: isChoiceType(q.type) ? raw.map((o) => o.trim()).filter(Boolean) : [] };
    if (!final.label.trim()) { Alert.alert('Uyarı', 'Soru metni boş bırakılamaz.'); return; }
    if (isChoiceType(final.type) && final.options.length === 0) { Alert.alert('Uyarı', 'En az bir seçenek ekleyin.'); return; }
    onSave(final, question.type);
  }

  const accept = q.settings?.accept || [];
  return (
    <Modal visible animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onCancel}><Text style={{ color: '#6B7280', fontWeight: '700' }}>Vazgeç</Text></TouchableOpacity>
          <Text style={styles.modalTitle}>Soruyu düzenle</Text>
          <TouchableOpacity onPress={done}><Text style={{ color: '#0052CC', fontWeight: '800' }}>Tamam</Text></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Soru metni <Text style={styles.req}>*</Text></Text>
          <TextInput style={styles.input} value={q.label} autoFocus={!q.label} onChangeText={(t) => setQ({ ...q, label: t })} placeholder="Örn. Cihazın seri numarası nedir?" />

          <Text style={styles.label}>Soru tipi</Text>
          <TouchableOpacity style={styles.input} onPress={() => setTypeOpen(true)}>
            <Text>{QUESTION_TYPE_BY_KEY[q.type]?.label}</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Yardım metni</Text>
          <TextInput style={styles.input} value={q.helpText} onChangeText={(t) => setQ({ ...q, helpText: t })} placeholder="Sorunun altında küçük açıklama" />

          {hasPlaceholder(q.type) && (
            <>
              <Text style={styles.label}>Örnek metin (placeholder)</Text>
              <TextInput style={styles.input} value={q.placeholder} onChangeText={(t) => setQ({ ...q, placeholder: t })} />
            </>
          )}

          {isChoiceType(q.type) && (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <Text style={[styles.label, { flex: 1 }]}>Seçenekler <Text style={styles.req}>*</Text></Text>
                <TouchableOpacity onPress={() => setBulk(bulk === null ? options.join('\n') : null)}>
                  <Text style={styles.linkText}>{bulk === null ? 'Toplu düzenle' : 'Tek tek düzenle'}</Text>
                </TouchableOpacity>
              </View>
              {bulk !== null ? (
                <>
                  <TextInput style={[styles.input, { minHeight: 110, textAlignVertical: 'top' }]} multiline autoFocus value={bulk}
                    onChangeText={setBulk} placeholder="Her satıra bir seçenek yazın" />
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => setBulk(null)}><Text style={{ color: '#6B7280', fontWeight: '700' }}>Vazgeç</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => {
                      const lines = bulk.split('\n').map((o) => o.trim()).filter(Boolean);
                      if (lines.length) setOptions(lines);
                      setBulk(null);
                    }}><Text style={styles.linkText}>Uygula</Text></TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {options.map((o, i) => (
                    <View key={i} style={styles.optRow}>
                      <Text style={styles.optMark}>{q.type === 'checkbox' ? '☐' : q.type === 'radio' ? '○' : i + 1}</Text>
                      <TextInput style={[styles.input, { flex: 1 }]} value={o} placeholder={`Seçenek ${i + 1}`}
                        onChangeText={(t) => setOptions(options.map((x, j) => (j === i ? t : x)))} />
                      <TouchableOpacity disabled={options.length <= 1} style={{ opacity: options.length <= 1 ? 0.3 : 1, padding: 6 }}
                        onPress={() => setOptions(options.filter((_, j) => j !== i))}>
                        <Text style={{ fontSize: 16, color: '#6B7280' }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity onPress={() => setOptions([...options, ''])} style={{ marginTop: 4 }}>
                    <Text style={styles.linkText}>+ Seçenek ekle</Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {q.type === 'file' && (
            <>
              <Text style={styles.label}>En fazla dosya sayısı</Text>
              <View style={styles.chipRow}>
                {[1, 2, 3, 4, 5, 10].map((n) => (
                  <TouchableOpacity key={n} style={[styles.chip, (q.settings?.maxFiles || 1) === n && styles.chipActive]}
                    onPress={() => setQ({ ...q, settings: { ...q.settings, maxFiles: n } })}>
                    <Text style={[styles.chipText, (q.settings?.maxFiles || 1) === n && styles.chipTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>İzin verilen türler <Text style={styles.hintInline}>(hiçbiri = hepsi)</Text></Text>
              <View style={styles.chipRow}>
                {FILE_CATEGORIES.map((c: any) => {
                  const on = accept.includes(c.key);
                  return (
                    <TouchableOpacity key={c.key} style={[styles.chip, on && styles.chipActive]}
                      onPress={() => setQ({ ...q, settings: { ...q.settings, accept: on ? accept.filter((k) => k !== c.key) : [...accept, c.key] } })}>
                      <Text style={[styles.chipText, on && styles.chipTextActive]}>{c.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          <Text style={styles.label}>Genişlik <Text style={styles.hintInline}>(web formundaki dizilim)</Text></Text>
          <View style={styles.chipRow}>
            {QUESTION_WIDTHS.map((w: any) => (
              <TouchableOpacity key={w.width} style={[styles.chip, q.width === w.width && styles.chipActive]} onPress={() => setQ({ ...q, width: w.width })}>
                <Text style={[styles.chipText, q.width === w.width && styles.chipTextActive]}>{w.short}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>{q.type === 'boolean' ? 'İşaretlenmesi zorunlu' : 'Zorunlu soru'}</Text>
            <Switch value={q.required} onValueChange={(v) => setQ({ ...q, required: v })} />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Yalnızca belirli bir cevapta göster</Text>
            <Switch
              value={!!q.showIf}
              disabled={!q.showIf && sources.length === 0}
              onValueChange={(v) => {
                if (!v) { setQ({ ...q, showIf: null }); return; }
                const src = sources[sources.length - 1];
                setQ({ ...q, showIf: { questionId: src.id, value: src.type === 'boolean' ? 'true' : (src.options[0] || '') } });
              }}
            />
          </View>
          {!q.showIf && sources.length === 0 && (
            <Text style={styles.hintInline}>Koşul için önce bu sorudan önce bir açılır liste, tek seçim veya onay kutusu sorusu ekleyin.</Text>
          )}
          {q.showIf && (
            <View style={styles.condBox}>
              <Text style={styles.condText}>Bu soruyu yalnızca</Text>
              <TouchableOpacity style={styles.input} onPress={() => setParentOpen(true)}><Text>{parent?.label || '— soru seçin —'}</Text></TouchableOpacity>
              <Text style={styles.condText}>sorusunun cevabı</Text>
              <TouchableOpacity style={styles.input} onPress={() => setValueOpen(true)}>
                <Text>{parentValues.find(([v]) => v === q.showIf!.value)?.[1] || '— seçin —'}</Text>
              </TouchableOpacity>
              <Text style={styles.condText}>olduğunda göster.</Text>
            </View>
          )}
        </ScrollView>

        <PickerSheet visible={typeOpen} title="Soru tipi" options={QUESTION_TYPES.map((t: any) => ({ key: t.type, label: t.label }))}
          onSelect={changeType} onClose={() => setTypeOpen(false)} />
        <PickerSheet visible={parentOpen} title="Bağlı soru" options={sources.map((s) => ({ key: s.id, label: s.label || '(adsız soru)' }))}
          onSelect={(id) => {
            setParentOpen(false);
            const src = sources.find((s) => s.id === id)!;
            setQ({ ...q, showIf: { questionId: id, value: src.type === 'boolean' ? 'true' : (src.options[0] || '') } });
          }}
          onClose={() => setParentOpen(false)} />
        <PickerSheet visible={valueOpen} title="Cevap" options={parentValues.map(([v, l]) => ({ key: v, label: l }))}
          onSelect={(v) => { setValueOpen(false); setQ({ ...q, showIf: { ...q.showIf!, value: v } }); }}
          onClose={() => setValueOpen(false)} />
      </SafeAreaView>
    </Modal>
  );
}

function ToolBtn({ icon, label, onPress, danger }: { icon: any; label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={[styles.toolBtn, danger && { borderColor: '#FCA5A5' }]} onPress={onPress}>
      <Ionicons name={icon} size={15} color={danger ? '#DE350B' : '#374151'} />
      <Text style={[styles.toolText, danger && { color: '#DE350B' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function IconBtn({ icon, onPress, disabled, danger }: { icon: any; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled} style={[styles.iconBtn, disabled && { opacity: 0.3 }]} hitSlop={6}>
      <Ionicons name={icon} size={17} color={danger ? '#DE350B' : '#42526E'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  linkText: { color: '#0052CC', fontWeight: '700', fontSize: 13 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  optMark: { width: 22, textAlign: 'center', color: '#6B7280', fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  container: { padding: 16, paddingBottom: 100 },
  empty: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginVertical: 10 },
  tabsRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  formTab: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  formTabActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  formTabText: { fontSize: 13, fontWeight: '700', color: '#172B4D' },
  passive: { fontSize: 10, color: '#fff', backgroundColor: '#6B778C', borderRadius: 6, paddingHorizontal: 5, overflow: 'hidden' },
  newTab: { flexDirection: 'row', alignItems: 'center', gap: 2, borderWidth: 1, borderColor: '#0052CC', borderStyle: 'dashed', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  newTabText: { fontSize: 13, fontWeight: '700', color: '#0052CC' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#172B4D', marginTop: 12, marginBottom: 6 },
  req: { color: '#DE350B' },
  hintInline: { fontSize: 11, color: '#6B7280', fontWeight: '400' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 10, fontSize: 14, backgroundColor: '#fff' },
  inputError: { borderColor: '#DE350B', borderWidth: 1.5 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  switchLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#172B4D' },
  toolRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  toolText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginLeft: 4 },
  qCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'transparent', borderLeftWidth: 3, borderLeftColor: '#2563eb' },
  qNum: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  qLabel: { fontSize: 14, fontWeight: '600', color: '#172B4D' },
  qMeta: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  qError: { fontSize: 12, color: '#DE350B', fontWeight: '600', marginTop: 6 },
  qActions: { flexDirection: 'row', gap: 14, marginTop: 8, justifyContent: 'flex-end' },
  iconBtn: { padding: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#0052CC', borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, marginTop: 4 },
  addBtnText: { color: '#0052CC', fontWeight: '700' },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 12 },
  saveInfo: { flex: 1, fontSize: 12, color: '#6B7280', fontWeight: '600' },
  saveBtn: { backgroundColor: '#0052CC', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  saveText: { color: '#fff', fontWeight: '700' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#172B4D' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#0052CC', borderColor: '#0052CC' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  condBox: { backgroundColor: '#F4F5F7', borderRadius: 8, padding: 10, gap: 6, marginTop: 8 },
  condText: { fontSize: 12, color: '#42526E' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: '#fff', borderRadius: 14, padding: 18 },
});
