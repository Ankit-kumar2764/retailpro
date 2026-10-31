import pool from '../config/db.js';

const productFields = `
  p.id,
  p.product_name AS productName,
  p.sku,
  COALESCE(c.name, p.category) AS category,
  p.category_id AS categoryId,
  p.description,
  p.purchase_price AS purchasePrice,
  p.selling_price AS sellingPrice,
  COALESCE(SUM(i.quantity), 0) AS availableStock,
  p.reorder_level AS reorderLevel,
  p.is_active AS isActive,
  DATE_FORMAT(p.created_at, '%Y-%m-%d') AS createdDate,
  p.created_at AS createdAt,
  p.updated_at AS updatedAt
`;

const productFromClause = `
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN inventory i ON i.product_id = p.id
`;
const numericFields = ['purchasePrice', 'sellingPrice', 'reorderLevel'];

function validateProduct(body) {
  const requiredFields = ['productName', 'sku', 'category'];
  const missingFields = requiredFields.filter((field) => !String(body[field] ?? '').trim());
  if (missingFields.length) {
    return `Required fields are missing: ${missingFields.join(', ')}.`;
  }

  for (const field of numericFields) {
    if (body[field] === undefined || body[field] === '' || !Number.isFinite(Number(body[field])) || Number(body[field]) < 0) {
      return `${field} must be a non-negative number.`;
    }
  }

  if (Number(body.sellingPrice) < Number(body.purchasePrice)) {
    return 'sellingPrice cannot be lower than purchasePrice.';
  }

  return null;
}

function handleDatabaseError(error, res, action) {
  console.error(`${action} failed:`, error);
  if (error.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'SKU must be unique.' });
  }
  return res.status(500).json({ message: `Unable to ${action.toLowerCase()}.` });
}

export async function listProducts(req, res) {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '50', 10)));
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const category = String(req.query.category || '').trim();
  const conditions = [];
  const parameters = [];

  if (search) {
    conditions.push('(p.product_name LIKE ? OR p.sku LIKE ? OR COALESCE(c.name, p.category) LIKE ?)');
    const searchTerm = `%${search}%`;
    parameters.push(searchTerm, searchTerm, searchTerm);
  }
  if (category) {
    conditions.push('COALESCE(c.name, p.category) = ?');
    parameters.push(category);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(
      `SELECT ${productFields} ${productFromClause} ${whereClause}
       GROUP BY p.id ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
      [...parameters, limit, offset],
    );
    const [countRows] = await pool.query(
      `SELECT COUNT(DISTINCT p.id) AS total ${productFromClause} ${whereClause}`,
      parameters,
    );
    const total = Number(countRows[0].total);
    res.json({
      data: rows,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (error) {
    return handleDatabaseError(error, res, 'load products');
  }
}

export async function getProduct(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT ${productFields} ${productFromClause} WHERE p.id = ? GROUP BY p.id`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ message: 'Product not found.' });
    return res.json(rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, 'load product');
  }
}

export async function createProduct(req, res) {
  const validationError = validateProduct(req.body);
  if (validationError) return res.status(400).json({ message: validationError });

  try {
    const [categoryRows] = await pool.query('SELECT id, name FROM categories WHERE name = ? AND is_active = TRUE', [String(req.body.category).trim()]);
    if (!categoryRows.length) return res.status(400).json({ message: 'A valid active category is required.' });
    const [result] = await pool.execute(
      `INSERT INTO products
        (category_id, product_name, sku, category, description, purchase_price, selling_price, reorder_level, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [categoryRows[0].id, String(req.body.productName).trim(), String(req.body.sku).trim(), categoryRows[0].name, String(req.body.description ?? '').trim(), Number(req.body.purchasePrice), Number(req.body.sellingPrice), Number(req.body.reorderLevel), req.body.isActive === undefined ? true : Boolean(req.body.isActive)],
    );
    const [rows] = await pool.query(`SELECT ${productFields} ${productFromClause} WHERE p.id = ? GROUP BY p.id`, [result.insertId]);
    return res.status(201).json(rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, 'create product');
  }
}

export async function updateProduct(req, res) {
  const validationError = validateProduct(req.body);
  if (validationError) return res.status(400).json({ message: validationError });

  try {
    const [categoryRows] = await pool.query('SELECT id, name FROM categories WHERE name = ? AND is_active = TRUE', [String(req.body.category).trim()]);
    if (!categoryRows.length) return res.status(400).json({ message: 'A valid active category is required.' });
    const [result] = await pool.execute(
      `UPDATE products
       SET category_id = ?, product_name = ?, sku = ?, category = ?, description = ?, purchase_price = ?,
           selling_price = ?, reorder_level = ?, is_active = ?
       WHERE id = ?`,
      [categoryRows[0].id, String(req.body.productName).trim(), String(req.body.sku).trim(), categoryRows[0].name, String(req.body.description ?? '').trim(), Number(req.body.purchasePrice), Number(req.body.sellingPrice), Number(req.body.reorderLevel), req.body.isActive === undefined ? true : Boolean(req.body.isActive), req.params.id],
    );
    if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
    const [rows] = await pool.query(`SELECT ${productFields} ${productFromClause} WHERE p.id = ? GROUP BY p.id`, [req.params.id]);
    return res.json(rows[0]);
  } catch (error) {
    return handleDatabaseError(error, res, 'update product');
  }
}

export async function deleteProduct(req, res) {
  try {
    const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Product not found.' });
    return res.status(204).send();
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ message: 'Product cannot be deleted while inventory or order records reference it.' });
    }
    return handleDatabaseError(error, res, 'delete product');
  }
}
