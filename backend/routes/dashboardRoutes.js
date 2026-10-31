import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  inventoryOverview,
  lowStock,
  purchaseOverview,
  recentOrders,
  salesOverview,
  summary,
  topProducts,
} from '../controllers/dashboardController.js';

const router = Router();
router.use(authenticate, authorize('Admin', 'Manager', 'Staff'));
router.get('/summary', summary);
router.get('/sales-overview', salesOverview);
router.get('/recent-orders', recentOrders);
router.get('/top-products', topProducts);
router.get('/low-stock', lowStock);
router.get('/inventory-overview', inventoryOverview);
router.get('/purchase-overview', purchaseOverview);
export default router;
