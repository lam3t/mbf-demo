import { Router } from 'express';
import { TeamsController } from '../controllers/teams.controller';
import { authGuard } from '../middlewares/auth.middleware';
import { auditLogger } from '../middlewares/audit.middleware';

const router = Router();

router.use(authGuard);

router.get('/', TeamsController.getAll);
router.get('/:id', TeamsController.getById);
router.post('/', auditLogger('CREATE_TEAM', 'INSPECTION_TEAMS'), TeamsController.create);
router.put('/:id', auditLogger('UPDATE_TEAM', 'INSPECTION_TEAMS'), TeamsController.update);
router.delete('/:id', auditLogger('DELETE_TEAM', 'INSPECTION_TEAMS'), TeamsController.delete);

export default router;

