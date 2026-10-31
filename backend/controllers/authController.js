import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const allowedRoles = new Set(['Admin', 'Manager', 'Staff']);

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: Boolean(user.isActive),
    createdAt: user.createdAt,
  };
}

function createToken(user) {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not configured.');
  return jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d', issuer: 'retail-inventory-api' },
  );
}

function validateCredentials(body) {
  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  if (!name || !email || !password) return 'Name, email, and password are required.';
  if (!emailPattern.test(email)) return 'Please provide a valid email address.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  return null;
}

async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.password_hash AS passwordHash,
            u.is_active AS isActive, u.created_at AS createdAt, r.name AS role
     FROM users u
     INNER JOIN roles r ON r.id = u.role_id
     WHERE u.email = ?`,
    [email],
  );
  return rows[0];
}

export async function register(request, response) {
  const validationError = validateCredentials(request.body);
  if (validationError) return response.status(400).json({ message: validationError });

  const email = String(request.body.email).trim().toLowerCase();
  const requestedRole = String(request.body.role || 'Staff').trim();
  const registrationKey = request.headers['x-role-registration-key'];
  let role = 'Staff';

  if (requestedRole !== 'Staff') {
    if (!allowedRoles.has(requestedRole)) return response.status(400).json({ message: 'Invalid role.' });
    if (!process.env.ADMIN_REGISTRATION_KEY || registrationKey !== process.env.ADMIN_REGISTRATION_KEY) {
      return response.status(403).json({ message: 'An authorized role registration key is required for this role.' });
    }
    role = requestedRole;
  }

  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) return response.status(409).json({ message: 'An account with this email already exists.' });

    const [roleRows] = await pool.query('SELECT id, name FROM roles WHERE name = ?', [role]);
    if (!roleRows.length) return response.status(500).json({ message: 'Configured user role was not found.' });
    const passwordHash = await bcrypt.hash(String(request.body.password), 12);
    const [result] = await pool.execute(
      `INSERT INTO users (role_id, name, email, password_hash) VALUES (?, ?, ?, ?)`,
      [roleRows[0].id, String(request.body.name).trim(), email, passwordHash],
    );
    const user = { id: result.insertId, name: String(request.body.name).trim(), email, role, isActive: true };
    return response.status(201).json({ message: 'Registration successful.', user: publicUser(user), token: createToken(user) });
  } catch (error) {
    console.error('User registration failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return response.status(409).json({ message: 'An account with this email already exists.' });
    return response.status(500).json({ message: 'Unable to register user.' });
  }
}

export async function login(request, response) {
  const email = String(request.body.email ?? '').trim().toLowerCase();
  const password = String(request.body.password ?? '');
  if (!emailPattern.test(email) || !password) return response.status(400).json({ message: 'Valid email and password are required.' });

  try {
    const user = await findUserByEmail(email);
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return response.status(401).json({ message: 'Invalid email or password.' });
    }
    await pool.execute('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    return response.json({ message: 'Login successful.', user: publicUser(user), token: createToken(user) });
  } catch (error) {
    console.error('User login failed:', error);
    return response.status(500).json({ message: 'Unable to login.' });
  }
}

export function profile(request, response) {
  return response.json({ user: publicUser(request.user) });
}

export function logout(_request, response) {
  return response.json({ message: 'Logout successful. Discard the JWT on the client.' });
}
