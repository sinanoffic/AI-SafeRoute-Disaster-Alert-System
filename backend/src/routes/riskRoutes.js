const express = require('express');
const { calculateRisk } = require('../controllers/riskController');
const router = express.Router();

router.post('/', calculateRisk);

module.exports = router;
