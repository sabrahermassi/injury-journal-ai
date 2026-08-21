import { Router } from 'express';
import { askAgent } from '../ai-agent/ai-agent-controller.js';

const router = Router();

router.post('/', askAgent);

export default router;
