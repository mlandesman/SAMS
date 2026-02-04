import express from 'express';
import { authenticateUserWithProfile, enforceClientAccess } from '../middleware/clientAuth.js';
import {
  listPollsHandler,
  getPollHandler,
  createPollHandler,
  updatePollHandler,
  deletePollHandler,
  publishPollHandler,
  closePollHandler,
  archivePollHandler,
  recordResponseHandler,
  getResponsesHandler,
  generateVoteTokensHandler,
  validateVoteTokenHandler,
  submitVoteViaTokenHandler,
  sendPollNotificationsHandler,
} from '../controllers/pollsController.js';

const router = express.Router();

const clientRouter = express.Router({ mergeParams: true });

clientRouter.use(enforceClientAccess);

clientRouter.get('/polls', listPollsHandler);
clientRouter.get('/polls/:pollId', getPollHandler);
clientRouter.post('/polls', createPollHandler);
clientRouter.put('/polls/:pollId', updatePollHandler);
clientRouter.delete('/polls/:pollId', deletePollHandler);
clientRouter.post('/polls/:pollId/publish', publishPollHandler);
clientRouter.post('/polls/:pollId/close', closePollHandler);
clientRouter.post('/polls/:pollId/archive', archivePollHandler);
clientRouter.post('/polls/:pollId/responses', recordResponseHandler);
clientRouter.get('/polls/:pollId/responses', getResponsesHandler);
clientRouter.post('/polls/:pollId/generate-tokens', generateVoteTokensHandler);
clientRouter.post('/polls/:pollId/send-notifications', sendPollNotificationsHandler);

router.use(
  '/clients/:clientId',
  authenticateUserWithProfile,
  (req, res, next) => {
    const { clientId } = req.params;
    req.originalParams = req.originalParams || {};
    req.originalParams.clientId = clientId;
    next();
  },
  clientRouter
);

router.get('/:token', validateVoteTokenHandler);
router.post('/:token', submitVoteViaTokenHandler);

export default router;
