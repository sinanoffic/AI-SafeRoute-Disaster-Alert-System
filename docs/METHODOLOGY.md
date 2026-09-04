# MCFRI Legacy v1.0 - Methodology

The methodology described here applies strictly to the **implemented legacy prototype** (MCFRI Legacy v1.0), which relies on deterministic arithmetic heuristics rather than data-driven empirical calibration. 

## 1. Input Processing & Normalization
The engine accepts several inputs (Rainfall, Soil Moisture, Drainage Quality, Permeability, HAND). These raw inputs are mapped into a standardized `[0,1]` scale using simple Min-Max scaling or asymptotic functions (e.g., Michaelis-Menten formulation for rainfall accumulation) to bound their effects.

## 2. Component Equations
Four distinct sub-components are evaluated independently:
* **Rainfall-Moisture ($F_{RM}$):** A combined metric evaluating rain accumulation scaled exponentially by antecedent soil moisture.
* **Water & Drainage ($F_W$):** Measures proximity to water bodies coupled with drainage deficit.
* **Topography ($F_T$):** Factors in Height Above Nearest Drainage (HAND) against surface impermeability.
* **Rainfall Surge ($F_\Delta$):** A half-wave rectified response to acute increases in rainfall rate.

## 3. Heuristic Aggregation
The overall score $S(t)$ is derived by weighting the components, ensuring the final output remains within the `[0, 200]` range. Current weights are predefined theoretical defaults ($0.40, 0.25, 0.20, 0.15$).

## 4. Secondary Mitigation (Shelter Proximity)
Risk zones near predefined shelters receive an artificial heuristic reduction in their risk score, modeled via an inverse-distance decay function.

## 5. Spillover Mechanics
Instead of complex hydrodynamic routing, the engine implements a simple geometric spillover logic. If a zone exceeds the maximum threshold, a fraction of its excess risk is radiated to adjacent geographic zones within a strict radius.
