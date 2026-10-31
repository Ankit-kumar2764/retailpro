import pool from '../config/db.js';

const statuses = ['Draft', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const summaryFields = `
  o.id, o.order_number AS orderNumber, o.customer_id AS customerId, c.name AS customerName,
  c.email AS customerEmail, o.warehouse_id AS warehouseId, w.name AS warehouseName,
  o.status, o.total_amount AS totalAmount,
  DATE_FORMAT(o.ordered_at, '%Y-%m-%d') AS orderDate, o.ordered_at AS orderedAt
`;

function validId(value) {
  return Number.isInteger(Number(value)) && Number(value) > 0;
}

function validateOrder(body) {
  if (!validId(body.warehouseId)) return 'A valid warehouse is required.';
  if (!validId(body.customerId) && (!body.customer || !String(body.customer.name ?? '').trim())) return 'Select a customer or provide a customer name.';
  if (!Array.isArray(body.items) || !body.items.length) return 'At least one product item is required.';
  const seen = new Set();
  for (const item of body.items) {
    if (!validId(item.productId) || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0
      || item.unitPrice === undefined || item.unitPrice === '' || !Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0) {
      return 'Each item needs a valid product, positive quantity, and non-negative unit price.';
    }
    if (seen.has(Number(item.productId))) return 'A product can appear only once per order.';
    seen.add(Number(item.productId));
  }
  return null;
}

function generatedNumber() {
  return `ORD-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${Date.now().toString().slice(-6)}`;
}

async function getDetails(connection, id) {
  const [orders] = await connection.query(
    `SELECT ${summaryFields} FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     LEFT JOIN warehouses w ON w.id = o.warehouse_id
     WHERE o.id = ?`,
    [id],
  );
  if (!orders.length) return null;
  const [items] = await connection.query(
    `SELECT oi.id, oi.product_id AS productId, p.product_name AS productName, p.sku,
            oi.quantity, oi.unit_price AS unitPrice, oi.line_total AS lineTotal
     FROM order_items oi INNER JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ? ORDER BY oi.id`,
    [id],
  );
  return { ...orders[0], items };
}

async function resolveCustomer(connection, body) {
  if (validId(body.customerId)) {
    const [rows] = await connection.execute('SELECT id FROM customers WHERE id = ? FOR UPDATE', [body.customerId]);
    if (!rows.length) return null;
    return Number(body.customerId);
  }
  const customer = body.customer || {};
  const email = String(customer.email ?? '').trim().toLowerCase();
  if (email) {
    const [existing] = await connection.execute('SELECT id FROM customers WHERE email = ? FOR UPDATE', [email]);
    if (existing.length) return existing[0].id;
  }
  const [result] = await connection.execute(
    'INSERT INTO customers (name, email, phone, address) VALUES (?, NULLIF(?, \'\'), ?, ?)',
    [String(customer.name).trim(), email, String(customer.phone ?? '').trim(), String(customer.address ?? '').trim()],
  );
  return result.insertId;
}

async function validateReferences(connection, body) {
  const [warehouse] = await connection.execute('SELECT id FROM warehouses WHERE id = ? AND is_active = TRUE FOR UPDATE', [body.warehouseId]);
  if (!warehouse.length) return 'Active warehouse was not found.';
  const ids = body.items.map((item) => item.productId);
  const [products] = await connection.query(`SELECT id FROM products WHERE is_active = TRUE AND id IN (${ids.map(() => '?').join(',')})`, ids);
  if (products.length !== ids.length) return 'One or more active products were not found.';
  return null;
}

function stockValidationError(current, requested) {
  return current < requested ? `Insufficient stock. Available: ${current}, requested: ${requested}.` : null;
}

async function checkOrderStock(connection, orderId, warehouseId) {
  const [items] = await connection.execute(
    `SELECT oi.product_id AS productId, oi.quantity, p.product_name AS productName,
            COALESCE(i.quantity, 0) AS available
     FROM order_items oi INNER JOIN products p ON p.id = oi.product_id
     LEFT JOIN inventory i ON i.product_id = oi.product_id AND i.warehouse_id = ?
     WHERE oi.order_id = ? FOR UPDATE`,
    [warehouseId, orderId],
  );
  const shortage = items.find((item) => Number(item.available) < Number(item.quantity));
  return shortage ? stockValidationError(Number(shortage.available), Number(shortage.quantity)).replace('Insufficient stock.', `Insufficient stock for ${shortage.productName}.`) : null;
}

async function changeReservedStock(connection, orderId, warehouseId, direction) {
  const [items] = await connection.execute('SELECT product_id AS productId, quantity FROM order_items WHERE order_id = ? FOR UPDATE', [orderId]);
  for (const item of items) {
    const [inventory] = await connection.execute(
      'SELECT id, quantity, reorder_level FROM inventory WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
      [item.productId, warehouseId],
    );
    if (direction < 0 && (!inventory.length || inventory[0].quantity < item.quantity)) {
      throw Object.assign(new Error('Insufficient stock for order processing.'), { statusCode: 409 });
    }
    if (inventory.length) {
      await connection.execute('UPDATE inventory SET quantity = quantity + ? WHERE id = ?', [direction * item.quantity, inventory[0].id]);
    } else if (direction > 0) {
      const [product] = await connection.execute('SELECT reorder_level FROM products WHERE id = ?', [item.productId]);
      await connection.execute('INSERT INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, ?)', [item.productId, warehouseId, item.quantity, product[0]?.reorder_level || 0]);
    }
  }
}

async function updateStatus(connection, id, status) {
  const [orders] = await connection.execute('SELECT id, status, warehouse_id AS warehouseId FROM orders WHERE id = ? FOR UPDATE', [id]);
  if (!orders.length) return { error: { code: 404, message: 'Order not found.' } };
  const current = orders[0];
  const transitions = {
    Draft: ['Pending', 'Cancelled'],
    Pending: ['Confirmed', 'Draft', 'Cancelled'],
    Confirmed: ['Processing', 'Cancelled'],
    Processing: ['Shipped', 'Cancelled'],
    Shipped: ['Delivered'],
    Delivered: [],
    Cancelled: [],
  };
  if (!transitions[current.status].includes(status)) return { error: { code: 409, message: `Order cannot move from ${current.status} to ${status}.` } };
  if (status === 'Confirmed') {
    const shortage = await checkOrderStock(connection, id, current.warehouseId);
    if (shortage) return { error: { code: 409, message: shortage } };
  }
  if (status === 'Processing') await changeReservedStock(connection, id, current.warehouseId, -1);
  if (status === 'Cancelled' && current.status === 'Processing') await changeReservedStock(connection, id, current.warehouseId, 1);
  await connection.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
  return {};
}

export async function listOrders(req, res) {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const conditions = []; const params = [];
  if (statuses.includes(status)) { conditions.push('o.status = ?'); params.push(status); }
  if (search) { conditions.push('(o.order_number LIKE ? OR c.name LIKE ? OR w.name LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  try {
    const [rows] = await pool.query(`SELECT ${summaryFields} FROM orders o INNER JOIN customers c ON c.id = o.customer_id LEFT JOIN warehouses w ON w.id = o.warehouse_id ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY o.created_at DESC`, params);
    res.json(rows);
  } catch (error) {
    console.error('List orders failed:', error);
    res.status(500).json({ message: 'Unable to load orders.' });
  }
}

export async function getOrder(req, res) {
  try {
    const order = await getDetails(pool, req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    res.json(order);
  } catch (error) {
    console.error('Get order failed:', error);
    res.status(500).json({ message: 'Unable to load order.' });
  }
}

export async function createOrder(req, res) {
  const validationError = validateOrder(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const customerId = await resolveCustomer(connection, req.body);
    if (!customerId) return await connection.rollback().then(() => res.status(400).json({ message: 'Customer was not found.' }));
    const referenceError = await validateReferences(connection, req.body);
    if (referenceError) return await connection.rollback().then(() => res.status(400).json({ message: referenceError }));
    const total = req.body.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
    const [result] = await connection.execute('INSERT INTO orders (order_number, customer_id, warehouse_id, status, total_amount) VALUES (?, ?, ?, ?, ?)', [generatedNumber(), customerId, req.body.warehouseId, 'Draft', total]);
    for (const item of req.body.items) await connection.execute('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [result.insertId, item.productId, item.quantity, item.unitPrice]);
    await connection.commit();
    res.status(201).json(await getDetails(pool, result.insertId));
  } catch (error) {
    await connection.rollback();
    console.error('Create order failed:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to create order.' });
  } finally { connection.release(); }
}

export async function updateOrder(req, res) {
  const validationError = validateOrder(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT status FROM orders WHERE id = ? FOR UPDATE', [req.params.id]);
    if (!existing.length) return await connection.rollback().then(() => res.status(404).json({ message: 'Order not found.' }));
    if (existing[0].status !== 'Draft') return await connection.rollback().then(() => res.status(409).json({ message: 'Only Draft orders can be edited.' }));
    const customerId = await resolveCustomer(connection, req.body);
    if (!customerId) return await connection.rollback().then(() => res.status(400).json({ message: 'Customer was not found.' }));
    const referenceError = await validateReferences(connection, req.body);
    if (referenceError) return await connection.rollback().then(() => res.status(400).json({ message: referenceError }));
    const total = req.body.items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);
    await connection.execute('UPDATE orders SET customer_id = ?, warehouse_id = ?, total_amount = ? WHERE id = ?', [customerId, req.body.warehouseId, total, req.params.id]);
    await connection.execute('DELETE FROM order_items WHERE order_id = ?', [req.params.id]);
    for (const item of req.body.items) await connection.execute('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [req.params.id, item.productId, item.quantity, item.unitPrice]);
    await connection.commit();
    res.json(await getDetails(pool, req.params.id));
  } catch (error) {
    await connection.rollback();
    console.error('Update order failed:', error);
    res.status(500).json({ message: 'Unable to update order.' });
  } finally { connection.release(); }
}

export async function updateOrderStatus(req, res) {
  const status = String(req.body.status || '');
  if (!statuses.includes(status)) return res.status(400).json({ message: `Status must be one of: ${statuses.join(', ')}.` });
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await updateStatus(connection, req.params.id, status);
    if (result.error) return await connection.rollback().then(() => res.status(result.error.code).json({ message: result.error.message }));
    await connection.commit();
    res.json(await getDetails(pool, req.params.id));
  } catch (error) {
    await connection.rollback();
    console.error('Update order status failed:', error);
    res.status(error.statusCode || 500).json({ message: error.statusCode ? error.message : 'Unable to update order status.' });
  } finally { connection.release(); }
}

export async function deleteOrder(req, res) {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute('SELECT status FROM orders WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Order not found.' });
    if (!['Draft', 'Cancelled'].includes(rows[0].status)) return res.status(409).json({ message: 'Only Draft or Cancelled orders can be deleted.' });
    const [result] = await connection.execute('DELETE FROM orders WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Order not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('Delete order failed:', error);
    res.status(500).json({ message: 'Unable to delete order.' });
  } finally { connection.release(); }
}

export async function listFulfillment(req, res) {
  req.query.status = req.query.status || '';
  return listOrders(req, res);
}

export async function getFulfillment(req, res) {
  return getOrder(req, res);
}

export async function updateFulfillmentStatus(req, res) {
  return updateOrderStatus(req, res);
}
