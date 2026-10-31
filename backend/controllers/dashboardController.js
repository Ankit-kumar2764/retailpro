import pool from '../config/db.js';

const dateRange = (req) => {
  const from = String(req.query.from || '').trim();
  const to = String(req.query.to || '').trim();
  const valid = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  return {
    from: valid(from) ? from : null,
    to: valid(to) ? to : null,
  };
};

const rangeWhere = (dateColumn, range, params) => {
  const conditions = [];
  if (range.from) {
    conditions.push(`${dateColumn} >= ?`);
    params.push(range.from);
  }
  if (range.to) {
    conditions.push(`${dateColumn} < DATE_ADD(?, INTERVAL 1 DAY)`);
    params.push(range.to);
  }
  return conditions.length ? `AND ${conditions.join(' AND ')}` : '';
};

export async function summary(_req, res) {
  try {
    const [[products]] = await pool.query('SELECT COUNT(*) AS totalProducts FROM products WHERE is_active = TRUE');
    const [[inventory]] = await pool.query('SELECT COALESCE(SUM(quantity), 0) AS totalInventoryUnits FROM inventory');
    const [[warehouses]] = await pool.query('SELECT COUNT(*) AS totalWarehouses FROM warehouses WHERE is_active = TRUE');
    const [[orders]] = await pool.query('SELECT COUNT(*) AS totalOrders FROM orders WHERE status <> "Cancelled"');
    const [[sales]] = await pool.query('SELECT COALESCE(SUM(total_amount), 0) AS totalSales FROM orders WHERE status <> "Cancelled"');
    const [[lowStock]] = await pool.query(`
      SELECT COUNT(*) AS lowStockProducts
      FROM (
        SELECT p.id
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.is_active = TRUE
        GROUP BY p.id, p.reorder_level
        HAVING COALESCE(SUM(i.quantity), 0) <= p.reorder_level
      ) low_stock
    `);
    res.json({
      totalProducts: Number(products.totalProducts),
      totalInventoryUnits: Number(inventory.totalInventoryUnits),
      totalWarehouses: Number(warehouses.totalWarehouses),
      totalOrders: Number(orders.totalOrders),
      totalSales: Number(sales.totalSales),
      lowStockProducts: Number(lowStock.lowStockProducts),
    });
  } catch (error) {
    console.error('Dashboard summary failed:', error);
    res.status(500).json({ message: 'Unable to load dashboard summary.' });
  }
}

export async function salesOverview(req, res) {
  const range = dateRange(req);
  const params = [];
  const where = rangeWhere('o.ordered_at', range, params);
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(o.ordered_at, '%Y-%m') AS month,
             COALESCE(SUM(o.total_amount), 0) AS sales,
             COUNT(*) AS orders
      FROM orders o
      WHERE o.status <> 'Cancelled' ${where}
      GROUP BY DATE_FORMAT(o.ordered_at, '%Y-%m')
      ORDER BY month
    `, params);
    res.json(rows.map((row) => ({ month: row.month, sales: Number(row.sales), orders: Number(row.orders) })));
  } catch (error) {
    console.error('Sales overview failed:', error);
    res.status(500).json({ message: 'Unable to load sales overview.' });
  }
}

export async function recentOrders(req, res) {
  const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit || '8', 10) || 8));
  try {
    const [rows] = await pool.query(`
      SELECT o.id, o.order_number AS orderNumber, c.name AS customerName,
             DATE_FORMAT(o.ordered_at, '%Y-%m-%d') AS orderDate,
             o.total_amount AS totalAmount, o.status
      FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.ordered_at DESC
      LIMIT ?
    `, [limit]);
    res.json(rows);
  } catch (error) {
    console.error('Recent orders failed:', error);
    res.status(500).json({ message: 'Unable to load recent orders.' });
  }
}

export async function topProducts(req, res) {
  const limit = Math.min(20, Math.max(1, Number.parseInt(req.query.limit || '5', 10) || 5));
  const range = dateRange(req);
  const params = [];
  const where = rangeWhere('o.ordered_at', range, params);
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.product_name AS productName, p.sku,
             SUM(oi.quantity) AS quantitySold,
             SUM(oi.line_total) AS sales
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      INNER JOIN products p ON p.id = oi.product_id
      WHERE o.status <> 'Cancelled' ${where}
      GROUP BY p.id, p.product_name, p.sku
      ORDER BY quantitySold DESC, sales DESC
      LIMIT ?
    `, [...params, limit]);
    res.json(rows.map((row) => ({ ...row, quantitySold: Number(row.quantitySold), sales: Number(row.sales) })));
  } catch (error) {
    console.error('Top products failed:', error);
    res.status(500).json({ message: 'Unable to load top products.' });
  }
}

export async function lowStock(req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.product_name AS productName, p.sku,
             COALESCE(SUM(i.quantity), 0) AS availableStock,
             p.reorder_level AS reorderLevel,
             COALESCE(c.name, p.category) AS category
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = TRUE
      GROUP BY p.id, p.product_name, p.sku, p.reorder_level, c.name, p.category
      HAVING COALESCE(SUM(i.quantity), 0) <= p.reorder_level
      ORDER BY availableStock ASC, p.product_name
    `);
    res.json(rows.map((row) => ({ ...row, availableStock: Number(row.availableStock), reorderLevel: Number(row.reorderLevel) })));
  } catch (error) {
    console.error('Dashboard low stock failed:', error);
    res.status(500).json({ message: 'Unable to load low stock products.' });
  }
}

export async function inventoryOverview(_req, res) {
  try {
    const [rows] = await pool.query(`
      SELECT COALESCE(c.name, p.category, 'Uncategorized') AS category,
             COALESCE(SUM(i.quantity), 0) AS units
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN inventory i ON i.product_id = p.id
      WHERE p.is_active = TRUE
      GROUP BY COALESCE(c.name, p.category, 'Uncategorized')
      ORDER BY units DESC
    `);
    const total = rows.reduce((sum, row) => sum + Number(row.units), 0);
    res.json(rows.map((row) => ({ category: row.category, units: Number(row.units), percentage: total ? Math.round((Number(row.units) / total) * 1000) / 10 : 0 })));
  } catch (error) {
    console.error('Inventory overview failed:', error);
    res.status(500).json({ message: 'Unable to load inventory overview.' });
  }
}

export async function purchaseOverview(req, res) {
  const range = dateRange(req);
  const params = [];
  const where = rangeWhere('po.ordered_at', range, params);
  try {
    const [rows] = await pool.query(`
      SELECT DATE_FORMAT(po.ordered_at, '%Y-%m') AS month,
             COUNT(*) AS purchaseOrders,
             COALESCE(SUM(po.total_amount), 0) AS purchaseAmount
      FROM purchase_orders po
      WHERE po.status <> 'Cancelled' ${where}
      GROUP BY DATE_FORMAT(po.ordered_at, '%Y-%m')
      ORDER BY month
    `, params);
    res.json(rows.map((row) => ({ month: row.month, purchaseOrders: Number(row.purchaseOrders), purchaseAmount: Number(row.purchaseAmount) })));
  } catch (error) {
    console.error('Purchase overview failed:', error);
    res.status(500).json({ message: 'Unable to load purchase overview.' });
  }
}
