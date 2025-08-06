import express from 'express';
import { enhancedVoiceQuery, enhancedResetSession} from '../controllers/voiceController.js';

const router = express.Router();

router.post('/voice-query', enhancedVoiceQuery);
router.post('/voice-reset', enhancedResetSession);

export default router;
