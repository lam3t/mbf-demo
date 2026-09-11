import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { PlansController } from '../controllers/plans.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';
import { CONFIG } from '../config';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `plan_doc_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const scanUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các file định dạng .jpg, .jpeg, .png, .pdf (tối đa 10MB)'));
    }
  }
});

const router = Router();

router.use(authGuard);

router.get('/', PlansController.getAll);
router.get('/pending-grid', PlansController.getPendingGrid);
router.get('/:id', PlansController.getById);
router.get('/:id/cross-ward-conflicts', PlansController.getCrossWardConflicts);
router.get('/:id/quota-check', PlansController.checkQuota);

router.post('/upload-scan', scanUpload.single('file'), auditLogger('UPLOAD_PLAN_SCAN', 'PLANS'), PlansController.uploadScanDocument);

router.post('/', auditLogger('CREATE_PLAN', 'PLANS'), PlansController.create);
router.post('/:id/items', auditLogger('ADD_PLAN_ITEMS', 'PLANS'), PlansController.addItems);
router.put('/:id/items', auditLogger('UPDATE_PLAN_ITEMS', 'PLANS'), PlansController.updateItems);
router.post('/:id/submit', auditLogger('SUBMIT_PLAN', 'PLANS'), PlansController.submit);

// Approve / Reject (MBF Roles)
router.post(
  '/:id/approve',
  roleGuard('admin', 'leader_mbf', 'officer_mbf'),
  auditLogger('APPROVE_PLAN', 'PLANS'),
  PlansController.approve
);

router.post(
  '/:id/sign-digital',
  roleGuard('admin', 'leader_mbf'),
  auditLogger('DIGITAL_SIGN_PLAN', 'PLANS'),
  PlansController.signDigital
);

router.post(
  '/:id/reject',
  roleGuard('admin', 'leader_mbf', 'officer_mbf'),
  auditLogger('REJECT_PLAN', 'PLANS'),
  PlansController.reject
);

router.post(
  '/approve-bulk',
  roleGuard('admin', 'leader_mbf', 'officer_mbf'),
  auditLogger('APPROVE_BULK_PLANS', 'PLANS'),
  PlansController.approveBulk
);

export default router;
