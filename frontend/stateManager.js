// ===========================
// stateManager.js – Central System Orchestrator (V3 – Predictive Pipeline)
// ===========================

const StateManager = (() => {

    /**
     * Central state update loop (V3 Pipeline).
     * Called on: rainfall change, time horizon change, SOS activation, location update.
     */
    function updateSystemState() {
        const timeHorizon = AppState.timeHorizon || 0;
        const deltaR = AppState.rainfall - (AppState.previousRainfall || 0);

        // V2 Pipeline: Full simulation (MCFRI-V2 → spillover → radius → future → adapt)
        const zones = RiskEngine.runFullSimulation(
            AppState.rainfall, 
            timeHorizon,
            AppState.moisture !== undefined ? AppState.moisture : 0.5,
            AppState.drainage !== undefined ? AppState.drainage : 0.5,
            AppState.permeability !== undefined ? AppState.permeability : 0.5,
            deltaR,
            AppState.handExposure !== undefined ? AppState.handExposure : 0.5
        );
        AppState.computedZones = zones;

        // Determine overall risk
        const overallRisk = RiskEngine.getOverallRisk(zones);
        const maxScore    = RiskEngine.getMaxRiskScore(zones);
        const zoneCounts  = RiskEngine.getZoneCounts(zones);
        AppState.maxRiskScore = maxScore;
        AppState.zoneCounts   = zoneCounts;

        // Update dashboard status (triggers alerts if threshold crossed)
        setRiskLevel(overallRisk);

        // Update live risk score on dashboard
        updateRiskScoreDisplay(maxScore);

        // Refresh map layers (if map is initialized)
        if (mapInitialized && AppState.map) {
            updateMapZones(zones);
        }

        // Recalculate routes (if a route is active)
        if (AppState.activeShelterId !== null) {
            recalculateActiveRoute();
        }

        // Update SOS priorities
        if (AppState.sosRequests.length > 0) {
            SOSEngine.calculatePriorities(AppState.sosRequests);
            renderAdminSOS();
        }

        // Update admin stats
        updateAdminStats();

        // V3: Enhanced simulator feedback with prediction data
        updateSimulatorFeedback();
    }

    /**
     * Update the risk score number on dashboard.
     */
    function updateRiskScoreDisplay(score) {
        const el = document.getElementById('live-risk-score');
        if (el) {
            el.textContent = score;
            el.className = 'risk-score-value';
            if (score > 140) el.classList.add('score-danger');
            else if (score >= 80) el.classList.add('score-warning');
            else el.classList.add('score-safe');
        }
    }

    /**
     * V3: Enhanced simulator feedback with prediction intelligence.
     */
    function updateSimulatorFeedback() {
        const simFeedback = document.getElementById('sim-feedback');
        if (!simFeedback) return;

        const zones = AppState.computedZones || [];
        const dangerCount  = zones.filter(z => z.level === 'danger').length;
        const warningCount = zones.filter(z => z.level === 'warning').length;
        const maxScore     = AppState.maxRiskScore || 0;
        const maxFuture    = RiskEngine.getMaxFutureRiskScore(zones);
        const spilloverCount = RiskEngine.getSpilloverCount(zones);
        const timeHorizon  = AppState.timeHorizon || 0;

        let text = '';
        if (dangerCount > 0) {
            text = `⚠️ HIGH RISK – ${dangerCount} danger zone(s). `;
            if (spilloverCount > 0) text += `Flood spreading to ${spilloverCount} neighbor(s). `;
            text += `Score: ${maxScore}`;
            if (timeHorizon > 0) text += ` → ${maxFuture} in ${timeHorizon}h`;
            text += '. Evacuation recommended.';
            simFeedback.style.background = 'rgba(239, 68, 68, 0.1)';
            simFeedback.style.color = '#ef4444';
            simFeedback.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        } else if (warningCount > 0) {
            text = `⚡ Moderate risk – ${warningCount} warning zone(s). Score: ${maxScore}`;
            if (timeHorizon > 0) text += ` → ${maxFuture} in ${timeHorizon}h`;
            text += '. Stay alert.';
            simFeedback.style.background = 'rgba(245, 158, 11, 0.1)';
            simFeedback.style.color = '#f59e0b';
            simFeedback.style.borderColor = 'rgba(245, 158, 11, 0.3)';
        } else {
            text = `✅ All zones safe. Score: ${maxScore}`;
            if (timeHorizon > 0) text += ` → ${maxFuture} in ${timeHorizon}h`;
            text += '. Normal conditions.';
            simFeedback.style.background = 'rgba(34, 197, 94, 0.1)';
            simFeedback.style.color = '#22c55e';
            simFeedback.style.borderColor = 'rgba(34, 197, 94, 0.3)';
        }

        simFeedback.textContent = text;

        // V3: Update prediction readout panel
        updatePredictionPanel(zones);
    }

    /**
     * V3: Render per-zone prediction details in the simulator.
     */
    function updatePredictionPanel(zones) {
        const panel = document.getElementById('prediction-panel');
        if (!panel) return;

        const timeHorizon = AppState.timeHorizon || 0;
        const adaptive = RiskEngine.getAdaptiveState();

        panel.innerHTML = zones.map(zone => {
            const futureScore = zone.futureRiskScore || zone.riskScore;
            const delta = futureScore - zone.riskScore;
            const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
            const deltaClass = delta > 0 ? 'prediction-up' : (delta < 0 ? 'prediction-down' : 'prediction-stable');
            const spillover = zone.spilloverReceived ? ` (+${zone.spilloverReceived} spillover)` : '';

            return `
                <div class="prediction-zone-row">
                    <div class="prediction-zone-name">
                        <span class="prediction-dot" style="background:${zone.color}"></span>
                        ${zone.label}
                    </div>
                    <div class="prediction-scores">
                        <span class="prediction-current">${zone.riskScore}</span>
                        ${timeHorizon > 0 ? `<span class="prediction-arrow">→</span><span class="prediction-future ${deltaClass}">${futureScore} (${deltaStr})</span>` : ''}
                    </div>
                    <span class="prediction-spillover">${spillover}</span>
                </div>
            `;
        }).join('');

        // V2: Adaptive weights indicator
        const weightsEl = document.getElementById('adaptive-weights');
        if (weightsEl) {
            weightsEl.innerHTML = `<span>AI Weights: wRM×${adaptive.wRM.toFixed(2)} | wW×${adaptive.wW.toFixed(2)} | wT×${adaptive.wT.toFixed(2)} | wD×${adaptive.wD.toFixed(2)}</span>`;
        }

        // V2: Risk Breakdown Panel
        const breakdownPanel = document.getElementById('breakdown-panel');
        if (breakdownPanel && zones.length > 0) {
            // Find the zone with highest risk for breakdown display
            const topZone = zones.reduce((a, b) => a.riskScore > b.riskScore ? a : b);
            if (topZone.components) {
                const c = topZone.components;
                const w = topZone.weights;
                const maxContrib = Math.max(
                    c.rainfallMoisture * w.rainfallMoisture,
                    c.waterDrainage * w.waterDrainage,
                    c.topographicLandUse * w.topographicLandUse,
                    c.rainfallAcceleration * w.rainfallAcceleration,
                    0.01
                );

                breakdownPanel.innerHTML = `
                    <div class="breakdown-zone-label">${topZone.label} (Score: ${topZone.riskScore})</div>
                    ${renderBreakdownBar('Rainfall × Moisture', c.rainfallMoisture * w.rainfallMoisture, maxContrib, '#3b82f6')}
                    ${renderBreakdownBar('Water × Drainage', c.waterDrainage * w.waterDrainage, maxContrib, '#06b6d4')}
                    ${renderBreakdownBar('Topographic × LandUse', c.topographicLandUse * w.topographicLandUse, maxContrib, '#8b5cf6')}
                    ${renderBreakdownBar('Rainfall Acceleration', c.rainfallAcceleration * w.rainfallAcceleration, maxContrib, '#f59e0b')}
                    ${topZone.explanation ? `<div class="breakdown-explanation">${topZone.explanation}</div>` : ''}
                `;
            }
        }
    }

    function renderBreakdownBar(label, value, maxValue, color) {
        const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
        return `
            <div class="breakdown-row">
                <span class="breakdown-label">${label}</span>
                <div class="breakdown-bar-bg">
                    <div class="breakdown-bar-fill" style="width:${pct}%; background:${color};"></div>
                </div>
                <span class="breakdown-value">${(value * 200).toFixed(1)}</span>
            </div>
        `;
    }

    // Periodic SOS priority refresh (every 30s)
    setInterval(() => {
        if (AppState.sosRequests.length > 0) {
            SOSEngine.calculatePriorities(AppState.sosRequests);
            renderAdminSOS();
            updateAdminStats();
        }
    }, 30000);

    return {
        updateSystemState,
    };
})();
