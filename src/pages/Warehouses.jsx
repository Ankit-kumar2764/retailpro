import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Pencil, Plus, Search, Trash2, Warehouse as WarehouseIcon, X } from 'lucide-react';
import { API_URL, apiError, authConfig } from '../utils/api';

const emptyWarehouse = { name: '', code: '', location: '', address: '', contactNumber: '', capacity: '', managerUserId: '', isActive: true };

function WarehouseModal({ warehouse, onClose, onSaved }) {
  const [form, setForm] = useState(warehouse || emptyWarehouse);
  const [error, setError] = useState('');
  const update = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.code.trim() || form.capacity === '' || Number(form.capacity) < 0) return setError('Name, code, and a valid capacity are required.');
    try {
      if (warehouse) await axios.put(`${API_URL}/warehouses/${warehouse.id}`, form, authConfig());
      else await axios.post(`${API_URL}/warehouses`, form, authConfig());
      onSaved(warehouse ? 'Warehouse updated successfully.' : 'Warehouse added successfully.');
    } catch (requestError) { setError(apiError(requestError, 'Unable to save warehouse.')); }
  };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="product-modal" role="dialog" aria-modal="true" aria-labelledby="warehouse-modal-title"><div className="modal-heading"><div><p className="eyebrow">Operations workspace</p><h2 id="warehouse-modal-title">{warehouse ? 'Edit warehouse' : 'Add warehouse'}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close modal"><X size={19} /></button></div><form onSubmit={submit}><div className="product-form-grid"><label>Warehouse name<input name="name" value={form.name} onChange={update} placeholder="Central Hub" /></label><label>Code<input name="code" value={form.code} onChange={update} placeholder="WH-CENTRAL" /></label><label>Location<input name="location" value={form.location} onChange={update} placeholder="New York" /></label><label>Address<input name="address" value={form.address} onChange={update} placeholder="123 Main Street" /></label><label>Contact number<input name="contactNumber" value={form.contactNumber} onChange={update} placeholder="+1 555 0100" /></label><label>Capacity<input name="capacity" type="number" min="0" value={form.capacity} onChange={update} placeholder="10000" /></label><label className="checkbox-label"><input name="isActive" type="checkbox" checked={form.isActive} onChange={update} /> Active warehouse</label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose}>Cancel</button><button className="primary-btn" type="submit">{warehouse ? 'Save changes' : 'Add warehouse'}</button></div></form></div></div>;
}

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const load = async () => { try { const response = await axios.get(`${API_URL}/warehouses`, authConfig()); setWarehouses(response.data); setError(''); } catch (requestError) { setError(apiError(requestError, 'Unable to load warehouses.')); } };
  useEffect(() => { load(); }, []);
  const filtered = warehouses.filter((item) => `${item.name} ${item.code} ${item.location}`.toLowerCase().includes(query.toLowerCase()));
  const remove = async (warehouse) => { if (!window.confirm(`Delete ${warehouse.name}?`)) return; try { await axios.delete(`${API_URL}/warehouses/${warehouse.id}`, authConfig()); setSuccess('Warehouse deleted successfully.'); load(); } catch (requestError) { setError(apiError(requestError, 'Unable to delete warehouse.')); } };
  return <main className="main-content"><div className="page-heading"><div><p className="eyebrow">Operations workspace</p><h1>Warehouses</h1><p className="page-subtitle">Manage locations and storage capacity across your network.</p></div><button className="primary-btn" onClick={() => setModal({ warehouse: null })}><Plus size={16} /> Add warehouse</button></div>{success && <div className="api-success" role="status">{success}<button onClick={() => setSuccess('')}><X size={14} /></button></div>}{error && <div className="api-error" role="alert">{error}<button onClick={load}>Retry</button></div>}<div className="warehouse-toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search warehouses..." /></div></div><div className="warehouse-grid">{filtered.map((warehouse) => <article className="panel warehouse-card" key={warehouse.id}><div className="warehouse-card-top"><div className="warehouse-symbol"><WarehouseIcon size={20} /></div><span className={`status ${warehouse.isActive ? 'in-stock' : 'out-of-stock'}`}><i />{warehouse.isActive ? 'Active' : 'Inactive'}</span></div><h2>{warehouse.name}</h2><p className="warehouse-code">{warehouse.code} · {warehouse.location || 'Location not set'}</p><div className="warehouse-metrics"><div><span>Stock units</span><strong>{warehouse.totalStock}</strong></div><div><span>Products</span><strong>{warehouse.productCount}</strong></div><div><span>Capacity</span><strong>{warehouse.capacity.toLocaleString()}</strong></div></div><div className="capacity-track"><span style={{ width: `${Math.min(100, warehouse.capacity ? (warehouse.totalStock / warehouse.capacity) * 100 : 0)}%` }} /></div><p className="warehouse-contact">{warehouse.managerName || 'No manager assigned'}{warehouse.contactNumber ? ` · ${warehouse.contactNumber}` : ''}</p><div className="warehouse-actions"><button className="outline-btn" onClick={() => setModal({ warehouse })}><Pencil size={14} /> Edit</button><button className="row-action danger-action" onClick={() => remove(warehouse)} aria-label={`Delete ${warehouse.name}`}><Trash2 size={16} /></button></div></article>)}{!filtered.length && <div className="panel table-message">No warehouses found.</div>}</div>{modal && <WarehouseModal warehouse={modal.warehouse} onClose={() => setModal(null)} onSaved={(message) => { setModal(null); setSuccess(message); load(); }} />}</main>;
}
