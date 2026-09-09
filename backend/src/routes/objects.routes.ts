import { Router } from 'express';
import multer from 'multer';
import { ObjectsController } from '../controllers/objects.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';

// Configure multer memory storage for Excel parsing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = Router();

router.use(authGuard);

router.get('/import/template', ObjectsController.getImportTemplate);
router.post('/import', upload.single('file'), auditLogger('IMPORT_OBJECTS', 'BUSINESS_OBJECTS'), ObjectsController.importBatch);

router.get('/', ObjectsController.getAll);
router.get('/check/:idOrTaxCode', ObjectsController.checkDuplicate);
router.get('/:id', ObjectsController.getById);
router.post('/', auditLogger('CREATE_OBJECT', 'BUSINESS_OBJECTS'), ObjectsController.create);
router.put('/:id', auditLogger('UPDATE_OBJECT', 'BUSINESS_OBJECTS'), ObjectsController.update);

export default router;
