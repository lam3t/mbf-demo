import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { InspectionsController } from '../controllers/inspections.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';
import { CONFIG } from '../config';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `evidence_${Date.now()}_${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.pdf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận các file định dạng .jpg, .png, .pdf'));
    }
  }
});

const router = Router();

router.use(authGuard);

router.get('/', InspectionsController.getAll);
router.get('/:id', InspectionsController.getById);
router.put('/:id', auditLogger('UPDATE_INSPECTION', 'INSPECTIONS'), InspectionsController.update);
router.post('/:id/evidence', upload.single('file'), auditLogger('UPLOAD_EVIDENCE', 'INSPECTIONS'), InspectionsController.uploadEvidence);
router.post('/:id/complete', auditLogger('COMPLETE_INSPECTION', 'INSPECTIONS'), InspectionsController.complete);

export default router;
