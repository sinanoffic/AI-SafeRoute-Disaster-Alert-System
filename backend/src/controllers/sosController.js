const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Simple mock wait time for simulation (could be dynamically provided or calculated)
const calculateWaitTime = () => Math.floor(Math.random() * 60) + 1; // 1 to 60 mins

exports.createSOSAlert = async (req, res) => {
    try {
        const { user, location, riskLevel } = req.body;
        
        if (!user || !location || location.length !== 2 || !riskLevel) {
            return res.status(400).json({ error: "Missing or invalid required fields" });
        }

        let baseScore = 0;
        if (riskLevel === 'danger') baseScore = 50;
        else if (riskLevel === 'warning') baseScore = 20;

        const waitTime = calculateWaitTime();
        // Capped time multiplier for urgency
        const timeMultiplier = Math.min(waitTime * 1.5, 50); 
        
        const priorityScore = Math.floor(baseScore + timeMultiplier);

        let priorityLabel = 'Low';
        if (priorityScore >= 75) priorityLabel = 'High';
        else if (priorityScore >= 40) priorityLabel = 'Medium';

        const alert = await prisma.sOSAlert.create({
            data: {
                user,
                lat: location[0],
                lng: location[1],
                riskLevel,
                priorityLabel,
                priorityScore
            }
        });

        res.status(201).json(alert);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.getActiveSOSAlerts = async (req, res) => {
    try {
        const alerts = await prisma.sOSAlert.findMany({
            where: { status: 'Active' },
            orderBy: { priorityScore: 'desc' }
        });
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

exports.resolveSOSAlert = async (req, res) => {
    try {
        const { id } = req.params;
        const alert = await prisma.sOSAlert.update({
            where: { id: parseInt(id) },
            data: { status: 'Resolved' }
        });
        res.json(alert);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}
