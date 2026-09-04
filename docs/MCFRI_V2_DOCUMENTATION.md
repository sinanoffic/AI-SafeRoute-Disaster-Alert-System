# MCFRI-V2 Engine: Technical Specification & Developer Documentation
**Multi-Catchment Flood Risk Index — Version 2.0 (Normalized Non-Linear Risk Engine)**  
*AI SafeRoute Disaster Management Platform*

---

> [!WARNING]
> **UNVALIDATED DEVELOPMENT STATUS NOTICE**  
> All mathematical equations, exponents ($\alpha, \beta, \gamma, \delta, \epsilon, \eta$), half-saturation constants ($R_0, Q_0$), component weights ($w_{RM}, w_W, w_T, w_D$), and classification thresholds documented herein are **UNVALIDATED DEVELOPMENT DEFAULTS**. They are engineered to establish bounded mathematical behavior ($S(t) \in [0, 200]$) and test system UI/backend pipelines. **These values must undergo rigorous empirical calibration and statistical validation against historical meteorological and hydrological datasets before operational deployment.** Do not use these uncalibrated parameters for real-world life-critical disaster dispatch.

---

## Table of Contents
1. [Theoretical Architecture & Core Equation](#1-theoretical-architecture--core-equation)
2. [Variable Definitions & Symbol Glossary](#2-variable-definitions--symbol-glossary)
3. [Normalization Procedures & Transfer Functions](#3-normalization-procedures--transfer-functions)
4. [Parameter Configuration (`MCFRI_CONFIG`)](#4-parameter-configuration-mcfr_config)
5. [Component Weight Constraints & Auto-Normalization](#5-component-weight-constraints--auto-normalization)
6. [Risk Classification Thresholds & Tiers](#6-risk-classification-thresholds--tiers)
7. [Secondary Risk Processing Pipeline](#7-secondary-risk-processing-pipeline)
8. [Validation & Calibration Workflow](#8-validation--calibration-workflow)
9. [System Limitations & Known Constraints](#9-system-limitations--known-constraints)
10. [Worked Numerical Example (UNVALIDATED)](#10-worked-numerical-example-unvalidated)
11. [How to Reproduce a Calculation](#11-how-to-reproduce-a-calculation)
12. [API Reference & Implementation Details](#12-api-reference--implementation-details)

---

## 1. Theoretical Architecture & Core Equation

The **Multi-Catchment Flood Risk Index Version 2 (MCFRI-V2)** is a deterministic, normalized non-linear environmental risk engine. It transforms raw multi-source meteorological, hydrologic, and geospatial telemetry into a bounded risk score $S(t) \in [0, 200]$.

Unlike linear flood models where risk accumulates proportionally to rainfall volume, MCFRI-V2 models asymptotic ground saturation, exponential moisture coupling, power-law topographic attenuation, and rate-of-change cloudburst dynamics.

```
RAW TELEMETRY INPUTS (R, m, p, d, h, l, dR/dt)
                     │
                     ▼
        INPUT SANITIZATION & GUARDS
                     │
                     ▼
          NORMALIZATION LAYER [0, 1]
    (Michaelis-Menten Kinetics & Rescaling)
                     │
                     ▼
     NON-LINEAR COMPONENT CALCULATIONS
      ┌──────────┬──────────┬──────────┬──────────┐
      ▼          ▼          ▼          ▼
     FRM         FW         FT       FDelta
 (Rain-Moist) (Water-Drain) (Topo-Land) (Accel)
      └──────────┴──────────┴──────────┴──────────┘
                     │
                     ▼
  WEIGHTED AGGREGATION & SCALING: S_raw = 200 * Σ(w_i * F_i)
                     │
                     ▼
  SHELTER PROTECTION & SPATIAL DAMPENING
                     │
                     ▼
       BOUNDARY CLAMPING: [0, 200]
                     │
                     ▼
  CLASSIFICATION (Safe < 80, Warning 80-140, Danger > 140)
                     │
                     ▼
  SECONDARY PIPELINE (Spillover -> Dynamic Radius -> Future Horizon)
```

### 1.1 The Primary Master Equation

$$S(t) = 200 \times \Big[ w_{RM} \cdot F_{RM} + w_{W} \cdot F_{W} + w_{T} \cdot F_{T} + w_{\Delta} \cdot F_{\Delta} \Big]$$

Where:
- $S(t)$ is the composite Catchment Flood Risk Score bounded in $[0, 200]$.
- $200$ is the operational maximum score scale multiplier ($S_{\max}$).
- $w_{RM}, w_W, w_T, w_\Delta$ are non-negative component weights subject to $\sum w_i = 1.0$.
- $F_{RM}, F_W, F_T, F_\Delta$ are normalized sub-component risk factors, each strictly bounded in $[0, 1]$.

---

### 1.2 Sub-Component Equations

#### 1. Rainfall-Moisture Coupling Component ($F_{RM}$)
Quantifies the non-linear interaction between incoming rainfall volume and antecedent soil saturation:

$$F_{RM} = r^\alpha \cdot \left( \frac{\exp(\beta \cdot m) - 1}{\exp(\beta) - 1} \right)$$

- $r = \frac{R}{R + R_0}$ is the Michaelis-Menten normalized rainfall index ($r \in [0, 1)$).
- $m \in [0, 1]$ is the normalized antecedent soil moisture index.
- $\alpha$ is the rainfall saturation power exponent (development default: $1.5$).
- $\beta$ is the exponential soil moisture amplification factor (development default: $2.0$).
- When $\beta \to 0$, the moisture term approaches $m$ linearly via L'Hôpital's rule.

#### 2. Water Proximity & Drainage Infrastructure Component ($F_W$)
Quantifies vulnerability based on physical distance to riverbanks/coastlines compounded by municipal drainage inadequacy:

$$F_{W} = p^\gamma \cdot (1 - d)^\delta$$

- $p \in [0, 1]$ is the normalized water body proximity index.
- $d \in [0, 1]$ is the normalized municipal drainage quality rating ($0 = \text{completely clogged/failed}, 1 = \text{optimal drainage}$).
- $(1 - d)$ represents the drainage vulnerability index.
- $\gamma$ is the proximity power exponent (development default: $2.0$).
- $\delta$ is the drainage vulnerability exponent (development default: $1.5$).

#### 3. Topographic Exposure & Land-Use Permeability Component ($F_T$)
Quantifies structural vulnerability from low elevation (Height Above Nearest Drainage / HAND) and surface impermeability (urban asphalt vs. vegetated canopy):

$$F_{T} = (1 - h)^\epsilon \cdot (1 - l)$$

- $h \in [0, 1]$ is the normalized topographic elevation safety factor ($0 = \text{deep basin / flood-exposed}, 1 = \text{high ground / crest}$).
- $(1 - h)$ represents topographic flood exposure.
- $l \in [0, 1]$ is the surface permeability coefficient ($0 = \text{impervious concrete/asphalt}, 1 = \text{permeable natural soil/forest}$).
- $(1 - l)$ represents surface runoff generation potential.
- $\epsilon$ is the topographic attenuation exponent (development default: $2.0$).

#### 4. Rainfall Rate Acceleration Component ($F_\Delta$)
Detects sudden, violent cloudbursts and flash flood onset by isolating positive rates of rainfall change:

$$F_{\Delta} = q^\eta$$

- $q = \frac{\max(0, \Delta R)}{\max(0, \Delta R) + Q_0}$ is the Michaelis-Menten normalized rainfall acceleration ($q \in [0, 1)$).
- $\Delta R = \frac{dR}{dt}$ is the positive rate of rainfall change across consecutive measurement intervals.
- $Q_0$ is the rainfall-rate half-saturation constant (development default: $50\text{ mm/event}$).
- $\eta$ is the rainfall acceleration exponent (development default: $1.2$).
- If $\Delta R \le 0$, $q = 0$ and $F_\Delta = 0$ (receding or steady rain produces zero flash acceleration).

---

## 2. Variable Definitions & Symbol Glossary

| Symbol | Mathematical Variable | Physical Meaning | Engineering Units | Permissible Range | Development Default |
| :--- | :--- | :--- | :--- | :--- | :--- |
| $R$ | `rainfall` | Total accumulated precipitation volume | Millimeters ($\text{mm}$) | $[0, \infty)$ | Dynamic ($0 - 300\text{ mm}$) |
| $R_0$ | `R0` | Rainfall half-saturation constant ($r = 0.5$ when $R = R_0$) | Millimeters ($\text{mm}$) | $(0, \infty)$ | $150\text{ mm}$ |
| $r$ | `norm.rainfall` | Normalized rainfall saturation ratio | Dimensionless | $[0, 1)$ | Calculated: $\frac{R}{R + R_0}$ |
| $m$ | `soilMoisture` | Antecedent soil moisture saturation | Dimensionless index | $[0.0, 1.0]$ | $0.5$ ($0=\text{dry}, 1=\text{saturated}$) |
| $p$ | `waterProximity` | Normalized proximity to surface water bodies | Dimensionless index | $[0.0, 1.0]$ | Zone raw ($1-5$) $\div 5$ |
| $d$ | `drainage` | Municipal drainage & culvert discharge capacity | Dimensionless index | $[0.0, 1.0]$ | $0.5$ ($0=\text{failed}, 1=\text{optimal}$) |
| $h$ | `handExposure` | Topographic safety / Height Above Nearest Drainage | Dimensionless index | $[0.0, 1.0]$ | Zone raw: $\frac{\text{elev}-1}{4}$ |
| $l$ | `permeability` | Land-surface infiltration / porousness factor | Dimensionless index | $[0.0, 1.0]$ | $0.5$ ($0=\text{paved}, 1=\text{forest}$) |
| $\Delta R$ ($dR/dt$) | `deltaR` / `rainfallRate`| Positive rate of rainfall accumulation change | $\text{mm / event}$ | $[0, \infty)$ | Dynamic ($\ge 0$) |
| $Q_0$ | `Q0` | Rainfall rate half-saturation constant | $\text{mm / event}$ | $(0, \infty)$ | $50\text{ mm/event}$ |
| $q$ | `norm.rainfallRate`| Normalized flash cloudburst acceleration ratio | Dimensionless | $[0, 1)$ | Calculated: $\frac{\Delta R}{\Delta R + Q_0}$ |
| $\alpha$ | `alpha` | Rainfall saturation power exponent | Dimensionless parameter | $(0, \infty)$ | $1.5$ |
| $\beta$ | `beta` | Antecedent soil moisture exponential factor | Dimensionless parameter | $(0, \infty)$ | $2.0$ |
| $\gamma$ | `gamma` | Proximity vulnerability power exponent | Dimensionless parameter | $(0, \infty)$ | $2.0$ |
| $\delta$ | `delta` | Drainage deficit power exponent | Dimensionless parameter | $(0, \infty)$ | $1.5$ |
| $\epsilon$ | `epsilon` | Topographic elevation protection exponent | Dimensionless parameter | $(0, \infty)$ | $2.0$ |
| $\eta$ | `eta` | Cloudburst surge power exponent | Dimensionless parameter | $(0, \infty)$ | $1.2$ |
| $w_{RM}$ | `wRM` | Weight for Rainfall-Moisture sub-component | Dimensionless weight | $[0.0, 1.0]$ | $0.40$ |
| $w_W$ | `wW` | Weight for Water-Drainage sub-component | Dimensionless weight | $[0.0, 1.0]$ | $0.25$ |
| $w_T$ | `wT` | Weight for Topographic-LandUse sub-component | Dimensionless weight | $[0.0, 1.0]$ | $0.20$ |
| $w_\Delta$ ($w_D$) | `wD` | Weight for Rainfall Acceleration sub-component | Dimensionless weight | $[0.0, 1.0]$ | $0.15$ |
| $S(t)$ | `riskScore` | Catchment Flood Risk Index score | Dimensionless scale | $[0, 200]$ | Scaled and clamped |

---

## 3. Normalization Procedures & Transfer Functions

To ensure numerical stability and prevent unbounded score explosion under extreme weather inputs, every raw environmental variable is transformed into a normalized domain $[0, 1]$ before evaluating non-linear power functions.

```
+-----------------------------------------------------------------------------------------+
|                                NORMALIZATION TRANSFER FUNCTIONS                         |
+--------------------------+---------------------+---------------------+------------------+
| Parameter                | Input Domain        | Output Range        | Transfer Curve   |
+--------------------------+---------------------+---------------------+------------------+
| Rainfall (R)             | [0, +inf) mm        | [0, 1.0)            | Michaelis-Menten |
| Soil Moisture (m)        | [0, 1.0]            | [0, 1.0]            | Linear Clamp     |
| Water Proximity (p)      | [1, 5] raw scale    | [0, 1.0]            | Linear Rescaling |
| Drainage Quality (d)     | [0, 1.0]            | [0, 1.0]            | Linear Clamp     |
| Topographic Factor (h)   | [1, 5] elev scale   | [0, 1.0]            | Min-Max Mapping  |
| Surface Permeability (l) | [0, 1.0]            | [0, 1.0]            | Linear Clamp     |
| Rain Acceleration (dR/dt)| (-inf, +inf) mm/ev  | [0, 1.0)            | Rectified MM     |
+--------------------------+---------------------+---------------------+------------------+
```

### 3.1 `normalizeRainfall(R, R0)`
Transforms unbounded rainfall precipitation into an asymptotic saturation curve:

$$r = f(R) = \frac{R}{R + R_0} \quad \text{for } R \ge 0, \; R_0 > 0$$

- **Mathematical properties:**
  - $f(0) = 0.0$
  - $f(R_0) = 0.5$ (Half-saturation)
  - $\lim_{R \to \infty} f(R) = 1.0$ (Strict upper asymptote)
  - $\frac{df}{dR} = \frac{R_0}{(R + R_0)^2} > 0$ (Strictly monotonic increasing)
- **Source Code Implementation (`riskEngine.js`):**
```javascript
function normalizeRainfall(R, R0) {
    const r = validatePositive(R, 0, 'rainfall');
    const r0 = validatePositive(R0, MCFRI_CONFIG.R0, 'R0');
    if (r0 === 0) return r > 0 ? 1 : 0;
    return r / (r + r0);
}
```

### 3.2 `normalizeSoilMoisture(m)`
Validates and clamps soil saturation index within $[0, 1]$:

$$m_{\text{norm}} = \max(0, \min(1, m))$$

- **Source Code Implementation (`riskEngine.js`):**
```javascript
function normalizeSoilMoisture(m) {
    return Math.max(0, Math.min(1, validateNumber(m, 0.5, 'soilMoisture')));
}
```

### 3.3 `normalizeWaterProximity(p)`
Transforms raw categorical geographic ratings ($1 = \text{inland/distant}$ to $5 = \text{riverbank/shoreline}$) to $[0, 1]$:

$$p_{\text{norm}} = \max\left(0, \min\left(1, \frac{p_{\text{raw}}}{5}\right)\right)$$

- **Source Code Implementation (`riskEngine.js`):**
```javascript
function normalizeWaterProximity(p) {
    const raw = validatePositive(p, 0, 'waterProximity');
    return Math.max(0, Math.min(1, raw / 5));
}
```

### 3.4 `normalizeDrainage(d)`
Sanitizes and clamps drainage quality ratings into $[0, 1]$:

$$d_{\text{norm}} = \max(0, \min(1, d))$$

- **Source Code Implementation (`riskEngine.js`):**
```javascript
function normalizeDrainage(d) {
    return Math.max(0, Math.min(1, validateNumber(d, 0.5, 'drainage')));
}
```

### 3.5 `normalizeHAND(elevationFactor)`
Maps discrete zone elevation tiers ($1 = \text{lowland basin}$ to $5 = \text{high crest}$) onto the continuous unit interval $[0, 1]$:

$$h_{\text{norm}} = \max\left(0, \min\left(1, \frac{\text{elevationFactor} - 1}{5 - 1}\right)\right) = \frac{\text{elevationFactor} - 1}{4}$$

- If an interactive global slider $h_{\text{user}}$ is supplied, the engine blends local zone terrain with the regional modifier:
$$h_{\text{final}} = \frac{h_{\text{zone}} + h_{\text{user}}}{2}$$
- **Source Code Implementation (`riskEngine.js`):**
```javascript
function normalizeHAND(elevationFactor) {
    const raw = validatePositive(elevationFactor, 1, 'HAND/elevationFactor');
    return Math.max(0, Math.min(1, (raw - 1) / 4));
}
```

### 3.6 `normalizePermeability(l)`
Sanitizes surface permeability into $[0, 1]$:

$$l_{\text{norm}} = \max(0, \min(1, l))$$

- **Source Code Implementation (`riskEngine.js`):**
```javascript
function normalizePermeability(l) {
    return Math.max(0, Math.min(1, validateNumber(l, 0.5, 'permeability')));
}
```

### 3.7 `normalizeRainfallRate(dR, Q0)`
Half-wave rectifies and normalizes the precipitation rate of change:

$$q = f(\Delta R) = \frac{\max(0, \Delta R)}{\max(0, \Delta R) + Q_0}$$

- Negative rates (drying/receding precipitation) are mapped to $0.0$.
- **Source Code Implementation (`riskEngine.js`):**
```javascript
function normalizeRainfallRate(dR, Q0) {
    const positiveDR = Math.max(0, validateNumber(dR, 0, 'rainfallRate'));
    const q0 = validatePositive(Q0, MCFRI_CONFIG.Q0, 'Q0');
    if (q0 === 0) return positiveDR > 0 ? 1 : 0;
    return positiveDR / (positiveDR + q0);
}
```

---

## 4. Parameter Configuration (`MCFRI_CONFIG`)

All engine constants, exponents, threshold limits, shelter buffers, and adaptive boundaries are centralized in `mcfriV2Config.js`.

### 4.1 Configuration Object Architecture

```javascript
const MCFRI_CONFIG = Object.freeze({
    // ---- Engine Identity ----
    engineVersion: "MCFRI-V2",
    engineLabel: "MCFRI-V2 — Normalized Non-Linear Risk Engine",
    parameterStatus: "UNVALIDATED DEVELOPMENT DEFAULTS",

    // ---- Exponent Parameters (UNVALIDATED) ----
    alpha:   1.5,    // Rainfall saturation exponent
    beta:    2.0,    // Moisture amplification exponent
    gamma:   2.0,    // Water proximity exponent
    delta:   1.5,    // Drainage quality exponent
    epsilon: 2.0,    // Topographic exposure exponent
    eta:     1.2,    // Rainfall acceleration exponent

    // ---- Scaling Constants (UNVALIDATED) ----
    R0: 150,   // Rainfall half-saturation constant (mm)
    Q0: 50,    // Rainfall-rate half-saturation constant (mm/event)

    // ---- Component Weights (must sum to 1.0) ----
    wRM: 0.40,   // Rainfall-Moisture component weight
    wW:  0.25,   // Water-Drainage component weight
    wT:  0.20,   // Topographic-LandUse component weight
    wD:  0.15,   // Rainfall Acceleration component weight

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

    // ---- Shelter Protection ----
    shelterProtection: Object.freeze({
        radius: 800,          // meters – protection field radius
        maxBonus: 40,         // max risk reduction points per shelter
        dampening: 0.8,       // 20% dampening factor after protection
        locations: Object.freeze([
            [12.978, 77.591],
            [12.985, 77.605],
            [12.970, 77.610],
            [12.965, 77.595],
            [12.982, 77.585],
            [12.960, 77.600],
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
        adjustmentStep: 0.01,
        bounds: Object.freeze({
            wRM: { min: 0.25, max: 0.55 },
            wW:  { min: 0.15, max: 0.40 },
            wT:  { min: 0.10, max: 0.35 },
            wD:  { min: 0.05, max: 0.25 },
        }),
    }),
});
```

### 4.2 Guidelines for Modifying Parameters During Calibration
1. `MCFRI_CONFIG` is deeply frozen via `Object.freeze()`. In production or testing scripts, clone or inject custom configurations into test harnesses rather than mutating the global constant.
2. Ensure exponents $\alpha, \beta, \gamma, \delta, \epsilon, \eta > 0$ to prevent negative power division-by-zero singularities.
3. Ensure $R_0 > 0$ and $Q_0 > 0$.
4. Ensure weights $w_i \in [0, 1]$ and $\sum w_i = 1.0$.

---

## 5. Component Weight Constraints & Auto-Normalization

### 5.1 The Sum-to-One Mathematical Constraint

To preserve mathematical boundedness where $S_{\text{raw}} \in [0, 200]$, component weights must satisfy:

$$w_{RM} + w_W + w_T + w_\Delta = 1.0 \quad \text{within tolerance } |1.0 - \sum w_i| \le 10^{-6}$$

Because each sub-component function maps into the unit interval $F_i \in [0, 1]$:

$$\max(S_{\text{raw}}) = 200 \times \Big( w_{RM}(1) + w_W(1) + w_T(1) + w_\Delta(1) \Big) = 200 \times (1.0) = 200$$

$$\min(S_{\text{raw}}) = 200 \times \Big( w_{RM}(0) + w_W(0) + w_T(0) + w_\Delta(0) \Big) = 200 \times (0.0) = 0$$

### 5.2 Auto-Normalization Fail-Safe Mechanism

If developer configuration errors or dynamic runtime adaptive weight adjustments result in $\sum w_i \neq 1.0$, `riskEngine.js` executes automatic L1-norm rescaling before score evaluation:

$$w_i' = \frac{w_i}{\sum_{k \in \{RM, W, T, \Delta\}} w_k}$$

```javascript
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
```

---

## 6. Risk Classification Thresholds & Tiers

The continuous risk score $S(t) \in [0, 200]$ is mapped to three categorical operational tiers:

```
0                        80                       140                      200
├────────────────────────┼────────────────────────┼────────────────────────┤
│        SAFE            │        WARNING         │        DANGER          │
│   (Normal Routine)     │  (Rescue Stage/Advis)  │ (Evacuation/Blacklist) │
└────────────────────────┴────────────────────────┴────────────────────────┘
```

| Tier Name | Score Range ($S$) | UI Hex Color | Map Fill Opacity | Physical Hydrologic Interpretation | Operational Emergency Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`SAFE`** | $0 \le S < 80$ | `#22c55e` (Green) | `0.12` | Infiltration capacity exceeds precipitation rate; culverts and natural channels operate normally. | Standard municipal monitoring. No travel restrictions. |
| **`WARNING`** | $80 \le S \le 140$ | `#f59e0b` (Amber) | `0.20` | Soil nearing full saturation; minor waterlogging in low-lying underpasses; runoff beginning. | Stage emergency personnel, clear drainage choke points, issue advisory warnings to pack emergency kits. |
| **`DANGER`** | $S > 140$ | `#ef4444` (Red) | `0.30` | Active structural flooding; river overflow; rapid surface inundation; severe threat to human life. | Mandatory evacuation; automated routing engine blacklists all roads traversing zone; SOS triage priority elevated. |

---

## 7. Secondary Risk Processing Pipeline

Following the primary core equation calculation, the engine applies four sequential domain transformations:

```
[Primary Score S_raw]
         │
         ▼
[1. Shelter Protection Bonus & Dampening]
         │
         ▼
[2. Zone-to-Zone Flood Spillover Transfer]
         │
         ▼
[3. Dynamic Map Visual Footprint Expansion]
         │
         ▼
[4. Future Horizon Trajectory Prediction]
         │
         ▼
[5. Adaptive Short-Term Weight Updating]
```

### 7.1 Shelter Protection Field & Dampening
Zones within proximity of fortified evacuation shelters receive a risk mitigation offset based on inverse distance:

$$\text{Bonus} = \sum_{s \in \text{Shelters}} \begin{cases} 40 \times \left(1 - \frac{\text{dist}(\text{zone}, s)}{800\text{m}}\right) & \text{if } \text{dist}(\text{zone}, s) < 800\text{m} \\ 0 & \text{otherwise} \end{cases}$$

$$S_{\text{mitigated}} = (S_{\text{raw}} - \text{Bonus}) \times 0.8$$

### 7.2 Flood Spillover Mechanics
When a catchment crosses into active `DANGER` ($S > 140$), excess flood volume bleeds into adjacent catchments within a $2000\text{m}$ radius:

$$\Delta S_{\text{spill}, j} = \sum_{i \ne j, S_i > 140} S_i \times 0.10 \times \left(1 - \frac{\text{dist}(i, j)}{2000\text{m}}\right)$$

$$S_{\text{final}, j} = \min\left(200, \text{round}(S_j + \Delta S_{\text{spill}, j})\right)$$

### 7.3 Dynamic Visual Radius
On Leaflet map renderings, the visual impact circle scales dynamically with risk severity:

$$R_{\text{visual}} = R_{\text{base}} \times \left( 1 + \frac{S_{\text{final}}}{200} \right)$$

### 7.4 Future Risk Horizon Projection
Projects risk trajectory across a $t_h$-hour window ($1 - 6\text{ hours}$):

$$S_{\text{future}} = \text{clamp}\left( S_{\text{final}} + \left(\frac{R}{50}\right) \cdot t_h + (p \cdot 10) \cdot t_h, \; 0, \; 200 \right)$$

### 7.5 Adaptive Short-Term Weight Updates
Maintains a 5-step rolling historical FIFO buffer of maximum risk scores. If rapid acceleration is detected across a 3-step window ($\Delta S_{\max} > 30$), the system adjusts sensitivity weights:

$$w_{RM} \leftarrow \min(w_{RM} + 0.01, \; 0.55), \quad w_D \leftarrow \min(w_D + 0.005, \; 0.25)$$

---

## 8. Validation & Calibration Workflow

To transition MCFRI-V2 from an unvalidated development model to an operationally certified disaster system, developers must adhere to the three-tier empirical calibration protocol.

```
+---------------------------------------------------------------------------------------+
|                              CALIBRATION & VALIDATION PIPELINE                        |
+---------------------------------------------------------------------------------------+
| 1. HISTORICAL DATA INGESTION: Rainfall gauges, soil radar (SMAP), DEM, inundation maps|
|                                         │                                             |
|                                         ▼                                             |
| 2. DATASET PARTITIONING:                                                              |
|    ├── Calibration Set (60%): Nelder-Mead / L-BFGS-B parameter fitting                |
|    ├── Validation Set (20%): Hyperparameter tuning & threshold optimization           |
|    └── Test Set (20%): Out-of-sample blinded performance certification                |
|                                         │                                             |
|                                         ▼                                             |
| 3. LOSS FUNCTION OPTIMIZATION:                                                        |
|    L(θ) = MSE(S_pred, S_observed) + λ * CrossEntropy(Class_pred, Class_ground_truth)  |
|                                         │                                             |
|                                         ▼                                             |
| 4. STATISTICAL EVALUATION: Accuracy, Macro F1, Brier Score, ROC-AUC                   |
+---------------------------------------------------------------------------------------+
```

### 8.1 Required Dataset Schema

Datasets passed into calibration/validation suites (e.g. `mcfriV2Validator.js`) should be structured in standardized JSON or CSV formats:

```json
[
  {
    "id": "EVENT_BLR_2022_09_05_01",
    "timestamp": "2022-09-05T02:30:00Z",
    "location": { "lat": 12.975, "lng": 77.590, "zoneId": "zone-a" },
    "inputs": {
      "rainfallMm": 185.4,
      "soilMoisture": 0.88,
      "waterProximityRaw": 5,
      "drainageQuality": 0.20,
      "elevationFactorRaw": 1,
      "permeability": 0.15,
      "deltaRMmPerHour": 65.0
    },
    "groundTruth": {
      "inundationDepthMeters": 1.45,
      "observedCategory": "danger",
      "damageReported": true,
      "roadSubmerged": true
    }
  }
]
```

### 8.2 Calibration vs. Validation vs. Test Methodology

1. **Calibration Dataset (60%):**
   - Used to calibrate mathematical coefficients $\theta = \{\alpha, \beta, \gamma, \delta, \epsilon, \eta, R_0, Q_0, w_{RM}, w_W, w_T, w_D\}$.
   - Optimization techniques: Constrained non-linear optimization (Nelder-Mead simplex, Sequential Least Squares Programming / SLSQP, or Genetic Algorithms).
   - Target Objective: Minimize Mean Squared Error (MSE) against observed flood inundation depths.

2. **Validation Dataset (20%):**
   - Used for hyperparameter tuning and threshold boundary optimization (`thresholds.safe`, `thresholds.warning`).
   - Prevents overfitting to local catchment microclimates.
   - Evaluates multi-class log-loss and ROC-AUC curves.

3. **Test Dataset (20%):**
   - Strictly isolated and out-of-sample historical disaster events.
   - Used to compute final reported metrics: Confusion Matrix, Balanced Accuracy, Precision, Recall, Macro F1-score, and Brier Reliability Score.

---

## 9. System Limitations & Known Constraints

Developers, hydrologists, and emergency planning authorities must take notice of the following explicit mathematical and engineering constraints:

> [!CAUTION]
> 1. **Unvalidated Development Parameters:** Default exponents ($\alpha=1.5, \beta=2.0$, etc.) and scaling factors ($R_0=150, Q_0=50$) are theoretical development values and have **NOT** been fitted against field hydrologic gauge data.
> 2. **Absence of 2D Hydrodynamic Physics:** MCFRI-V2 does not solve the 2D Shallow Water Equations (Saint-Venant equations). Water flow velocities and hydraulic momentum are simplified through point-centroid proxy factors.
> 3. **Heuristic Shelter Protection:** The shelter mitigation formula ($40\text{ pts} \times (1 - d/800)$ with $0.8$ dampening) is a geometric heuristic and does not model actual structural elevation or civil shelter barrier strength.
> 4. **Heuristic Adaptive Weight Adjustment:** The short-term memory trend rule is a fixed-step heuristic ($\pm 0.01$) rather than a mathematically rigorous online Kalman filter or Bayesian parameter estimator.
> 5. **Spatial Independence Assumption:** Zone risk calculations are initially computed independently per zone before applying heuristic spillover approximations.

---

## 10. Worked Numerical Example (UNVALIDATED)

> [!IMPORTANT]
> **UNVALIDATED EXAMPLE**  
> The following step-by-step calculation utilizes the uncalibrated development defaults from `mcfriV2Config.js`. It illustrates the internal arithmetic pipeline for developer reproduction.

### 10.1 Input Parameters

| Parameter | Symbol | Input Value |
| :--- | :--- | :--- |
| Accumulated Rainfall | $R$ | $200.0\text{ mm}$ |
| Soil Moisture | $m$ | $0.70$ |
| Water Proximity | $p$ | $0.80$ (from raw rating $4 / 5$) |
| Drainage Quality | $d$ | $0.30$ |
| Topographic Exposure | $h$ | $0.20$ (from raw elevation $1.8 \implies \frac{1.8-1}{4} = 0.20$) |
| Surface Permeability | $l$ | $0.30$ |
| Rainfall Acceleration | $\Delta R$ | $100.0\text{ mm/event}$ |

**Config Parameters:**
- $R_0 = 150.0\text{ mm}, \quad Q_0 = 50.0\text{ mm/event}$
- $\alpha = 1.5, \quad \beta = 2.0, \quad \gamma = 2.0, \quad \delta = 1.5, \quad \epsilon = 2.0, \quad \eta = 1.2$
- $w_{RM} = 0.40, \quad w_W = 0.25, \quad w_T = 0.20, \quad w_D = 0.15$

---

### 10.2 Step-by-Step Calculation

#### Step 1: Input Normalization
1. **Rainfall ($r$):**
   $$r = \frac{R}{R + R_0} = \frac{200}{200 + 150} = \frac{200}{350} = \frac{4}{7} \approx 0.57142857$$

2. **Soil Moisture ($m$):**
   $$m = 0.70$$

3. **Water Proximity ($p$):**
   $$p = 0.80$$

4. **Drainage Quality ($d$):**
   $$d = 0.30 \implies (1 - d) = 0.70$$

5. **Topographic Exposure ($h$):**
   $$h = 0.20 \implies (1 - h) = 0.80$$

6. **Permeability ($l$):**
   $$l = 0.30 \implies (1 - l) = 0.70$$

7. **Rainfall Acceleration ($q$):**
   $$q = \frac{\Delta R}{\Delta R + Q_0} = \frac{100}{100 + 50} = \frac{100}{150} = \frac{2}{3} \approx 0.66666667$$

---

#### Step 2: Component Evaluations

1. **Rainfall-Moisture Factor ($F_{RM}$):**
   $$r^\alpha = (0.57142857)^{1.5} = \sqrt{(0.57142857)^3} \approx 0.43195971$$
   $$\text{Moisture Term} = \frac{\exp(2.0 \times 0.70) - 1}{\exp(2.0) - 1} = \frac{\exp(1.4) - 1}{\exp(2.0) - 1} \approx \frac{4.05519997 - 1}{7.38905610 - 1} = \frac{3.05519997}{6.38905610} \approx 0.47819270$$
   $$F_{RM} = 0.43195971 \times 0.47819270 \approx \mathbf{0.20655983}$$

2. **Water-Drainage Factor ($F_W$):**
   $$p^\gamma = (0.80)^{2.0} = 0.64000000$$
   $$(1 - d)^\delta = (0.70)^{1.5} = \sqrt{(0.70)^3} = \sqrt{0.343} \approx 0.58566209$$
   $$F_W = 0.64000000 \times 0.58566209 \approx \mathbf{0.37482369}$$

3. **Topographic-LandUse Factor ($F_T$):**
   $$(1 - h)^\epsilon = (0.80)^{2.0} = 0.64000000$$
   $$(1 - l) = 0.70000000$$
   $$F_T = 0.64000000 \times 0.70000000 = \mathbf{0.44800000}$$

4. **Rainfall Acceleration Factor ($F_\Delta$):**
   $$q^\eta = (0.66666667)^{1.2} \approx \mathbf{0.61473861}$$

---

#### Step 3: Weighted Linear Combination
$$\text{Weighted Sum} = (w_{RM} \cdot F_{RM}) + (w_W \cdot F_W) + (w_T \cdot F_T) + (w_D \cdot F_\Delta)$$

- $w_{RM} \cdot F_{RM} = 0.40 \times 0.20655983 = \mathbf{0.08262393}$
- $w_W \cdot F_W = 0.25 \times 0.37482369 = \mathbf{0.09370592}$
- $w_T \cdot F_T = 0.20 \times 0.44800000 = \mathbf{0.08960000}$
- $w_D \cdot F_\Delta = 0.15 \times 0.61473861 = \mathbf{0.09221079}$

$$\text{Total Weighted Sum} = 0.08262393 + 0.09370592 + 0.08960000 + 0.09221079 = \mathbf{0.35814065}$$

---

#### Step 4: Primary Raw Score Scaling ($S_{\text{raw}}$)
$$S_{\text{raw}} = 200 \times 0.35814065 = \mathbf{71.628129} \quad (\approx 72)$$

---

#### Step 5: Post-Processing & Shelter Dampening
- Assuming no shelter within $800\text{m}$ ($\text{Bonus} = 0$), the implementation applies structural dampening ($0.8$):
$$S_{\text{mitigated}} = 71.628129 \times 0.8 = \mathbf{57.302503}$$
$$\text{Final Integer Clamped Score } S = \max(0, \min(200, \text{round}(57.302503))) = \mathbf{57}$$
*(Note: If evaluating pure un-dampened core formula: $S = \text{round}(71.628129) = \mathbf{72}$)*

---

#### Step 6: Operational Classification
- Since $57 < 80$ (and $72 < 80$):
- **Classification Level:** `SAFE`
- **Map Badge Color:** `#22c55e` (Green)
- **Status:** Water absorbed normally, routine drainage operation.

---

## 11. How to Reproduce a Calculation

### 11.1 Reproduction in JavaScript / Node.js

Create a test script `verify_mcfri.js`:

```javascript
function computeMCFRIV2({
    R = 200, m = 0.7, p = 0.8, d = 0.3, h = 0.2, l = 0.3, deltaR = 100,
    R0 = 150, Q0 = 50,
    alpha = 1.5, beta = 2.0, gamma = 2.0, delta = 1.5, epsilon = 2.0, eta = 1.2,
    wRM = 0.40, wW = 0.25, wT = 0.20, wD = 0.15,
    applyDampening = false
}) {
    // 1. Normalization
    const r = R / (R + R0);
    const mNorm = Math.max(0, Math.min(1, m));
    const pNorm = Math.max(0, Math.min(1, p));
    const dNorm = Math.max(0, Math.min(1, d));
    const hNorm = Math.max(0, Math.min(1, h));
    const lNorm = Math.max(0, Math.min(1, l));
    const q = Math.max(0, deltaR) / (Math.max(0, deltaR) + Q0);

    // 2. Components
    const FRM = Math.pow(r, alpha) * ((Math.exp(beta * mNorm) - 1) / (Math.exp(beta) - 1));
    const FW = Math.pow(pNorm, gamma) * Math.pow(1 - dNorm, delta);
    const FT = Math.pow(1 - hNorm, epsilon) * (1 - lNorm);
    const FDelta = Math.pow(q, eta);

    // 3. Weight Normalization
    const wSum = wRM + wW + wT + wD;
    const w1 = wRM / wSum, w2 = wW / wSum, w3 = wT / wSum, w4 = wD / wSum;

    // 4. Weighted Sum & Base Scaling
    const weightedSum = (w1 * FRM) + (w2 * FW) + (w3 * FT) + (w4 * FDelta);
    let score = 200 * weightedSum;

    if (applyDampening) {
        score = score * 0.8;
    }

    const finalScore = Math.max(0, Math.min(200, Math.round(score)));
    const level = finalScore > 140 ? 'danger' : finalScore >= 80 ? 'warning' : 'safe';

    return {
        normalizedInputs: { r, m: mNorm, p: pNorm, d: dNorm, h: hNorm, l: lNorm, q },
        components: { FRM, FW, FT, FDelta },
        weightedSum,
        rawScore: 200 * weightedSum,
        finalScore,
        level
    };
}

// Run Example
console.log(computeMCFRIV2({}));
```

### 11.2 Reproduction in Python 3

```python
import numpy as np

def compute_mcfri_v2(
    R=200.0, m=0.7, p=0.8, d=0.3, h=0.2, l=0.3, delta_R=100.0,
    R0=150.0, Q0=50.0,
    alpha=1.5, beta=2.0, gamma=2.0, delta=1.5, epsilon=2.0, eta=1.2,
    w_RM=0.40, w_W=0.25, w_T=0.20, w_D=0.15,
    apply_dampening=False
):
    # 1. Normalization
    r = R / (R + R0)
    m_norm = np.clip(m, 0.0, 1.0)
    p_norm = np.clip(p, 0.0, 1.0)
    d_norm = np.clip(d, 0.0, 1.0)
    h_norm = np.clip(h, 0.0, 1.0)
    l_norm = np.clip(l, 0.0, 1.0)
    q = max(0.0, delta_R) / (max(0.0, delta_R) + Q0)

    # 2. Components
    F_RM = (r ** alpha) * ((np.exp(beta * m_norm) - 1.0) / (np.exp(beta) - 1.0))
    F_W = (p_norm ** gamma) * ((1.0 - d_norm) ** delta)
    F_T = ((1.0 - h_norm) ** epsilon) * (1.0 - l_norm)
    F_Delta = q ** eta

    # 3. Weights
    w_sum = w_RM + w_W + w_T + w_D
    w1, w2, w3, w4 = w_RM / w_sum, w_W / w_sum, w_T / w_sum, w_D / w_sum

    # 4. Weighted Aggregation
    weighted_sum = (w1 * F_RM) + (w2 * F_W) + (w3 * F_T) + (w4 * F_Delta)
    score = 200.0 * weighted_sum

    if apply_dampening:
        score *= 0.8

    final_score = int(np.clip(np.round(score), 0, 200))
    level = "danger" if final_score > 140 else "warning" if final_score >= 80 else "safe"

    return {
        "r": r, "q": q,
        "F_RM": F_RM, "F_W": F_W, "F_T": F_T, "F_Delta": F_Delta,
        "weighted_sum": weighted_sum,
        "raw_score": 200.0 * weighted_sum,
        "final_score": final_score,
        "level": level
    }

if __name__ == "__main__":
    res = compute_mcfri_v2()
    print("MCFRI-V2 Python Result:", res)
```

---

## 12. API Reference & Implementation Details

The core implementation is encapsulated in [`frontend/riskEngine.js`](file:///c:/Users/Admin/Documents/BrCE%20%28project%29/project%201/frontend/riskEngine.js) and configured via [`frontend/mcfriV2Config.js`](file:///c:/Users/Admin/Documents/BrCE%20%28project%29/project%201/frontend/mcfriV2Config.js).

### 12.1 Exported Methods on `RiskEngine`

| Function Signature | Return Type | Description |
| :--- | :--- | :--- |
| `runFullSimulation(rainfall, horizon, moisture, drainage, perm, deltaR, hand)` | `Array<ZoneResult>` | Executes the complete 5-stage simulation pipeline across all defined geographic zones. |
| `calculateMCFRIV2Risks(rainfall, moisture, drainage, perm, deltaR, hand)` | `Array<ZoneResult>` | Evaluates Stage 1 core non-linear MCFRI-V2 risk equations. |
| `applyZoneSpillover(zones)` | `Array<ZoneResult>` | Propagates flood danger from zones with $S > 140$ into neighboring zones within $2000\text{m}$. |
| `calculateFutureRisk(zones, rainfall, timeHorizon)` | `Array<ZoneResult>` | Projects flood severity trajectories over $1 - 6\text{ hour}$ forward horizons. |
| `updateDynamicRadius(zones)` | `Array<ZoneResult>` | Computes pixel/meter rendering radii based on calculated risk score. |
| `adjustWeights(zones)` | `void` | Evaluates rolling 5-step risk gradient and updates adaptive component weights. |
| `getNormalizedWeights()` | `Object` | Returns active runtime component weights normalized to sum to $1.0$. |
| `getOverallRisk(zones)` | `string` (`'safe'\|'warning'\|'danger'`) | Determines aggregate district risk level. |

### 12.2 Output Zone Data Structure
Each evaluated zone returns a comprehensive telemetry and explainability payload:

```javascript
{
  id: "zone-a",
  label: "Flood Zone A",
  center: [12.975, 77.590],
  baseRadius: 500,
  elevationFactor: 1,
  proximityToWater: 5,
  riskScore: 148,
  level: "danger",
  color: "#ef4444",
  fillColor: "#ef4444",
  fillOpacity: 0.30,
  protectionApplied: 12,
  spilloverReceived: 0,
  normalizedInputs: {
    rainfall: 0.5714,
    soilMoisture: 0.70,
    waterProximity: 1.0,
    drainage: 0.30,
    handExposure: 0.0,
    permeability: 0.30,
    rainfallRate: 0.6667
  },
  components: {
    rainfallMoisture: 0.2066,
    waterDrainage: 0.5857,
    topographicLandUse: 0.7000,
    rainfallAcceleration: 0.6147
  },
  weights: {
    rainfallMoisture: 0.40,
    waterDrainage: 0.25,
    topographicLandUse: 0.20,
    rainfallAcceleration: 0.15
  },
  explanation: "Risk is primarily driven by topographic exposure and impervious land, with secondary contribution from water proximity with poor drainage.",
  engineVersion: "MCFRI-V2",
  timestamp: 1771656820000
}
```

---

## 13. Summary & Roadmap for Empirical Validation

```
+-----------------------------------------------------------------------------------------+
|                                    VALIDATION ROADMAP                                   |
+------------------------------------+----------------------------------------------------+
| Phase                              | Core Deliverables & Milestones                     |
+------------------------------------+----------------------------------------------------+
| Phase 1: Synthetic Benchmark Suite | Automated unit & regression test harness in        |
|                                    | `mcfriV2Validator.js` verifying numerical bounds   |
|                                    | and edge conditions (0 rain, infinite rain, etc.)  |
+------------------------------------+----------------------------------------------------+
| Phase 2: Historical Inundation Fit | Parameter calibration using historical monsoon     |
|                                    | gauge telemetry (e.g. IMD / CWC Kerala & Bangalore |
|                                    | rainfall flood datasets).                          |
+------------------------------------+----------------------------------------------------+
| Phase 3: Spatial Sensor Ingestion  | Replace static zone constants with real-time DEM   |
|                                    | (SRTM 30m) and satellite radar soil moisture (SMAP)|
+------------------------------------+----------------------------------------------------+
```

*Document End — AI SafeRoute Engineering Team*
