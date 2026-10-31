import React, { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { categoryData, inventory, navItems, orderStatusData, orders, salesData, stats, stockMovementData } from './data/dashboardData';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import Inventory from './pages/Inventory';
import Login from './pages/Login';
import axios from 'axios';
import { API_URL, authConfig } from './utils/api';
import Suppliers from './pages/Suppliers';
import PurchaseOrders from './pages/PurchaseOrders';
import Orders from './pages/Orders';
import OrderFulfillment from './pages/OrderFulfillment';
import Settings from './pages/Settings';
import Reports from './pages/Reports';

const icon = (name, props = {}) => {
  const Component = Icons[name] || Icons.Circle;
  return <Component size={18} strokeWidth={1.8} {...props} />;
};

function getStoredUser() {
  try {
    const value = JSON.parse(window.localStorage.getItem('retailpro_user') || '{}');
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const location = useLocation();
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><div className="brand-mark">R</div><span>Retail<span className="brand-accent">Pro</span></span><button className="icon-btn sidebar-toggle" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">{icon('PanelLeftClose')}</button></div>
      <div className="nav-section-label">Workspace</div>
      <nav className="sidebar-nav">
        {navItems.slice(0, 6).map((item) => <Link className={location.pathname === item.path ? 'active' : ''} to={item.path} key={item.label} onClick={() => setMobileOpen(false)}>{icon(item.icon)}<span>{item.label}</span></Link>)}
      </nav>
      <div className="nav-section-label">Management</div>
      <nav className="sidebar-nav">
        {navItems.slice(6).map((item) => <Link className={location.pathname === item.path ? 'active' : ''} to={item.path} key={item.label} onClick={() => setMobileOpen(false)}>{icon(item.icon)}<span>{item.label}</span></Link>)}
      </nav>
      <div className="sidebar-footer"><div className="upgrade-card"><div className="upgrade-icon">{icon('Sparkles')}</div><strong>Upgrade to Pro</strong><p>Unlock advanced analytics and reports.</p><button>View plans <span>→</span></button></div><div className="help-link">{icon('CircleHelp')}<span>Help & support</span></div></div>
    </aside>
  );
}

function Navbar({ onMenu }) {
  const [notifications, setNotifications] = useState(false);
  const [profile, setProfile] = useState(false);
  const storedUser = getStoredUser();
  const logout = async () => { try { await axios.post(`${API_URL}/auth/logout`, {}, authConfig()); } catch (error) { console.error('Logout request failed:', error); } finally { window.localStorage.removeItem('retailpro_token'); window.localStorage.removeItem('retailpro_user'); window.location.href = '/login'; } };
  return <header className="topbar"><button className="mobile-menu icon-btn" onClick={onMenu} aria-label="Open menu">{icon('Menu')}</button><div className="search-box">{icon('Search')}<input placeholder="Search anything..." /><kbd>⌘ K</kbd></div><div className="topbar-actions"><div className="date-display">{icon('CalendarDays')}<span>Oct 24, 2024</span></div><div className="dropdown-wrap"><button className="icon-btn notification-btn" onClick={() => setNotifications(!notifications)} aria-label="Notifications">{icon('Bell')}<i /></button>{notifications && <div className="dropdown notification-menu"><div className="dropdown-header"><strong>Notifications</strong><span>3 new</span></div><div className="notification-item"><span className="dot violet" /><p><strong>New order received</strong><small>Order #ORD-84921 · 4 min ago</small></p></div><div className="notification-item"><span className="dot amber" /><p><strong>Low stock alert</strong><small>Classic Cotton T-Shirt · 1 hr ago</small></p></div><button className="view-all">View all notifications</button></div>}</div><div className="dropdown-wrap"><button className="profile-button" onClick={() => setProfile(!profile)}><span className="avatar">{(storedUser.name || 'User').slice(0, 2).toUpperCase()}</span><span className="profile-copy"><strong>{storedUser.name || 'User'}</strong><small>{storedUser.role || 'Staff'}</small></span>{icon('ChevronDown', { size: 15 })}</button>{profile && <div className="dropdown profile-menu"><Link to="/settings">{icon('UserRound')} My profile</Link><Link to="/settings">{icon('Settings')} Account settings</Link><hr /><button onClick={logout}>{icon('LogOut')} Sign out</button></div>}</div></div></header>;
}

function StatCard({ stat }) {
  return <div className="stat-card"><div className={`stat-icon ${stat.tone}`}>{icon(stat.icon)}</div><div className="stat-content"><span>{stat.label}</span><strong>{stat.value}</strong><div><b className={stat.down ? 'negative' : ''}>{stat.down ? '↓' : '↑'} {stat.change}</b><small>{stat.detail}</small></div></div><div className="mini-chart"><svg viewBox="0 0 64 28" preserveAspectRatio="none"><path d={stat.down ? 'M0 9 C10 4 13 19 23 14 S33 20 42 13 S53 18 64 7' : 'M0 22 C9 18 12 20 20 12 S29 18 38 9 S52 13 64 2'} /></svg></div></div>;
}

const tooltipStyle = { background: '#1b263b', border: '1px solid #293751', borderRadius: 8, color: '#f8fafc', fontSize: 12 };
function ChartCard({ title, subtitle, children, className = '' }) {
  return <section className={`panel chart-panel ${className}`}><div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="more-btn">{icon('MoreHorizontal')}</button></div>{children}</section>;
}

function InventoryTable() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All status');
  const rows = useMemo(() => inventory.filter((item) => (item.product + item.sku + item.category).toLowerCase().includes(query.toLowerCase()) && (filter === 'All status' || item.status === filter)), [query, filter]);
  return <section className="panel inventory-panel"><div className="panel-heading inventory-heading"><div><h2>Inventory overview</h2><p>Keep an eye on your product availability</p></div><Link className="outline-btn" to="/inventory">View inventory {icon('ArrowUpRight', { size: 15 })}</Link></div><div className="table-toolbar"><div className="table-search">{icon('Search')}<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search products..." /></div><select value={filter} onChange={(e) => setFilter(e.target.value)}><option>All status</option><option>In Stock</option><option>Low Stock</option><option>Out of Stock</option></select><button className="filter-btn">{icon('ListFilter')} Filters</button></div><div className="table-scroll"><table><thead><tr><th>Product name</th><th>SKU</th><th>Category</th><th>Warehouse</th><th>Available stock</th><th>Reorder level</th><th>Status</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.sku}><td><strong className="product-name">{row.product}</strong></td><td className="muted">{row.sku}</td><td>{row.category}</td><td>{row.warehouse}</td><td><strong>{row.stock}</strong></td><td className="muted">{row.reorder}</td><td><span className={`status ${row.status.toLowerCase().replaceAll(' ', '-')}`}><i />{row.status}</span></td><td><button className="row-action">{icon('MoreVertical')}</button></td></tr>)}</tbody></table></div><div className="pagination"><span>Showing {rows.length} of 2,486 products</span><div><button disabled>{icon('ChevronLeft')}</button><button className="page-active">1</button><button>2</button><button>3</button><button>...</button><button>249</button><button>{icon('ChevronRight')}</button></div></div></section>;
}

function RecentOrders() {
  return <section className="panel orders-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Latest activity from your store</p></div><Link className="text-btn" to="/orders">View all {icon('ArrowRight', { size: 15 })}</Link></div><div className="orders-list">{orders.map((order) => <div className="order-row" key={order.id}><div className="order-icon">{icon('ShoppingBag')}</div><div className="order-main"><strong>{order.id}</strong><span>{order.customer} · {order.date}</span></div><div className="order-amount"><strong>{order.amount}</strong><span className={`payment ${order.payment.toLowerCase()}`}>{order.payment}</span></div><span className={`order-status ${order.status.toLowerCase()}`}>{order.status}</span><button className="row-action">{icon('MoreVertical')}</button></div>)}</div></section>;
}

function Dashboard() {
  const [period, setPeriod] = useState('Last 12 months');
  return <main className="main-content"><div className="page-heading"><div><p className="eyebrow">Thursday, October 24, 2024</p><h1>Good morning, Jordan <span>✦</span></h1><p className="page-subtitle">Here&apos;s what&apos;s happening with your store today.</p></div><div className="heading-actions"><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>Last 12 months</option><option>Last 30 days</option><option>This year</option></select><Link to="/products" className="primary-btn">{icon('Plus')} Add product</Link></div></div><div className="stats-grid">{stats.map((stat) => <StatCard stat={stat} key={stat.label} />)}</div><div className="charts-grid"><ChartCard title="Monthly sales overview" subtitle="Revenue performance over time" className="sales-chart"><div className="legend"><span><i className="legend-dot violet" />Revenue</span><span><i className="legend-dot blue" />Orders</span></div><ResponsiveContainer width="100%" height={256}><LineChart data={salesData} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke="#253249" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" stroke="#71819c" tickLine={false} axisLine={false} fontSize={11} /><YAxis stroke="#71819c" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => `$${value / 1000}k`} /><Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [name === 'sales' ? `$${value.toLocaleString()}` : value, name === 'sales' ? 'Revenue' : 'Orders']} /><Line type="monotone" dataKey="sales" stroke="#818cf8" strokeWidth={3} dot={false} activeDot={{ r: 5, fill: '#818cf8', stroke: '#172033', strokeWidth: 3 }} /><Line type="monotone" dataKey="orders" stroke="#38bdf8" strokeWidth={2} dot={false} strokeDasharray="5 5" /></LineChart></ResponsiveContainer></ChartCard><ChartCard title="Inventory by category" subtitle="Current stock distribution" className="category-chart"><div className="donut-wrap"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={78} paddingAngle={4} stroke="none">{categoryData.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}%`, 'Share']} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>48.2k</strong><span>units</span></div></div><div className="category-legend">{categoryData.map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}%</strong></div>)}</div></ChartCard><ChartCard title="Order status distribution" subtitle="Orders by current status" className="status-chart"><ResponsiveContainer width="100%" height={180}><BarChart data={orderStatusData} layout="vertical" margin={{ top: 0, right: 8, left: 18, bottom: 0 }}><XAxis type="number" hide /><YAxis dataKey="name" type="category" stroke="#94a3b8" tickLine={false} axisLine={false} fontSize={11} width={66} /><Tooltip cursor={{ fill: '#202e45' }} contentStyle={tooltipStyle} /><Bar dataKey="value" radius={[0, 5, 5, 0]}>{orderStatusData.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Bar></BarChart></ResponsiveContainer></ChartCard><ChartCard title="Weekly stock movement" subtitle="Inbound vs outbound units" className="stock-chart"><div className="legend"><span><i className="legend-dot green" />Inbound</span><span><i className="legend-dot amber" />Outbound</span></div><ResponsiveContainer width="100%" height={180}><AreaChart data={stockMovementData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }}><defs><linearGradient id="inbound" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="100%" stopColor="#22c55e" stopOpacity={0} /></linearGradient><linearGradient id="outbound" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b" stopOpacity={0.22} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#253249" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="day" stroke="#71819c" tickLine={false} axisLine={false} fontSize={11} /><YAxis stroke="#71819c" tickLine={false} axisLine={false} fontSize={11} /><Tooltip contentStyle={tooltipStyle} /><Area type="monotone" dataKey="inbound" stroke="#22c55e" fill="url(#inbound)" strokeWidth={2} /><Area type="monotone" dataKey="outbound" stroke="#f59e0b" fill="url(#outbound)" strokeWidth={2} /></AreaChart></ResponsiveContainer></ChartCard></div><div className="lower-grid"><InventoryTable /><RecentOrders /></div><section className="quick-actions"><div><h2>Quick actions</h2><p>Jump right into your most common tasks</p></div><div className="quick-actions-buttons"><Link to="/products"><span className="quick-icon violet">{icon('PackagePlus')}</span><span><strong>Add product</strong><small>Add a new item to catalog</small></span>{icon('ArrowUpRight')}</Link><Link to="/orders"><span className="quick-icon blue">{icon('ShoppingCart')}</span><span><strong>Create order</strong><small>Process a new customer order</small></span>{icon('ArrowUpRight')}</Link><Link to="/suppliers"><span className="quick-icon green">{icon('UserPlus')}</span><span><strong>Add supplier</strong><small>Connect a new supplier</small></span>{icon('ArrowUpRight')}</Link><Link to="/warehouses"><span className="quick-icon amber">{icon('Warehouse')}</span><span><strong>Manage warehouse</strong><small>Review warehouse capacity</small></span>{icon('ArrowUpRight')}</Link></div></section></main>;
}

function DashboardLive() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [period, setPeriod] = useState('Last 12 months');

  useEffect(() => {
    const end = new Date();
    const start = new Date(end);
    if (period === 'Last 30 days') start.setDate(end.getDate() - 30);
    else if (period === 'This year') start.setMonth(0, 1);
    else start.setFullYear(end.getFullYear() - 1);
    const formatDate = (date) => date.toISOString().slice(0, 10);
    const range = `?from=${formatDate(start)}&to=${formatDate(end)}`;
    let active = true;
    Promise.all([
      axios.get(`${API_URL}/dashboard/summary`, authConfig()),
      axios.get(`${API_URL}/dashboard/sales-overview${range}`, authConfig()),
      axios.get(`${API_URL}/dashboard/recent-orders?limit=8`, authConfig()),
      axios.get(`${API_URL}/dashboard/top-products?limit=5${range.replace('?', '&')}`, authConfig()),
      axios.get(`${API_URL}/dashboard/low-stock`, authConfig()),
      axios.get(`${API_URL}/dashboard/inventory-overview`, authConfig()),
      axios.get(`${API_URL}/dashboard/purchase-overview${range}`, authConfig()),
    ]).then((responses) => {
      if (active) setData({
        summary: responses[0].data,
        sales: responses[1].data,
        recentOrders: responses[2].data,
        topProducts: responses[3].data,
        lowStock: responses[4].data,
        inventory: responses[5].data,
        purchases: responses[6].data,
      });
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || 'Unable to load dashboard analytics.');
    });
    return () => { active = false; };
  }, [period]);

  if (error) return <main className="main-content"><div className="api-error" role="alert">{error}</div></main>;
  if (!data) return <main className="main-content"><div className="panel table-message">Loading dashboard analytics...</div></main>;

  const statCards = [
    ['Total Products', data.summary.totalProducts, 'Package', 'violet'],
    ['Inventory Units', data.summary.totalInventoryUnits, 'Layers3', 'blue'],
    ['Warehouses', data.summary.totalWarehouses, 'Warehouse', 'cyan'],
    ['Total Orders', data.summary.totalOrders, 'ShoppingCart', 'green'],
    ['Total Sales', `$${Number(data.summary.totalSales).toLocaleString()}`, 'Banknote', 'pink'],
    ['Low Stock Products', data.summary.lowStockProducts, 'TriangleAlert', 'amber'],
  ];
  const colors = ['#6366f1', '#22c55e', '#f59e0b', '#ec4899', '#38bdf8', '#a78bfa'];
  return <main className="main-content">
    <div className="page-heading"><div><p className="eyebrow">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p><h1>Dashboard <span>✦</span></h1><p className="page-subtitle">Live performance from your retail operations.</p></div><div className="heading-actions"><select value={period} onChange={(event) => setPeriod(event.target.value)}><option>Last 12 months</option><option>Last 30 days</option><option>This year</option></select><Link to="/products" className="primary-btn">{icon('Plus')} Add product</Link></div></div>
    <div className="stats-grid">{statCards.map(([label, value, iconName, tone]) => <div className="stat-card" key={label}><div className={`stat-icon ${tone}`}>{icon(iconName)}</div><div className="stat-content"><span>{label}</span><strong>{value}</strong><div><small>Live database value</small></div></div></div>)}</div>
    <div className="charts-grid">
      <ChartCard title="Monthly sales overview" subtitle="Revenue and order count" className="sales-chart"><ResponsiveContainer width="100%" height={256}><LineChart data={data.sales} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}><CartesianGrid stroke="#253249" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" stroke="#71819c" tickLine={false} axisLine={false} fontSize={11} /><YAxis stroke="#71819c" tickLine={false} axisLine={false} fontSize={11} tickFormatter={(value) => `$${value / 1000}k`} /><Tooltip contentStyle={tooltipStyle} /><Line type="monotone" dataKey="sales" stroke="#818cf8" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="orders" stroke="#38bdf8" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></ChartCard>
      <ChartCard title="Inventory by category" subtitle="Available units"><div className="donut-wrap"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={data.inventory} dataKey="units" nameKey="category" innerRadius={56} outerRadius={78} paddingAngle={4} stroke="none">{data.inventory.map((entry, index) => <Cell fill={colors[index % colors.length]} key={entry.category} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{Number(data.summary.totalInventoryUnits).toLocaleString()}</strong><span>units</span></div></div><div className="category-legend">{data.inventory.map((item, index) => <div key={item.category}><span><i style={{ background: colors[index % colors.length] }} />{item.category}</span><strong>{item.percentage}%</strong></div>)}</div></ChartCard>
      <ChartCard title="Purchase overview" subtitle="Monthly purchase orders" className="status-chart"><ResponsiveContainer width="100%" height={180}><BarChart data={data.purchases} margin={{ top: 0, right: 8, left: -18, bottom: 0 }}><CartesianGrid stroke="#253249" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="month" stroke="#71819c" tickLine={false} axisLine={false} fontSize={10} /><YAxis stroke="#71819c" tickLine={false} axisLine={false} fontSize={10} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="purchaseOrders" fill="#38bdf8" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></ChartCard>
    </div>
    <div className="lower-grid">
      <section className="panel inventory-panel"><div className="panel-heading"><div><h2>Top selling products</h2><p>Highest quantity sold</p></div></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>SKU</th><th>Quantity sold</th><th>Sales</th></tr></thead><tbody>{data.topProducts.length ? data.topProducts.map((item) => <tr key={item.id}><td><strong>{item.productName}</strong></td><td className="muted">{item.sku}</td><td>{item.quantitySold}</td><td>${Number(item.sales).toLocaleString()}</td></tr>) : <tr><td colSpan="4" className="table-message">No sales data available.</td></tr>}</tbody></table></div></section>
      <section className="panel orders-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Latest database orders</p></div><Link className="text-btn" to="/orders">View all {icon('ArrowRight', { size: 15 })}</Link></div><div className="orders-list">{data.recentOrders.length ? data.recentOrders.map((order) => <div className="order-row" key={order.id}><div className="order-icon">{icon('ShoppingBag')}</div><div className="order-main"><strong>{order.orderNumber}</strong><span>{order.customerName || 'Guest'} · {order.orderDate}</span></div><div className="order-amount"><strong>${Number(order.totalAmount).toLocaleString()}</strong></div><span className={`order-status ${order.status.toLowerCase()}`}>{order.status}</span></div>) : <p className="table-message">No orders available.</p>}</div></section>
    </div>
    <section className="panel inventory-panel"><div className="panel-heading"><div><h2>Low stock products</h2><p>Products at or below reorder level</p></div><Link className="outline-btn" to="/inventory">View inventory</Link></div><div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Available</th><th>Reorder level</th></tr></thead><tbody>{data.lowStock.length ? data.lowStock.slice(0, 8).map((item) => <tr key={item.id}><td><strong>{item.productName}</strong><small>{item.sku}</small></td><td>{item.category}</td><td>{item.availableStock}</td><td>{item.reorderLevel}</td></tr>) : <tr><td colSpan="4" className="table-message">No low-stock products.</td></tr>}</tbody></table></div></section>
  </main>;
}

function Placeholder({ label }) {
  return <main className="main-content placeholder"><div className="page-heading"><div><p className="eyebrow">RetailPro workspace</p><h1>{label}</h1><p className="page-subtitle">This workspace is ready for your next inventory workflow.</p></div></div><div className="empty-state panel"><div className="empty-icon">{icon('Construction')}</div><h2>{label} workspace</h2><p>This workspace is reserved for the next approved product scope. Existing operational modules remain available.</p><Link className="primary-btn" to="/">Back to dashboard</Link></div></main>;
}

function RequireAuth({ children }) {
  const location = useLocation();
  const [state, setState] = useState('checking');
  useEffect(() => {
    if (!window.localStorage.getItem('retailpro_token')) {
      setState('missing');
      return;
    }
    axios.get(`${API_URL}/auth/profile`, authConfig())
      .then(() => setState('valid'))
      .catch(() => {
        window.localStorage.removeItem('retailpro_token');
        window.localStorage.removeItem('retailpro_user');
        setState('missing');
      });
  }, []);
  if (state === 'checking') return <main className="main-content"><div className="panel table-message">Checking authentication...</div></main>;
  return state === 'valid' ? children : <Navigate to="/login" replace state={{ from: location }} />;
}

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return <Routes><Route path="/login" element={<Login />} /><Route path="*" element={<div className="app-shell"><Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />{mobileOpen && <button className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-label="Close menu" /> }<div className={`content-shell ${collapsed ? 'sidebar-collapsed' : ''}`}><Navbar onMenu={() => setMobileOpen(true)} /><Routes><Route path="/" element={<RequireAuth><DashboardLive /></RequireAuth>} /><Route path="/products" element={<RequireAuth><Products /></RequireAuth>} /><Route path="/warehouses" element={<RequireAuth><Warehouses /></RequireAuth>} /><Route path="/inventory" element={<RequireAuth><Inventory /></RequireAuth>} /><Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} /><Route path="/fulfillment" element={<RequireAuth><OrderFulfillment /></RequireAuth>} /><Route path="/suppliers" element={<RequireAuth><Suppliers /></RequireAuth>} /><Route path="/purchase-orders" element={<RequireAuth><PurchaseOrders /></RequireAuth>} />  <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} /><Route path="/reports" element={<RequireAuth><Reports /></RequireAuth>} />{navItems.slice(4).filter((item) => !['/orders', '/fulfillment', '/suppliers', '/purchase-orders', '/settings', '/reports'].includes(item.path)).map((item) => <Route path={item.path} element={<Placeholder label={item.label} />} key={item.path} />)}<Route path="*" element={<Navigate to="/" replace />} /></Routes></div></div>} /></Routes>;
}

export default App;
