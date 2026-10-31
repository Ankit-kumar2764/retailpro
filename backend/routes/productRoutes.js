import { Router } from 'express';
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from '../controllers/productController.js';
import { authenticate, authorize } from '../middleware/authMiddleware.js';

const router = Router();

router.get('/', authenticate, authorize('Admin', 'Manager', 'Staff'), listProducts);
router.get('/:id', authenticate, authorize('Admin', 'Manager', 'Staff'), getProduct);
router.post('/', authenticate, authorize('Admin', 'Manager'), createProduct);
router.put('/:id', authenticate, authorize('Admin', 'Manager'), updateProduct);
router.delete('/:id', authenticate, authorize('Admin', 'Manager'), deleteProduct);

export default router;
