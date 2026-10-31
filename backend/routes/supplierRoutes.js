import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { createSupplier, deleteSupplier, getSupplier, listSuppliers, updateSupplier } from '../controllers/supplierController.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('Admin', 'Manager', 'Staff'), listSuppliers);
router.get('/:id', authorize('Admin', 'Manager', 'Staff'), getSupplier);
router.post('/', authorize('Admin', 'Manager'), createSupplier);
router.put('/:id', authorize('Admin', 'Manager'), updateSupplier);
router.delete('/:id', authorize('Admin', 'Manager'), deleteSupplier);
export default router;
