import bcrypt from 'bcryptjs';
import pool from './config/db.js';

async function resetPassword() {
  const email = 'manager-products-1793382900200@example.com';
  const newPassword = 'Manager@123';

  try {
    const hash = await bcrypt.hash(newPassword, 12);

    const [result] = await pool.execute(
      'UPDATE users SET password_hash = ? WHERE email = ?',
      [hash, email]
    );

    if (result.affectedRows > 0) {
      console.log('Password reset successful!');
    } else {
      console.log('User not found!');
    }
  } catch (error) {
    console.error('Reset failed:', error);
  } finally {
    await pool.end();
  }
}

resetPassword();