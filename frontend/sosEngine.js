// ===========================
// sosEngine.js – SOS Priority Intelligence Module
// ===========================

const SOSEngine = (() => {

    /**
     * Create a new SOS request with enriched data.
     * @param {Array} location – [lat, lng]
     * @param {string} overallRisk – 'safe'|'warning'|'danger'
     * @returns {Object} enriched SOS request
     */
    function createRequest(location, overallRisk) {
        const riskNumeric = overallRisk === 'danger' ? 3 : overallRisk === 'warning' ? 2 : 1;
        return {
            id: Date.now(),
            user: 'User #' + Math.floor(Math.random() * 9000 + 1000),
            location: [...location],
            locationStr: `${location[0].toFixed(4)}, ${location[1].toFixed(4)}`,
            timestamp: Date.now(),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            riskLevel: riskNumeric, // 1=safe, 2=warning, 3=danger
            isStatic: Math.random() > 0.4, // 60% chance user is stationary
            priorityScore: 0,
            priorityLabel: 'LOW',
        };
    }

    /**
     * Calculate priority scores for all SOS requests.
     * Formula: (riskLevel * 50) + (minutesWaiting * 2) + (isStatic ? 30 : 0)
     * @param {Array} requests
     * @returns {Array} sorted by priority (highest first)
     */
    function calculatePriorities(requests) {
        const now = Date.now();

        requests.forEach(req => {
            const minutesWaiting = (now - req.timestamp) / 60000;
            req.priorityScore = Math.round(
                (req.riskLevel * 50) + (minutesWaiting * 2) + (req.isStatic ? 30 : 0)
            );

            if (req.priorityScore > 120) {
                req.priorityLabel = 'HIGH';
            } else if (req.priorityScore >= 70) {
                req.priorityLabel = 'MEDIUM';
            } else {
                req.priorityLabel = 'LOW';
            }
        });

        // Sort descending by priority
        requests.sort((a, b) => b.priorityScore - a.priorityScore);
        return requests;
    }

    /**
     * Get counts per priority level.
     */
    function getPriorityCounts(requests) {
        return {
            high:   requests.filter(r => r.priorityLabel === 'HIGH').length,
            medium: requests.filter(r => r.priorityLabel === 'MEDIUM').length,
            low:    requests.filter(r => r.priorityLabel === 'LOW').length,
        };
    }

    /**
     * Get badge color class for a priority label.
     */
    function priorityBadgeClass(label) {
        if (label === 'HIGH')   return 'priority-high';
        if (label === 'MEDIUM') return 'priority-medium';
        return 'priority-low';
    }

    /**
     * Get emoji for a priority label.
     */
    function priorityEmoji(label) {
        if (label === 'HIGH')   return '🔴';
        if (label === 'MEDIUM') return '🟡';
        return '🟢';
    }

    return {
        createRequest,
        calculatePriorities,
        getPriorityCounts,
        priorityBadgeClass,
        priorityEmoji,
    };
})();
