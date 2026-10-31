import pool from './config/db.js';

const categories = [
  ['RP Sample Electronics', 'Sample consumer electronics'],
  ['RP Sample Office', 'Sample office equipment'],
  ['RP Sample Networking', 'Sample networking equipment'],
  ['RP Sample Accessories', 'Sample accessories and cables'],
  ['RP Sample Furniture', 'Sample office furniture'],
];

const products = [
  ['RP-SAMPLE-LAPTOP', 'ProBook Laptop 14', 'RP Sample Electronics', 650, 899, 18, 5],
  ['RP-SAMPLE-MOUSE', 'Ergo Wireless Mouse', 'RP Sample Accessories', 12, 24, 42, 10],
  ['RP-SAMPLE-KEYBOARD', 'Mechanical Keyboard', 'RP Sample Accessories', 35, 69, 28, 8],
  ['RP-SAMPLE-MONITOR', '24in IPS Monitor', 'RP Sample Electronics', 110, 179, 14, 4],
  ['RP-SAMPLE-PHONE', 'Smart Mobile Phone', 'RP Sample Electronics', 280, 399, 22, 6],
  ['RP-SAMPLE-HEADPHONES', 'Noise Cancel Headphones', 'RP Sample Electronics', 55, 99, 31, 8],
  ['RP-SAMPLE-PRINTER', 'Laser Office Printer', 'RP Sample Office', 145, 229, 9, 3],
  ['RP-SAMPLE-USB', 'Braided USB-C Cable', 'RP Sample Accessories', 4, 12, 60, 15],
  ['RP-SAMPLE-ROUTER', 'Wi-Fi 6 Router', 'RP Sample Networking', 48, 89, 17, 5],
  ['RP-SAMPLE-CHAIR', 'Ergonomic Office Chair', 'RP Sample Furniture', 120, 249, 7, 3],
  ['RP-SAMPLE-WEBCAM', 'Full HD Webcam', 'RP Sample Electronics', 28, 59, 24, 6],
  ['RP-SAMPLE-SSD', '1TB Portable SSD', 'RP Sample Electronics', 70, 119, 19, 5],
  ['RP-SAMPLE-DOCK', 'USB-C Docking Station', 'RP Sample Accessories', 85, 149, 12, 4],
  ['RP-SAMPLE-SWITCH', '8-Port Network Switch', 'RP Sample Networking', 32, 65, 16, 5],
  ['RP-SAMPLE-TABLE', 'Standing Office Desk', 'RP Sample Furniture', 210, 349, 6, 2],
  ['RP-SAMPLE-SCANNER', 'Document Scanner', 'RP Sample Office', 95, 159, 10, 3],
  ['RP-SAMPLE-TONER', 'Printer Toner Cartridge', 'RP Sample Office', 42, 79, 20, 6],
  ['RP-SAMPLE-ADAPTER', 'Universal Power Adapter', 'RP Sample Accessories', 18, 39, 26, 7],
  ['RP-SAMPLE-AP', 'Business Wi-Fi Access Point', 'RP Sample Networking', 75, 129, 11, 4],
  ['RP-SAMPLE-LAMP', 'LED Desk Lamp', 'RP Sample Furniture', 22, 49, 15, 5],
];

const warehouses = [
  ['RP Sample Central Warehouse', 'RPS-CENTRAL', 'Central business district', 1000],
  ['RP Sample North Warehouse', 'RPS-NORTH', 'North industrial zone', 750],
  ['RP Sample South Warehouse', 'RPS-SOUTH', 'South distribution park', 600],
];

const suppliers = [
  ['RP Sample Tech Supply', 'Aarav Mehta', 'tech-supply@example.test', '+91-90000-10001', 'Mumbai'],
  ['RP Sample Office World', 'Sara Khan', 'office-world@example.test', '+91-90000-10002', 'Delhi'],
  ['RP Sample Network Hub', 'Vikram Rao', 'network-hub@example.test', '+91-90000-10003', 'Bengaluru'],
  ['RP Sample Furniture Co', 'Neha Singh', 'furniture-co@example.test', '+91-90000-10004', 'Pune'],
  ['RP Sample Global Goods', 'Kabir Shah', 'global-goods@example.test', '+91-90000-10005', 'Hyderabad'],
];

const customers = Array.from({ length: 10 }, (_, index) => [
  `RP Sample Customer ${String(index + 1).padStart(2, '0')}`,
  `customer${index + 1}@example.test`,
  `+91-91000-${String(index + 1).padStart(4, '0')}`,
  `${index + 1} Sample Street`,
]);

const inventoryQuantities = [
  [24, 3, 0], [55, 8, 4], [18, 3, 2], [12, 4, 1], [20, 6, 3],
  [35, 7, 3], [8, 3, 1], [70, 12, 5], [16, 5, 2], [6, 2, 0],
];

const purchasePlans = [
  { number: 'RP-SAMPLE-PO-001', supplier: 0, warehouse: 0, status: 'Received', items: [[0, 5, 650], [1, 20, 12]] },
  { number: 'RP-SAMPLE-PO-002', supplier: 1, warehouse: 1, status: 'Approved', items: [[6, 8, 145], [15, 5, 95]] },
  { number: 'RP-SAMPLE-PO-003', supplier: 2, warehouse: 2, status: 'Ordered', items: [[8, 12, 48], [13, 10, 32]] },
  { number: 'RP-SAMPLE-PO-004', supplier: 3, warehouse: 0, status: 'Partially Received', items: [[9, 6, 120], [14, 4, 210]] },
  { number: 'RP-SAMPLE-PO-005', supplier: 4, warehouse: 1, status: 'Pending', items: [[4, 10, 280], [5, 12, 55]] },
];

const orderPlans = [
  { number: 'RP-SAMPLE-ORD-001', customer: 0, warehouse: 0, status: 'Delivered', items: [[0, 1], [1, 2]] },
  { number: 'RP-SAMPLE-ORD-002', customer: 1, warehouse: 1, status: 'Shipped', items: [[2, 1], [3, 1]] },
  { number: 'RP-SAMPLE-ORD-003', customer: 2, warehouse: 2, status: 'Processing', items: [[4, 1], [5, 1]] },
  { number: 'RP-SAMPLE-ORD-004', customer: 3, warehouse: 0, status: 'Confirmed', items: [[6, 1], [7, 3]] },
  { number: 'RP-SAMPLE-ORD-005', customer: 4, warehouse: 1, status: 'Pending', items: [[8, 1]] },
  { number: 'RP-SAMPLE-ORD-006', customer: 5, warehouse: 2, status: 'Delivered', items: [[9, 1], [10, 1]] },
  { number: 'RP-SAMPLE-ORD-007', customer: 6, warehouse: 0, status: 'Shipped', items: [[11, 1], [12, 1]] },
  { number: 'RP-SAMPLE-ORD-008', customer: 7, warehouse: 1, status: 'Processing', items: [[13, 1], [14, 1]] },
  { number: 'RP-SAMPLE-ORD-009', customer: 8, warehouse: 2, status: 'Delivered', items: [[15, 1], [16, 2]] },
  { number: 'RP-SAMPLE-ORD-010', customer: 9, warehouse: 0, status: 'Confirmed', items: [[17, 1], [18, 1], [19, 1]] },
];

async function findId(connection, table, column, value) {
  const [rows] = await connection.execute(`SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`, [value]);
  if (!rows.length) throw new Error(`Unable to resolve ${table}.${column}: ${value}`);
  return rows[0].id;
}

async function insertSampleData() {
  const connection = await pool.getConnection();
  const ids = { categories: new Map(), products: [], warehouses: [], suppliers: [], customers: [] };
  try {
    await connection.beginTransaction();

    for (const [name, description] of categories) {
      await connection.execute('INSERT IGNORE INTO categories (name, description, is_active) VALUES (?, ?, TRUE)', [name, description]);
      ids.categories.set(name, await findId(connection, 'categories', 'name', name));
    }

    for (const [sku, name, category, purchasePrice, sellingPrice, stock, reorderLevel] of products) {
      await connection.execute(
        'INSERT IGNORE INTO products (category_id, product_name, sku, category, purchase_price, selling_price, available_stock, reorder_level, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)',
        [ids.categories.get(category), name, sku, category, purchasePrice, sellingPrice, stock, reorderLevel],
      );
      ids.products.push(await findId(connection, 'products', 'sku', sku));
    }

    for (const [name, code, location, capacity] of warehouses) {
      await connection.execute('INSERT IGNORE INTO warehouses (name, code, location, capacity, is_active) VALUES (?, ?, ?, ?, TRUE)', [name, code, location, capacity]);
      ids.warehouses.push(await findId(connection, 'warehouses', 'code', code));
    }

    for (const [name, contactPerson, email, phone, city] of suppliers) {
      await connection.execute('INSERT IGNORE INTO suppliers (name, contact_person, email, phone, city, is_active) VALUES (?, ?, ?, ?, ?, TRUE)', [name, contactPerson, email, phone, city]);
      ids.suppliers.push(await findId(connection, 'suppliers', 'email', email));
    }

    for (const [name, email, phone, address] of customers) {
      await connection.execute('INSERT IGNORE INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)', [name, email, phone, address]);
      ids.customers.push(await findId(connection, 'customers', 'email', email));
    }

    for (let productIndex = 0; productIndex < inventoryQuantities.length; productIndex += 1) {
      for (let warehouseIndex = 0; warehouseIndex < ids.warehouses.length; warehouseIndex += 1) {
        await connection.execute(
          'INSERT IGNORE INTO inventory (product_id, warehouse_id, quantity, reorder_level) VALUES (?, ?, ?, ?)',
          [ids.products[productIndex], ids.warehouses[warehouseIndex], inventoryQuantities[productIndex][warehouseIndex], products[productIndex][6]],
        );
      }
    }

    for (const plan of purchasePlans) {
      const supplierId = ids.suppliers[plan.supplier];
      const warehouseId = ids.warehouses[plan.warehouse];
      const existing = await findId(connection, 'suppliers', 'id', supplierId);
      if (!existing) throw new Error('Supplier reference failed.');
      const total = plan.items.reduce((sum, [productIndex, quantity, unitCost]) => sum + quantity * unitCost, 0);
      await connection.execute('INSERT IGNORE INTO purchase_orders (po_number, supplier_id, warehouse_id, status, total_amount, received_at) VALUES (?, ?, ?, ?, ?, ?)', [plan.number, supplierId, warehouseId, plan.status, total, plan.status === 'Received' ? new Date() : null]);
      const purchaseOrderId = await findId(connection, 'purchase_orders', 'po_number', plan.number);
      for (const [productIndex, quantity, unitCost] of plan.items) {
        await connection.execute('INSERT IGNORE INTO purchase_order_items (purchase_order_id, product_id, quantity_ordered, quantity_received, unit_cost) VALUES (?, ?, ?, ?, ?)', [purchaseOrderId, ids.products[productIndex], quantity, plan.status === 'Received' ? quantity : Math.floor(quantity / 2), unitCost]);
      }
    }

    for (const plan of orderPlans) {
      const items = plan.items.map(([productIndex, quantity]) => ({ productIndex, quantity, unitPrice: products[productIndex][5] }));
      const total = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
      await connection.execute('INSERT IGNORE INTO orders (order_number, customer_id, warehouse_id, status, payment_status, total_amount, ordered_at) VALUES (?, ?, ?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL ? DAY))', [plan.number, ids.customers[plan.customer], ids.warehouses[plan.warehouse], plan.status, plan.status === 'Pending' ? 'Pending' : 'Paid', total, orderPlans.indexOf(plan) + 1]);
      const orderId = await findId(connection, 'orders', 'order_number', plan.number);
      for (const item of items) {
        await connection.execute('INSERT IGNORE INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)', [orderId, ids.products[item.productIndex], item.quantity, item.unitPrice]);
      }
    }

    await connection.commit();
    console.log(JSON.stringify({ message: 'Sample data seeded safely.', categories: categories.length, products: products.length, warehouses: warehouses.length, suppliers: suppliers.length, customers: customers.length, inventoryRecords: inventoryQuantities.length * warehouses.length, purchaseOrders: purchasePlans.length, salesOrders: orderPlans.length }));
  } catch (error) {
    await connection.rollback();
    console.error('Sample data seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await pool.end();
  }
}

insertSampleData();
