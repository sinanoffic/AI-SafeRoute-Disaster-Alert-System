// Migrated from frontend riskEngine.js
exports.calculateRisk = (req, res) => {
    try {
        const { rainfall, elevationFactor, proximityToWater } = req.body;
        
        if (rainfall === undefined || elevationFactor === undefined || proximityToWater === undefined) {
            return res.status(400).json({ error: "Missing required parameters" });
        }

        const riskScore = Math.max(0, Math.round(
            (rainfall * 0.5) + (proximityToWater * 40) - (elevationFactor * 25)
        ));

        let riskLevel = 'safe';
        if (riskScore >= 140) riskLevel = 'danger';
        else if (riskScore >= 80) riskLevel = 'warning';

        res.json({ riskScore, riskLevel });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
