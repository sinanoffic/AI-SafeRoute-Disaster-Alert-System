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

        // V3 Pipeline: Full simulation (MCFRI → spillover → radius → future → adapt)
        const zones = RiskEngine.runFullSimulation(
            AppState.rainfall, 
            timeHorizon,
            AppState.moisture !== undefined ? AppState.moisture : 0.5,
            AppState.drainage !== undefined ? AppState.drainage : 5,
            AppState.permeability !== undefined ? AppState.permeability : 0.5,
            deltaR
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
            text = `⚠️ Prototype modeled risk: HIGH – ${dangerCount} danger-classified zone(s). `;
            if (spilloverCount > 0) text += `Modeled spillover affects ${spilloverCount} neighboring zone(s). `;
            text += `Score: ${maxScore}`;
            if (timeHorizon > 0) text += ` → ${maxFuture} in ${timeHorizon}h`;
            text += '. Prototype indicator only; follow official emergency guidance for any real-world evacuation decision.';
            simFeedback.style.background = 'rgba(239, 68, 68, 0.1)';
            simFeedback.style.color = '#ef4444';
            simFeedback.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        } else if (warningCount > 0) {
            text = `⚡ Prototype modeled risk: MODERATE – ${warningCount} warning-classified zone(s). Score: ${maxScore}`;
            if (timeHorizon > 0) text += ` → ${maxFuture} in ${timeHorizon}h`;
            text += '. Review official local guidance for real-world conditions.';
            simFeedback.style.background = 'rgba(245, 158, 11, 0.1)';
            simFeedback.style.color = '#f59e0b';
            simFeedback.style.borderColor = 'rgba(245, 158, 11, 0.3)';
        } else {
            text = `✅ All zones are currently classified as low modeled risk under the selected simulated inputs. Score: ${maxScore}`;
            if (timeHorizon > 0) text += ` → ${maxFuture} in ${timeHorizon}h`;
            text += '. This is a prototype classification, not a real-world safety guarantee.';
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

        // Adaptive weights indicator
        const weightsEl = document.getElementById('adaptive-weights');
        if (weightsEl) {
            weightsEl.innerHTML = `<span>Adaptive heuristic weights: R×${adaptive.rainfallWeight.toFixed(4)} | W×${adaptive.proximityWeight.toFixed(2)} | E×${adaptive.elevationWeight.toFixed(1)}</span>`;
        }
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
