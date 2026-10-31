import pool from '../config/db.js';

const inventoryFields = `
  i.id,
  i.product_id AS productId,
  p.product_name AS productName,
  p.sku,
  i.warehouse_id AS warehouseId,
  w.name AS warehouseName,
  i.quantity,
  i.reorder_level AS reorderLevel,
  CASE WHEN i.quantity = 0 THEN 'Out of Stock' WHEN i.quantity <= i.reorder_level THEN 'Low Stock' ELSE 'In Stock' END AS status
`;

function positiveInteger(value, field) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) return `${field} must be a positive whole number.`;
  return null;
}

export async function listInventory(req, res) {
  const params = [];
  const conditions = [];
  if (req.query.productId) { conditions.push('i.product_id = ?'); params.push(req.query.productId); }
  if (req.query.warehouseId) { conditions.push('i.warehouse_id = ?'); params.push(req.query.warehouseId); }
  if (req.query.search) { conditions.push('(p.product_name LIKE ? OR p.sku LIKE ? OR w.name LIKE ?)'); const term = `%${String(req.query.search).trim()}%`; params.push(term, term, term); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(`SELECT ${inventoryFields} FROM inventory i INNER JOIN products p ON p.id = i.product_id INNER JOIN warehouses w ON w.id = i.warehouse_id ${where} ORDER BY p.product_name, w.name`, params);
    res.json(rows);
  } catch (error) {
    console.error('List inventory failed:', error);
    res.status(500).json({ message: 'Unable to load inventory.' });
  }
}

export async function getInventory(req, res) {
  try {
    const [rows] = await pool.query(`SELECT ${inventoryFields} FROM inventory i INNER JOIN products p ON p.id = i.product_id INNER JOIN warehouses w ON w.id = i.warehouse_id WHERE i.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Inventory record not found.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Get inventory failed:', error);
    res.status(500).json({ message: 'Unable to load inventory record.' });
  }
}

export async function lowStock(req, res) {
  try {
    const [rows] = await pool.query(`SELECT ${inventoryFields} FROM inventory i INNER JOIN products p ON p.id = i.product_id INNER JOIN warehouses w ON w.id = i.warehouse_id WHERE i.quantity <= i.reorder_level ORDER BY i.quantity ASC`);
    res.json(rows);
  } catch (error) {
    console.error('Low stock query failed:', error);
    res.status(500).json({ message: 'Unable to load low stock alerts.' });
  }
}

export async function adjustStock(req, res) {
  const quantityError = positiveInteger(Math.abs(Number(req.body.quantityChange)), 'quantityChange');
  if (quantityError || !Number.isInteger(Number(req.body.quantityChange)) || Number(req.body.quantityChange) === 0 || !String(req.body.reason ?? '').trim()) {
    return res.status(400).json({ message: quantityError || 'quantityChange must be a non-zero whole number and reason is required.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, quantity, reorder_level FROM inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE', [req.body.productId, req.body.warehouseId]);
    let inventoryId;
    let currentQuantity = 0;
    if (rows.length) {
      inventoryId = rows[0].id;
      currentQuantity = rows[0].quantity;
    } else {
      if (Number(req.body.quantityChange) < 0) return await connection.rollback().then(() => res.status(404).json({ message: 'Inventory record not found for this product and warehouse.' }));
      const [productRows] = await connection.execute('SELECT id, reorder_level FROM products WHERE id = ? AND is_active = TRUE FOR UPDATE', [req.body.productId]);
      const [warehouseRows] = await connection.execute('SELECT id FROM warehouses WHERE id = ? AND is_active = TRUE FOR UPDATE', [req.body.warehouseId]);
      if (!productRows.length || !warehouseRows.length) return await connection.rollback().then(() => res.status(404).json({ message: 'Product or warehouse not found.' }));
      const [inserted] = await connection.execute('INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, ?)', [req.body.productId, req.body.warehouseId, 0, productRows[0].reorder_level || 0]);
      inventoryId = inserted.insertId;
    }
    const nextQuantity = currentQuantity + Number(req.body.quantityChange);
    if (nextQuantity < 0) return await connection.rollback().then(() => res.status(400).json({ message: 'Stock cannot become negative.' }));
    await connection.execute('UPDATE inventory SET quantity = ? WHERE id = ?', [nextQuantity, inventoryId]);
    const [adjustment] = await connection.execute('INSERT INTO stock_adjustments (product_id, warehouse_id, quantity_change, reason, created_by) VALUES (?, ?, ?, ?, ?)', [req.body.productId, req.body.warehouseId, Number(req.body.quantityChange), String(req.body.reason).trim(), req.user.id]);
    await connection.commit();
    res.status(201).json({ message: 'Stock adjusted successfully.', adjustmentId: adjustment.insertId, quantity: nextQuantity });
  } catch (error) {
    await connection.rollback();
    console.error('Adjust stock failed:', error);
    res.status(500).json({ message: 'Unable to adjust stock.' });
  } finally { connection.release(); }
}

export async function transferStock(req, res) {
  const quantityError = positiveInteger(req.body.quantity, 'quantity');
  if (quantityError || !req.body.productId || !req.body.fromWarehouseId || !req.body.toWarehouseId || Number(req.body.fromWarehouseId) === Number(req.body.toWarehouseId)) {
    return res.status(400).json({ message: quantityError || 'Valid product, source warehouse, destination warehouse are required and must differ.' });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [product] = await connection.execute('SELECT id FROM products WHERE id = ? AND is_active = TRUE FOR UPDATE', [req.body.productId]);
    if (!product.length) return await connection.rollback().then(() => res.status(404).json({ message: 'Product not found.' }));
    const [warehouses] = await connection.execute('SELECT id FROM warehouses WHERE id IN (?, ?) AND is_active = TRUE FOR UPDATE', [req.body.fromWarehouseId, req.body.toWarehouseId]);
    if (warehouses.length !== 2) return await connection.rollback().then(() => res.status(404).json({ message: 'Source or destination warehouse not found.' }));
    const [source] = await connection.execute('SELECT id, quantity FROM inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE', [req.body.productId, req.body.fromWarehouseId]);
    if (!source.length || source[0].quantity < Number(req.body.quantity)) return await connection.rollback().then(() => res.status(400).json({ message: 'Insufficient source stock.' }));
    await connection.execute('UPDATE inventory SET quantity = quantity - ? WHERE id = ?', [Number(req.body.quantity), source[0].id]);
    await connection.execute(`INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`, [req.body.productId, req.body.toWarehouseId, Number(req.body.quantity)]);
    const [transfer] = await connection.execute('INSERT INTO stock_transfers (product_id, from_warehouse_id, to_warehouse_id, quantity, status, notes, created_by) VALUES (?, ?, ?, ?, "Completed", ?, ?)', [req.body.productId, req.body.fromWarehouseId, req.body.toWarehouseId, Number(req.body.quantity), String(req.body.notes ?? '').trim(), req.user.id]);
    await connection.commit();
    res.status(201).json({ message: 'Stock transferred successfully.', transferId: transfer.insertId });
  } catch (error) {
    await connection.rollback();
    console.error('Transfer stock failed:', error);
    res.status(500).json({ message: 'Unable to transfer stock.' });
  } finally { connection.release(); }
}
