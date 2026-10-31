import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { getFulfillment, listFulfillment, updateFulfillmentStatus } from '../controllers/orderController.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('Admin', 'Manager', 'Staff'), listFulfillment);
router.get('/:orderId', authorize('Admin', 'Manager', 'Staff'), (req, res) => getFulfillment({ ...req, params: { id: req.params.orderId } }, res));
router.patch('/:orderId/status', authorize('Admin', 'Manager'), (req, res) => updateFulfillmentStatus({ ...req, params: { id: req.params.orderId } }, res));
export default router;
