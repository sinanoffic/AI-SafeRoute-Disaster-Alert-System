// ===========================
// mcfriV2Config.js – MCFRI-V2 Centralized Configuration
// Engine Version: MCFRI-V2 (Normalized Non-Linear Risk Engine)
// ===========================
//
// IMPORTANT: All parameter values below are UNVALIDATED DEVELOPMENT DEFAULTS.
// They are provided solely for testing the interface and must be replaced
// with empirically calibrated values before operational deployment.
//
// Parameters require empirical calibration and validation.

const MCFRI_CONFIG = Object.freeze({

    // ---- Engine Identity ----
    engineVersion: "MCFRI-V2",
    engineLabel: "MCFRI-V2 — Normalized Non-Linear Risk Engine",
    parameterStatus: "UNVALIDATED DEVELOPMENT DEFAULTS",

    // ---- Research Pipeline Status ----
    // These fields are research-pipeline placeholders until the actual
    // data extraction system is connected.
    researchStage: "STAGE 1 — DATASET CONSTRUCTION",
    calibrationStatus: "NOT YET COMPLETED",
    validationStatus: "NOT YET COMPLETED",
    dataSourceStatus: "NOT YET CONNECTED",
    analysisGridResolution: "250m",
    modelStatus: "DEVELOPMENT MODEL",

    // ---- Exponent Parameters (UNVALIDATED) ----
    alpha:   1.5,    // Rainfall saturation exponent
    beta:    2.0,    // Moisture amplification exponent
    gamma:   2.0,    // Water proximity exponent
    delta:   1.5,    // Drainage quality exponent
    epsilon: 2.0,    // Topographic exposure exponent
    eta:     1.2,    // Rainfall acceleration exponent

    // ---- Scaling Constants (UNVALIDATED) ----
    R0: 150,   // Rainfall half-saturation constant (mm). At R=R0, normalized rainfall = 0.5
    Q0: 50,    // Rainfall-rate half-saturation constant (mm/event). At dR/dt=Q0, normalized rate = 0.5

    // ---- Component Weights (must sum to 1.0) ----
    wRM: 0.40,   // Rainfall-Moisture component weight
    wW:  0.25,   // Water-Drainage component weight
    wT:  0.20,   // Topographic-LandUse component weight
    wD:  0.15,   // Rainfall Acceleration (flash flood) component weight

    // ---- Classification Thresholds ----
    thresholds: Object.freeze({
        safe:    80,    // Score < 80 = Safe
        warning: 140,   // 80 <= Score <= 140 = Warning
        // Score > 140 = Danger
    }),

    // ---- Score Bounds ----
    scoreMin: 0,
    scoreMax: 200,

    // ---- Weight Sum Tolerance ----
    weightSumTolerance: 1e-6,

    // ---- Shelter Protection (preserved from V1) ----
    shelterProtection: Object.freeze({
        radius: 800,          // meters – protection field radius
        maxBonus: 40,         // max risk reduction points per shelter
        dampening: 0.8,       // 20% dampening factor after protection
        locations: Object.freeze([
            [12.978, 77.591],  // School
            [12.985, 77.605],  // Hospital
            [12.970, 77.610],  // Hall
            [12.965, 77.595],  // St. Johns
            [12.982, 77.585],  // Ambedkar
            [12.960, 77.600],  // Koramangala
        ]),
    }),

    // ---- Spillover Configuration ----
    spillover: Object.freeze({
        triggerThreshold: 140,   // Only danger zones spill
        radius: 2000,            // meters
        transferRate: 0.10,      // 10% of source score
    }),

    // ---- Adaptive Weight System ----
    adaptive: Object.freeze({
        maxHistory: 5,
        trendThreshold: 30,
        adjustmentStep: 0.01,   // Weight adjustment per trend detection
        bounds: Object.freeze({
            wRM: { min: 0.25, max: 0.55 },
            wW:  { min: 0.15, max: 0.40 },
            wT:  { min: 0.10, max: 0.35 },
            wD:  { min: 0.05, max: 0.25 },
        }),
    }),

    // ---- Rainfall Rate Sampling ----
    rainfallRateSampling: "mm per slider event (no time dimension)",

    // ---- Unit Documentation ----
    units: Object.freeze({
        rainfall:       "mm (accumulated precipitation)",
        soilMoisture:   "normalized 0–1 (0 = dry, 1 = saturated)",
        waterProximity: "raw 1–5 in zone data, normalized to 0–1 for equation",
        drainage:       "normalized 0–1 (0 = poor, 1 = excellent)",
        handExposure:   "raw elevationFactor 1–5 in zone data, normalized to 0–1 (0 = exposed, 1 = safe)",
        permeability:   "normalized 0–1 (0 = impervious, 1 = permeable)",
        rainfallRate:   "mm per slider event (positive increases only)",
    }),
});

// ---- Weight Sum Validation ----
(function validateWeights() {
    const sum = MCFRI_CONFIG.wRM + MCFRI_CONFIG.wW + MCFRI_CONFIG.wT + MCFRI_CONFIG.wD;
    if (Math.abs(sum - 1.0) > MCFRI_CONFIG.weightSumTolerance) {
        console.error(
            `[MCFRI-V2 CONFIG ERROR] Weights do not sum to 1.0 (sum = ${sum}). ` +
            `Auto-normalizing weights.`
        );
        // Note: Cannot mutate frozen object. This check is a build-time guard.
        // If weights don't sum to 1, the engine normalizes them at runtime.
    } else {
        console.log(`[MCFRI-V2] Configuration loaded. Weights sum = ${sum.toFixed(6)}. ${MCFRI_CONFIG.parameterStatus}.`);
    }
})();
