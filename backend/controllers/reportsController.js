import pool from '../config/db.js';

const salesStatuses = `o.status <> 'Cancelled'`;
const purchaseStatuses = `po.status <> 'Cancelled'`;

function getRange(req, column, params) {
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  const valid = (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!valid(from) || !valid(to) || (from && to && from > to)) {
    const error = new Error('Dates must use YYYY-MM-DD and from must not be after to.');
    error.statusCode = 400;
    throw error;
  }
  if (from) { params.push(from); }
  if (to) { params.push(to); }
  return `${from ? ` AND ${column} >= ?` : ''}${to ? ` AND ${column} < DATE_ADD(?, INTERVAL 1 DAY)` : ''}`;
}

const number = (value) => Number(value || 0);
const mapNumbers = (rows, fields) => rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, fields.includes(key) ? number(value) : value])));

export async function summary(req, res) {
  try {
    const orderParams = [];
    const purchaseParams = [];
    const orderRange = getRange(req, 'o.ordered_at', orderParams);
    const purchaseRange = getRange(req, 'po.ordered_at', purchaseParams);
    const [[sales], [orders], [products], [inventory], [purchases], [lowStock]] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS totalSales FROM orders o WHERE ${salesStatuses}${orderRange}`, orderParams),
      pool.query(`SELECT COUNT(*) AS totalOrders FROM orders o WHERE ${salesStatuses}${orderRange}`, orderParams),
      pool.query('SELECT COUNT(*) AS totalProducts FROM products WHERE is_active = TRUE'),
      pool.query('SELECT COALESCE(SUM(quantity), 0) AS totalInventoryUnits FROM inventory'),
      pool.query(`SELECT COALESCE(SUM(po.total_amount), 0) AS totalPurchaseAmount FROM purchase_orders po WHERE ${purchaseStatuses}${purchaseRange}`, purchaseParams),
      pool.query(`SELECT COUNT(*) AS lowStockProducts FROM (SELECT p.id FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.is_active = TRUE GROUP BY p.id, p.reorder_level HAVING COALESCE(SUM(i.quantity), 0) <= p.reorder_level) low_stock`),
    ]);
    res.json({ totalSales: number(sales[0].totalSales), totalOrders: number(orders[0].totalOrders), totalProducts: number(products[0].totalProducts), totalInventoryUnits: number(inventory[0].totalInventoryUnits), totalPurchaseAmount: number(purchases[0].totalPurchaseAmount), lowStockProducts: number(lowStock[0].lowStockProducts) });
  } catch (error) {
    console.error('Reports summary failed:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to load report summary.' });
  }
}

export async function sales(req, res) {
  try {
    const params = [];
    const range = getRange(req, 'o.ordered_at', params);
    const [kpiRows, monthly, daily, products, categories, statuses] = await Promise.all([
      pool.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS totalSales, COUNT(*) AS totalOrders, COALESCE(AVG(o.total_amount), 0) AS averageOrderValue FROM orders o WHERE ${salesStatuses}${range}`, params),
      pool.query(`SELECT DATE_FORMAT(o.ordered_at, '%Y-%m') AS period, SUM(o.total_amount) AS sales, COUNT(*) AS orders FROM orders o WHERE ${salesStatuses}${range} GROUP BY period ORDER BY period`, params),
      pool.query(`SELECT DATE_FORMAT(o.ordered_at, '%Y-%m-%d') AS period, SUM(o.total_amount) AS sales, COUNT(*) AS orders FROM orders o WHERE ${salesStatuses}${range} GROUP BY period ORDER BY period`, params),
      pool.query(`SELECT p.id, p.product_name AS productName, p.sku, SUM(oi.quantity) AS quantitySold, SUM(oi.line_total) AS revenue FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id INNER JOIN products p ON p.id = oi.product_id WHERE ${salesStatuses}${range} GROUP BY p.id, p.product_name, p.sku ORDER BY revenue DESC`, params),
      pool.query(`SELECT COALESCE(c.name, p.category, 'Uncategorized') AS category, SUM(oi.quantity) AS quantitySold, SUM(oi.line_total) AS revenue FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id INNER JOIN products p ON p.id = oi.product_id LEFT JOIN categories c ON c.id = p.category_id WHERE ${salesStatuses}${range} GROUP BY COALESCE(c.name, p.category, 'Uncategorized') ORDER BY revenue DESC`, params),
      pool.query(`SELECT o.status, COUNT(*) AS orders, SUM(o.total_amount) AS sales FROM orders o WHERE ${salesStatuses}${range} GROUP BY o.status ORDER BY sales DESC`, params),
    ]);
    res.json({ kpis: mapNumbers([kpiRows[0][0]], ['totalSales', 'totalOrders', 'averageOrderValue'])[0], monthly: mapNumbers(monthly[0], ['sales', 'orders']), daily: mapNumbers(daily[0], ['sales', 'orders']), products: mapNumbers(products[0], ['quantitySold', 'revenue']), categories: mapNumbers(categories[0], ['quantitySold', 'revenue']), statuses: mapNumbers(statuses[0], ['orders', 'sales']) });
  } catch (error) {
    console.error('Sales reports failed:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to load sales reports.' });
  }
}

export async function inventory(req, res) {
  try {
    const [warehouse, categories, lowStock, outOfStock, totals] = await Promise.all([
      pool.query(`SELECT w.name AS warehouse, COALESCE(SUM(i.quantity), 0) AS units, COALESCE(SUM(i.quantity * p.purchase_price), 0) AS valuation FROM inventory i INNER JOIN warehouses w ON w.id = i.warehouse_id INNER JOIN products p ON p.id = i.product_id WHERE p.is_active = TRUE GROUP BY w.id, w.name ORDER BY units DESC`),
      pool.query(`SELECT COALESCE(c.name, p.category, 'Uncategorized') AS category, COALESCE(SUM(i.quantity), 0) AS units, COALESCE(SUM(i.quantity * p.purchase_price), 0) AS valuation FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id WHERE p.is_active = TRUE GROUP BY COALESCE(c.name, p.category, 'Uncategorized') ORDER BY units DESC`),
      pool.query(`SELECT p.id, p.product_name AS productName, p.sku, COALESCE(SUM(i.quantity), 0) AS availableStock, p.reorder_level AS reorderLevel, GREATEST(p.reorder_level - COALESCE(SUM(i.quantity), 0), 0) AS recommendedQuantity, COALESCE(c.name, p.category, 'Uncategorized') AS category FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id WHERE p.is_active = TRUE GROUP BY p.id, p.product_name, p.sku, p.reorder_level, c.name, p.category HAVING availableStock <= p.reorder_level ORDER BY availableStock, p.product_name`),
      pool.query(`SELECT p.id, p.product_name AS productName, p.sku, COALESCE(SUM(i.quantity), 0) AS availableStock, p.purchase_price AS purchasePrice FROM products p LEFT JOIN inventory i ON i.product_id = p.id WHERE p.is_active = TRUE GROUP BY p.id, p.product_name, p.sku, p.purchase_price HAVING availableStock = 0 ORDER BY p.product_name`),
      pool.query(`SELECT COALESCE(SUM(i.quantity), 0) AS totalStock, COALESCE(SUM(i.quantity * p.purchase_price), 0) AS valuation FROM inventory i INNER JOIN products p ON p.id = i.product_id WHERE p.is_active = TRUE`),
    ]);
    res.json({ totals: mapNumbers(totals[0], ['totalStock', 'valuation'])[0], warehouse: mapNumbers(warehouse[0], ['units', 'valuation']), categories: mapNumbers(categories[0], ['units', 'valuation']), lowStock: mapNumbers(lowStock[0], ['availableStock', 'reorderLevel', 'recommendedQuantity']), outOfStock: mapNumbers(outOfStock[0], ['availableStock', 'purchasePrice']) });
  } catch (error) {
    console.error('Inventory reports failed:', error);
    res.status(500).json({ message: 'Unable to load inventory reports.' });
  }
}

export async function purchases(req, res) {
  try {
    const params = [];
    const range = getRange(req, 'po.ordered_at', params);
    const [kpis, monthly, suppliers] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS totalPurchaseOrders, COALESCE(SUM(po.total_amount), 0) AS totalPurchaseAmount, SUM(po.status IN ('Pending', 'Submitted', 'Approved', 'Ordered', 'Partially Received')) AS pendingPurchaseOrders, SUM(po.status = 'Received') AS receivedPurchaseOrders FROM purchase_orders po WHERE ${purchaseStatuses}${range}`, params),
      pool.query(`SELECT DATE_FORMAT(po.ordered_at, '%Y-%m') AS period, COUNT(*) AS purchaseOrders, SUM(po.total_amount) AS purchaseAmount FROM purchase_orders po WHERE ${purchaseStatuses}${range} GROUP BY period ORDER BY period`, params),
      pool.query(`SELECT s.id, s.name AS supplier, COUNT(po.id) AS purchaseOrders, COALESCE(SUM(po.total_amount), 0) AS purchaseAmount FROM suppliers s INNER JOIN purchase_orders po ON po.supplier_id = s.id WHERE ${purchaseStatuses}${range} GROUP BY s.id, s.name ORDER BY purchaseAmount DESC`, params),
    ]);
    res.json({ kpis: mapNumbers(kpis[0], ['totalPurchaseOrders', 'totalPurchaseAmount', 'pendingPurchaseOrders', 'receivedPurchaseOrders'])[0], monthly: mapNumbers(monthly[0], ['purchaseOrders', 'purchaseAmount']), suppliers: mapNumbers(suppliers[0], ['purchaseOrders', 'purchaseAmount']) });
  } catch (error) {
    console.error('Purchase reports failed:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to load purchase reports.' });
  }
}

export async function products(req, res) {
  try {
    const params = [];
    const range = getRange(req, 'o.ordered_at', params);
    const [top, least, categories] = await Promise.all([
      pool.query(`SELECT p.id, p.product_name AS productName, p.sku, SUM(oi.quantity) AS quantitySold, SUM(oi.line_total) AS revenue FROM order_items oi INNER JOIN orders o ON o.id = oi.order_id INNER JOIN products p ON p.id = oi.product_id WHERE ${salesStatuses}${range} GROUP BY p.id, p.product_name, p.sku ORDER BY quantitySold DESC, revenue DESC LIMIT 10`, params),
      pool.query(`SELECT p.id, p.product_name AS productName, p.sku, COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS quantitySold, COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.line_total ELSE 0 END), 0) AS revenue FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id LEFT JOIN orders o ON o.id = oi.order_id AND ${salesStatuses}${range} WHERE p.is_active = TRUE GROUP BY p.id, p.product_name, p.sku ORDER BY quantitySold ASC, revenue ASC LIMIT 10`, params),
      pool.query(`SELECT COALESCE(c.name, p.category, 'Uncategorized') AS category, COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0) AS quantitySold, COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.line_total ELSE 0 END), 0) AS revenue FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN order_items oi ON oi.product_id = p.id LEFT JOIN orders o ON o.id = oi.order_id AND ${salesStatuses}${range} WHERE p.is_active = TRUE GROUP BY COALESCE(c.name, p.category, 'Uncategorized') ORDER BY revenue DESC`, params),
    ]);
    res.json({ top: mapNumbers(top[0], ['quantitySold', 'revenue']), least: mapNumbers(least[0], ['quantitySold', 'revenue']), categories: mapNumbers(categories[0], ['quantitySold', 'revenue']) });
  } catch (error) {
    console.error('Product reports failed:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to load product reports.' });
  }
}

export async function lowStock(req, res) {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '50', 10) || 50));
    const [rows] = await pool.query(`SELECT p.id, p.product_name AS productName, p.sku, COALESCE(SUM(i.quantity), 0) AS availableStock, p.reorder_level AS reorderLevel, GREATEST(p.reorder_level - COALESCE(SUM(i.quantity), 0), 0) AS recommendedQuantity, COALESCE(c.name, p.category, 'Uncategorized') AS category FROM products p LEFT JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id WHERE p.is_active = TRUE GROUP BY p.id, p.product_name, p.sku, p.reorder_level, c.name, p.category HAVING availableStock <= p.reorder_level ORDER BY availableStock, p.product_name LIMIT ?`, [limit]);
    res.json(mapNumbers(rows, ['availableStock', 'reorderLevel', 'recommendedQuantity']));
  } catch (error) {
    console.error('Reports low-stock failed:', error);
    res.status(500).json({ message: 'Unable to load low-stock report.' });
  }
}
