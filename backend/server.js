import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool, { testDatabaseConnection } from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { errorHandler, notFound } from './middleware/errorMiddleware.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import fulfillmentRoutes from './routes/fulfillmentRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import reportsRoutes from './routes/reportsRoutes.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 5000);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const allowedOrigins = new Set([clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173']);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/fulfillment', fulfillmentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/reports', reportsRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    await testDatabaseConnection();
    res.json({
      status: 'ok',
      service: 'retail-inventory-api',
      database: process.env.DB_NAME || 'retail_inventory',
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({
      status: 'unavailable',
      service: 'retail-inventory-api',
      message: 'Database connection failed. Check MySQL and backend environment variables.',
    });
  }
});

app.use(notFound);
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Retail Inventory API listening on http://localhost:${port}`);
  console.log(`Database target: ${process.env.DB_USER || 'root'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'retail_inventory'}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} received. Shutting down API.`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default app;
