const express = require('express');
const router = express.Router();
const { 
  getMyInstitution, 
  getInstitutionLeaderboard, 
  getInstitutionActivities 
} = require('../controllers/institutionController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/my', getMyInstitution);
router.get('/leaderboard', getInstitutionLeaderboard);
router.get('/activities', getInstitutionActivities);

module.exports = router;
