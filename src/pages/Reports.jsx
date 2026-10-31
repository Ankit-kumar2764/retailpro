import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Printer, RefreshCw } from 'lucide-react';
import { API_URL, apiError, authConfig } from '../utils/api';

const today = new Date();
const iso = (date) => date.toISOString().slice(0, 10);
const ranges = {
  today: [iso(today), iso(today)],
  last7: [iso(new Date(today.getTime() - 6 * 86400000)), iso(today)],
  last30: [iso(new Date(today.getTime() - 29 * 86400000)), iso(today)],
  month: [iso(new Date(today.getFullYear(), today.getMonth(), 1)), iso(today)],
  year: [iso(new Date(today.getFullYear(), 0, 1)), iso(today)],
};
const money = (value) => `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const compactMoney = (value) => `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const empty = (value) => !value?.length;

function ChartEmpty() { return <div className="report-empty">No data for this date range.</div>; }
function Kpi({ label, value, icon }) { return <div className="summary-card report-kpi"><span>{icon} {label}</span><strong>{value}</strong></div>; }

function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => `"${String(row[header] ?? '').replaceAll('"', '""')}"`).join(','))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export default function Reports() {
  const [rangeKey, setRangeKey] = useState('last30');
  const [custom, setCustom] = useState(ranges.last30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const range = rangeKey === 'custom' ? custom : ranges[rangeKey];
  const query = `?from=${range[0]}&to=${range[1]}`;

  const load = async () => {
    setLoading(true);
    try {
      const [summary, sales, inventory, purchases, products, lowStock] = await Promise.all([
        axios.get(`${API_URL}/reports/summary${query}`, authConfig()),
        axios.get(`${API_URL}/reports/sales${query}`, authConfig()),
        axios.get(`${API_URL}/reports/inventory`, authConfig()),
        axios.get(`${API_URL}/reports/purchases${query}`, authConfig()),
        axios.get(`${API_URL}/reports/products${query}`, authConfig()),
        axios.get(`${API_URL}/reports/low-stock?limit=50`, authConfig()),
      ]);
      setData({ summary: summary.data, sales: sales.data, inventory: inventory.data, purchases: purchases.data, products: products.data, lowStock: lowStock.data });
      setError('');
    } catch (requestError) { setError(apiError(requestError, 'Unable to load reports.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [query]);

  const exportRows = useMemo(() => ({
    sales: (data?.sales.products || []).map((row) => ({ product: row.productName, sku: row.sku, quantitySold: row.quantitySold, revenue: row.revenue })),
    inventory: (data?.inventory.lowStock || []).map((row) => ({ product: row.productName, sku: row.sku, category: row.category, availableStock: row.availableStock, reorderLevel: row.reorderLevel, recommendedQuantity: row.recommendedQuantity })),
    purchases: (data?.purchases.suppliers || []).map((row) => ({ supplier: row.supplier, purchaseOrders: row.purchaseOrders, purchaseAmount: row.purchaseAmount })),
  }), [data]);
  const exportReport = (type) => downloadCsv(`retailpro-${type}-report-${range[0]}-to-${range[1]}.csv`, exportRows[type] || []);

  if (loading && !data) return <main className="main-content"><div className="panel table-message">Loading reports...</div></main>;
  return <main className="main-content reports-page">
    <div className="page-heading reports-heading"><div><p className="eyebrow">Business intelligence</p><h1>Reports &amp; Analytics</h1><p className="page-subtitle">Track sales, inventory, purchasing and product performance from live database data.</p></div><div className="report-actions"><button className="outline-btn" onClick={() => window.print()}><Printer size={15} /> Print</button><button className="outline-btn" onClick={() => exportReport('sales')}><Download size={15} /> Sales CSV</button><button className="outline-btn" onClick={() => exportReport('inventory')}><Download size={15} /> Inventory CSV</button><button className="outline-btn" onClick={() => exportReport('purchases')}><Download size={15} /> Purchase CSV</button></div></div>
    <div className="report-filter panel"><label>Period<select value={rangeKey} onChange={(event) => setRangeKey(event.target.value)}><option value="today">Today</option><option value="last7">Last 7 Days</option><option value="last30">Last 30 Days</option><option value="month">This Month</option><option value="year">This Year</option><option value="custom">Custom Date Range</option></select></label>{rangeKey === 'custom' && <><label>From<input type="date" value={custom[0]} onChange={(event) => setCustom([event.target.value, custom[1]])} /></label><label>To<input type="date" value={custom[1]} onChange={(event) => setCustom([custom[0], event.target.value])} /></label></>}<button className="outline-btn report-refresh" onClick={load}><RefreshCw size={15} /> Refresh</button></div>
    {error && <div className="api-error">{error}<button onClick={load}>Retry</button></div>}
    <div className="report-kpi-grid"><Kpi label="Total Sales" value={money(data?.summary.totalSales)} icon="↗" /><Kpi label="Total Orders" value={data?.summary.totalOrders.toLocaleString()} icon="#" /><Kpi label="Total Products" value={data?.summary.totalProducts.toLocaleString()} icon="▦" /><Kpi label="Inventory Units" value={data?.summary.totalInventoryUnits.toLocaleString()} icon="◈" /><Kpi label="Purchase Amount" value={money(data?.summary.totalPurchaseAmount)} icon="↓" /><Kpi label="Low Stock Products" value={data?.summary.lowStockProducts.toLocaleString()} icon="!" /></div>
    <div className="reports-grid"><section className="panel report-panel report-wide"><div className="panel-heading"><div><h2>Sales trend</h2><p>{money(data?.sales.kpis.totalSales)} revenue · {data?.sales.kpis.totalOrders} orders · {money(data?.sales.kpis.averageOrderValue)} average order</p></div></div>{empty(data?.sales.monthly) ? <ChartEmpty /> : <ResponsiveContainer width="100%" height={260}><LineChart data={data.sales.monthly}><CartesianGrid stroke="#253249" strokeDasharray="3 3" /><XAxis dataKey="period" stroke="#71819c" /><YAxis stroke="#71819c" tickFormatter={compactMoney} /><Tooltip formatter={(value) => money(value)} contentStyle={{ background: '#1b263b', border: '1px solid #293751' }} /><Line type="monotone" dataKey="sales" stroke="#818cf8" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer>}</section><section className="panel report-panel"><div className="panel-heading"><div><h2>Daily sales</h2><p>Revenue by day</p></div></div>{empty(data?.sales.daily) ? <ChartEmpty /> : <ResponsiveContainer width="100%" height={260}><LineChart data={data.sales.daily}><CartesianGrid stroke="#253249" strokeDasharray="3 3" /><XAxis dataKey="period" stroke="#71819c" tick={{ fontSize: 10 }} /><YAxis stroke="#71819c" tickFormatter={compactMoney} /><Tooltip formatter={(value) => money(value)} contentStyle={{ background: '#1b263b', border: '1px solid #293751' }} /><Line type="monotone" dataKey="sales" stroke="#f59e0b" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>}</section><section className="panel report-panel"><div className="panel-heading"><div><h2>Inventory by category</h2><p>Units and valuation</p></div></div>{empty(data?.inventory.categories) ? <ChartEmpty /> : <ResponsiveContainer width="100%" height={260}><BarChart data={data.inventory.categories} layout="vertical"><CartesianGrid stroke="#253249" /><XAxis type="number" stroke="#71819c" /><YAxis type="category" dataKey="category" width={90} stroke="#71819c" tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="units" fill="#38bdf8" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>}</section><section className="panel report-panel"><div className="panel-heading"><div><h2>Purchase trends</h2><p>Orders and purchase amount</p></div></div>{empty(data?.purchases.monthly) ? <ChartEmpty /> : <ResponsiveContainer width="100%" height={260}><LineChart data={data.purchases.monthly}><CartesianGrid stroke="#253249" strokeDasharray="3 3" /><XAxis dataKey="period" stroke="#71819c" /><YAxis stroke="#71819c" tickFormatter={compactMoney} /><Tooltip formatter={(value) => money(value)} contentStyle={{ background: '#1b263b', border: '1px solid #293751' }} /><Line type="monotone" dataKey="purchaseAmount" stroke="#34d399" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer>}</section></div>
    <div className="reports-grid reports-tables"><section className="panel report-panel report-wide"><div className="panel-heading"><div><h2>Top selling products</h2><p>Product-wise quantity and revenue</p></div></div><ReportTable headers={['Product', 'SKU', 'Qty sold', 'Revenue']} rows={data?.products.top} render={(row) => <><td><strong>{row.productName}</strong></td><td className="muted">{row.sku}</td><td>{row.quantitySold}</td><td>{money(row.revenue)}</td></>} /></section><section className="panel report-panel"><div className="panel-heading"><div><h2>Least selling products</h2><p>Products needing attention</p></div></div><ReportTable headers={['Product', 'Qty', 'Revenue']} rows={data?.products.least} render={(row) => <><td><strong>{row.productName}</strong><small>{row.sku}</small></td><td>{row.quantitySold}</td><td>{money(row.revenue)}</td></>} /></section><section className="panel report-panel"><div className="panel-heading"><div><h2>Sales by category</h2><p>Category-wise performance</p></div></div><ReportTable headers={['Category', 'Qty', 'Revenue']} rows={data?.sales.categories} render={(row) => <><td><strong>{row.category}</strong></td><td>{row.quantitySold}</td><td>{money(row.revenue)}</td></>} /></section><section className="panel report-panel"><div className="panel-heading"><div><h2>Low stock report</h2><p>Reorder recommendations</p></div></div><ReportTable headers={['Product', 'Available', 'Reorder']} rows={data?.lowStock} render={(row) => <><td><strong>{row.productName}</strong><small>{row.category}</small></td><td>{row.availableStock}</td><td className="warning-text">{row.recommendedQuantity}</td></>} /></section><section className="panel report-panel"><div className="panel-heading"><div><h2>Supplier performance</h2><p>Purchase amount by supplier</p></div></div><ReportTable headers={['Supplier', 'Orders', 'Amount']} rows={data?.purchases.suppliers} render={(row) => <><td><strong>{row.supplier}</strong></td><td>{row.purchaseOrders}</td><td>{money(row.purchaseAmount)}</td></>} /></section><section className="panel report-panel"><div className="panel-heading"><div><h2>Order status</h2><p>Eligible sales by status</p></div></div><ReportTable headers={['Status', 'Orders', 'Sales']} rows={data?.sales.statuses} render={(row) => <><td><strong>{row.status}</strong></td><td>{row.orders}</td><td>{money(row.sales)}</td></>} /></section></div>
  </main>;
}

function ReportTable({ headers, rows = [], render }) {
  return <div className="table-scroll"><table className="reports-table"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id || row.productName || row.supplier || row.status || row.category || index}>{render(row)}</tr>) : <tr><td colSpan={headers.length} className="table-message">No data available.</td></tr>}</tbody></table></div>;
}
