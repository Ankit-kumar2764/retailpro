import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { createOrder, deleteOrder, getOrder, listOrders, updateOrder, updateOrderStatus } from '../controllers/orderController.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('Admin', 'Manager', 'Staff'), listOrders);
router.get('/:id', authorize('Admin', 'Manager', 'Staff'), getOrder);
router.post('/', authorize('Admin', 'Manager'), createOrder);
router.put('/:id', authorize('Admin', 'Manager'), updateOrder);
router.patch('/:id/status', authorize('Admin', 'Manager'), updateOrderStatus);
router.delete('/:id', authorize('Admin', 'Manager'), deleteOrder);
export default router;
