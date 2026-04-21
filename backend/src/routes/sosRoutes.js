const express = require('express');
const { createSOSAlert, getActiveSOSAlerts, resolveSOSAlert } = require('../controllers/sosController');
const router = express.Router();

router.post('/', createSOSAlert);
router.get('/', getActiveSOSAlerts);
router.patch('/:id/resolve', resolveSOSAlert);

module.exports = router;
