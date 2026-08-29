import { Router } from 'express';
import { listInjuries } from '../injuries/injuries-controller.js';

const router = Router();

router.get('/', listInjuries);

export default router;
