import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { inventory, lowStock, products, purchases, sales, summary } from '../controllers/reportsController.js';

const router = Router();
router.use(authenticate, authorize('Admin', 'Manager', 'Staff'));
router.get('/summary', summary);
router.get('/sales', sales);
router.get('/inventory', inventory);
router.get('/purchases', purchases);
router.get('/products', products);
router.get('/low-stock', lowStock);
export default router;
