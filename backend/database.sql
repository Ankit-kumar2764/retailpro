-- Retail Inventory Management System
-- Phase 2 schema. This script is intentionally non-destructive:
-- it never drops tables or deletes existing rows.

CREATE DATABASE IF NOT EXISTS retail_inventory
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE retail_inventory;

CREATE TABLE IF NOT EXISTS roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(60) NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB;

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
  ('companyName', 'RetailPro'),
  ('currency', 'USD'),
  ('dateFormat', 'YYYY-MM-DD');

INSERT IGNORE INTO roles (name, description) VALUES
  ('Admin', 'Full access to the retail inventory system'),
  ('Manager', 'Can manage catalog, inventory, suppliers, and orders'),
  ('Staff', 'Can view and perform assigned operational tasks');

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  role_id INT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

INSERT IGNORE INTO categories (name, description) VALUES
  ('Electronics', 'Devices, accessories, and consumer electronics'),
  ('Apparel', 'Clothing and fashion products'),
  ('Home & Living', 'Furniture, decor, and household products'),
  ('Beauty', 'Personal care and beauty products'),
  ('Sports', 'Sportswear, equipment, and accessories'),
  ('Accessories', 'Lifestyle and fashion accessories');

CREATE TABLE IF NOT EXISTS products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NULL,
  product_name VARCHAR(150) NOT NULL,
  sku VARCHAR(80) NOT NULL,
  category VARCHAR(100) NULL,
  description TEXT NULL,
  purchase_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  selling_price DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  available_stock INT UNSIGNED NOT NULL DEFAULT 0,
  reorder_level INT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category_id (category_id),
  KEY idx_products_category (category),
  KEY idx_products_active (is_active),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- Preserve the existing Phase 1 products table and add its relational category link.
SET @add_category_id = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'products' AND column_name = 'category_id'
    ),
    'SELECT 1',
    'ALTER TABLE products ADD COLUMN category_id INT UNSIGNED NULL AFTER id'
  )
);
PREPARE add_category_id_statement FROM @add_category_id;
EXECUTE add_category_id_statement;
DEALLOCATE PREPARE add_category_id_statement;

SET @add_category_index = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = 'products' AND index_name = 'idx_products_category_id'
    ),
    'SELECT 1',
    'ALTER TABLE products ADD INDEX idx_products_category_id (category_id)'
  )
);
PREPARE add_category_index_statement FROM @add_category_index;
EXECUTE add_category_index_statement;
DEALLOCATE PREPARE add_category_index_statement;

UPDATE products p
LEFT JOIN categories c ON c.name = p.category
SET p.category_id = c.id
WHERE p.category_id IS NULL AND p.category IS NOT NULL;

SET @add_product_category_fk = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_schema = DATABASE() AND table_name = 'products'
        AND constraint_name = 'fk_products_category'
    ),
    'SELECT 1',
    'ALTER TABLE products ADD CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES categories (id) ON UPDATE CASCADE ON DELETE SET NULL'
  )
);
PREPARE add_product_category_fk_statement FROM @add_product_category_fk;
EXECUTE add_product_category_fk_statement;
DEALLOCATE PREPARE add_product_category_fk_statement;

-- The original Phase 1 products table used a signed INT id. Normalize it
-- before creating child tables so all foreign-key columns are compatible.
ALTER TABLE products MODIFY COLUMN id INT UNSIGNED NOT NULL AUTO_INCREMENT;

CREATE TABLE IF NOT EXISTS warehouses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(30) NOT NULL,
  location VARCHAR(255) NULL,
  capacity INT UNSIGNED NOT NULL DEFAULT 0,
  manager_user_id INT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_warehouses_code (code),
  KEY idx_warehouses_manager (manager_user_id),
  CONSTRAINT fk_warehouses_manager FOREIGN KEY (manager_user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

SET @add_warehouse_address = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'warehouses' AND column_name = 'address'
    ),
    'SELECT 1',
    'ALTER TABLE warehouses ADD COLUMN address VARCHAR(255) NULL AFTER location'
  )
);
PREPARE add_warehouse_address_statement FROM @add_warehouse_address;
EXECUTE add_warehouse_address_statement;
DEALLOCATE PREPARE add_warehouse_address_statement;

SET @add_warehouse_contact = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'warehouses' AND column_name = 'contact_number'
    ),
    'SELECT 1',
    'ALTER TABLE warehouses ADD COLUMN contact_number VARCHAR(40) NULL AFTER address'
  )
);
PREPARE add_warehouse_contact_statement FROM @add_warehouse_contact;
EXECUTE add_warehouse_contact_statement;
DEALLOCATE PREPARE add_warehouse_contact_statement;

CREATE TABLE IF NOT EXISTS inventory (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  warehouse_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  reorder_level INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inventory_product_warehouse (product_id, warehouse_id),
  KEY idx_inventory_warehouse (warehouse_id),
  CONSTRAINT fk_inventory_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_inventory_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(120) NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  city VARCHAR(100) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppliers_email (email),
  KEY idx_suppliers_name (name)
) ENGINE=InnoDB;

SET @add_supplier_city = (
  SELECT IF(
    EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'suppliers' AND column_name = 'city'
    ),
    'SELECT 1',
    'ALTER TABLE suppliers ADD COLUMN city VARCHAR(100) NULL AFTER address'
  )
);
PREPARE add_supplier_city_statement FROM @add_supplier_city;
EXECUTE add_supplier_city_statement;
DEALLOCATE PREPARE add_supplier_city_statement;

CREATE TABLE IF NOT EXISTS customers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  address VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_email (email),
  KEY idx_customers_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(40) NOT NULL,
  customer_id INT UNSIGNED NULL,
  warehouse_id INT UNSIGNED NULL,
  status ENUM('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled') NOT NULL DEFAULT 'Pending',
  payment_status ENUM('Pending', 'Paid', 'Failed', 'Refunded') NOT NULL DEFAULT 'Pending',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ordered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_number (order_number),
  KEY idx_orders_customer (customer_id),
  KEY idx_orders_warehouse (warehouse_id),
  KEY idx_orders_status (status),
  KEY idx_orders_ordered_at (ordered_at),
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT fk_orders_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

-- Extend the existing order workflow without dropping the table or changing rows.
ALTER TABLE orders
  MODIFY COLUMN status ENUM('Draft', 'Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled')
  NOT NULL DEFAULT 'Draft';

CREATE TABLE IF NOT EXISTS order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) AS (quantity * unit_price) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_product (order_id, product_id),
  KEY idx_order_items_product (product_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS purchase_orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  po_number VARCHAR(40) NOT NULL,
  supplier_id INT UNSIGNED NOT NULL,
  warehouse_id INT UNSIGNED NOT NULL,
  status ENUM('Draft', 'Pending', 'Submitted', 'Approved', 'Ordered', 'Partially Received', 'Received', 'Cancelled') NOT NULL DEFAULT 'Draft',
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  ordered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_orders_number (po_number),
  KEY idx_purchase_orders_supplier (supplier_id),
  KEY idx_purchase_orders_warehouse (warehouse_id),
  KEY idx_purchase_orders_status (status),
  CONSTRAINT fk_purchase_orders_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_orders_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

ALTER TABLE purchase_orders MODIFY COLUMN status ENUM('Draft', 'Pending', 'Submitted', 'Approved', 'Ordered', 'Partially Received', 'Received', 'Cancelled') NOT NULL DEFAULT 'Draft';

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  purchase_order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NOT NULL,
  quantity_ordered INT UNSIGNED NOT NULL,
  quantity_received INT UNSIGNED NOT NULL DEFAULT 0,
  unit_cost DECIMAL(12, 2) NOT NULL,
  line_total DECIMAL(12, 2) AS (quantity_ordered * unit_cost) STORED,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_purchase_order_product (purchase_order_id, product_id),
  KEY idx_purchase_order_items_product (product_id),
  CONSTRAINT fk_purchase_order_items_order FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_purchase_order_items_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_transfers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  from_warehouse_id INT UNSIGNED NOT NULL,
  to_warehouse_id INT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  status ENUM('Pending', 'Completed', 'Cancelled') NOT NULL DEFAULT 'Pending',
  notes VARCHAR(255) NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_transfers_product (product_id),
  KEY idx_stock_transfers_from_warehouse (from_warehouse_id),
  KEY idx_stock_transfers_to_warehouse (to_warehouse_id),
  KEY idx_stock_transfers_created_by (created_by),
  CONSTRAINT fk_stock_transfers_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stock_transfers_from_warehouse FOREIGN KEY (from_warehouse_id) REFERENCES warehouses (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stock_transfers_to_warehouse FOREIGN KEY (to_warehouse_id) REFERENCES warehouses (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stock_transfers_created_by FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  warehouse_id INT UNSIGNED NOT NULL,
  quantity_change INT NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_adjustments_product_warehouse (product_id, warehouse_id),
  KEY idx_stock_adjustments_created_by (created_by),
  CONSTRAINT fk_stock_adjustments_product FOREIGN KEY (product_id) REFERENCES products (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stock_adjustments_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses (id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stock_adjustments_created_by FOREIGN KEY (created_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT chk_stock_adjustment_nonzero CHECK (quantity_change <> 0)
) ENGINE=InnoDB;
