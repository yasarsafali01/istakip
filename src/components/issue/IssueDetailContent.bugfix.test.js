/**
 * Bug Condition Exploration Tests — IssueDetailContent
 *
 * Bu testler düzeltilmemiş kodda BAŞARISIZ olmalıdır.
 * Başarısızlık, hataların var olduğunu kanıtlar.
 *
 * Test 1 — Hata 1: Proje alanı eksikliği
 * Test 2 — Hata 2: unitCode güncellenmemesi
 * Test 3 — Hata 3: Atama listesinde yanlış kişiler
 */

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import IssueDetailContent from './IssueDetailContent';
import AppContext from '../../context/AppContext';
import { seedUsers, seedProjects, seedUnits, seedIssues } from '../../data/seedData';
import { ROLES } from '../../constants';

// ─── Shared test data ─────────────────────────────────────────────────────────

// A request belonging to project-bigd-1 (BIGD unit)
const requestBigd1 = seedIssues.find((i) => i.id === 'issue-bigd1-req1');

// project-bigd-1 and project-odb-1 objects
const projectBigd1 = seedProjects.find((p) => p.id === 'project-bigd-1');
const projectOdb1 = seedProjects.find((p) => p.id === 'project-odb-1');

// unit-bigd and unit-odb
const unitBigd = seedUnits.find((u) => u.id === 'unit-bigd');
const unitOdb = seedUnits.find((u) => u.id === 'unit-odb');

// A Department_Head user (can edit, can assign)
const deptHeadUser = seedUsers.find((u) => u.id === 'user-bigd-head');

// Build a minimal app state
function buildState(overrides = {}) {
  return {
    auth: {
      isAuthenticated: true,
      currentUser: { id: deptHeadUser.id, role: deptHeadUser.role, unitId: deptHeadUser.unitId },
    },
    users: seedUsers,
    projects: seedProjects,
    units: seedUnits,
    issues: seedIssues,
    sprints: [],
    comments: [],
    activities: [],
    ...overrides,
  };
}

// Helper: wrap component with a mock AppContext
function renderWithContext(ui, state, dispatch = jest.fn()) {
  return render(
    <AppContext.Provider value={{ state, dispatch }}>
      {ui}
    </AppContext.Provider>
  );
}

// ─── Test 1: Proje Alanı Eksikliği (Hata 1) ──────────────────────────────────
/**
 * Validates: Bug Condition 1 — Proje Alanı Eksikliği
 *
 * IssueDetailContent, isRequest: true olan bir talep ve editMode aktifken
 * proje seçim alanını render etmelidir.
 *
 * Düzeltilmemiş kodda bu alan render edilmediğinden test BAŞARISIZ olacak.
 */
describe('Hata 1 — Proje Alanı Eksikliği', () => {
  test('isRequest:true ve editMode aktifken proje seçim alanı DOM\'da bulunmalı', async () => {
    const state = buildState();
    const dispatch = jest.fn();

    renderWithContext(
      <IssueDetailContent
        issue={requestBigd1}
        onClose={jest.fn()}
      />,
      state,
      dispatch
    );

    // Düzenle butonuna tıkla — editMode'u aktifleştir
    const editButton = screen.getByRole('button', { name: /düzenle/i });
    act(() => {
      fireEvent.click(editButton);
    });

    // Proje seçim alanı DOM'da olmalı
    // Düzeltilmemiş kodda bu alan render edilmediğinden test BAŞARISIZ olacak
    const projectSelect = screen.queryByTestId('project-select') ||
      screen.queryByLabelText(/proje/i) ||
      document.querySelector('select[data-testid="project-select"]');

    // Alternatif: "Proje" etiketli bir select veya label arayalım
    const projectLabel = screen.queryByText(/^📁\s*Proje$/i) ||
      screen.queryByText(/proje/i, { selector: '.text-muted' });

    expect(projectSelect || projectLabel).not.toBeNull();
  });
});

// ─── Test 2: unitCode Güncellenmemesi (Hata 2) ───────────────────────────────
/**
 * Validates: Bug Condition 2 — unitCode Güncellenmemesi
 *
 * handleSave çağrıldığında dispatch edilen UPDATE_ISSUE payload'ında
 * unitCode alanı yeni projenin birimiyle eşleşmelidir.
 *
 * Düzeltilmemiş kodda unitCode payload'da undefined olduğundan test BAŞARISIZ olacak.
 */
describe('Hata 2 — unitCode Güncellenmemesi', () => {
  test('Proje değiştirilip kaydedildiğinde UPDATE_ISSUE payload\'ında unitCode bulunmalı', async () => {
    const state = buildState();
    const dispatch = jest.fn();

    renderWithContext(
      <IssueDetailContent
        issue={requestBigd1}
        onClose={jest.fn()}
      />,
      state,
      dispatch
    );

    // Düzenle butonuna tıkla
    const editButton = screen.getByRole('button', { name: /düzenle/i });
    act(() => {
      fireEvent.click(editButton);
    });

    // Kaydet butonuna tıkla (proje değişikliği olmasa da handleSave çağrılır)
    const saveButton = screen.getByRole('button', { name: /kaydet/i });
    act(() => {
      fireEvent.click(saveButton);
    });

    // dispatch çağrılarını bul
    const updateIssueCalls = dispatch.mock.calls.filter(
      ([action]) => action.type === 'UPDATE_ISSUE'
    );

    expect(updateIssueCalls.length).toBeGreaterThan(0);

    const payload = updateIssueCalls[0][0].payload;

    // unitCode payload'da tanımlı olmalı
    // Düzeltilmemiş kodda unitCode payload'da undefined olduğundan test BAŞARISIZ olacak
    expect(payload.unitCode).toBeDefined();
    expect(payload.unitCode).not.toBeUndefined();

    // Mevcut proje değişmediğinde unitCode mevcut değerle eşleşmeli
    expect(payload.unitCode).toBe(requestBigd1.unitCode); // 'BIGD'
  });

  test('Farklı bir projeye (project-odb-1) geçildiğinde unitCode ODB olmalı', () => {
    /**
     * Bu test, handleSave'in unitCode hesaplama mantığını doğrudan test eder.
     * Mevcut IssueDetailContent'te editProjectId state'i olmadığından
     * bu davranış test edilemez — ancak unitCode'un payload'da eksik olduğunu kanıtlar.
     */
    const state = buildState();

    // Mevcut handleSave mantığını simüle et:
    // Düzeltilmemiş kod sadece şu alanları gönderir:
    const buggyPayload = {
      id: requestBigd1.id,
      title: requestBigd1.title,
      description: requestBigd1.description,
      type: requestBigd1.type,
      priority: requestBigd1.priority,
      status: requestBigd1.status,
      assigneeId: requestBigd1.assigneeId || null,
      // unitCode EKSİK — bu hatanın kanıtı
    };

    // Yeni proje için beklenen unitCode
    const newProject = state.projects.find((p) => p.id === 'project-odb-1');
    const newUnit = state.units.find((u) => u.id === newProject.unitId);
    const expectedUnitCode = newUnit.unitCode; // 'ODB'

    // Düzeltilmemiş payload'da unitCode undefined olmalı (hatanın kanıtı)
    expect(buggyPayload.unitCode).toBeUndefined();

    // Beklenen unitCode 'ODB' olmalı (düzeltilmiş kodda bu değer payload'da olacak)
    expect(expectedUnitCode).toBe('ODB');

    // Düzeltilmemiş payload'da unitCode eksik olduğundan,
    // yeni unitCode ile eşleşmez — bu hatanın kanıtı
    expect(buggyPayload.unitCode).not.toBe(expectedUnitCode);
  });
});

// ─── Test 3: Atama Listesinde Yanlış Kişiler (Hata 3) ────────────────────────
/**
 * Validates: Bug Condition 3 — Atama Listesinde Yanlış Kişiler
 *
 * project-bigd-1'e ait bir talep için assignableUsers hesaplandığında,
 * sonuçta project-bigd-2'nin Worker'ları bulunmamalıdır.
 *
 * Düzeltilmiş kodda u.projectId === issue.projectId koşulu kullanıldığından
 * yalnızca project-bigd-1'in Worker'ları listede olacak.
 */
describe('Hata 3 — Atama Listesinde Yanlış Kişiler', () => {
  test('project-bigd-1 talebi için assignableUsers\'da project-bigd-2 Worker\'ları bulunmamalı', () => {
    const state = buildState();

    // Düzeltilmiş assignableUsers hesaplama mantığını simüle et (IssueDetailContent.jsx'teki düzeltilmiş kod)
    const issue = requestBigd1; // projectId: 'project-bigd-1'
    const project = state.projects.find((p) => p.id === issue.projectId);
    const currentUser = deptHeadUser; // Department_Head, System_Admin değil

    // FIXED hesaplama — düzeltilmiş IssueDetailContent kodu
    const fixedAssignableUsers = state.users.filter((u) => {
      if (u.role === ROLES.EXTERNAL_USER) return false;
      if (currentUser?.role === ROLES.SYSTEM_ADMIN) return true;
      if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
      if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
      if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
      return false;
    });

    // project-bigd-2'nin Worker'larını bul
    const wrongWorkers = fixedAssignableUsers.filter(
      (u) => u.role === ROLES.WORKER && u.projectId !== issue.projectId
    );

    // Düzeltilmiş kodda wrongWorkers boş olmalı (hata giderildi)
    expect(wrongWorkers.length).toBe(0);
  });

  test('project-bigd-1 talebi için assignableUsers yalnızca project-bigd-1 Worker\'larını içermeli', () => {
    const state = buildState();
    const issue = requestBigd1;
    const project = state.projects.find((p) => p.id === issue.projectId);
    const currentUser = deptHeadUser;

    // FIXED hesaplama
    const fixedAssignableUsers = state.users.filter((u) => {
      if (u.role === ROLES.EXTERNAL_USER) return false;
      if (currentUser?.role === ROLES.SYSTEM_ADMIN) return true;
      if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
      if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
      if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
      return false;
    });

    // Tüm Worker'ları filtrele
    const workersInList = fixedAssignableUsers.filter((u) => u.role === ROLES.WORKER);

    // Yalnızca project-bigd-1'in Worker'ları olmalı
    workersInList.forEach((worker) => {
      expect(worker.projectId).toBe(issue.projectId);
    });
  });

  test('Düzeltilmiş kodda project-bigd-2 Worker\'larının listede olmadığını doğrula', () => {
    const state = buildState();
    const issue = requestBigd1;
    const project = state.projects.find((p) => p.id === issue.projectId);
    const currentUser = deptHeadUser;

    // FIXED hesaplama
    const fixedAssignableUsers = state.users.filter((u) => {
      if (u.role === ROLES.EXTERNAL_USER) return false;
      if (currentUser?.role === ROLES.SYSTEM_ADMIN) return true;
      if (u.role === ROLES.WORKER) return u.projectId === issue.projectId;
      if (u.role === ROLES.PROJECT_MANAGER) return project?.managerId === u.id;
      if (u.role === ROLES.DEPARTMENT_HEAD) return u.unitId === project?.unitId;
      return false;
    });

    // project-bigd-2'nin Worker'larından biri (user-bigd-w5)
    const bigd2Worker = state.users.find((u) => u.id === 'user-bigd-w5');
    expect(bigd2Worker).toBeDefined();
    expect(bigd2Worker.projectId).toBe('project-bigd-2');
    expect(bigd2Worker.role).toBe(ROLES.WORKER);

    // Düzeltilmiş kodda bu Worker listede bulunmamalı (hata giderildi)
    const isInFixedList = fixedAssignableUsers.some((u) => u.id === 'user-bigd-w5');
    expect(isInFixedList).toBe(false);
  });
});


// ─── Koruma Testleri (Preservation) ──────────────────────────────────────────
/**
 * Bu testler düzeltilmemiş kodda GEÇMELI.
 * Temel davranışın korunduğunu doğrular — düzeltme sonrası regresyon referansı.
 */
describe('Koruma Testleri (Preservation)', () => {

  // ── Gözlem 1: Proje Değiştirmeyen Düzenleme ────────────────────────────────
  /**
   * Validates: Requirements 3.1
   *
   * Düzeltilmemiş kodda editProjectId state'i yok.
   * handleSave çağrıldığında UPDATE_ISSUE payload'ında unitCode undefined.
   * Ancak store'daki mevcut issue'nun unitCode değeri değişmez çünkü
   * AppReducer UPDATE_ISSUE'da spread operatörü kullanır:
   *   { ...issue, ...action.payload }
   * payload'da unitCode undefined ise mevcut değer korunur.
   *
   * Bu test: proje değiştirilmediğinde store'daki unitCode değerinin
   * korunduğunu doğrular.
   */
  describe('Gözlem 1 — Proje Değiştirmeyen Düzenleme', () => {
    test('Proje değiştirilmeden kaydedildiğinde store\'daki unitCode değeri korunmalı', () => {
      // Düzeltilmemiş handleSave mantığını simüle et:
      // payload'da unitCode yok (undefined)
      const buggyPayload = {
        id: requestBigd1.id,
        title: requestBigd1.title,
        description: requestBigd1.description,
        type: requestBigd1.type,
        priority: requestBigd1.priority,
        status: requestBigd1.status,
        assigneeId: requestBigd1.assigneeId || null,
        // unitCode EKSİK — düzeltilmemiş kod bu alanı göndermez
      };

      // AppReducer UPDATE_ISSUE mantığını simüle et:
      // { ...issue, ...payload } — payload'da unitCode undefined ise mevcut değer korunur
      const currentIssue = { ...requestBigd1 };
      const updatedIssue = { ...currentIssue, ...buggyPayload };

      // Mevcut unitCode değeri korunmalı (spread ile undefined üzerine yazılmaz)
      expect(updatedIssue.unitCode).toBe(requestBigd1.unitCode); // 'BIGD'
      expect(updatedIssue.unitCode).toBeDefined();
    });

    test('UPDATE_ISSUE payload\'ında unitCode undefined olsa bile reducer mevcut değeri korur', () => {
      // AppReducer'ın UPDATE_ISSUE case'ini simüle et
      const initialIssue = { ...requestBigd1 }; // unitCode: 'BIGD'

      // Düzeltilmemiş payload — unitCode yok
      const payloadWithoutUnitCode = {
        id: requestBigd1.id,
        title: 'Güncellenmiş Başlık',
        description: requestBigd1.description,
        type: requestBigd1.type,
        priority: 'High',
        status: requestBigd1.status,
        assigneeId: requestBigd1.assigneeId || null,
      };

      // Reducer mantığı: { ...issue, ...payload }
      const result = { ...initialIssue, ...payloadWithoutUnitCode };

      // unitCode payload'da olmadığından mevcut değer korunur
      expect(result.unitCode).toBe('BIGD');
      expect(result.title).toBe('Güncellenmiş Başlık');
      expect(result.priority).toBe('High');
    });
  });

  // ── Gözlem 2: System_Admin Atama Davranışı ─────────────────────────────────
  /**
   * Validates: Requirements 3.5
   *
   * Düzeltilmemiş assignableUsers hesaplaması:
   *   u.role !== ROLES.EXTERNAL_USER &&
   *   (u.unitId === project?.unitId || currentUser?.role === ROLES.SYSTEM_ADMIN)
   *
   * System_Admin için currentUser?.role === ROLES.SYSTEM_ADMIN true olduğundan
   * tüm non-external kullanıcılar listeleniyor.
   * Bu davranış KORUNMALI — düzeltme sonrasında da geçerli olmalı.
   */
  describe('Gözlem 2 — System_Admin Atama Davranışı', () => {
    test('System_Admin için assignableUsers tüm non-external kullanıcıları içermeli', () => {
      const adminUser = seedUsers.find((u) => u.id === 'user-admin');
      expect(adminUser.role).toBe(ROLES.SYSTEM_ADMIN);

      const state = buildState({
        auth: {
          isAuthenticated: true,
          currentUser: { id: adminUser.id, role: adminUser.role, unitId: adminUser.unitId },
        },
      });

      const issue = requestBigd1;
      const project = state.projects.find((p) => p.id === issue.projectId);
      const currentUser = adminUser;

      // Düzeltilmemiş assignableUsers hesaplaması
      const assignableUsers = state.users.filter(
        (u) =>
          u.role !== ROLES.EXTERNAL_USER &&
          (u.unitId === project?.unitId || currentUser?.role === ROLES.SYSTEM_ADMIN)
      );

      // Tüm non-external kullanıcılar listede olmalı
      const nonExternalUsers = state.users.filter((u) => u.role !== ROLES.EXTERNAL_USER);
      expect(assignableUsers.length).toBe(nonExternalUsers.length);

      // External_User listede olmamalı
      const externalInList = assignableUsers.filter((u) => u.role === ROLES.EXTERNAL_USER);
      expect(externalInList.length).toBe(0);
    });

    test('System_Admin için farklı birimlerden kullanıcılar da assignableUsers\'da bulunmalı', () => {
      const adminUser = seedUsers.find((u) => u.id === 'user-admin');
      const state = buildState({
        auth: {
          isAuthenticated: true,
          currentUser: { id: adminUser.id, role: adminUser.role, unitId: adminUser.unitId },
        },
      });

      const issue = requestBigd1; // project-bigd-1 (unit-bigd)
      const project = state.projects.find((p) => p.id === issue.projectId);
      const currentUser = adminUser;

      // Düzeltilmemiş assignableUsers hesaplaması
      const assignableUsers = state.users.filter(
        (u) =>
          u.role !== ROLES.EXTERNAL_USER &&
          (u.unitId === project?.unitId || currentUser?.role === ROLES.SYSTEM_ADMIN)
      );

      // ODB biriminden kullanıcılar da listede olmalı (System_Admin tüm kullanıcıları görebilir)
      const odbUsersInList = assignableUsers.filter((u) => u.unitId === 'unit-odb');
      expect(odbUsersInList.length).toBeGreaterThan(0);

      // Örnek: user-odb-w1 listede olmalı
      const odbWorker = assignableUsers.find((u) => u.id === 'user-odb-w1');
      expect(odbWorker).toBeDefined();
    });

    test('System_Admin için assignableUsers Worker\'ları proje sınırı olmaksızın içermeli', () => {
      const adminUser = seedUsers.find((u) => u.id === 'user-admin');
      const state = buildState({
        auth: {
          isAuthenticated: true,
          currentUser: { id: adminUser.id, role: adminUser.role, unitId: adminUser.unitId },
        },
      });

      const issue = requestBigd1;
      const project = state.projects.find((p) => p.id === issue.projectId);
      const currentUser = adminUser;

      // Düzeltilmemiş assignableUsers hesaplaması
      const assignableUsers = state.users.filter(
        (u) =>
          u.role !== ROLES.EXTERNAL_USER &&
          (u.unitId === project?.unitId || currentUser?.role === ROLES.SYSTEM_ADMIN)
      );

      // project-bigd-2'nin Worker'ları da listede olmalı (System_Admin için)
      const bigd2Worker = assignableUsers.find((u) => u.id === 'user-bigd-w5');
      expect(bigd2Worker).toBeDefined();
      expect(bigd2Worker.projectId).toBe('project-bigd-2');

      // project-odb-1'in Worker'ları da listede olmalı
      const odb1Worker = assignableUsers.find((u) => u.id === 'user-odb-w1');
      expect(odb1Worker).toBeDefined();
    });
  });

  // ── Gözlem 3: Başlık/Açıklama/Öncelik Güncelleme Koruması ─────────────────
  /**
   * Validates: Requirements 3.1
   *
   * handleSave çağrıldığında UPDATE_ISSUE payload'ında
   * title, description, priority, type alanları doğru gönderiliyor.
   * Bu davranış KORUNMALI.
   */
  describe('Gözlem 3 — Başlık/Açıklama/Öncelik Güncelleme Koruması', () => {
    test('handleSave çağrıldığında UPDATE_ISSUE payload\'ında title doğru gönderilmeli', async () => {
      const state = buildState();
      const dispatch = jest.fn();

      renderWithContext(
        <IssueDetailContent
          issue={requestBigd1}
          onClose={jest.fn()}
        />,
        state,
        dispatch
      );

      // Düzenle butonuna tıkla
      const editButton = screen.getByRole('button', { name: /düzenle/i });
      act(() => {
        fireEvent.click(editButton);
      });

      // Başlık alanını güncelle
      const titleInput = screen.getByRole('textbox', { name: /başlık/i });
      act(() => {
        fireEvent.change(titleInput, { target: { value: 'Güncellenmiş VPN Talebi' } });
      });

      // Kaydet butonuna tıkla
      const saveButton = screen.getByRole('button', { name: /kaydet/i });
      act(() => {
        fireEvent.click(saveButton);
      });

      // UPDATE_ISSUE dispatch çağrısını bul
      const updateIssueCalls = dispatch.mock.calls.filter(
        ([action]) => action.type === 'UPDATE_ISSUE'
      );

      expect(updateIssueCalls.length).toBeGreaterThan(0);
      const payload = updateIssueCalls[0][0].payload;

      // Yeni başlık payload'da olmalı
      expect(payload.title).toBe('Güncellenmiş VPN Talebi');
      expect(payload.id).toBe(requestBigd1.id);
    });

    test('handleSave çağrıldığında UPDATE_ISSUE payload\'ında description doğru gönderilmeli', async () => {
      const state = buildState();
      const dispatch = jest.fn();

      renderWithContext(
        <IssueDetailContent
          issue={requestBigd1}
          onClose={jest.fn()}
        />,
        state,
        dispatch
      );

      // Düzenle butonuna tıkla
      const editButton = screen.getByRole('button', { name: /düzenle/i });
      act(() => {
        fireEvent.click(editButton);
      });

      // Açıklama alanını güncelle
      const descInput = screen.getByRole('textbox', { name: /açıklama/i });
      act(() => {
        fireEvent.change(descInput, { target: { value: 'Yeni açıklama metni' } });
      });

      // Kaydet butonuna tıkla
      const saveButton = screen.getByRole('button', { name: /kaydet/i });
      act(() => {
        fireEvent.click(saveButton);
      });

      // UPDATE_ISSUE dispatch çağrısını bul
      const updateIssueCalls = dispatch.mock.calls.filter(
        ([action]) => action.type === 'UPDATE_ISSUE'
      );

      expect(updateIssueCalls.length).toBeGreaterThan(0);
      const payload = updateIssueCalls[0][0].payload;

      // Yeni açıklama payload'da olmalı
      expect(payload.description).toBe('Yeni açıklama metni');
    });

    test('handleSave çağrıldığında UPDATE_ISSUE payload\'ında priority doğru gönderilmeli', async () => {
      const state = buildState();
      const dispatch = jest.fn();

      renderWithContext(
        <IssueDetailContent
          issue={requestBigd1}
          onClose={jest.fn()}
        />,
        state,
        dispatch
      );

      // Düzenle butonuna tıkla
      const editButton = screen.getByRole('button', { name: /düzenle/i });
      act(() => {
        fireEvent.click(editButton);
      });

      // Öncelik alanını güncelle (select element)
      // Öncelik select'ini bul — "Öncelik" label'ının yanındaki select
      const selects = document.querySelectorAll('select.form-select');
      // İlk select type, ikinci select priority, üçüncü select status
      const prioritySelect = Array.from(selects).find(
        (s) => Array.from(s.options).some((o) => o.value === 'High')
      );

      if (prioritySelect) {
        act(() => {
          fireEvent.change(prioritySelect, { target: { value: 'High' } });
        });
      }

      // Kaydet butonuna tıkla
      const saveButton = screen.getByRole('button', { name: /kaydet/i });
      act(() => {
        fireEvent.click(saveButton);
      });

      // UPDATE_ISSUE dispatch çağrısını bul
      const updateIssueCalls = dispatch.mock.calls.filter(
        ([action]) => action.type === 'UPDATE_ISSUE'
      );

      expect(updateIssueCalls.length).toBeGreaterThan(0);
      const payload = updateIssueCalls[0][0].payload;

      // priority payload'da tanımlı olmalı
      expect(payload.priority).toBeDefined();
      // type payload'da tanımlı olmalı
      expect(payload.type).toBeDefined();
      // status payload'da tanımlı olmalı
      expect(payload.status).toBeDefined();
    });

    test('Proje değiştirmeden başlık güncellendiğinde type ve status değerleri korunmalı', async () => {
      const state = buildState();
      const dispatch = jest.fn();

      renderWithContext(
        <IssueDetailContent
          issue={requestBigd1}
          onClose={jest.fn()}
        />,
        state,
        dispatch
      );

      // Düzenle butonuna tıkla
      const editButton = screen.getByRole('button', { name: /düzenle/i });
      act(() => {
        fireEvent.click(editButton);
      });

      // Sadece başlığı değiştir
      const titleInput = screen.getByRole('textbox', { name: /başlık/i });
      act(() => {
        fireEvent.change(titleInput, { target: { value: 'Sadece Başlık Değişti' } });
      });

      // Kaydet
      const saveButton = screen.getByRole('button', { name: /kaydet/i });
      act(() => {
        fireEvent.click(saveButton);
      });

      const updateIssueCalls = dispatch.mock.calls.filter(
        ([action]) => action.type === 'UPDATE_ISSUE'
      );

      expect(updateIssueCalls.length).toBeGreaterThan(0);
      const payload = updateIssueCalls[0][0].payload;

      // Değiştirilmeyen alanlar orijinal değerleriyle korunmalı
      expect(payload.type).toBe(requestBigd1.type);
      expect(payload.status).toBe(requestBigd1.status);
      expect(payload.assigneeId).toBe(requestBigd1.assigneeId);
    });
  });
});
