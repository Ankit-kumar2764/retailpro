import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware.js';
import {
  changePassword,
  createUser,
  deactivateUser,
  getSettingsProfile,
  getSystemSettings,
  listRoles,
  listUsers,
  updateSettingsProfile,
  updateSystemSettings,
  updateUser,
} from '../controllers/settingsController.js';

const router = Router();
router.use(authenticate);
router.get('/profile', getSettingsProfile);
router.put('/profile', updateSettingsProfile);
router.put('/password', changePassword);
router.get('/system', authorize('Admin', 'Manager', 'Staff'), getSystemSettings);
router.put('/system', authorize('Admin'), updateSystemSettings);
router.get('/roles', authorize('Admin'), listRoles);
router.get('/users', authorize('Admin'), listUsers);
router.post('/users', authorize('Admin'), createUser);
router.put('/users/:id', authorize('Admin'), updateUser);
router.delete('/users/:id', authorize('Admin'), deactivateUser);
export default router;
