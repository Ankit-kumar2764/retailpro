import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { listCustomers } from '../controllers/customerController.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('Admin', 'Manager', 'Staff'), listCustomers);
export default router;
