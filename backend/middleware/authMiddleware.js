import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

function getToken(request) {
  const header = request.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7).trim();
}

export async function authenticate(request, response, next) {
  const token = getToken(request);
  if (!token) return response.status(401).json({ message: 'Authentication token is required.' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query(
      `SELECT u.id, u.name, u.email, u.is_active AS isActive, r.name AS role
       FROM users u
       INNER JOIN roles r ON r.id = u.role_id
       WHERE u.id = ?`,
      [payload.sub],
    );
    if (!rows.length || !rows[0].isActive) {
      return response.status(401).json({ message: 'User account is inactive or does not exist.' });
    }
    request.user = rows[0];
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') return response.status(401).json({ message: 'Authentication token has expired.' });
    return response.status(401).json({ message: 'Invalid authentication token.' });
  }
}

export function authorize(...allowedRoles) {
  return (request, response, next) => {
    if (!request.user || !allowedRoles.includes(request.user.role)) {
      return response.status(403).json({ message: 'You do not have permission to perform this action.' });
    }
    return next();
  };
}
