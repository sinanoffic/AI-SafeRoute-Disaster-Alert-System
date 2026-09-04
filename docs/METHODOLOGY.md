# MCFRI Legacy v1.0 - Methodology

The methodology described here applies strictly to the **implemented legacy prototype** (MCFRI Legacy v1.0), which relies on deterministic arithmetic heuristics rather than data-driven empirical calibration.

## 1. Input Processing
The engine accepts environmental inputs such as Rainfall, Soil Moisture, Proximity to Water, Drainage Quality, and Elevation/Permeability. These are fed directly into the heuristic model.

## 2. Risk Calculation Heuristic
The overall raw score $S_{raw}(t)$ is calculated using a nonlinear combination of terms. The structure is:

$ S_{raw}(t) = [R(t)^\alpha \cdot e^{\beta M}] \cdot W_r + [P^\gamma \cdot D^{-\delta}] \cdot W_p - [E^\epsilon \cdot L] \cdot W_e + \lambda \cdot \Delta R_{event} $

Where:
* $S_{raw}$: The raw prototype risk score.
* $R$: Rainfall input.
* $M$: Soil Moisture input.
* $P$: Proximity to Water.
* $D$: Drainage Quality.
* $E$: Elevation Factor.
* $L$: Permeability.
* $W_r$, $W_p$, $W_e$: Heuristic weights for Rainfall, Proximity, and Elevation components.
* $\alpha, \beta, \gamma, \delta, \epsilon, \lambda$: Constant heuristic exponents and coefficients.
* $\Delta R_{event}$: The event-to-event rainfall difference.

> **Important implementation note:** While some historical project text described the last term using $\Delta R/\Delta t$ notation, the actual software logic receives an event-to-event rainfall change ($\Delta R_{event}$) directly from UI slider updates and does not measure true elapsed clock time.

This raw score is scaled down to a theoretical maximum to constrain outputs to a `[0, 200]` historical risk range.

## 3. Secondary Mitigation (Shelter Proximity)
Risk zones near predefined shelters receive an artificial heuristic reduction in their risk score. This is modeled using a linear distance decay within a defined cutoff radius (not an inverse-distance decay). The calculated protection bonus is subtracted from the score, followed by an unconditional $\times 0.8$ dampening factor.

## 4. Spillover Mechanics
Instead of complex hydrodynamic routing, the engine implements a simple geometric spillover logic. A fraction of a zone's total source score is radiated to adjacent geographic zones based on distance (it transfers a fraction of the *entire* score, not just excess risk).

## 5. Future-Risk Projection
The system projects future risk using the following exact deterministic prototype extrapolation heuristic:

```javascript
futureRiskScore = Math.max(0, Math.round(
    zone.riskScore 
    + (rainfall / 50) * timeHorizon 
    + (zone.proximityToWater * 2) * timeHorizon
))
```

This is a simple arithmetic projection and does not employ advanced hydrodynamic forecasting or empirical calibration.

## 6. Adaptive Weight Heuristic
The system features a simple deterministic heuristic where only the rainfall weight ($W_r$) and proximity weight ($W_p$) are modified. The engine compares the change in maximum modeled risk across recent simulation snapshots. When the trend exceeds hardcoded thresholds, those two weights are adjusted within fixed bounds. The elevation weight ($W_e$) remains fixed and is not adapted. This is a hardcoded arithmetic adjustment and should not be confused with machine learning or actual AI model training.
