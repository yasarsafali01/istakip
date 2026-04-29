import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import { ACTIONS, ROLES } from '../../constants';

export default function UnitForm({ onClose, existingUnit }) {
  const { state, dispatch } = useAppContext();
  const [name, setName] = useState(existingUnit?.name || '');
  const [unitCode, setUnitCode] = useState(existingUnit?.unitCode || '');
  const [departmentHeadId, setDepartmentHeadId] = useState(existingUnit?.departmentHeadId || '');
  const [errors, setErrors] = useState({});

  const departmentHeads = state.users.filter(u => u.role === ROLES.DEPARTMENT_HEAD);

  function validate() {
    const errs = {};
    if (!name.trim()) errs.name = 'Birim adı zorunludur.';
    if (!unitCode.trim()) errs.unitCode = 'Birim kodu zorunludur.';
    else if (!/^[A-Z0-9]+$/.test(unitCode.trim())) errs.unitCode = 'Birim kodu yalnızca büyük harf ve rakam içerebilir.';
    else {
      const duplicate = state.units.find(
        u => u.unitCode === unitCode.trim().toUpperCase() && u.id !== existingUnit?.id
      );
      if (duplicate) errs.unitCode = 'Bu birim kodu zaten kullanılıyor.';
    }
    return errs;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    if (existingUnit) {
      dispatch({
        type: ACTIONS.UPDATE_UNIT,
        payload: { ...existingUnit, name: name.trim(), unitCode: unitCode.trim().toUpperCase(), departmentHeadId: departmentHeadId || null },
      });
    } else {
      dispatch({
        type: ACTIONS.ADD_UNIT,
        payload: {
          id: `unit-${Date.now()}`,
          name: name.trim(),
          unitCode: unitCode.trim().toUpperCase(),
          departmentHeadId: departmentHeadId || null,
          createdAt: new Date().toISOString(),
        },
      });
    }
    onClose();
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-3">
        <label htmlFor="unit-name" className="form-label fw-medium">Birim Adı <span className="text-danger">*</span></label>
        <input id="unit-name" type="text" className={`form-control ${errors.name ? 'is-invalid' : ''}`}
          value={name} onChange={e => setName(e.target.value)} placeholder="Bilgi İşlem Daire Başkanlığı" />
        {errors.name && <div className="invalid-feedback">{errors.name}</div>}
      </div>
      <div className="mb-3">
        <label htmlFor="unit-code" className="form-label fw-medium">Birim Kodu <span className="text-danger">*</span></label>
        <input id="unit-code" type="text" className={`form-control ${errors.unitCode ? 'is-invalid' : ''}`}
          value={unitCode} onChange={e => setUnitCode(e.target.value.toUpperCase())} placeholder="BIGD" maxLength={10} />
        {errors.unitCode ? <div className="invalid-feedback">{errors.unitCode}</div>
          : <div className="form-text">Büyük harf ve rakamlardan oluşan kısa kod (örn. BIGD, ODB)</div>}
      </div>
      <div className="mb-4">
        <label htmlFor="unit-head" className="form-label fw-medium">Daire Başkanı</label>
        <select id="unit-head" className="form-select" value={departmentHeadId} onChange={e => setDepartmentHeadId(e.target.value)}>
          <option value="">— Seçiniz —</option>
          {departmentHeads.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
      </div>
      <div className="d-flex gap-2 justify-content-end">
        <button type="button" className="btn btn-outline-secondary" onClick={onClose}>İptal</button>
        <button type="submit" className="btn btn-primary">{existingUnit ? 'Güncelle' : 'Birim Oluştur'}</button>
      </div>
    </form>
  );
}
