import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const categories = ['Electronics', 'Apparel', 'Home & Living', 'Beauty', 'Sports', 'Accessories'];
const emptyProduct = {
  productName: '',
  sku: '',
  category: '',
  description: '',
  purchasePrice: '',
  sellingPrice: '',
  availableStock: '',
  reorderLevel: '',
  isActive: true,
};

const formatCurrency = (value) => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
const authConfig = () => {
  const token = window.localStorage.getItem('retailpro_token');
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

function ProductModal({ product, mode, onClose, onSaved }) {
  const [form, setForm] = useState(product || emptyProduct);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const updateField = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.productName.trim() || !form.sku.trim() || !form.category) {
      setError('Product name, SKU, and category are required.');
      return;
    }
    const numericFields = ['purchasePrice', 'sellingPrice', 'reorderLevel'];
    if (numericFields.some((field) => form[field] === '' || Number(form[field]) < 0)) {
      setError('Prices, stock, and reorder level must be non-negative numbers.');
      return;
    }

    setSaving(true);
    try {
      const request = mode === 'edit'
        ? axios.put(`${API_URL}/products/${product.id}`, form, authConfig())
        : axios.post(`${API_URL}/products`, form, authConfig());
      await request;
      onSaved(mode === 'edit' ? 'Product updated successfully.' : 'Product added successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to save product. Check the API connection.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title">
      <div className="modal-heading"><div><p className="eyebrow">Catalog workspace</p><h2 id="product-modal-title">{mode === 'edit' ? 'Edit product' : 'Add new product'}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close modal"><X size={19} /></button></div>
      <form onSubmit={submit}>
        <div className="product-form-grid">
          <label>Product name<input name="productName" value={form.productName} onChange={updateField} placeholder="e.g. Wireless Headphones" /></label>
          <label>SKU<input name="sku" value={form.sku} onChange={updateField} placeholder="e.g. WH-1001" /></label>
          <label>Category<select name="category" value={form.category} onChange={updateField}><option value="">Select category</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
          <label>Purchase price<input name="purchasePrice" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={updateField} placeholder="0.00" /></label>
          <label>Selling price<input name="sellingPrice" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={updateField} placeholder="0.00" /></label>
          <label>Reorder level<input name="reorderLevel" type="number" min="0" step="1" value={form.reorderLevel} onChange={updateField} placeholder="0" /></label>
          <label className="checkbox-label"><input name="isActive" type="checkbox" checked={form.isActive} onChange={updateField} /> Active product</label>
          <label className="full-field">Description<textarea name="description" rows="3" value={form.description} onChange={updateField} placeholder="Add a short product description" /></label>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="outline-btn" onClick={onClose}>Cancel</button><button type="submit" className="primary-btn" disabled={saving}>{saving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Add product'}</button></div>
      </form>
    </div>
  </div>;
}

function ProductDetails({ product, onClose }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="product-modal details-modal" role="dialog" aria-modal="true" aria-labelledby="product-details-title">
      <div className="modal-heading"><div><p className="eyebrow">Product details</p><h2 id="product-details-title">{product.productName}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close details"><X size={19} /></button></div>
      <div className="detail-grid">{[['Product ID', `#${product.id}`], ['SKU', product.sku], ['Category', product.category], ['Purchase price', formatCurrency(product.purchasePrice)], ['Selling price', formatCurrency(product.sellingPrice)], ['Available stock', product.availableStock], ['Reorder level', product.reorderLevel], ['Created date', product.createdDate]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
      <div className="detail-description"><span>Description</span><p>{product.description || 'No description provided.'}</p></div>
      <div className="modal-actions"><button className="primary-btn" onClick={onClose}>Done</button></div>
    </div>
  </div>;
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const pageSize = 6;

  const loadProducts = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/products`, authConfig());
      setProducts(Array.isArray(response.data) ? response.data : response.data.data || []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Products could not be loaded. Start the API server and check MySQL settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadProducts(); }, []);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();
    return products
      .filter((product) => (category === 'All categories' || product.category === category)
        && `${product.productName} ${product.sku} ${product.category}`.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => {
        if (sort === 'name') return a.productName.localeCompare(b.productName);
        if (sort === 'stock') return b.availableStock - a.availableStock;
        if (sort === 'price') return b.sellingPrice - a.sellingPrice;
        return b.id - a.id;
      });
  }, [products, query, category, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const visibleProducts = filteredProducts.slice((page - 1) * pageSize, page * pageSize);
  const activeProducts = products.filter((product) => product.isActive).length;

  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  useEffect(() => { setPage(1); }, [query, category, sort]);

  const removeProduct = async (product) => {
    if (!window.confirm(`Delete ${product.productName}? This cannot be undone.`)) return;
    try {
      await axios.delete(`${API_URL}/products/${product.id}`, authConfig());
      await loadProducts();
      setSuccess('Product deleted successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to delete product.');
    }
  };

  return <main className="main-content products-page">
    <div className="page-heading"><div><p className="eyebrow">Catalog workspace</p><h1>Products Management</h1><p className="page-subtitle">Create, organize, and monitor every product in your catalog.</p></div><button className="primary-btn" onClick={() => setModal({ type: 'form', mode: 'add', product: emptyProduct })}><Plus size={16} /> Add new product</button></div>
    <div className="product-summary-grid"><div className="summary-card"><span>Total products</span><strong>{products.length.toLocaleString()}</strong><small>Across your catalog</small></div><div className="summary-card"><span>Active products</span><strong>{activeProducts.toLocaleString()}</strong><small className="summary-positive">● Available for sale</small></div><div className="summary-card"><span>Categories</span><strong>{new Set(products.map((product) => product.category)).size}</strong><small>Product groups</small></div></div>
    {success && <div className="api-success" role="status">{success}<button onClick={() => setSuccess('')} aria-label="Dismiss notification"><X size={14} /></button></div>}
    <section className="panel product-table-panel"><div className="panel-heading"><div><h2>Product catalog</h2><p>{filteredProducts.length} products match your current view</p></div><div className="product-toolbar"><div className="table-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." aria-label="Search products" /></div><select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category"><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort products"><option value="newest">Newest first</option><option value="name">Name A-Z</option><option value="stock">Highest stock</option><option value="price">Highest price</option></select></div></div>
      {error && <div className="api-error" role="alert">{error}<button onClick={loadProducts}>Retry</button></div>}
      <div className="table-scroll"><table className="products-table"><thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Pricing</th><th>Stock</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead><tbody>{loading ? <tr><td colSpan="8" className="table-message">Loading products...</td></tr> : visibleProducts.length ? visibleProducts.map((product) => <tr key={product.id}><td><strong className="product-name">{product.productName}</strong><small>{product.description || 'No description'}</small></td><td className="muted">{product.sku}</td><td>{product.category}</td><td><strong>{formatCurrency(product.sellingPrice)}</strong><small>Cost {formatCurrency(product.purchasePrice)}</small></td><td><strong>{product.availableStock}</strong><small>Reorder at {product.reorderLevel}</small></td><td className="muted">{product.createdDate}</td><td><span className={`status ${product.isActive ? 'in-stock' : 'out-of-stock'}`}><i />{product.isActive ? 'Active' : 'Inactive'}</span></td><td><div className="product-actions"><button className="row-action" onClick={() => setModal({ type: 'details', product })} aria-label={`View ${product.productName}`}><Eye size={16} /></button><button className="row-action" onClick={() => setModal({ type: 'form', mode: 'edit', product })} aria-label={`Edit ${product.productName}`}><Pencil size={16} /></button><button className="row-action danger-action" onClick={() => removeProduct(product)} aria-label={`Delete ${product.productName}`}><Trash2 size={16} /></button></div></td></tr>) : <tr><td colSpan="8" className="table-message">No products found. Try a different search or add your first product.</td></tr>}</tbody></table></div>
      <div className="pagination"><span>Showing {visibleProducts.length} of {filteredProducts.length} products</span><div><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>‹</button>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(0, 5).map((number) => <button key={number} className={page === number ? 'page-active' : ''} onClick={() => setPage(number)}>{number}</button>)}<button onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>›</button></div></div>
    </section>
    {modal?.type === 'form' && <ProductModal product={modal.product} mode={modal.mode} onClose={() => setModal(null)} onSaved={async (message) => { setModal(null); setSuccess(message); await loadProducts(); }} />}
    {modal?.type === 'details' && <ProductDetails product={modal.product} onClose={() => setModal(null)} />}
  </main>;
}
