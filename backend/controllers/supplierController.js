import pool from '../config/db.js';

function validateSupplier(body) {
  if (!String(body.name ?? '').trim()) return 'Supplier name is required.';
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) return 'Please provide a valid email address.';
  return null;
}

const fields = `id, name, contact_person AS contactPerson, email, phone, address, city, is_active AS isActive,
  DATE_FORMAT(created_at, '%Y-%m-%d') AS createdDate`;

export async function listSuppliers(req, res) {
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || '').trim();
  const conditions = [];
  const params = [];
  if (search) {
    conditions.push('(name LIKE ? OR contact_person LIKE ? OR email LIKE ? OR phone LIKE ? OR city LIKE ?)');
    params.push(...Array(5).fill(`%${search}%`));
  }
  if (status === 'active' || status === 'inactive') {
    conditions.push('is_active = ?');
    params.push(status === 'active');
  }
  try {
    const [rows] = await pool.query(`SELECT ${fields} FROM suppliers ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC`, params);
    res.json(rows);
  } catch (error) {
    console.error('List suppliers failed:', error);
    res.status(500).json({ message: 'Unable to load suppliers.' });
  }
}

export async function getSupplier(req, res) {
  try {
    const [rows] = await pool.query(`SELECT ${fields} FROM suppliers WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Supplier not found.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('Get supplier failed:', error);
    res.status(500).json({ message: 'Unable to load supplier.' });
  }
}

export async function createSupplier(req, res) {
  const validationError = validateSupplier(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  try {
    const [result] = await pool.execute(
      `INSERT INTO suppliers (name, contact_person, email, phone, address, city, is_active)
       VALUES (?, ?, NULLIF(?, ''), ?, ?, ?, ?)`,
      [String(req.body.name).trim(), String(req.body.contactPerson ?? '').trim(), String(req.body.email ?? '').trim().toLowerCase(), String(req.body.phone ?? '').trim(), String(req.body.address ?? '').trim(), String(req.body.city ?? '').trim(), req.body.isActive === undefined ? true : Boolean(req.body.isActive)],
    );
    const [rows] = await pool.query(`SELECT ${fields} FROM suppliers WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create supplier failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Supplier email must be unique.' });
    res.status(500).json({ message: 'Unable to create supplier.' });
  }
}

export async function updateSupplier(req, res) {
  const validationError = validateSupplier(req.body);
  if (validationError) return res.status(400).json({ message: validationError });
  try {
    const [result] = await pool.execute(
      `UPDATE suppliers SET name = ?, contact_person = ?, email = NULLIF(?, ''), phone = ?, address = ?, city = ?, is_active = ? WHERE id = ?`,
      [String(req.body.name).trim(), String(req.body.contactPerson ?? '').trim(), String(req.body.email ?? '').trim().toLowerCase(), String(req.body.phone ?? '').trim(), String(req.body.address ?? '').trim(), String(req.body.city ?? '').trim(), req.body.isActive === undefined ? true : Boolean(req.body.isActive), req.params.id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Supplier not found.' });
    const [rows] = await pool.query(`SELECT ${fields} FROM suppliers WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('Update supplier failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Supplier email must be unique.' });
    res.status(500).json({ message: 'Unable to update supplier.' });
  }
}

export async function deleteSupplier(req, res) {
  try {
    const [result] = await pool.execute('UPDATE suppliers SET is_active = FALSE WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Supplier not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('Deactivate supplier failed:', error);
    res.status(500).json({ message: 'Unable to deactivate supplier.' });
  }
}
