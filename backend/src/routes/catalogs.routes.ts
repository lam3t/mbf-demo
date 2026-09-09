import { Router } from 'express';
import { CatalogsController } from '../controllers/catalogs.controller';
import { authGuard, roleGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';

const router = Router();

router.use(authGuard);

// Violations Catalog
router.get('/violations', CatalogsController.getViolations);
router.post('/violations', roleGuard('admin'), auditLogger('CREATE_VIOLATION', 'CATALOGS'), CatalogsController.createViolation);
router.put('/violations/:id', roleGuard('admin'), auditLogger('UPDATE_VIOLATION', 'CATALOGS'), CatalogsController.updateViolation);
router.delete('/violations/:id', roleGuard('admin'), auditLogger('DELETE_VIOLATION', 'CATALOGS'), CatalogsController.deleteViolation);

// Recommendation Tag Catalog
router.get('/recommendation-tags', CatalogsController.getRecommendationTags);
router.post('/recommendation-tags', roleGuard('admin'), auditLogger('CREATE_RECOMMENDATION_TAG', 'CATALOGS'), CatalogsController.createRecommendationTag);
router.put('/recommendation-tags/:id', roleGuard('admin'), auditLogger('UPDATE_RECOMMENDATION_TAG', 'CATALOGS'), CatalogsController.updateRecommendationTag);
router.delete('/recommendation-tags/:id', roleGuard('admin'), auditLogger('DELETE_RECOMMENDATION_TAG', 'CATALOGS'), CatalogsController.deleteRecommendationTag);

export default router;
