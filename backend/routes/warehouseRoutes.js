import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { createWarehouse, deleteWarehouse, getWarehouse, listWarehouses, updateWarehouse } from '../controllers/warehouseController.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('Admin', 'Manager', 'Staff'), listWarehouses);
router.get('/:id', authorize('Admin', 'Manager', 'Staff'), getWarehouse);
router.post('/', authorize('Admin', 'Manager'), createWarehouse);
router.put('/:id', authorize('Admin', 'Manager'), updateWarehouse);
router.delete('/:id', authorize('Admin', 'Manager'), deleteWarehouse);
export default router;
