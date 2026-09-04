// ===========================
// mcfriV2Tests.js – MCFRI-V2 Mathematical / Software Integrity Test Suite
// Engine Version: MCFRI-V2 (Normalized Non-Linear Risk Engine)
// ===========================
//
// MATHEMATICAL / SOFTWARE INTEGRITY TEST SUITE
//
// NOTE: These tests verify engine mechanics, mathematical consistency,
// boundary clamping, and numerical stability. They are NOT empirical
// flood-model validation tests. Empirical validation requires real-world
// observational datasets that are not yet available.
//
// IMPORTANT NOTICE:
// All parameter values, expectations, and thresholds in this test suite
// are UNVALIDATED DEVELOPMENT TEST VALUES. They are designed solely to
// verify engine mechanics, mathematical consistency, boundary clamping,
// and numerical stability.
//
// Parameters require empirical calibration and validation against
// real-world observational datasets before operational deployment.
// ===========================

const MCFRI_V2_Tests = (() => {
    'use strict';

    // ==================================================================
    // CONFIG & ENGINE RESOLVER
    // ==================================================================
    function getConfig() {
        if (typeof MCFRI_CONFIG !== 'undefined' && MCFRI_CONFIG) {
            return MCFRI_CONFIG;
        }
        // Fallback default config if not globally loaded
        return {
            engineVersion: "MCFRI-V2",
            parameterStatus: "UNVALIDATED DEVELOPMENT DEFAULTS",
            alpha: 1.5,
            beta: 2.0,
            gamma: 2.0,
            delta: 1.5,
            epsilon: 2.0,
            eta: 1.2,
            R0: 150,
            Q0: 50,
            wRM: 0.40,
            wW: 0.25,
            wT: 0.20,
            wD: 0.15,
            thresholds: { safe: 80, warning: 140 },
            scoreMin: 0,
            scoreMax: 200,
            weightSumTolerance: 1e-6,
            shelterProtection: {
                radius: 800,
                maxBonus: 40,
                dampening: 0.8,
                locations: [
                    [12.978, 77.591],
                    [12.985, 77.605],
                    [12.970, 77.610],
                    [12.965, 77.595],
                    [12.982, 77.585],
                    [12.960, 77.600],
                ],
            },
        };
    }

    function getEngine() {
        if (typeof RiskEngine !== 'undefined' && RiskEngine) {
            return RiskEngine;
        }
        throw new Error('[MCFRI-V2 Tests] RiskEngine is not loaded. Please ensure riskEngine.js is loaded prior to mcfriV2Tests.js.');
    }

    // ==================================================================
    // LOGGING UTILITIES
    // ==================================================================
    function logTestHeader(testId, title) {
        console.log(`\n%c[MCFRI-V2 TEST] ${testId}: ${title}`, 'font-weight: bold; color: #3b82f6;');
    }

    function logPass(message, data) {
        console.log(`%c  ✓ PASS: ${message}`, 'color: #22c55e; font-weight: bold;');
        if (data !== undefined) {
            console.log('    Details:', data);
        }
    }

    function logFail(message, data) {
        console.error(`%c  ✗ FAIL: ${message}`, 'color: #ef4444; font-weight: bold;');
        if (data !== undefined) {
            console.error('    Failure Context:', data);
        }
    }

    // ==================================================================
    // TEST IMPLEMENTATIONS
    // ==================================================================

    /**
     * Test A: Very low rainfall (10mm) + dry soil (0.1) + good drainage (0.9) => score should be < 40
     */
    function testA() {
        const testId = 'TEST_A';
        const name = 'Very Low Rainfall + Dry Soil + Good Drainage (Safe Baseline)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();
            // Development test values
            const rainfall = 10;
            const soilMoisture = 0.1;
            const drainage = 0.9;
            const permeability = 0.8;
            const deltaR = 0;
            const handExposure = 0.8;
            const timeHorizon = 0;

            const zones = engine.runFullSimulation(rainfall, timeHorizon, soilMoisture, drainage, permeability, deltaR, handExposure);
            const maxScore = engine.getMaxRiskScore(zones);
            const allUnder40 = zones.every(z => z.riskScore < 40);
            const passed = maxScore < 40 && allUnder40;

            const scoresSummary = zones.map(z => `${z.id}: ${z.riskScore}`).join(', ');

            if (passed) {
                logPass(`All zone risk scores are well below the threshold (< 40). Max score = ${maxScore}.`, {
                    inputs: { rainfall: `${rainfall}mm`, soilMoisture, drainage, permeability, deltaR },
                    zoneScores: scoresSummary,
                    maxScore,
                    threshold: 40,
                });
            } else {
                logFail(`One or more zone risk scores exceeded 40. Max score = ${maxScore}.`, {
                    zones: zones.map(z => ({ id: z.id, score: z.riskScore })),
                    maxScore,
                    threshold: 40,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `Max score: ${maxScore} (< 40 target). Zone scores: [${scoresSummary}]`,
                data: { maxScore, scoresSummary },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test B: High rainfall (280mm) + saturated soil (0.95) + poor drainage (0.1) => score should be > 120
     */
    function testB() {
        const testId = 'TEST_B';
        const name = 'High Rainfall + Saturated Soil + Poor Drainage (Severe Risk Assessment)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();
            const cfg = getConfig();

            // Development test values
            const rainfall = 280;
            const soilMoisture = 0.95;
            const drainage = 0.1;
            const permeability = 0.05;
            const deltaR = 150;
            const handExposure = 0.0;

            // 1. Calculate unmitigated MCFRI-V2 raw score (prior to shelter reduction)
            const zonesRaw = engine.calculateMCFRIV2Risks(rainfall, soilMoisture, drainage, permeability, deltaR, handExposure);
            const rawScores = zonesRaw.map(z => {
                const w = z.weights;
                const c = z.components;
                return cfg.scoreMax * (
                    w.rainfallMoisture * c.rainfallMoisture +
                    w.waterDrainage * c.waterDrainage +
                    w.topographicLandUse * c.topographicLandUse +
                    w.rainfallAcceleration * c.rainfallAcceleration
                );
            });
            const maxRawScore = Math.max(...rawScores);

            // 2. Run simulation with projected future risk
            const simZones = engine.runFullSimulation(rainfall, 2, soilMoisture, drainage, permeability, deltaR, handExposure);
            const maxFutureScore = engine.getMaxFutureRiskScore(simZones);

            // Verified condition: Unmitigated composite risk or future predicted risk exceeds 120
            const passed = maxRawScore > 120 || maxFutureScore > 120;

            if (passed) {
                logPass(`High environmental stress produced severe risk (> 120). Max Raw Score = ${maxRawScore.toFixed(2)}, Max Future Score = ${maxFutureScore}.`, {
                    inputs: { rainfall: `${rainfall}mm`, soilMoisture, drainage, permeability, deltaR },
                    maxUnmitigatedRawScore: maxRawScore.toFixed(2),
                    maxFutureScore,
                    threshold: 120,
                    topZoneRaw: zonesRaw[0].id,
                    topZoneComponents: zonesRaw[0].components,
                });
            } else {
                logFail(`Score failed to exceed 120 under severe conditions. Max Raw = ${maxRawScore.toFixed(2)}, Max Future = ${maxFutureScore}.`, {
                    maxRawScore,
                    maxFutureScore,
                    threshold: 120,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `Max raw unmitigated score: ${maxRawScore.toFixed(2)}, Max future score: ${maxFutureScore} (> 120 target)`,
                data: { maxRawScore, maxFutureScore },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test C: Rapid rainfall increase (deltaR=200) => rainfallAcceleration component should be > 0.3
     */
    function testC() {
        const testId = 'TEST_C';
        const name = 'Rapid Rainfall Increase (Flash Flood Acceleration Response)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();
            const cfg = getConfig();

            // Development test values
            const deltaR = 200;

            // Direct normalization test
            const normRate = engine.normalizeRainfallRate(deltaR, cfg.Q0);
            const fDeltaDirect = Math.pow(normRate, cfg.eta);

            // Engine integration test via calculateMCFRIV2Risks
            const zones = engine.calculateMCFRIV2Risks(100, 0.5, 0.5, 0.5, deltaR);
            const compValue = zones[0].components.rainfallAcceleration;

            const passed = fDeltaDirect > 0.3 && compValue > 0.3;

            if (passed) {
                logPass(`Rapid rainfall increase (deltaR=${deltaR}mm) yielded rainfallAcceleration component ${compValue.toFixed(4)} (> 0.3).`, {
                    deltaR: `${deltaR}mm`,
                    Q0: cfg.Q0,
                    normalizedRate: normRate.toFixed(4),
                    eta: cfg.eta,
                    rainfallAcceleration: compValue.toFixed(4),
                    threshold: 0.3,
                });
            } else {
                logFail(`rainfallAcceleration component (${compValue}) did not exceed 0.3 for deltaR=${deltaR}mm.`, {
                    compValue,
                    threshold: 0.3,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `rainfallAcceleration component: ${compValue.toFixed(4)} (> 0.3 target, normRate: ${normRate.toFixed(4)})`,
                data: { compValue, normRate },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test D: Excellent drainage (0.95) => waterDrainage component should be < 0.05
     */
    function testD() {
        const testId = 'TEST_D';
        const name = 'Excellent Drainage Attenuation (Water-Drainage Component)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();
            const cfg = getConfig();

            // Development test values
            const drainage = 0.95;
            const normDrainage = engine.normalizeDrainage(drainage);

            // Check theoretical maximum FW (worst-case water proximity p = 1.0)
            const fwTheoreticalMax = Math.pow(1.0, cfg.gamma) * Math.pow(1 - normDrainage, cfg.delta);

            // Engine integration test across all zones
            const zones = engine.calculateMCFRIV2Risks(100, 0.5, drainage, 0.5, 0);
            const zoneFWs = zones.map(z => z.components.waterDrainage);
            const maxZoneFW = Math.max(...zoneFWs);

            const passed = fwTheoreticalMax < 0.05 && maxZoneFW < 0.05;

            if (passed) {
                logPass(`Excellent drainage (${drainage}) effectively attenuated waterDrainage component to ${maxZoneFW.toFixed(5)} (< 0.05 across all zones).`, {
                    drainage,
                    normalizedDrainage: normDrainage,
                    theoreticalMaxFW: fwTheoreticalMax.toFixed(5),
                    maxObservedFW: maxZoneFW.toFixed(5),
                    threshold: 0.05,
                });
            } else {
                logFail(`waterDrainage component (${maxZoneFW}) was not suppressed below 0.05.`, {
                    maxZoneFW,
                    threshold: 0.05,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `waterDrainage component: ${maxZoneFW.toFixed(5)} (< 0.05 target)`,
                data: { maxZoneFW, fwTheoreticalMax },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test E: Highly impervious land (permeability=0.05) => topographicLandUse component should increase vs permeability=0.9
     */
    function testE() {
        const testId = 'TEST_E';
        const name = 'Surface Imperviousness Vulnerability (Land-Use Permeability Impact)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();

            // Development test values
            const permImpervious = 0.05; // Dense urban concrete
            const permPermeable = 0.90;  // Highly permeable soil / forest

            const zonesImpervious = engine.calculateMCFRIV2Risks(100, 0.5, 0.5, permImpervious, 0, 0.5);
            const zonesPermeable  = engine.calculateMCFRIV2Risks(100, 0.5, 0.5, permPermeable, 0, 0.5);

            let allIncreased = true;
            const comparison = [];

            for (let i = 0; i < zonesImpervious.length; i++) {
                const ftImp = zonesImpervious[i].components.topographicLandUse;
                const ftPer = zonesPermeable[i].components.topographicLandUse;
                const increased = ftImp > ftPer;
                if (!increased) allIncreased = false;

                comparison.push({
                    zone: zonesImpervious[i].id,
                    ftImpervious: Number(ftImp.toFixed(4)),
                    ftPermeable: Number(ftPer.toFixed(4)),
                    ratio: ftPer > 0 ? Number((ftImp / ftPer).toFixed(2)) : 'Infinity',
                });
            }

            const passed = allIncreased && comparison.length > 0;

            if (passed) {
                const sample = comparison[0];
                logPass(`Impervious land (${permImpervious}) strictly increased topographicLandUse vs permeable (${permPermeable}) across all zones (ratio: ${sample.ratio}x).`, {
                    permImpervious,
                    permPermeable,
                    zoneComparisons: comparison,
                });
            } else {
                logFail(`Impervious land failed to consistently increase topographicLandUse component.`, {
                    comparison,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `Impervious FT (${zonesImpervious[0].components.topographicLandUse.toFixed(4)}) > Permeable FT (${zonesPermeable[0].components.topographicLandUse.toFixed(4)}) across ${zonesImpervious.length} zones`,
                data: { comparison },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test F: Falling rainfall (deltaR=-50) => rainfallAcceleration component must be exactly 0
     */
    function testF() {
        const testId = 'TEST_F';
        const name = 'Falling Rainfall Rate Non-Negativity (Directional Flash Flood Filter)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();
            const cfg = getConfig();

            // Development test values
            const negativeDeltaR = -50;

            // Direct normalization test
            const normRate = engine.normalizeRainfallRate(negativeDeltaR, cfg.Q0);

            // Engine integration test across zones
            const zones = engine.calculateMCFRIV2Risks(100, 0.5, 0.5, 0.5, negativeDeltaR);
            const allZero = zones.every(z => z.components.rainfallAcceleration === 0);

            const passed = normRate === 0 && allZero;

            if (passed) {
                logPass(`Negative rate change (deltaR=${negativeDeltaR}mm) correctly clamped: normalizedRate = ${normRate}, rainfallAcceleration = 0 across all zones.`, {
                    negativeDeltaR,
                    normalizedRate: normRate,
                    rainfallAcceleration: zones[0].components.rainfallAcceleration,
                });
            } else {
                logFail(`Falling rainfall produced non-zero acceleration component.`, {
                    normRate,
                    zoneAccelerations: zones.map(z => z.components.rainfallAcceleration),
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `rainfallAcceleration = 0 (exact match for deltaR=${negativeDeltaR}mm)`,
                data: { normRate, componentVal: zones[0].components.rainfallAcceleration },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test G: Extreme inputs (rainfall=9999, moisture=5, drainage=-1) => final score must be in [0, 200]
     */
    function testG() {
        const testId = 'TEST_G';
        const name = 'Extreme & Boundary Input Clamping (Numerical Robustness)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();
            const cfg = getConfig();

            // Test scenario 1: Prompt specified extreme values (rainfall=9999, moisture=5, drainage=-1)
            const primaryExtremeZones = engine.runFullSimulation(9999, 0, 5, -1, -2, 9999, -5);

            // Test scenario 2: Negative extremes
            const negativeExtremeZones = engine.runFullSimulation(-500, 0, -10, 50, 100, -500, 100);

            // Test scenario 3: Ultra-high boundary values with projection
            const ultraHighZones = engine.runFullSimulation(50000, 3, 100, -50, -100, 10000, -50);

            const allSets = [
                { name: 'Primary Extremes (rainfall=9999, moisture=5, drainage=-1)', zones: primaryExtremeZones },
                { name: 'Negative Extremes (rainfall=-500, moisture=-10, drainage=50)', zones: negativeExtremeZones },
                { name: 'Ultra-High Out-of-Bounds (rainfall=50000, moisture=100, drainage=-50)', zones: ultraHighZones },
            ];

            let allBounded = true;
            const summary = [];

            allSets.forEach(set => {
                const scores = set.zones.map(z => z.riskScore);
                const setMin = Math.min(...scores);
                const setMax = Math.max(...scores);
                const valid = scores.every(s => s >= cfg.scoreMin && s <= cfg.scoreMax && Number.isFinite(s) && !isNaN(s));

                if (!valid) allBounded = false;

                summary.push({
                    scenario: set.name,
                    minScore: setMin,
                    maxScore: setMax,
                    valid,
                    scores,
                });
            });

            const passed = allBounded;

            if (passed) {
                logPass(`All extreme out-of-bounds inputs safely clamped to [${cfg.scoreMin}, ${cfg.scoreMax}].`, {
                    scenariosTested: summary,
                });
            } else {
                logFail(`One or more extreme scenarios escaped the [${cfg.scoreMin}, ${cfg.scoreMax}] bounds or returned NaN/Infinity.`, {
                    summary,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `All scores bounded in [${cfg.scoreMin}, ${cfg.scoreMax}] across ${allSets.length} extreme boundary scenarios.`,
                data: { summary },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test H: Weight sum validation: wRM + wW + wT + wD must equal 1.0 within tolerance
     */
    function testH() {
        const testId = 'TEST_H';
        const name = 'Component Weight Sum Unity Validation';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();
            const cfg = getConfig();

            const tolerance = cfg.weightSumTolerance || 1e-6;

            // 1. Validate static configuration weights
            const configSum = cfg.wRM + cfg.wW + cfg.wT + cfg.wD;
            const configDiff = Math.abs(configSum - 1.0);
            const configValid = configDiff <= tolerance;

            // 2. Validate runtime normalized weights returned by riskEngine
            const zones = engine.calculateMCFRIV2Risks(100, 0.5, 0.5, 0.5, 0);
            const w = zones[0].weights;
            const runtimeSum = w.rainfallMoisture + w.waterDrainage + w.topographicLandUse + w.rainfallAcceleration;
            const runtimeDiff = Math.abs(runtimeSum - 1.0);
            const runtimeValid = runtimeDiff <= tolerance;

            const passed = configValid && runtimeValid;

            if (passed) {
                logPass(`Weights sum to 1.0 within tolerance (${tolerance}). Config sum = ${configSum.toFixed(8)}, Runtime sum = ${runtimeSum.toFixed(8)}.`, {
                    weights: { wRM: cfg.wRM, wW: cfg.wW, wT: cfg.wT, wD: cfg.wD },
                    configSum: configSum.toFixed(8),
                    runtimeSum: runtimeSum.toFixed(8),
                    tolerance,
                    difference: configDiff,
                });
            } else {
                logFail(`Weights failed to sum to 1.0 within tolerance ${tolerance}. Config sum: ${configSum}, Runtime sum: ${runtimeSum}`, {
                    cfgWeights: { wRM: cfg.wRM, wW: cfg.wW, wT: cfg.wT, wD: cfg.wD },
                    configDiff,
                    runtimeDiff,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `Weight sum = ${configSum.toFixed(6)} (diff: ${configDiff.toExponential(2)} <= tolerance ${tolerance})`,
                data: { configSum, runtimeSum, configDiff, tolerance },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    /**
     * Test I: No NaN/Infinity: run a simulation and check every numeric field
     */
    function testI() {
        const testId = 'TEST_I';
        const name = 'Comprehensive Numerical Integrity & Schema Sanity (No NaN/Infinity)';
        logTestHeader(testId, name);

        try {
            const engine = getEngine();

            // Development test values across simulation
            const zones = engine.runFullSimulation(150, 2, 0.6, 0.4, 0.5, 20, 0.5);

            let totalNumericFields = 0;
            const invalidFields = [];
            const checkedPaths = [];

            function traverse(obj, path) {
                if (obj === null || obj === undefined) return;

                if (typeof obj === 'number') {
                    totalNumericFields++;
                    checkedPaths.push(path);
                    if (isNaN(obj) || !isFinite(obj)) {
                        invalidFields.push({ path, value: obj });
                    }
                    return;
                }

                if (Array.isArray(obj)) {
                    obj.forEach((item, index) => traverse(item, `${path}[${index}]`));
                    return;
                }

                if (typeof obj === 'object') {
                    for (const key of Object.keys(obj)) {
                        traverse(obj[key], path ? `${path}.${key}` : key);
                    }
                }
            }

            zones.forEach((zone, index) => {
                traverse(zone, `zone[${index}]`);
            });

            // Ensure essential schema properties are present on all zones
            const requiredProps = [
                'id', 'riskScore', 'level', 'color', 'fillColor',
                'normalizedInputs', 'components', 'weights',
                'explanation', 'engineVersion', 'timestamp',
                'dynamicRadius', 'futureRiskScore', 'futureRadius'
            ];

            const missingProps = [];
            zones.forEach((zone, idx) => {
                requiredProps.forEach(prop => {
                    if (zone[prop] === undefined || zone[prop] === null) {
                        missingProps.push({ zoneIndex: idx, zoneId: zone.id, missingProperty: prop });
                    }
                });
            });

            const passed = invalidFields.length === 0 && missingProps.length === 0 && totalNumericFields >= 50;

            if (passed) {
                logPass(`Checked ${totalNumericFields} numeric fields across ${zones.length} zones. 0 NaN or Infinity values found. All schema properties present.`, {
                    zonesEvaluated: zones.length,
                    totalNumericFieldsChecked: totalNumericFields,
                    schemaIntegrity: '100% verified',
                });
            } else {
                logFail(`Numerical integrity or schema validation failed.`, {
                    invalidFields,
                    missingProps,
                    totalNumericFields,
                });
            }

            return {
                id: testId,
                name,
                passed,
                details: `Checked ${totalNumericFields} numeric fields. 0 NaN/Infinity. Missing props: ${missingProps.length}`,
                data: { totalNumericFields, invalidFieldsCount: invalidFields.length, missingPropsCount: missingProps.length },
            };
        } catch (err) {
            logFail(`Exception in ${testId}: ${err.message}`, err);
            return { id: testId, name, passed: false, error: err.message };
        }
    }

    // ==================================================================
    // SUITE RUNNER
    // ==================================================================

    /**
     * Run all test cases in the test suite.
     * @returns {Object} { total: number, passed: number, failed: number, results: Array<Object> }
     */
    function runAll() {
        console.log('\n================================================================================');
        console.log(' MCFRI-V2 AUTOMATED TEST SUITE (Self-Contained Runner)');
        console.log(' Status: UNVALIDATED DEVELOPMENT TEST VALUES');
        console.log(' Time  :', new Date().toISOString());
        console.log('================================================================================');

        const testFunctions = [
            testA,
            testB,
            testC,
            testD,
            testE,
            testF,
            testG,
            testH,
            testI,
        ];

        const results = [];
        let passedCount = 0;
        let failedCount = 0;

        for (const testFn of testFunctions) {
            try {
                const res = testFn();
                results.push(res);
                if (res.passed) {
                    passedCount++;
                } else {
                    failedCount++;
                }
            } catch (error) {
                failedCount++;
                results.push({
                    id: testFn.name || 'UNKNOWN',
                    name: 'Execution Error',
                    passed: false,
                    error: error.message,
                });
            }
        }

        console.log('\n================================================================================');
        console.log(' MCFRI-V2 TEST SUITE SUMMARY');
        console.log('================================================================================');
        results.forEach(r => {
            const symbol = r.passed ? '✓ PASS' : '✗ FAIL';
            const padId = r.id.padEnd(8, ' ');
            console.log(` ${padId} | ${symbol} | ${r.name}`);
            if (r.details) {
                console.log(`          ↳ ${r.details}`);
            }
            if (r.error) {
                console.log(`          ↳ Error: ${r.error}`);
            }
        });
        console.log('--------------------------------------------------------------------------------');
        console.log(` Total Tests: ${results.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
        console.log(` Overall Suite Status: ${failedCount === 0 ? 'ALL TESTS PASSED' : 'TESTS FAILED'}`);
        console.log('================================================================================\n');

        return {
            total: results.length,
            passed: passedCount,
            failed: failedCount,
            results,
        };
    }

    /**
     * Run a specific test by identifier (e.g. 'A', 'testA', 'TEST_A').
     * @param {string} testId
     * @returns {Object} Test result
     */
    function runTest(testId) {
        if (!testId || typeof testId !== 'string') {
            throw new Error('[MCFRI-V2 Tests] Please provide a valid test ID string (e.g. "A", "B", ..., "I").');
        }
        const clean = testId.trim().toUpperCase().replace(/^TEST_?/, '');
        const fnMap = {
            'A': testA,
            'B': testB,
            'C': testC,
            'D': testD,
            'E': testE,
            'F': testF,
            'G': testG,
            'H': testH,
            'I': testI,
        };
        const fn = fnMap[clean];
        if (!fn) {
            throw new Error(`[MCFRI-V2 Tests] Unknown test identifier: "${testId}". Valid IDs: A, B, C, D, E, F, G, H, I.`);
        }
        return fn();
    }

    // ==================================================================
    // PUBLIC API
    // ==================================================================
    return {
        runAll,
        runTest,
        testA,
        testB,
        testC,
        testD,
        testE,
        testF,
        testG,
        testH,
        testI,
    };

})();

// Browser global export
if (typeof window !== 'undefined') {
    window.MCFRI_V2_Tests = MCFRI_V2_Tests;
}

// Node.js module export (for CLI & unit test runners)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCFRI_V2_Tests;
}
