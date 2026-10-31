import pool from '../config/db.js';

export async function listCustomers(_req, res) {
  try {
    const [rows] = await pool.query('SELECT id, name, email, phone, address FROM customers ORDER BY name');
    res.json(rows);
  } catch (error) {
    console.error('List customers failed:', error);
    res.status(500).json({ message: 'Unable to load customers.' });
  }
}
