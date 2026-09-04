# MCFRI Legacy v1.0 - Methodology

The methodology described here applies strictly to the **implemented legacy prototype** (MCFRI Legacy v1.0), which relies on deterministic arithmetic heuristics rather than data-driven empirical calibration.

## 1. Input Processing
The engine accepts environmental inputs such as Rainfall, Soil Moisture, Proximity to Water, Drainage Quality, and Elevation/Permeability. These are fed directly into the heuristic model.

## 2. Risk Calculation Heuristic
The overall raw score $S_{raw}(t)$ is calculated using a nonlinear combination of terms:
* **Rainfall-Moisture ($R(t)^\alpha \cdot e^{\beta M}$):** Evaluates rainfall accumulation scaled exponentially by soil moisture.
* **Water & Drainage ($P^\gamma \cdot D^{-\delta}$):** Measures proximity to water coupled with drainage deficit.
* **Topography ($E^\epsilon \cdot L$):** Factors in elevation against surface permeability.
* **Rainfall Surge ($\lambda \cdot \Delta R/\Delta t$):** A response to acute increases in rainfall rate.

This raw score is scaled down to a theoretical maximum to constrain outputs to a `[0, 200]` historical risk range.

## 3. Secondary Mitigation (Shelter Proximity)
Risk zones near predefined shelters receive an artificial heuristic reduction in their risk score. This is modeled using a linear distance decay within a defined cutoff radius (not an inverse-distance decay).

## 4. Spillover Mechanics
Instead of complex hydrodynamic routing, the engine implements a simple geometric spillover logic. A fraction of a zone's total source score is radiated to adjacent geographic zones based on distance (it transfers a fraction of the *entire* score, not just excess risk).

## 5. Future-Risk Projection
The system forecasts future risk using a simple linear projection of the current rainfall trend over the next 1-6 hours. It does not employ advanced hydrodynamic forecasting.

## 6. Adaptive Weight Heuristic
The system features a simple deterministic heuristic that alters the parameter weights ($W_r, W_p, W_e$) slightly based on recent trends in maximum risk scores over the last few simulation snapshots. This is a hardcoded arithmetic adjustment, and should not be confused with machine learning or actual AI model training.
