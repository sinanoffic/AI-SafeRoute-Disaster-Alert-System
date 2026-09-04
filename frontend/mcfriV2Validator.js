// ===========================
// mcfriV2Validator.js – MCFRI-V2 Dataset Evaluation Utility
// Engine: MCFRI-V2 (Normalized Non-Linear Risk Engine)
// ===========================
//
// DEVELOPER & TESTING DATASET EVALUATION UTILITY
//
// NOTE: This utility evaluates datasets against the MCFRI-V2 risk engine
// equations. It does NOT constitute empirical flood-model validation.
// Empirical validation requires calibrated parameters fitted against
// real-world observational flood datasets.
//
// IMPORTANT NOTICE:
// This utility evaluates datasets against the MCFRI-V2 risk engine equations.
// Results are empirical and NEVER fabricated. 100% accuracy is NOT assumed
// or claimed. Parameter calibration and ground-truth validation require
// ongoing real-world empirical data collection.
//
// SCHEMA FOR INPUT DATASET:
// Array of records matching:
// {
//   district: string,
//   rainfall: number (mm),
//   soilMoisture: number (0–1),
//   waterProximity: number (0–1 or 1–5),
//   drainage: number (0–1),
//   handExposure: number (0–1 or 1–5),
//   permeability: number (0–1),
//   rainfallRateChange: number (mm),
//   actualClass: 'safe' | 'warning' | 'danger',
//   datasetType: 'calibration' | 'validation' | 'test'
// }
// ===========================

const MCFRI_V2_Validator = (() => {
    'use strict';

    // ---- Constants ----
    const VALID_DATASET_TYPES = Object.freeze(['calibration', 'validation', 'test']);
    const CLASSES = Object.freeze(['safe', 'warning', 'danger']);

    // ---- Synthetic Example Dataset (5 records) ----
    const EXAMPLE_DATASET = Object.freeze([
        {
            district: "Koramangala (Low-Lying / High Runoff)",
            rainfall: 180,
            soilMoisture: 0.90,
            waterProximity: 4.5,
            drainage: 0.20,
            handExposure: 1.5,
            permeability: 0.15,
            rainfallRateChange: 45,
            actualClass: "danger",
            datasetType: "test",
            status: "SYNTHETIC TEST DATA - NOT VALIDATED"
        },
        {
            district: "Indiranagar (Moderate Slope / Urban)",
            rainfall: 95,
            soilMoisture: 0.65,
            waterProximity: 2.5,
            drainage: 0.50,
            handExposure: 3.0,
            permeability: 0.40,
            rainfallRateChange: 15,
            actualClass: "warning",
            datasetType: "validation",
            status: "SYNTHETIC TEST DATA - NOT VALIDATED"
        },
        {
            district: "Sadashivanagar (Elevated / High Infiltration)",
            rainfall: 30,
            soilMoisture: 0.25,
            waterProximity: 1.0,
            drainage: 0.85,
            handExposure: 4.5,
            permeability: 0.70,
            rainfallRateChange: 0,
            actualClass: "safe",
            datasetType: "calibration",
            status: "SYNTHETIC TEST DATA - NOT VALIDATED"
        },
        {
            district: "HSR Layout Sector 6 (Drainage Choke)",
            rainfall: 140,
            soilMoisture: 0.80,
            waterProximity: 3.8,
            drainage: 0.25,
            handExposure: 2.0,
            permeability: 0.20,
            rainfallRateChange: 30,
            actualClass: "danger",
            datasetType: "test",
            status: "SYNTHETIC TEST DATA - NOT VALIDATED"
        },
        {
            district: "Jayanagar 4th Block (Residential Green)",
            rainfall: 70,
            soilMoisture: 0.50,
            waterProximity: 2.0,
            drainage: 0.60,
            handExposure: 3.5,
            permeability: 0.55,
            rainfallRateChange: 10,
            actualClass: "safe",
            datasetType: "validation",
            status: "SYNTHETIC TEST DATA - NOT VALIDATED"
        }
    ]);

    // ==================================================================
    // CONFIG RESOLVER
    // ==================================================================
    function getConfig() {
        if (typeof MCFRI_CONFIG !== 'undefined' && MCFRI_CONFIG) {
            return MCFRI_CONFIG;
        }
        // Fallback matching mcfriV2Config.js defaults
        return {
            engineVersion: "MCFRI-V2",
            engineLabel: "MCFRI-V2 — Normalized Non-Linear Risk Engine",
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
            thresholds: {
                safe: 80,
                warning: 140,
            },
            scoreMin: 0,
            scoreMax: 200,
            weightSumTolerance: 1e-6,
        };
    }

    // ==================================================================
    // NORMALIZATION LAYER (Delegates to RiskEngine when available)
    // ==================================================================
    function normalizeRainfall(r, R0) {
        if (typeof RiskEngine !== 'undefined' && typeof RiskEngine.normalizeRainfall === 'function') {
            return RiskEngine.normalizeRainfall(r, R0);
        }
        const val = Math.max(0, Number(r) || 0);
        const r0 = Math.max(0, Number(R0) || 150);
        if (r0 === 0) return val > 0 ? 1 : 0;
        return val / (val + r0);
    }

    function normalizeSoilMoisture(m) {
        if (typeof RiskEngine !== 'undefined' && typeof RiskEngine.normalizeSoilMoisture === 'function') {
            return RiskEngine.normalizeSoilMoisture(m);
        }
        const val = Number(m);
        return Math.max(0, Math.min(1, isNaN(val) ? 0.5 : val));
    }

    function normalizeWaterProximity(p) {
        const val = Math.max(0, Number(p) || 0);
        if (typeof RiskEngine !== 'undefined' && typeof RiskEngine.normalizeWaterProximity === 'function') {
            if (val > 1.0) {
                return RiskEngine.normalizeWaterProximity(val);
            }
            return Math.max(0, Math.min(1, val));
        }
        return val > 1.0 ? Math.max(0, Math.min(1, val / 5)) : Math.max(0, Math.min(1, val));
    }

    function normalizeDrainage(d) {
        if (typeof RiskEngine !== 'undefined' && typeof RiskEngine.normalizeDrainage === 'function') {
            return RiskEngine.normalizeDrainage(d);
        }
        const val = Number(d);
        return Math.max(0, Math.min(1, isNaN(val) ? 0.5 : val));
    }

    function normalizeHAND(h) {
        const val = Math.max(0, Number(h) || 0);
        if (typeof RiskEngine !== 'undefined' && typeof RiskEngine.normalizeHAND === 'function') {
            if (val > 1.0) {
                return RiskEngine.normalizeHAND(val);
            }
            return Math.max(0, Math.min(1, val));
        }
        return val > 1.0 ? Math.max(0, Math.min(1, (val - 1) / 4)) : Math.max(0, Math.min(1, val));
    }

    function normalizePermeability(l) {
        if (typeof RiskEngine !== 'undefined' && typeof RiskEngine.normalizePermeability === 'function') {
            return RiskEngine.normalizePermeability(l);
        }
        const val = Number(l);
        return Math.max(0, Math.min(1, isNaN(val) ? 0.5 : val));
    }

    function normalizeRainfallRate(dR, Q0) {
        if (typeof RiskEngine !== 'undefined' && typeof RiskEngine.normalizeRainfallRate === 'function') {
            return RiskEngine.normalizeRainfallRate(dR, Q0);
        }
        const val = Math.max(0, Number(dR) || 0);
        const q0 = Math.max(0, Number(Q0) || 50);
        if (q0 === 0) return val > 0 ? 1 : 0;
        return val / (val + q0);
    }

    // ==================================================================
    // MCFRI-V2 COMPONENT CALCULATIONS
    // ==================================================================
    function calcFRM(r, m, alpha, beta) {
        const rTerm = Math.pow(r, alpha);
        const denominator = Math.exp(beta) - 1;
        if (denominator === 0) return rTerm;
        const moistureTerm = (Math.exp(beta * m) - 1) / denominator;
        return rTerm * moistureTerm;
    }

    function calcFW(p, d, gamma, delta) {
        return Math.pow(p, gamma) * Math.pow(1 - d, delta);
    }

    function calcFT(h, l, epsilon) {
        return Math.pow(1 - h, epsilon) * (1 - l);
    }

    function calcFDelta(q, eta) {
        return Math.pow(q, eta);
    }

    // ==================================================================
    // RISK CLASSIFICATION (using MCFRI_CONFIG thresholds)
    // ==================================================================
    function classifyScore(score, thresholds) {
        const t = thresholds || getConfig().thresholds;
        if (score > t.warning) {
            return 'danger';
        } else if (score >= t.safe) {
            return 'warning';
        }
        return 'safe';
    }

    // ==================================================================
    // SINGLE RECORD EVALUATION
    // ==================================================================
    /**
     * Evaluates a single record against MCFRI-V2 equations.
     * @param {Object} record - Data row with environmental features
     * @param {Object} [customConfig] - Optional override config
     * @returns {Object} Evaluated record with predicted score, predicted class, and correctness
     */
    function calculateRecordScore(record, customConfig) {
        if (!record || typeof record !== 'object') {
            throw new TypeError('[MCFRI_V2_Validator] Invalid record: expected object.');
        }

        const cfg = customConfig || getConfig();

        // 1. Normalize all inputs
        const norm = {
            rainfall: normalizeRainfall(record.rainfall, cfg.R0),
            soilMoisture: normalizeSoilMoisture(record.soilMoisture),
            waterProximity: normalizeWaterProximity(record.waterProximity),
            drainage: normalizeDrainage(record.drainage),
            handExposure: normalizeHAND(record.handExposure),
            permeability: normalizePermeability(record.permeability),
            rainfallRate: normalizeRainfallRate(
                record.rainfallRateChange !== undefined ? record.rainfallRateChange : (record.deltaR || 0),
                cfg.Q0
            ),
        };

        // 2. Calculate MCFRI-V2 non-linear components
        const components = {
            rainfallMoisture: calcFRM(norm.rainfall, norm.soilMoisture, cfg.alpha, cfg.beta),
            waterDrainage: calcFW(norm.waterProximity, norm.drainage, cfg.gamma, cfg.delta),
            topographicLandUse: calcFT(norm.handExposure, norm.permeability, cfg.epsilon),
            rainfallAcceleration: calcFDelta(norm.rainfallRate, cfg.eta),
        };

        // 3. Weight normalization
        const weightSum = cfg.wRM + cfg.wW + cfg.wT + cfg.wD;
        const weights = {
            wRM: cfg.wRM / (weightSum || 1),
            wW:  cfg.wW / (weightSum || 1),
            wT:  cfg.wT / (weightSum || 1),
            wD:  cfg.wD / (weightSum || 1),
        };

        // 4. Weighted score
        const rawScore = cfg.scoreMax * (
            weights.wRM * components.rainfallMoisture +
            weights.wW  * components.waterDrainage +
            weights.wT  * components.topographicLandUse +
            weights.wD  * components.rainfallAcceleration
        );

        // 5. Clamped predicted score [0, 200]
        const predictedScore = Math.max(cfg.scoreMin, Math.min(cfg.scoreMax, Math.round(rawScore)));

        // 6. Classification
        const predictedClass = classifyScore(predictedScore, cfg.thresholds);
        const actualClass = (record.actualClass || '').toString().trim().toLowerCase();
        const correct = (predictedClass === actualClass);

        return {
            district: record.district || 'Unknown District',
            datasetType: (record.datasetType || 'unspecified').toString().trim().toLowerCase(),
            predictedScore,
            rawScore: Number(rawScore.toFixed(4)),
            predictedClass,
            actualClass,
            correct,
            normalizedInputs: norm,
            components,
            weights,
            rawRecord: record,
        };
    }

    // ==================================================================
    // CONFUSION MATRIX & EVALUATION METRICS
    // ==================================================================
    /**
     * Builds a 3x3 confusion matrix and computes precision, recall, F1, and accuracy.
     * @param {Array<Object>} evaluatedRecords - Output from calculateRecordScore
     * @returns {Object} Confusion matrix and performance metrics
     */
    function generateConfusionMatrix(evaluatedRecords) {
        const matrix = {
            safe:    { safe: 0, warning: 0, danger: 0, total: 0 },
            warning: { safe: 0, warning: 0, danger: 0, total: 0 },
            danger:  { safe: 0, warning: 0, danger: 0, total: 0 },
        };

        let correctCount = 0;
        const totalSamples = evaluatedRecords.length;

        evaluatedRecords.forEach(rec => {
            const act = CLASSES.includes(rec.actualClass) ? rec.actualClass : 'unknown';
            const pred = CLASSES.includes(rec.predictedClass) ? rec.predictedClass : 'unknown';

            if (matrix[act]) {
                matrix[act].total++;
                if (matrix[act][pred] !== undefined) {
                    matrix[act][pred]++;
                }
            }

            if (rec.correct) {
                correctCount++;
            }
        });

        const incorrectCount = totalSamples - correctCount;
        const accuracy = totalSamples > 0 ? (correctCount / totalSamples) * 100 : 0;

        // Compute per-class precision, recall, F1-score, and support
        const classMetrics = {};
        let totalF1 = 0;
        let weightedF1Sum = 0;

        CLASSES.forEach(cls => {
            const tp = matrix[cls] ? matrix[cls][cls] : 0;
            const actualTotal = matrix[cls] ? matrix[cls].total : 0;
            const predTotal = CLASSES.reduce((sum, other) => sum + (matrix[other] ? matrix[other][cls] : 0), 0);

            const precision = predTotal > 0 ? tp / predTotal : 0;
            const recall = actualTotal > 0 ? tp / actualTotal : 0;
            const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

            classMetrics[cls] = {
                support: actualTotal,
                predictedCount: predTotal,
                truePositives: tp,
                falsePositives: predTotal - tp,
                falseNegatives: actualTotal - tp,
                precision: Number(precision.toFixed(4)),
                recall: Number(recall.toFixed(4)),
                f1Score: Number(f1.toFixed(4)),
                precisionPercent: `${(precision * 100).toFixed(2)}%`,
                recallPercent: `${(recall * 100).toFixed(2)}%`,
                f1Percent: `${(f1 * 100).toFixed(2)}%`,
            };

            totalF1 += f1;
            weightedF1Sum += f1 * actualTotal;
        });

        const macroF1 = Number((totalF1 / CLASSES.length).toFixed(4));
        const weightedF1 = totalSamples > 0 ? Number((weightedF1Sum / totalSamples).toFixed(4)) : 0;

        return {
            matrix,
            classes: CLASSES,
            totalSamples,
            correctCount,
            incorrectCount,
            accuracy: Number(accuracy.toFixed(2)),
            accuracyFormatted: `${accuracy.toFixed(2)}%`,
            macroF1,
            weightedF1,
            classMetrics,
        };
    }

    // ==================================================================
    // VALIDATION RUNNERS
    // ==================================================================
    /**
     * Validates a dataset array against MCFRI-V2.
     * @param {Array<Object>} dataset - Array of district data records
     * @param {Object} [options] - Validation options (datasetType filter, custom config)
     * @returns {Object} Complete validation report with confusion matrix & accuracy
     */
    function validate(dataset, options = {}) {
        if (!Array.isArray(dataset)) {
            throw new TypeError('[MCFRI_V2_Validator] Dataset must be an array of records.');
        }

        const filterType = options.datasetType || options.filterType || null;
        let recordsToProcess = dataset;

        if (filterType) {
            const normalizedFilter = String(filterType).trim().toLowerCase();
            recordsToProcess = dataset.filter(r => (r.datasetType || '').toString().trim().toLowerCase() === normalizedFilter);
        }

        const evaluatedRecords = recordsToProcess.map(rec => calculateRecordScore(rec, options.config));
        const matrixResult = generateConfusionMatrix(evaluatedRecords);

        // Detect dataset types present in the raw input
        const typesPresent = [...new Set(dataset.map(r => (r.datasetType || 'unspecified').toString().trim().toLowerCase()))];
        const isMixed = typesPresent.length > 1;

        // Breakdown by datasetType when mixed and no explicit filter was applied
        let byTypeBreakdown = null;
        if (isMixed && !filterType) {
            byTypeBreakdown = {};
            typesPresent.forEach(t => {
                const subRecords = evaluatedRecords.filter(r => r.datasetType === t);
                byTypeBreakdown[t] = generateConfusionMatrix(subRecords);
            });
        }

        return {
            validationStatus: 'SUCCESS',
            timestamp: new Date().toISOString(),
            engineVersion: (options.config && options.config.engineVersion) || getConfig().engineVersion,
            filterApplied: filterType || 'NONE (All Records Evaluated)',
            typesPresent,
            isMixedDataset: isMixed,
            warning: (isMixed && !filterType)
                ? 'CAUTION: Dataset contains mixed dataset types (calibration/validation/test). Calibration, validation, and test datasets should be evaluated separately.'
                : null,
            totalSamples: matrixResult.totalSamples,
            correctCount: matrixResult.correctCount,
            incorrectCount: matrixResult.incorrectCount,
            accuracy: matrixResult.accuracy,
            accuracyPercent: matrixResult.accuracyFormatted,
            macroF1: matrixResult.macroF1,
            weightedF1: matrixResult.weightedF1,
            confusionMatrix: matrixResult.matrix,
            classMetrics: matrixResult.classMetrics,
            byTypeBreakdown,
            records: evaluatedRecords,
        };
    }

    /**
     * Validates only records matching the specified datasetType ('calibration', 'validation', or 'test').
     * Prevents silent mixing of calibration, validation, and test sets.
     * @param {Array<Object>} dataset - Array of district data records
     * @param {string} type - 'calibration' | 'validation' | 'test'
     * @param {Object} [options] - Additional validation options
     * @returns {Object} Filtered validation report
     */
    function validateByType(dataset, type, options = {}) {
        if (!type || typeof type !== 'string') {
            throw new Error('[MCFRI_V2_Validator] validateByType requires a dataset type string (e.g. "calibration", "validation", "test").');
        }
        const normalizedType = type.trim().toLowerCase();
        if (!VALID_DATASET_TYPES.includes(normalizedType)) {
            console.warn(`[MCFRI_V2_Validator] Notice: "${type}" is not one of the standard dataset types: ${VALID_DATASET_TYPES.join(', ')}`);
        }
        return validate(dataset, { ...options, datasetType: normalizedType });
    }

    // ==================================================================
    // REPORT FORMATTING (ASCII Table Output for Console / Logs)
    // ==================================================================
    function formatReport(result) {
        if (!result || typeof result !== 'object') {
            return 'Invalid validation result.';
        }

        const lines = [];
        lines.push('================================================================================');
        lines.push(' MCFRI-V2 ENGINE VALIDATION REPORT (Developer / Testing Utility)');
        lines.push(` Engine Version : ${result.engineVersion || 'MCFRI-V2'}`);
        lines.push(` Filter Applied : ${result.filterApplied}`);
        lines.push(` Generated At   : ${result.timestamp}`);
        lines.push('================================================================================');

        if (result.warning) {
            lines.push(`\n[WARNING] ${result.warning}\n`);
        }

        lines.push('\nSUMMARY PERFORMANCE METRICS');
        lines.push('--------------------------------------------------------------------------------');
        lines.push(` Total Samples    : ${result.totalSamples}`);
        lines.push(` Correct Count    : ${result.correctCount}`);
        lines.push(` Incorrect Count  : ${result.incorrectCount}`);
        lines.push(` Model Accuracy   : ${result.accuracyPercent}`);
        lines.push(` Macro F1-Score   : ${result.macroF1}`);
        lines.push(` Weighted F1      : ${result.weightedF1}`);

        lines.push('\nCONFUSION MATRIX (Rows: Actual Class | Columns: Predicted Class)');
        lines.push('--------------------------------------------------------------------------------');
        lines.push(' Actual \\ Pred    |   Safe   |  Warning |  Danger  |  Total Actual');
        lines.push('------------------+----------+----------+----------+--------------');

        const m = result.confusionMatrix;
        CLASSES.forEach(cls => {
            const row = m[cls] || { safe: 0, warning: 0, danger: 0, total: 0 };
            const label = cls.charAt(0).toUpperCase() + cls.slice(1);
            const paddedLabel = label.padEnd(16, ' ');
            const safe = String(row.safe || 0).padStart(8, ' ');
            const warn = String(row.warning || 0).padStart(8, ' ');
            const dang = String(row.danger || 0).padStart(8, ' ');
            const total = String(row.total || 0).padStart(12, ' ');
            lines.push(` ${paddedLabel} | ${safe} | ${warn} | ${dang} | ${total}`);
        });

        lines.push('------------------+----------+----------+----------+--------------');
        const predSafe = CLASSES.reduce((sum, c) => sum + (m[c] ? m[c].safe : 0), 0);
        const predWarn = CLASSES.reduce((sum, c) => sum + (m[c] ? m[c].warning : 0), 0);
        const predDang = CLASSES.reduce((sum, c) => sum + (m[c] ? m[c].danger : 0), 0);
        const predTotal = predSafe + predWarn + predDang;
        lines.push(` Total Predicted  | ${String(predSafe).padStart(8, ' ')} | ${String(predWarn).padStart(8, ' ')} | ${String(predDang).padStart(8, ' ')} | ${String(predTotal).padStart(12, ' ')}`);

        lines.push('\nPER-CLASS PERFORMANCE BREAKDOWN');
        lines.push('--------------------------------------------------------------------------------');
        lines.push(' Class      Precision    Recall       F1-Score     Support (Actual Count)');
        lines.push('--------------------------------------------------------------------------------');
        CLASSES.forEach(cls => {
            const cm = result.classMetrics[cls] || {};
            const clsName = (cls.charAt(0).toUpperCase() + cls.slice(1)).padEnd(10, ' ');
            const prec = (cm.precisionPercent || '0.00%').padStart(10, ' ');
            const rec = (cm.recallPercent || '0.00%').padStart(10, ' ');
            const f1 = (cm.f1Percent || '0.00%').padStart(10, ' ');
            const sup = String(cm.support || 0).padStart(10, ' ');
            lines.push(` ${clsName} ${prec}   ${rec}   ${f1}   ${sup}`);
        });
        lines.push('--------------------------------------------------------------------------------');

        if (result.records && result.records.length > 0) {
            lines.push('\nSAMPLE EVALUATION DETAILS');
            lines.push('--------------------------------------------------------------------------------');
            result.records.forEach((r, idx) => {
                const mark = r.correct ? '✓ PASS' : '✗ FAIL';
                lines.push(` [${idx + 1}] ${r.district} (${r.datasetType})`);
                lines.push(`     Actual: ${r.actualClass.toUpperCase()} | Predicted: ${r.predictedClass.toUpperCase()} (Score: ${r.predictedScore}) | Result: ${mark}`);
            });
            lines.push('--------------------------------------------------------------------------------');
        }

        return lines.join('\n');
    }

    function printReport(result) {
        const text = formatReport(result);
        console.log(text);
        return text;
    }

    // ==================================================================
    // PUBLIC API
    // ==================================================================
    return {
        validate,
        validateByType,
        calculateRecordScore,
        classifyScore,
        generateConfusionMatrix,
        formatReport,
        printReport,
        EXAMPLE_DATASET,
        VALID_DATASET_TYPES,
        CLASSES,
    };

})();

// Global exports (browser window, globalThis, Node.js global & module)
if (typeof globalThis !== 'undefined') {
    globalThis.MCFRI_V2_Validator = MCFRI_V2_Validator;
}
if (typeof window !== 'undefined') {
    window.MCFRI_V2_Validator = MCFRI_V2_Validator;
}
if (typeof global !== 'undefined') {
    global.MCFRI_V2_Validator = MCFRI_V2_Validator;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MCFRI_V2_Validator;
}

