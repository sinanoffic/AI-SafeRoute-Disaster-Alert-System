const express = require('express');
const { getShelters, seedShelters } = require('../controllers/shelterController');
const router = express.Router();

router.get('/', getShelters);
router.post('/seed', seedShelters); // Utility to populate DB

module.exports = router;
