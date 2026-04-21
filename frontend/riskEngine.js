// ===========================
// riskEngine.js – Predictive Non-Linear Environmental Simulation Engine (V3)
// ===========================

const RiskEngine = (() => {

    // Enhanced zone data with environmental factors
    const zoneBaseData = [
        { id: 'zone-a', center: [12.975, 77.590], baseRadius: 500, label: 'Flood Zone A',       elevationFactor: 1,   proximityToWater: 5 },
        { id: 'zone-b', center: [12.968, 77.600], baseRadius: 400, label: 'Low-Lying Area B',    elevationFactor: 2,   proximityToWater: 3 },
        { id: 'zone-c', center: [12.980, 77.597], baseRadius: 600, label: 'Elevated Area C',     elevationFactor: 5,   proximityToWater: 1 },
        { id: 'zone-d', center: [12.963, 77.585], baseRadius: 450, label: 'River Proximity D',   elevationFactor: 1.5, proximityToWater: 4.5 },
        { id: 'zone-e', center: [12.978, 77.608], baseRadius: 350, label: 'Drainage Issue E',    elevationFactor: 3,   proximityToWater: 2.5 },
    ];

    // ---- Adaptive Weight System (Light AI Memory) ----
    const adaptiveState = {
        rainfallWeight: 0.002,
        proximityWeight: 5,
        elevationWeight: 10,
        history: [],          // Last 5 simulation snapshots
        maxHistory: 5,
        // Safe bounds for weights
        bounds: {
            rainfallWeight:  { min: 0.001, max: 0.004 },
            proximityWeight: { min: 3,     max: 8 },
            elevationWeight: { min: 7,     max: 14 },
        }
    };

    // ---- Haversine distance (meters) between two [lat,lng] points ----
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

    // ---- Color/Level classification ----
    function classifyRisk(score) {
        if (score > 140) {
            return {
                level: 'danger',
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.30,
            };
        } else if (score >= 80) {
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

    // ============================================================
    // 1. NON-LINEAR RISK CALCULATION (With Shelter Protection)
    // ============================================================
    function calculateNonLinearRisks(rainfall) {
        // Known shelter locations (synchronized with app.js)
        const shelters = [
            [12.978, 77.591], // School
            [12.985, 77.605], // Hospital
            [12.970, 77.610], // Hall
            [12.965, 77.595], // St. Johns
            [12.982, 77.585], // Ambedkar
            [12.960, 77.600]  // Koramangala
        ];

        return zoneBaseData.map(zone => {
            // Base Risk Score Calculation
            let riskScore = (rainfall * rainfall * adaptiveState.rainfallWeight) +
                            (Math.pow(zone.proximityToWater, 3) * adaptiveState.proximityWeight) -
                            (Math.pow(zone.elevationFactor, 2) * adaptiveState.elevationWeight);

            // --- V3.1: SHELTER PROTECTION LOGIC (Inhibitor Field) ---
            // If the zone is near a shelter, it benefits from "Urban Engineering Protection"
            let protectionBonus = 0;
            shelters.forEach(sLoc => {
                const distToShelter = haversineDistance(zone.center, sLoc);
                if (distToShelter < 800) { // Within 800m of a shelter
                    // Add protection points based on proximity
                    const proxFactor = 1 - (distToShelter / 800);
                    protectionBonus += 40 * proxFactor; 
                }
            });

            // Apply protection: Subtract bonus and dampen sensitivity by 20%
            riskScore = (riskScore - protectionBonus) * 0.8;

            const rounded = Math.max(0, Math.round(riskScore));
            const classification = classifyRisk(rounded);

            return {
                ...zone,
                riskScore: rounded,
                protectionApplied: Math.round(protectionBonus),
                ...classification,
            };
        });
    }

    // ============================================================
    // 2. ZONE SPILLOVER EFFECT
    // ============================================================
    function applyZoneSpillover(zones) {
        const spilloverRadius = 2000; // meters – zones within 2km are affected

        // Work on a copy so we don't double-count
        const spilloverBonus = zones.map(() => 0);

        zones.forEach((srcZone, srcIdx) => {
            if (srcZone.riskScore <= 140) return; // Only danger zones spill

            zones.forEach((tgtZone, tgtIdx) => {
                if (srcIdx === tgtIdx) return;
                const dist = haversineDistance(srcZone.center, tgtZone.center);
                if (dist <= spilloverRadius) {
                    // Closer neighbors get more spillover
                    const proximityFactor = 1 - (dist / spilloverRadius);
                    spilloverBonus[tgtIdx] += srcZone.riskScore * 0.1 * proximityFactor;
                }
            });
        });

        // Apply spillover and reclassify
        return zones.map((zone, idx) => {
            if (spilloverBonus[idx] === 0) return zone;

            const newScore = Math.round(zone.riskScore + spilloverBonus[idx]);
            const classification = classifyRisk(newScore);

            return {
                ...zone,
                riskScore: newScore,
                spilloverReceived: Math.round(spilloverBonus[idx]),
                ...classification,
            };
        });
    }

    // ============================================================
    // 3. FUTURE RISK PREDICTION
    // ============================================================
    function calculateFutureRisk(zones, rainfall, timeHorizon) {
        return zones.map(zone => {
            const rainfallTrend = rainfall / 50;
            const waterAccumulationFactor = zone.proximityToWater * 2;

            const futureRiskScore = Math.max(0, Math.round(
                zone.riskScore +
                (rainfallTrend * timeHorizon) +
                (waterAccumulationFactor * timeHorizon)
            ));

            const futureClassification = classifyRisk(futureRiskScore);

            // Future dynamic radius (score-based)
            const futureRadius = zone.baseRadius + (zone.baseRadius * (futureRiskScore / 200));

            return {
                ...zone,
                // Keep current properties intact
                futureRiskScore,
                futureLevel: futureClassification.level,
                futureColor: futureClassification.color,
                futureFillColor: futureClassification.fillColor,
                futureFillOpacity: futureClassification.fillOpacity * 0.5, // Semi-transparent
                futureRadius,
            };
        });
    }

    // ============================================================
    // 4. DYNAMIC RADIUS (score-based, not rainfall-based)
    // ============================================================
    function updateDynamicRadius(zones) {
        return zones.map(zone => ({
            ...zone,
            dynamicRadius: zone.baseRadius + (zone.baseRadius * (zone.riskScore / 200)),
        }));
    }

    // ============================================================
    // 5. ADAPTIVE WEIGHT ADJUSTMENT (Light AI)
    // ============================================================
    function adjustWeights(zones) {
        // Store snapshot
        const snapshot = {
            timestamp: Date.now(),
            maxScore: getMaxRiskScore(zones),
            avgScore: Math.round(zones.reduce((s, z) => s + z.riskScore, 0) / zones.length),
        };
        adaptiveState.history.push(snapshot);
        if (adaptiveState.history.length > adaptiveState.maxHistory) {
            adaptiveState.history.shift();
        }

        // Need at least 3 snapshots to detect trend
        if (adaptiveState.history.length < 3) return;

        const recent = adaptiveState.history.slice(-3);
        const trend = recent[2].maxScore - recent[0].maxScore;

        // If risk is climbing fast, slightly increase sensitivity
        if (trend > 30) {
            adaptiveState.rainfallWeight = Math.min(
                adaptiveState.rainfallWeight + 0.0001,
                adaptiveState.bounds.rainfallWeight.max
            );
            adaptiveState.proximityWeight = Math.min(
                adaptiveState.proximityWeight + 0.02,
                adaptiveState.bounds.proximityWeight.max
            );
        }
        // If risk is dropping, relax weights slightly
        else if (trend < -30) {
            adaptiveState.rainfallWeight = Math.max(
                adaptiveState.rainfallWeight - 0.0001,
                adaptiveState.bounds.rainfallWeight.min
            );
            adaptiveState.proximityWeight = Math.max(
                adaptiveState.proximityWeight - 0.02,
                adaptiveState.bounds.proximityWeight.min
            );
        }
    }

    // ============================================================
    // 6. FULL PIPELINE (orchestrated by StateManager)
    // ============================================================
    function runFullSimulation(rainfall, timeHorizon) {
        // Step 1: Non-linear base calculation
        let zones = calculateNonLinearRisks(rainfall);

        // Step 2: Spillover
        zones = applyZoneSpillover(zones);

        // Step 3: Dynamic radius (current)
        zones = updateDynamicRadius(zones);

        // Step 4: Future prediction layer
        zones = calculateFutureRisk(zones, rainfall, timeHorizon);

        // Step 5: Adaptive weight adjustment
        adjustWeights(zones);

        return zones;
    }

    // ---- Utility functions (unchanged API) ----
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

    // ---- Legacy compatibility ----
    function calculateZoneRisks(rainfall) {
        return runFullSimulation(rainfall, 0);
    }

    // Public API
    return {
        zoneBaseData,
        calculateZoneRisks,       // Legacy compat
        runFullSimulation,        // New primary entry
        calculateNonLinearRisks,
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
    };

})();
