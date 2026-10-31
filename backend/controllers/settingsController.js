import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const roles = new Set(['Admin', 'Manager', 'Staff']);
let settingsStorageReady;
const userFields = `u.id, u.name, u.email, r.name AS role, u.is_active AS isActive,
  DATE_FORMAT(u.created_at, '%Y-%m-%d') AS createdDate, u.last_login_at AS lastLoginAt`;

function ensureSettingsStorage() {
  if (!settingsStorageReady) {
    settingsStorageReady = pool.query(`CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(60) NOT NULL PRIMARY KEY,
      setting_value VARCHAR(255) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`).then(() => pool.query(
      `INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
       ('companyName', 'RetailPro'), ('currency', 'USD'), ('dateFormat', 'YYYY-MM-DD')`,
    ));
  }
  return settingsStorageReady;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.isActive),
    createdDate: user.createdDate,
    lastLoginAt: user.lastLoginAt,
  };
}

function validateIdentity(body) {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  if (!name || !email || !emailPattern.test(email)) return 'A valid name and email are required.';
  return { name, email };
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8
    ? null
    : 'Password must be at least 8 characters.';
}

async function findUser(userId, connection = pool) {
  const [rows] = await connection.query(`SELECT ${userFields} FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = ?`, [userId]);
  return rows[0] || null;
}

export async function getSettingsProfile(req, res) {
  try {
    const user = await findUser(req.user.id);
    if (!user) return res.status(404).json({ message: 'User profile not found.' });
    res.json({ user: publicUser(user) });
  } catch (error) {
    console.error('Get settings profile failed:', error);
    res.status(500).json({ message: 'Unable to load profile.' });
  }
}

export async function updateSettingsProfile(req, res) {
  const identity = validateIdentity(req.body);
  if (!identity) return res.status(400).json({ message: 'A valid name and email are required.' });
  try {
    const [result] = await pool.execute('UPDATE users SET name = ?, email = ? WHERE id = ?', [identity.name, identity.email, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'User profile not found.' });
    const user = await findUser(req.user.id);
    res.json({ message: 'Profile updated successfully.', user: publicUser(user) });
  } catch (error) {
    console.error('Update settings profile failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email is already in use.' });
    res.status(500).json({ message: 'Unable to update profile.' });
  }
}

export async function changePassword(req, res) {
  const currentPassword = String(req.body.currentPassword ?? '');
  const newPassword = String(req.body.newPassword ?? '');
  const passwordError = validatePassword(newPassword);
  if (!currentPassword || passwordError || newPassword === currentPassword) {
    return res.status(400).json({ message: passwordError || 'Current and new passwords are required and must differ.' });
  }
  try {
    const [rows] = await pool.query('SELECT password_hash AS passwordHash FROM users WHERE id = ? AND is_active = TRUE', [req.user.id]);
    if (!rows.length || !(await bcrypt.compare(currentPassword, rows[0].passwordHash))) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, req.user.id]);
    res.json({ message: 'Password changed successfully. Please sign in again.' });
  } catch (error) {
    console.error('Change password failed:', error);
    res.status(500).json({ message: 'Unable to change password.' });
  }
}

export async function listUsers(_req, res) {
  try {
    const [rows] = await pool.query(`SELECT ${userFields} FROM users u INNER JOIN roles r ON r.id = u.role_id ORDER BY u.created_at DESC`);
    res.json(rows.map(publicUser));
  } catch (error) {
    console.error('List users failed:', error);
    res.status(500).json({ message: 'Unable to load users.' });
  }
}

export async function createUser(req, res) {
  const identity = validateIdentity(req.body);
  const passwordError = validatePassword(String(req.body.password ?? ''));
  const role = String(req.body.role || 'Staff');
  if (!identity || passwordError || !roles.has(role)) return res.status(400).json({ message: passwordError || 'Name, email, password, and valid role are required.' });
  try {
    const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!roleRows.length) return res.status(400).json({ message: 'Selected role was not found.' });
    const passwordHash = await bcrypt.hash(String(req.body.password), 12);
    const [result] = await pool.execute('INSERT INTO users (role_id, name, email, password_hash, is_active) VALUES (?, ?, ?, ?, ?)', [roleRows[0].id, identity.name, identity.email, passwordHash, req.body.isActive === undefined ? true : Boolean(req.body.isActive)]);
    res.status(201).json({ message: 'User created successfully.', user: publicUser(await findUser(result.insertId)) });
  } catch (error) {
    console.error('Create user failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email is already in use.' });
    res.status(500).json({ message: 'Unable to create user.' });
  }
}

export async function updateUser(req, res) {
  const identity = validateIdentity(req.body);
  const role = String(req.body.role || '');
  if (!identity || !roles.has(role)) return res.status(400).json({ message: 'Valid name, email, and role are required.' });
  if (Number(req.params.id) === req.user.id && (req.body.isActive === false || role !== 'Admin')) return res.status(400).json({ message: 'You cannot deactivate yourself or remove your Admin role.' });
  try {
    const [currentRows] = await pool.query('SELECT r.name AS role, u.is_active AS isActive FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE u.id = ?', [req.params.id]);
    if (!currentRows.length) return res.status(404).json({ message: 'User not found.' });
    if (currentRows[0].role === 'Admin' && (role !== 'Admin' || req.body.isActive === false)) {
      const [adminRows] = await pool.query("SELECT COUNT(*) AS count FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name = 'Admin' AND u.is_active = TRUE");
      if (adminRows[0].count <= 1) return res.status(400).json({ message: 'At least one active Admin account is required.' });
    }
    const [roleRows] = await pool.query('SELECT id FROM roles WHERE name = ?', [role]);
    if (!roleRows.length) return res.status(400).json({ message: 'Selected role was not found.' });
    const [result] = await pool.execute('UPDATE users SET role_id = ?, name = ?, email = ?, is_active = ? WHERE id = ?', [roleRows[0].id, identity.name, identity.email, req.body.isActive === undefined ? true : Boolean(req.body.isActive), req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
    res.json({ message: 'User updated successfully.', user: publicUser(await findUser(req.params.id)) });
  } catch (error) {
    console.error('Update user failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email is already in use.' });
    res.status(500).json({ message: 'Unable to update user.' });
  }
}

export async function deactivateUser(req, res) {
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ message: 'You cannot deactivate your own account.' });
  try {
    const [adminRows] = await pool.query(`SELECT COUNT(*) AS count
      FROM users u INNER JOIN roles r ON r.id = u.role_id
      WHERE r.name = 'Admin' AND u.is_active = TRUE AND u.id = ?`, [req.params.id]);
    if (adminRows[0].count) {
      const [activeAdmins] = await pool.query(`SELECT COUNT(*) AS count
        FROM users u INNER JOIN roles r ON r.id = u.role_id
        WHERE r.name = 'Admin' AND u.is_active = TRUE`);
      if (activeAdmins[0].count <= 1) return res.status(400).json({ message: 'At least one active Admin account is required.' });
    }
    const [result] = await pool.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'User not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('Deactivate user failed:', error);
    res.status(500).json({ message: 'Unable to deactivate user.' });
  }
}

export async function listRoles(_req, res) {
  try {
    const [rows] = await pool.query('SELECT id, name, description FROM roles ORDER BY id');
    res.json(rows);
  } catch (error) {
    console.error('List roles failed:', error);
    res.status(500).json({ message: 'Unable to load roles.' });
  }
}

export async function getSystemSettings(_req, res) {
  try {
    await ensureSettingsStorage();
    const [rows] = await pool.query('SELECT setting_key AS settingKey, setting_value AS settingValue FROM system_settings');
    res.json(Object.fromEntries(rows.map((row) => [row.settingKey, row.settingValue])));
  } catch (error) {
    console.error('Get system settings failed:', error);
    res.status(500).json({ message: 'Unable to load system settings.' });
  }
}

export async function updateSystemSettings(req, res) {
  const allowed = {
    companyName: String(req.body.companyName ?? '').trim(),
    currency: String(req.body.currency ?? '').trim().toUpperCase(),
    dateFormat: String(req.body.dateFormat ?? '').trim(),
  };
  if (!allowed.companyName || !/^[A-Z]{3}$/.test(allowed.currency) || !['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'].includes(allowed.dateFormat)) {
    return res.status(400).json({ message: 'Company name, three-letter currency, and supported date format are required.' });
  }
  const connection = await pool.getConnection();
  try {
    await ensureSettingsStorage();
    await connection.beginTransaction();
    for (const [key, value] of Object.entries(allowed)) await connection.execute('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [key, value]);
    await connection.commit();
    res.json({ message: 'System settings updated successfully.', settings: allowed });
  } catch (error) {
    await connection.rollback();
    console.error('Update system settings failed:', error);
    res.status(500).json({ message: 'Unable to update system settings.' });
  } finally { connection.release(); }
}
