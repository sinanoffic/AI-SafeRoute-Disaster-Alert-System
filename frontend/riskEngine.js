// ===========================
// riskEngine.js – MCFRI-V2 Normalized Non-Linear Risk Engine
// Engine Version: MCFRI-V2
// ===========================
//
// IMPORTANT: Parameters are UNVALIDATED DEVELOPMENT DEFAULTS.
// Parameters require empirical calibration and validation.
//
// Pipeline: RAW INPUTS → VALIDATION → NORMALIZATION → COMPONENT CALC
//           → WEIGHTED SCORE → CLAMP [0,200] → CLASSIFICATION → UI

const RiskEngine = (() => {

    // ---- Developer Feature Flag: set to true to use legacy V1 engine ----
    const USE_V1_ENGINE = false;

    // ---- Zone Base Data (unchanged) ----
    const zoneBaseData = [
        { id: 'zone-a', center: [12.975, 77.590], baseRadius: 500, label: 'Flood Zone A',       elevationFactor: 1,   proximityToWater: 5 },
        { id: 'zone-b', center: [12.968, 77.600], baseRadius: 400, label: 'Low-Lying Area B',    elevationFactor: 2,   proximityToWater: 3 },
        { id: 'zone-c', center: [12.980, 77.597], baseRadius: 600, label: 'Elevated Area C',     elevationFactor: 5,   proximityToWater: 1 },
        { id: 'zone-d', center: [12.963, 77.585], baseRadius: 450, label: 'River Proximity D',   elevationFactor: 1.5, proximityToWater: 4.5 },
        { id: 'zone-e', center: [12.978, 77.608], baseRadius: 350, label: 'Drainage Issue E',    elevationFactor: 3,   proximityToWater: 2.5 },
    ];

    // ---- Adaptive Weight State ----
    const adaptiveState = {
        wRM: MCFRI_CONFIG.wRM,
        wW:  MCFRI_CONFIG.wW,
        wT:  MCFRI_CONFIG.wT,
        wD:  MCFRI_CONFIG.wD,
        history: [],
        maxHistory: MCFRI_CONFIG.adaptive.maxHistory,
    };

    // ==================================================================
    // INPUT VALIDATION
    // ==================================================================
    function validateNumber(value, fallback, name) {
        if (value === null || value === undefined || typeof value !== 'number' || !isFinite(value) || isNaN(value)) {
            console.warn(`[MCFRI-V2] Invalid input for "${name}": ${value}. Using fallback: ${fallback}`);
            return fallback;
        }
        return value;
    }

    function validatePositive(value, fallback, name) {
        const v = validateNumber(value, fallback, name);
        return v < 0 ? (console.warn(`[MCFRI-V2] Negative value for "${name}": ${v}. Using 0.`), 0) : v;
    }

    // ==================================================================
    // NORMALIZATION LAYER (dedicated functions, no duplication)
    // ==================================================================

    /**
     * Normalize rainfall using Michaelis-Menten saturation curve.
     * @param {number} R - Raw rainfall in mm (>=0)
     * @param {number} R0 - Half-saturation constant
     * @returns {number} Normalized rainfall in [0, 1)
     */
    function normalizeRainfall(R, R0) {
        const r = validatePositive(R, 0, 'rainfall');
        const r0 = validatePositive(R0, MCFRI_CONFIG.R0, 'R0');
        if (r0 === 0) return r > 0 ? 1 : 0;
        return r / (r + r0);
    }

    /**
     * Normalize soil moisture. Already expected 0–1.
     * @param {number} m - Raw soil moisture
     * @returns {number} Clamped to [0, 1]
     */
    function normalizeSoilMoisture(m) {
        return Math.max(0, Math.min(1, validateNumber(m, 0.5, 'soilMoisture')));
    }

    /**
     * Normalize water proximity from zone's raw 1–5 scale to 0–1.
     * @param {number} p - Raw proximity (1=low, 5=high)
     * @returns {number} Normalized in [0, 1]
     */
    function normalizeWaterProximity(p) {
        const raw = validatePositive(p, 0, 'waterProximity');
        return Math.max(0, Math.min(1, raw / 5));
    }

    /**
     * Normalize drainage quality. Expected 0–1.
     * 0 = very poor, 1 = very good.
     * @param {number} d - Raw drainage value
     * @returns {number} Clamped to [0, 1]
     */
    function normalizeDrainage(d) {
        return Math.max(0, Math.min(1, validateNumber(d, 0.5, 'drainage')));
    }

    /**
     * Normalize topographic exposure (HAND equivalent).
     * Maps zone's elevationFactor (1–5) to 0–1.
     * Higher h = safer (less flood-exposed).
     * @param {number} elevationFactor - Raw elevation factor from zone data
     * @returns {number} Normalized in [0, 1]
     */
    function normalizeHAND(elevationFactor) {
        const raw = validatePositive(elevationFactor, 1, 'HAND/elevationFactor');
        // Map 1–5 to 0–1: (val - 1) / (5 - 1)
        return Math.max(0, Math.min(1, (raw - 1) / 4));
    }

    /**
     * Normalize land-surface permeability. Expected 0–1.
     * 0 = impervious (concrete), 1 = permeable (forest).
     * @param {number} l - Raw permeability
     * @returns {number} Clamped to [0, 1]
     */
    function normalizePermeability(l) {
        return Math.max(0, Math.min(1, validateNumber(l, 0.5, 'permeability')));
    }

    /**
     * Normalize rainfall rate of change using Michaelis-Menten.
     * Only positive changes contribute (flash flood detection).
     * @param {number} dR - Raw rainfall rate change
     * @param {number} Q0 - Rate half-saturation constant
     * @returns {number} Normalized in [0, 1)
     */
    function normalizeRainfallRate(dR, Q0) {
        const positiveDR = Math.max(0, validateNumber(dR, 0, 'rainfallRate'));
        const q0 = validatePositive(Q0, MCFRI_CONFIG.Q0, 'Q0');
        if (q0 === 0) return positiveDR > 0 ? 1 : 0;
        return positiveDR / (positiveDR + q0);
    }

    // ==================================================================
    // MCFRI-V2 COMPONENT CALCULATIONS
    // ==================================================================

    /**
     * Calculate the Rainfall-Moisture component (FRM).
     * FRM = r^alpha * ((exp(beta*m) - 1) / (exp(beta) - 1))
     */
    function calcFRM(r, m, alpha, beta) {
        const rTerm = Math.pow(r, alpha);
        const denominator = Math.exp(beta) - 1;
        if (denominator === 0) return rTerm;
        const moistureTerm = (Math.exp(beta * m) - 1) / denominator;
        return rTerm * moistureTerm;
    }

    /**
     * Calculate the Water-Drainage component (FW).
     * FW = p^gamma * (1-d)^delta
     */
    function calcFW(p, d, gamma, delta) {
        return Math.pow(p, gamma) * Math.pow(1 - d, delta);
    }

    /**
     * Calculate the Topographic-LandUse component (FT).
     * FT = (1-h)^epsilon * (1-l)
     */
    function calcFT(h, l, epsilon) {
        return Math.pow(1 - h, epsilon) * (1 - l);
    }

    /**
     * Calculate the Rainfall Acceleration component (FDelta).
     * FDelta = q^eta
     */
    function calcFDelta(q, eta) {
        return Math.pow(q, eta);
    }

    // ==================================================================
    // EXPLAINABILITY (deterministic, no LLM)
    // ==================================================================

    function generateExplanation(components, weights, normalizedInputs) {
        const contributions = [
            { name: 'rainfall intensity and soil moisture', value: components.rainfallMoisture * weights.rainfallMoisture },
            { name: 'water proximity with poor drainage',   value: components.waterDrainage * weights.waterDrainage },
            { name: 'topographic exposure and impervious land', value: components.topographicLandUse * weights.topographicLandUse },
            { name: 'rapid rainfall acceleration',          value: components.rainfallAcceleration * weights.rainfallAcceleration },
        ];

        contributions.sort((a, b) => b.value - a.value);

        const significant = contributions.filter(c => c.value > 0.05);
        if (significant.length === 0) {
            return "Risk is minimal. All environmental factors are within safe ranges.";
        }

        const primary = significant[0];
        let explanation = `Risk is primarily driven by ${primary.name}`;

        if (significant.length > 1) {
            explanation += `, with secondary contribution from ${significant[1].name}`;
        }
        explanation += '.';

        return explanation;
    }

    // ==================================================================
    // RISK CLASSIFICATION
    // ==================================================================

    function classifyRisk(score) {
        const t = MCFRI_CONFIG.thresholds;
        if (score > t.warning) {
            return {
                level: 'danger',
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.30,
            };
        } else if (score >= t.safe) {
            return {
                level: 'warning',
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.20,
            };
        }
        return {
            level: 'safe',
            color: '#22c55e',
            fillColor: '#22c55e',
            fillOpacity: 0.12,
        };
    }

    // ==================================================================
    // HAVERSINE DISTANCE (unchanged utility)
    // ==================================================================

    function haversineDistance(a, b) {
        const R = 6371000;
        const dLat = (b[0] - a[0]) * Math.PI / 180;
        const dLng = (b[1] - a[1]) * Math.PI / 180;
        const sinLat = Math.sin(dLat / 2);
        const sinLng = Math.sin(dLng / 2);
        const h = sinLat * sinLat +
                  Math.cos(a[0] * Math.PI / 180) * Math.cos(b[0] * Math.PI / 180) *
                  sinLng * sinLng;
        return 2 * R * Math.asin(Math.sqrt(h));
    }

    // ==================================================================
    // RUNTIME WEIGHT NORMALIZATION
    // ==================================================================

    function getNormalizedWeights() {
        const sum = adaptiveState.wRM + adaptiveState.wW + adaptiveState.wT + adaptiveState.wD;
        if (Math.abs(sum - 1.0) > MCFRI_CONFIG.weightSumTolerance) {
            return {
                wRM: adaptiveState.wRM / sum,
                wW:  adaptiveState.wW / sum,
                wT:  adaptiveState.wT / sum,
                wD:  adaptiveState.wD / sum,
            };
        }
        return {
            wRM: adaptiveState.wRM,
            wW:  adaptiveState.wW,
            wT:  adaptiveState.wT,
            wD:  adaptiveState.wD,
        };
    }

    // ==================================================================
    // 1. MCFRI-V2 CORE CALCULATION
    // ==================================================================

    function calculateMCFRIV2Risks(rainfall, moisture, drainage, permeability, deltaR, handExposure) {
        const cfg = MCFRI_CONFIG;
        const shelters = cfg.shelterProtection.locations;
        const w = getNormalizedWeights();

        return zoneBaseData.map(zone => {
            // ---- STEP 1: NORMALIZE all inputs ----
            const norm = {
                rainfall:       normalizeRainfall(rainfall, cfg.R0),
                soilMoisture:   normalizeSoilMoisture(moisture),
                waterProximity: normalizeWaterProximity(zone.proximityToWater),
                drainage:       normalizeDrainage(drainage),
                handExposure:   normalizeHAND(zone.elevationFactor),
                permeability:   normalizePermeability(permeability),
                rainfallRate:   normalizeRainfallRate(deltaR, cfg.Q0),
            };

            // Override HAND with user slider if provided (blend zone data + user input)
            // User slider acts as a global modifier; zone elevation is the base
            if (handExposure !== undefined && handExposure !== null) {
                // Average of zone-intrinsic HAND and user-controlled global exposure
                norm.handExposure = Math.max(0, Math.min(1,
                    (norm.handExposure + normalizeSoilMoisture(handExposure)) / 2
                ));
            }

            // ---- STEP 2: CALCULATE COMPONENTS ----
            const components = {
                rainfallMoisture:     calcFRM(norm.rainfall, norm.soilMoisture, cfg.alpha, cfg.beta),
                waterDrainage:        calcFW(norm.waterProximity, norm.drainage, cfg.gamma, cfg.delta),
                topographicLandUse:   calcFT(norm.handExposure, norm.permeability, cfg.epsilon),
                rainfallAcceleration: calcFDelta(norm.rainfallRate, cfg.eta),
            };

            // ---- STEP 3: WEIGHTED SUM ----
            let rawScore = cfg.scoreMax * (
                w.wRM * components.rainfallMoisture +
                w.wW  * components.waterDrainage +
                w.wT  * components.topographicLandUse +
                w.wD  * components.rainfallAcceleration
            );

            // ---- STEP 4: SHELTER PROTECTION (preserved from V1) ----
            let protectionBonus = 0;
            shelters.forEach(sLoc => {
                const distToShelter = haversineDistance(zone.center, sLoc);
                if (distToShelter < cfg.shelterProtection.radius) {
                    const proxFactor = 1 - (distToShelter / cfg.shelterProtection.radius);
                    protectionBonus += cfg.shelterProtection.maxBonus * proxFactor;
                }
            });
            rawScore = (rawScore - protectionBonus) * cfg.shelterProtection.dampening;

            // ---- STEP 5: CLAMP to [0, 200] ----
            const score = Math.max(cfg.scoreMin, Math.min(cfg.scoreMax, Math.round(rawScore)));

            // ---- STEP 6: CLASSIFY ----
            const classification = classifyRisk(score);

            // ---- STEP 7: EXPLAIN ----
            const explanation = generateExplanation(components, {
                rainfallMoisture: w.wRM,
                waterDrainage: w.wW,
                topographicLandUse: w.wT,
                rainfallAcceleration: w.wD,
            }, norm);

            // ---- Return rich result object ----
            return {
                ...zone,
                riskScore: score,
                protectionApplied: Math.round(protectionBonus),
                ...classification,
                // V2 Rich Data
                normalizedInputs: norm,
                components,
                weights: { rainfallMoisture: w.wRM, waterDrainage: w.wW, topographicLandUse: w.wT, rainfallAcceleration: w.wD },
                explanation,
                engineVersion: cfg.engineVersion,
                timestamp: Date.now(),
            };
        });
    }

    // ==================================================================
    // 2. ZONE SPILLOVER EFFECT (preserved from V1)
    // ==================================================================

    function applyZoneSpillover(zones) {
        const cfg = MCFRI_CONFIG.spillover;
        const spilloverBonus = zones.map(() => 0);

        zones.forEach((srcZone, srcIdx) => {
            if (srcZone.riskScore <= cfg.triggerThreshold) return;

            zones.forEach((tgtZone, tgtIdx) => {
                if (srcIdx === tgtIdx) return;
                const dist = haversineDistance(srcZone.center, tgtZone.center);
                if (dist <= cfg.radius) {
                    const proximityFactor = 1 - (dist / cfg.radius);
                    spilloverBonus[tgtIdx] += srcZone.riskScore * cfg.transferRate * proximityFactor;
                }
            });
        });

        return zones.map((zone, idx) => {
            if (spilloverBonus[idx] === 0) return zone;

            const newScore = Math.max(MCFRI_CONFIG.scoreMin,
                Math.min(MCFRI_CONFIG.scoreMax, Math.round(zone.riskScore + spilloverBonus[idx])));
            const classification = classifyRisk(newScore);

            return {
                ...zone,
                riskScore: newScore,
                spilloverReceived: Math.round(spilloverBonus[idx]),
                ...classification,
            };
        });
    }

    // ==================================================================
    // 3. FUTURE RISK PREDICTION (preserved from V1)
    // ==================================================================

    function calculateFutureRisk(zones, rainfall, timeHorizon) {
        return zones.map(zone => {
            const rainfallTrend = rainfall / 50;
            const waterAccumulationFactor = (zone.normalizedInputs ? zone.normalizedInputs.waterProximity : 0.5) * 10;

            const futureRiskScore = Math.max(MCFRI_CONFIG.scoreMin, Math.min(MCFRI_CONFIG.scoreMax, Math.round(
                zone.riskScore +
                (rainfallTrend * timeHorizon) +
                (waterAccumulationFactor * timeHorizon)
            )));

            const futureClassification = classifyRisk(futureRiskScore);
            const futureRadius = zone.baseRadius + (zone.baseRadius * (futureRiskScore / MCFRI_CONFIG.scoreMax));

            return {
                ...zone,
                futureRiskScore,
                futureLevel: futureClassification.level,
                futureColor: futureClassification.color,
                futureFillColor: futureClassification.fillColor,
                futureFillOpacity: futureClassification.fillOpacity * 0.5,
                futureRadius,
            };
        });
    }

    // ==================================================================
    // 4. DYNAMIC RADIUS (preserved)
    // ==================================================================

    function updateDynamicRadius(zones) {
        return zones.map(zone => ({
            ...zone,
            dynamicRadius: zone.baseRadius + (zone.baseRadius * (zone.riskScore / MCFRI_CONFIG.scoreMax)),
        }));
    }

    // ==================================================================
    // 5. ADAPTIVE WEIGHT ADJUSTMENT (preserved, updated for V2 weights)
    // ==================================================================

    function adjustWeights(zones) {
        const snapshot = {
            timestamp: Date.now(),
            maxScore: getMaxRiskScore(zones),
            avgScore: Math.round(zones.reduce((s, z) => s + z.riskScore, 0) / zones.length),
        };
        adaptiveState.history.push(snapshot);
        if (adaptiveState.history.length > adaptiveState.maxHistory) {
            adaptiveState.history.shift();
        }

        if (adaptiveState.history.length < 3) return;

        const recent = adaptiveState.history.slice(-3);
        const trend = recent[2].maxScore - recent[0].maxScore;
        const bounds = MCFRI_CONFIG.adaptive.bounds;
        const step = MCFRI_CONFIG.adaptive.adjustmentStep;

        if (trend > MCFRI_CONFIG.adaptive.trendThreshold) {
            // Risk climbing: increase rainfall-moisture sensitivity
            adaptiveState.wRM = Math.min(adaptiveState.wRM + step, bounds.wRM.max);
            adaptiveState.wD  = Math.min(adaptiveState.wD + step * 0.5, bounds.wD.max);
        } else if (trend < -MCFRI_CONFIG.adaptive.trendThreshold) {
            // Risk dropping: relax
            adaptiveState.wRM = Math.max(adaptiveState.wRM - step, bounds.wRM.min);
            adaptiveState.wD  = Math.max(adaptiveState.wD - step * 0.5, bounds.wD.min);
        }
    }

    // ==================================================================
    // 6. FULL PIPELINE
    // ==================================================================

    function runFullSimulation(rainfall, timeHorizon, moisture, drainage, permeability, deltaR, handExposure) {
        // Default values
        moisture     = moisture     !== undefined ? moisture     : 0.5;
        drainage     = drainage     !== undefined ? drainage     : 0.5;
        permeability = permeability !== undefined ? permeability : 0.5;
        deltaR       = deltaR       !== undefined ? deltaR       : 0;
        handExposure = handExposure !== undefined ? handExposure : 0.5;

        // Step 1: MCFRI-V2 calculation
        let zones = calculateMCFRIV2Risks(rainfall, moisture, drainage, permeability, deltaR, handExposure);

        // Step 2: Spillover
        zones = applyZoneSpillover(zones);

        // Step 3: Dynamic radius
        zones = updateDynamicRadius(zones);

        // Step 4: Future prediction
        zones = calculateFutureRisk(zones, rainfall, timeHorizon);

        // Step 5: Adaptive weight adjustment
        adjustWeights(zones);

        return zones;
    }

    // ==================================================================
    // UTILITY FUNCTIONS (preserved API)
    // ==================================================================

    function getOverallRisk(zones) {
        const hasDanger  = zones.some(z => z.level === 'danger');
        const hasWarning = zones.some(z => z.level === 'warning');
        if (hasDanger) return 'danger';
        if (hasWarning) return 'warning';
        return 'safe';
    }

    function getZoneCounts(zones) {
        return {
            danger:  zones.filter(z => z.level === 'danger').length,
            warning: zones.filter(z => z.level === 'warning').length,
            safe:    zones.filter(z => z.level === 'safe').length,
        };
    }

    function getMaxRiskScore(zones) {
        return Math.max(...zones.map(z => z.riskScore));
    }

    function getMaxFutureRiskScore(zones) {
        return Math.max(...zones.map(z => z.futureRiskScore || z.riskScore));
    }

    function getSpilloverCount(zones) {
        return zones.filter(z => z.spilloverReceived && z.spilloverReceived > 0).length;
    }

    function getAdaptiveState() {
        return { ...adaptiveState };
    }

    // Legacy compatibility
    function calculateZoneRisks(rainfall) {
        return runFullSimulation(rainfall, 0);
    }

    // Public API
    return {
        zoneBaseData,
        calculateZoneRisks,
        runFullSimulation,
        calculateMCFRIV2Risks,
        applyZoneSpillover,
        calculateFutureRisk,
        updateDynamicRadius,
        adjustWeights,
        getOverallRisk,
        getZoneCounts,
        getMaxRiskScore,
        getMaxFutureRiskScore,
        getSpilloverCount,
        getAdaptiveState,
        // V2 Normalization exports (for testing)
        normalizeRainfall,
        normalizeSoilMoisture,
        normalizeWaterProximity,
        normalizeDrainage,
        normalizeHAND,
        normalizePermeability,
        normalizeRainfallRate,
    };

})();
