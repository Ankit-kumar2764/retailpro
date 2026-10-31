import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import { adjustStock, getInventory, listInventory, lowStock, transferStock } from '../controllers/inventoryController.js';

const router = Router();
router.use(authenticate);
router.get('/', authorize('Admin', 'Manager', 'Staff'), listInventory);
router.get('/low-stock', authorize('Admin', 'Manager', 'Staff'), lowStock);
router.get('/:id', authorize('Admin', 'Manager', 'Staff'), getInventory);
router.post('/adjust', authorize('Admin', 'Manager'), adjustStock);
router.post('/transfer', authorize('Admin', 'Manager'), transferStock);
export default router;
