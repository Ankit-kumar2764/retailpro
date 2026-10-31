import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { createPurchaseOrder, getPurchaseOrder, listPurchaseOrders, updatePurchaseOrder, updatePurchaseOrderStatus } from '../controllers/purchaseOrderController.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('Admin', 'Manager', 'Staff'), listPurchaseOrders);
router.get('/:id', authorize('Admin', 'Manager', 'Staff'), getPurchaseOrder);
router.post('/', authorize('Admin', 'Manager'), createPurchaseOrder);
router.put('/:id', authorize('Admin', 'Manager'), updatePurchaseOrder);
router.patch('/:id/status', authorize('Admin', 'Manager'), updatePurchaseOrderStatus);
export default router;
