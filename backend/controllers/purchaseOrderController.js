import pool from '../config/db.js';

const statuses = ['Draft', 'Pending', 'Approved', 'Ordered', 'Partially Received', 'Received', 'Cancelled'];
const summaryFields = `
  po.id, po.po_number AS poNumber, po.supplier_id AS supplierId, s.name AS supplierName,
  po.warehouse_id AS warehouseId, w.name AS warehouseName, po.status, po.total_amount AS totalAmount,
  DATE_FORMAT(po.ordered_at, '%Y-%m-%d') AS orderedDate, po.received_at AS receivedAt
`;

function positiveInteger(value, field) {
  if (!Number.isInteger(Number(value)) || Number(value) <= 0) return `${field} must be a positive whole number.`;
  return null;
}

function validateOrder(body) {
  if (!Number.isInteger(Number(body.supplierId)) || Number(body.supplierId) <= 0
    || !Number.isInteger(Number(body.warehouseId)) || Number(body.warehouseId) <= 0) {
    return 'A valid supplier and warehouse are required.';
  }
  if (!Array.isArray(body.items) || !body.items.length) return 'At least one product item is required.';
  const seen = new Set();
  for (const item of body.items) {
    const quantityError = positiveInteger(item.quantityOrdered ?? item.quantity, 'quantity');
    if (!Number.isInteger(Number(item.productId)) || Number(item.productId) <= 0
      || quantityError || item.unitCost === undefined || item.unitCost === ''
      || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0) {
      return quantityError || 'Each item needs a valid product, quantity, and purchase price.';
    }
    if (seen.has(Number(item.productId))) return 'A product can appear only once per purchase order.';
    seen.add(Number(item.productId));
  }
  return null;
}

function validateCreateStatus(status) {
  return status === undefined || status === '' || status === 'Draft'
    ? null
    : 'Purchase orders must be created as Draft.';
}

function generatedNumber() {
  return `PO-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-6)}`;
}

async function orderDetails(connection, id) {
  const [orders] = await connection.query(`SELECT ${summaryFields} FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id JOIN warehouses w ON w.id = po.warehouse_id WHERE po.id = ?`, [id]);
  if (!orders.length) return null;
  const [items] = await connection.query(
    `SELECT poi.id, poi.product_id AS productId, p.product_name AS productName, p.sku, poi.quantity_ordered AS quantityOrdered,
            poi.quantity_received AS quantityReceived, poi.unit_cost AS unitCost, poi.line_total AS lineTotal
     FROM purchase_order_items poi JOIN products p ON p.id = poi.product_id WHERE poi.purchase_order_id = ? ORDER BY poi.id`,
    [id],
  );
  return { ...orders[0], items };
}

export async function listPurchaseOrders(req, res) {
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim();
  const conditions = []; const params = [];
  if (status && statuses.includes(status)) { conditions.push('po.status = ?'); params.push(status); }
  if (search) { conditions.push('(po.po_number LIKE ? OR s.name LIKE ? OR w.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  try {
    const [rows] = await pool.query(`SELECT ${summaryFields} FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id JOIN warehouses w ON w.id = po.warehouse_id ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY po.created_at DESC`, params);
    res.json(rows);
  } catch (error) {
    console.error('List purchase orders failed:', error);
    res.status(500).json({ message: 'Unable to load purchase orders.' });
  }
}

export async function getPurchaseOrder(req, res) {
  try {
    const order = await orderDetails(pool, req.params.id);
    if (!order) return res.status(404).json({ message: 'Purchase order not found.' });
    res.json(order);
  } catch (error) {
    console.error('Get purchase order failed:', error);
    res.status(500).json({ message: 'Unable to load purchase order.' });
  }
}

export async function createPurchaseOrder(req, res) {
  const validationError = validateOrder(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  const statusError = validateCreateStatus(req.body.status);
  if (statusError) return res.status(400).json({ message: statusError });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [supplier] = await connection.execute('SELECT id FROM suppliers WHERE id = ? AND is_active = TRUE FOR UPDATE', [req.body.supplierId]);
    const [warehouse] = await connection.execute('SELECT id FROM warehouses WHERE id = ? AND is_active = TRUE FOR UPDATE', [req.body.warehouseId]);
    if (!supplier.length || !warehouse.length) return await connection.rollback().then(() => res.status(400).json({ message: 'Active supplier or warehouse was not found.' }));
    const productIds = req.body.items.map((item) => item.productId);
    const placeholders = productIds.map(() => '?').join(',');
    const [products] = await connection.query(`SELECT id FROM products WHERE is_active = TRUE AND id IN (${placeholders})`, productIds);
    if (products.length !== productIds.length) return await connection.rollback().then(() => res.status(400).json({ message: 'One or more active products were not found.' }));
    const total = req.body.items.reduce((sum, item) => sum + Number(item.quantityOrdered ?? item.quantity) * Number(item.unitCost), 0);
    const [result] = await connection.execute('INSERT INTO purchase_orders (po_number, supplier_id, warehouse_id, status, total_amount) VALUES (?, ?, ?, ?, ?)', [generatedNumber(), req.body.supplierId, req.body.warehouseId, 'Draft', total]);
    for (const item of req.body.items) await connection.execute('INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, unit_cost) VALUES (?, ?, ?, ?)', [result.insertId, item.productId, Number(item.quantityOrdered ?? item.quantity), Number(item.unitCost)]);
    await connection.commit();
    res.status(201).json(await orderDetails(pool, result.insertId));
  } catch (error) {
    await connection.rollback();
    console.error('Create purchase order failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Purchase order number already exists.' });
    res.status(500).json({ message: 'Unable to create purchase order.' });
  } finally { connection.release(); }
}

export async function updatePurchaseOrder(req, res) {
  const validationError = validateOrder(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id, status FROM purchase_orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!existing.length) return await connection.rollback().then(() => res.status(404).json({ message: 'Purchase order not found.' }));
    if (existing[0].status !== 'Draft') return await connection.rollback().then(() => res.status(409).json({ message: 'Only Draft purchase orders can be edited.' }));
    const [supplier] = await connection.execute('SELECT id FROM suppliers WHERE id = ? AND is_active = TRUE FOR UPDATE', [req.body.supplierId]);
    const [warehouse] = await connection.execute('SELECT id FROM warehouses WHERE id = ? AND is_active = TRUE FOR UPDATE', [req.body.warehouseId]);
    if (!supplier.length || !warehouse.length) return await connection.rollback().then(() => res.status(400).json({ message: 'Active supplier or warehouse was not found.' }));
    const productIds = req.body.items.map((item) => item.productId);
    const placeholders = productIds.map(() => '?').join(',');
    const [products] = await connection.query(`SELECT id FROM products WHERE is_active = TRUE AND id IN (${placeholders})`, productIds);
    if (products.length !== productIds.length) return await connection.rollback().then(() => res.status(400).json({ message: 'One or more active products were not found.' }));
    await connection.execute('UPDATE purchase_orders SET supplier_id = ?, warehouse_id = ?, total_amount = ? WHERE id = ?', [req.body.supplierId, req.body.warehouseId, req.body.items.reduce((sum, item) => sum + Number(item.quantityOrdered ?? item.quantity) * Number(item.unitCost), 0), req.params.id]);
    await connection.execute('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
    for (const item of req.body.items) await connection.execute('INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, unit_cost) VALUES (?, ?, ?, ?)', [req.params.id, item.productId, Number(item.quantityOrdered ?? item.quantity), Number(item.unitCost)]);
    await connection.commit(); res.json(await orderDetails(pool, req.params.id));
  } catch (error) { await connection.rollback(); console.error('Update purchase order failed:', error); res.status(500).json({ message: 'Unable to update purchase order.' }); } finally { connection.release(); }
}

export async function updatePurchaseOrderStatus(req, res) {
  const { status, receivedItems } = req.body;
  if (!statuses.includes(status)) return res.status(400).json({ message: `Status must be one of: ${statuses.join(', ')}.` });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute('SELECT id, status, warehouse_id FROM purchase_orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!orders.length) return await connection.rollback().then(() => res.status(404).json({ message: 'Purchase order not found.' }));
    const current = orders[0];
    if (current.status === 'Received' || current.status === 'Cancelled') return await connection.rollback().then(() => res.status(409).json({ message: `A ${current.status} purchase order cannot change status.` }));
    const [items] = await connection.execute('SELECT id, product_id, quantity_ordered, quantity_received, unit_cost FROM purchase_order_items WHERE purchase_order_id = ? FOR UPDATE', [req.params.id]);
    const requested = new Map((Array.isArray(receivedItems) ? receivedItems : []).map((item) => [Number(item.itemId), Number(item.quantityReceived)]));
    if (status === 'Received' || status === 'Partially Received') {
      for (const item of items) {
        const next = requested.has(item.id) ? requested.get(item.id) : (status === 'Received' ? item.quantity_ordered : item.quantity_received);
        if (!Number.isInteger(next) || next < item.quantity_received || next > item.quantity_ordered
          || (status === 'Received' && next !== item.quantity_ordered)) {
          return await connection.rollback().then(() => res.status(400).json({
            message: status === 'Received'
              ? 'All ordered quantities must be received before an order can be marked Received.'
              : 'Received quantities must be whole numbers between current and ordered quantities.',
          }));
        }
        const delta = next - item.quantity_received;
        if (delta > 0) {
          await connection.execute('INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) SELECT ?, ?, ?, reorder_level FROM products WHERE id = ? ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)', [item.product_id, current.warehouse_id, delta, item.product_id]);
          await connection.execute('UPDATE purchase_order_items SET quantity_received = ? WHERE id = ?', [next, item.id]);
        }
      }
    }
    await connection.execute('UPDATE purchase_orders SET status = ?, received_at = ? WHERE id = ?', [status, status === 'Received' ? new Date() : null, req.params.id]);
    await connection.commit(); res.json(await orderDetails(pool, req.params.id));
  } catch (error) { await connection.rollback(); console.error('Update purchase order status failed:', error); res.status(500).json({ message: 'Unable to update purchase order status.' }); } finally { connection.release(); }
}
