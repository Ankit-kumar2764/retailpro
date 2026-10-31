import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

const productFields = `
  id,
  product_name AS productName,
  sku,
  category,
  description,
  purchase_price AS purchasePrice,
  selling_price AS sellingPrice,
  available_stock AS availableStock,
  reorder_level AS reorderLevel,
  DATE_FORMAT(created_at, '%Y-%m-%d') AS createdDate,
  is_active AS isActive
`;

const validateProduct = (body) => {
  const required = ['productName', 'sku', 'category'];
  const missing = required.filter((field) => !String(body[field] || '').trim());
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;

  const numericFields = ['purchasePrice', 'sellingPrice', 'availableStock', 'reorderLevel'];
  for (const field of numericFields) {
    if (body[field] === undefined || body[field] === '' || Number.isNaN(Number(body[field])) || Number(body[field]) < 0) {
      return `${field} must be a non-negative number`;
    }
  }
  return null;
};

app.get('/api/products', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ${productFields} FROM products ORDER BY created_at DESC`);
    res.json(rows);
  } catch (error) {
    console.error('GET /api/products failed:', error);
    res.status(500).json({ message: 'Unable to load products.' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`SELECT ${productFields} FROM products WHERE id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Product not found.' });
    res.json(rows[0]);
  } catch (error) {
    console.error('GET /api/products/:id failed:', error);
    res.status(500).json({ message: 'Unable to load the product.' });
  }
});

app.post('/api/products', async (req, res) => {
  const validationError = validateProduct(req.body);
  if (validationError) return res.status(400).json({ message: validationError });

  const { productName, sku, category, description = '', purchasePrice, sellingPrice, availableStock, reorderLevel, isActive = true } = req.body;
  try {
    const [result] = await pool.execute(
      `INSERT INTO products
        (product_name, sku, category, description, purchase_price, selling_price, available_stock, reorder_level, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [productName.trim(), sku.trim(), category.trim(), description.trim(), Number(purchasePrice), Number(sellingPrice), Number(availableStock), Number(reorderLevel), Boolean(isActive)],
    );
    const [rows] = await pool.query(`SELECT ${productFields} FROM products WHERE id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('POST /api/products failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'SKU must be unique.' });
    res.status(500).json({ message: 'Unable to create the product.' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  const validationError = validateProduct(req.body);
  if (validationError) return res.status(400).json({ message: validationError });

  const { productName, sku, category, description = '', purchasePrice, sellingPrice, availableStock, reorderLevel, isActive = true } = req.body;
  try {
    const [result] = await pool.execute(
      `UPDATE products
       SET product_name = ?, sku = ?, category = ?, description = ?, purchase_price = ?,
           selling_price = ?, available_stock = ?, reorder_level = ?, is_active = ?
       WHERE id = ?`,
      [productName.trim(), sku.trim(), category.trim(), description.trim(), Number(purchasePrice), Number(sellingPrice), Number(availableStock), Number(reorderLevel), Boolean(isActive), req.params.id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
    const [rows] = await pool.query(`SELECT ${productFields} FROM products WHERE id = ?`, [req.params.id]);
    res.json(rows[0]);
  } catch (error) {
    console.error('PUT /api/products/:id failed:', error);
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'SKU must be unique.' });
    res.status(500).json({ message: 'Unable to update the product.' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
    res.status(204).send();
  } catch (error) {
    console.error('DELETE /api/products/:id failed:', error);
    res.status(500).json({ message: 'Unable to delete the product.' });
  }
});

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(503).json({ status: 'unavailable', message: 'Database connection failed.' });
  }
});

app.listen(port, () => {
  console.log(`RetailPro API listening on http://localhost:${port}`);
});
