import { Router } from 'express';
import authRoutes from './auth.routes';
import usersRoutes from './users.routes';
import objectsRoutes from './objects.routes';
import plansRoutes from './plans.routes';
import inspectionsRoutes from './inspections.routes';
import catalogsRoutes from './catalogs.routes';
import configsRoutes from './configs.routes';
import dashboardRoutes from './dashboard.routes';
import auditRoutes from './audit.routes';
import reportsRoutes from './reports.routes';
import alertsRoutes from './alerts.routes';
import wardsRoutes from './wards.routes';
import adhocRoutes from './adhoc.routes';
import { CatalogsController } from '../controllers/catalogs.controller';
import { InspectionsController } from '../controllers/inspections.controller';
import { authGuard } from '../middlewares/auth.middleware';

const router = Router();

// API Root & Health Check
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TNT Inspection Management Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'TNT Inspection Management Backend',
    timestamp: new Date().toISOString()
  });
});

// Module routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/objects', objectsRoutes);
router.use('/plans', plansRoutes);
router.use('/adhoc-requests', adhocRoutes);
router.use('/inspections', inspectionsRoutes);
router.use('/catalogs', catalogsRoutes);
router.use('/configs', configsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/wards', wardsRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/reports', reportsRoutes);
router.use('/alerts', alertsRoutes);


// Additional catalog & recommendation direct endpoints for frontend convenience
router.get('/violation-catalog', authGuard, CatalogsController.getViolations);
router.get('/recommendation-tag-catalog', authGuard, CatalogsController.getRecommendationTags);
router.get('/recommendations', authGuard, InspectionsController.getRecommendations);

export default router;
