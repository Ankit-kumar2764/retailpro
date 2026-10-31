import pool from '../config/db.js';

const warehouseFields = `
  w.id,
  w.name,
  w.code,
  w.location,
  w.address,
  w.contact_number AS contactNumber,
  w.capacity,
  w.manager_user_id AS managerUserId,
  u.name AS managerName,
  w.is_active AS isActive,
  COALESCE(SUM(i.quantity), 0) AS totalStock,
  COUNT(DISTINCT i.product_id) AS productCount,
  DATE_FORMAT(w.created_at, '%Y-%m-%d') AS createdDate
`;
const warehouseFrom = 'FROM warehouses w LEFT JOIN users u ON u.id = w.manager_user_id LEFT JOIN inventory i ON i.warehouse_id = w.id';

function validateWarehouse(body) {
  if (!String(body.name ?? '').trim() || !String(body.code ?? '').trim()) return 'Warehouse name and code are required.';
  if (!Number.isInteger(Number(body.capacity)) || Number(body.capacity) < 0) return 'Capacity must be a non-negative whole number.';
  if (body.managerUserId !== undefined && body.managerUserId !== '' && !Number.isInteger(Number(body.managerUserId))) return 'managerUserId must be a valid user ID.';
  return null;
}

export async function listWarehouses(req, res) {
  const search = String(req.query.search || '').trim();
  const params = [];
  const where = search ? 'WHERE w.name LIKE ? OR w.code LIKE ? OR w.location LIKE ? OR u.name LIKE ?' : '';
  if (search) params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  try {
    const [rows] = await pool.query(`SELECT ${warehouseFields} ${warehouseFrom} ${where} GROUP BY w.id ORDER BY w.created_at DESC`, params);
    res.json(rows);
  } catch (error) {
    console.error('List warehouses failed:', error);
    res.status(500).json({ message: 'Unable to load warehouses.' });
  }
}

export async function getWarehouse(req, res) {
  try {
    const [rows] = await pool.query(`SELECT ${warehouseFields} ${warehouseFrom} WHERE w.id = ? GROUP BY w.id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Warehouse not found.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Get warehouse failed:', error);
    res.status(500).json({ message: 'Unable to load warehouse.' });
  }
}

export async function createWarehouse(req, res) {
  const validationError = validateWarehouse(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  try {
    const [result] = await pool.execute(
      `INSERT INTO warehouses (name, code, location, address, contact_number, capacity, manager_user_id, is_active)
       VALUES (?, ?, ?, ?, ?, ?, NULLIF(?, ''), ?)`,
      [String(req.body.name).trim(), String(req.body.code).trim(), String(req.body.location ?? '').trim(), String(req.body.address ?? '').trim(), String(req.body.contactNumber ?? '').trim(), Number(req.body.capacity), String(req.body.managerUserId ?? ''), req.body.isActive === undefined ? true : Boolean(req.body.isActive)],
    );
    const [rows] = await pool.query(`SELECT ${warehouseFields} ${warehouseFrom} WHERE w.id = ? GROUP BY w.id`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create warehouse failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Warehouse code must be unique.' });
    if (error.code === 'ER_NO_REFERENCED_ROW_2') return res.status(400).json({ message: 'Manager user was not found.' });
    res.status(500).json({ message: 'Unable to create warehouse.' });
  }
}

export async function updateWarehouse(req, res) {
  const validationError = validateWarehouse(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  try {
    const [result] = await pool.execute(
      `UPDATE warehouses SET name = ?, code = ?, location = ?, address = ?, contact_number = ?,
       capacity = ?, manager_user_id = NULLIF(?, ''), is_active = ? WHERE id = ?`,
      [String(req.body.name).trim(), String(req.body.code).trim(), String(req.body.location ?? '').trim(), String(req.body.address ?? '').trim(), String(req.body.contactNumber ?? '').trim(), Number(req.body.capacity), String(req.body.managerUserId ?? ''), req.body.isActive === undefined ? true : Boolean(req.body.isActive), req.params.id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Warehouse not found.' });
    const [rows] = await pool.query(`SELECT ${warehouseFields} ${warehouseFrom} WHERE w.id = ? GROUP BY w.id`, [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Update warehouse failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Warehouse code must be unique.' });
    res.status(500).json({ message: 'Unable to update warehouse.' });
  }
}

export async function deleteWarehouse(req, res) {
  try {
    const [result] = await pool.execute('DELETE FROM warehouses WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Warehouse not found.' });
    res.status(204).send();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ message: 'Warehouse cannot be deleted while inventory or operational records reference it.' });
    console.error('Delete warehouse failed:', error);
    res.status(500).json({ message: 'Unable to delete warehouse.' });
  }
}
