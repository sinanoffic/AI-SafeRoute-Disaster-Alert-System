const express = require('express');
const cors = require('cors');
require('dotenv').config();

const riskRoutes = require('./routes/riskRoutes');
const shelterRoutes = require('./routes/shelterRoutes');
const sosRoutes = require('./routes/sosRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/risk', riskRoutes);
app.use('/api/shelters', shelterRoutes);
app.use('/api/sos', sosRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'AI SafeRoute Backend is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 AI SafeRoute V2 Backend running on port ${PORT}`);
});
