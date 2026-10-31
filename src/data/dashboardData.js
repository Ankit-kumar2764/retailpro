export const navItems = [
  { label: 'Dashboard', icon: 'LayoutDashboard', path: '/' },
  { label: 'Products', icon: 'Package', path: '/products' },
  { label: 'Inventory', icon: 'Boxes', path: '/inventory' },
  { label: 'Warehouses', icon: 'Warehouse', path: '/warehouses' },
  { label: 'Orders', icon: 'ShoppingCart', path: '/orders' },
  { label: 'Order Fulfillment', icon: 'Truck', path: '/fulfillment' },
  { label: 'Suppliers', icon: 'UsersRound', path: '/suppliers' },
  { label: 'Purchase Orders', icon: 'ClipboardList', path: '/purchase-orders' },
  { label: 'Reports & Analytics', icon: 'ChartNoAxesCombined', path: '/reports' },
  { label: 'Settings', icon: 'Settings', path: '/settings' },
];

export const stats = [
  { label: 'Total Products', value: '2,486', change: '+12.5%', detail: 'vs. last month', icon: 'Package', tone: 'violet' },
  { label: 'Total Stock', value: '48,290', change: '+8.2%', detail: 'units in inventory', icon: 'Layers3', tone: 'blue' },
  { label: 'Low Stock Items', value: '18', change: '-4.6%', detail: 'needs attention', icon: 'TriangleAlert', tone: 'amber', down: true },
  { label: 'Total Orders', value: '1,284', change: '+18.7%', detail: 'vs. last month', icon: 'ShoppingCart', tone: 'green' },
  { label: 'Pending Orders', value: '56', change: '+2.4%', detail: 'awaiting fulfillment', icon: 'Clock3', tone: 'pink' },
  { label: 'Total Suppliers', value: '128', change: '+5.1%', detail: 'active partners', icon: 'UsersRound', tone: 'cyan' },
];

export const salesData = [
  { month: 'Jan', sales: 22000, orders: 1200 }, { month: 'Feb', sales: 28000, orders: 1480 },
  { month: 'Mar', sales: 26000, orders: 1370 }, { month: 'Apr', sales: 34000, orders: 1790 },
  { month: 'May', sales: 31000, orders: 1650 }, { month: 'Jun', sales: 39000, orders: 2040 },
  { month: 'Jul', sales: 36000, orders: 1880 }, { month: 'Aug', sales: 44000, orders: 2310 },
  { month: 'Sep', sales: 41000, orders: 2190 }, { month: 'Oct', sales: 49000, orders: 2610 },
  { month: 'Nov', sales: 46000, orders: 2470 }, { month: 'Dec', sales: 54000, orders: 2860 },
];

export const categoryData = [
  { name: 'Electronics', value: 34, color: '#6366f1' },
  { name: 'Apparel', value: 26, color: '#22c55e' },
  { name: 'Home & Living', value: 20, color: '#f59e0b' },
  { name: 'Beauty', value: 12, color: '#ec4899' },
  { name: 'Sports', value: 8, color: '#38bdf8' },
];

export const orderStatusData = [
  { name: 'Delivered', value: 620, color: '#22c55e' },
  { name: 'Processing', value: 280, color: '#6366f1' },
  { name: 'Shipped', value: 210, color: '#38bdf8' },
  { name: 'Cancelled', value: 74, color: '#ef4444' },
];

export const stockMovementData = [
  { day: 'Mon', inbound: 420, outbound: 280 }, { day: 'Tue', inbound: 360, outbound: 320 },
  { day: 'Wed', inbound: 510, outbound: 390 }, { day: 'Thu', inbound: 460, outbound: 340 },
  { day: 'Fri', inbound: 610, outbound: 430 }, { day: 'Sat', inbound: 390, outbound: 280 },
  { day: 'Sun', inbound: 290, outbound: 210 },
];

export const inventory = [
  { product: 'Wireless Headphones', sku: 'WH-1001', category: 'Electronics', warehouse: 'Central Hub', stock: 245, reorder: 50, status: 'In Stock' },
  { product: 'Classic Cotton T-Shirt', sku: 'CT-2048', category: 'Apparel', warehouse: 'North Depot', stock: 32, reorder: 40, status: 'Low Stock' },
  { product: 'Smart LED Desk Lamp', sku: 'SL-3012', category: 'Home & Living', warehouse: 'Central Hub', stock: 0, reorder: 25, status: 'Out of Stock' },
  { product: 'Leather Card Holder', sku: 'LC-1099', category: 'Accessories', warehouse: 'West Warehouse', stock: 168, reorder: 30, status: 'In Stock' },
  { product: 'Running Shoes Pro', sku: 'RS-8871', category: 'Sports', warehouse: 'North Depot', stock: 18, reorder: 24, status: 'Low Stock' },
  { product: 'Vitamin C Face Serum', sku: 'VC-4420', category: 'Beauty', warehouse: 'Central Hub', stock: 94, reorder: 20, status: 'In Stock' },
];

export const orders = [
  { id: '#ORD-84921', customer: 'Olivia Bennett', date: 'Oct 24, 2024', amount: '$1,240.00', payment: 'Paid', status: 'Delivered' },
  { id: '#ORD-84920', customer: 'Liam Carter', date: 'Oct 24, 2024', amount: '$860.50', payment: 'Paid', status: 'Processing' },
  { id: '#ORD-84919', customer: 'Sophia Mitchell', date: 'Oct 23, 2024', amount: '$2,410.00', payment: 'Pending', status: 'Processing' },
  { id: '#ORD-84918', customer: 'Noah Williams', date: 'Oct 23, 2024', amount: '$345.90', payment: 'Paid', status: 'Shipped' },
  { id: '#ORD-84917', customer: 'Emma Anderson', date: 'Oct 22, 2024', amount: '$720.00', payment: 'Paid', status: 'Delivered' },
];
