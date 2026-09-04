# MCFRI Legacy v1.0 - AI SafeRoute

**Experimental flood-risk scoring and risk-aware evacuation-routing prototype.**

## Research status

> [!WARNING]
> **MCFRI Legacy v1.0 represents an experimental prototype and historical implementation.** It has not undergone the independent multi-catchment calibration and validation required for an operational flood forecasting model. Outputs should be interpreted as prototype risk indicators, not authoritative forecasts or emergency instructions.

## Overview

AI SafeRoute is an experimental disaster management platform. MCFRI Legacy v1.0 is the original prototype of the Multi-Catchment Flood Risk Index (MCFRI), engineered to compute a heuristic flood-risk score from environmental inputs. The system evaluates available road-route alternatives using a risk-weighted cost function to guide risk-aware evacuation routing. The backend orchestrates these features and serves them to a frontend dashboard.

This repository serves as a historical archive of the prototype software.

## System architecture

The application functions across several layers:

1. **Environmental/user inputs**: User locations, rainfall, soil moisture, and other parameters are fed into the system.
2. **Legacy risk engine**: Computes risk scores using a deterministic arithmetic heuristic.
3. **Risk zones**: The engine projects risk onto geographic zones.
4. **Road-route retrieval**: OSRM is used to retrieve potential road paths.
5. **Risk-weighted route evaluation**: Routes are scored based on their intersection with high-risk zones.
6. **Map visualization / shelter / SOS interface**: A frontend presents the risk map, shelter distances, and SOS coordination.

## Core prototype model

The frontend legacy risk engine computes a raw score $S_{raw}(t) based on the following nonlinear heuristic equation:

$ S_{raw}(t) = \Big[ R(t)^\alpha \cdot e^{\beta M} \Big] W_r + \Big[ P^\gamma \cdot D^{-\delta} \Big] W_p - \Big[ E^\epsilon \cdot L \Big] W_e + \lambda \left(\frac{\Delta R}{\Delta t}\right) $

Where:
* $R(t)$: Rainfall
* $M$: Soil Moisture
* $P$: Proximity to Water
* $D$: Drainage Quality
* $E$: Elevation Factor
* $L$: Permeability
* $\Delta R/\Delta t$: Rainfall Acceleration surge

**Implementation details:**
* **Scaling**: The raw score is scaled down using a theoretical maximum to constrain the output roughly to a [0, 200] historical risk range.
* **Shelter mitigation**: Zones near predefined shelters receive a heuristic risk reduction based on linear distance decay up to a cutoff radius.
* **Rounding/floor behavior**: The final score is floored to 0 and rounded to the nearest integer.
* **Thresholds**: Safe (<80), Warning (80-140), and Danger (>140) are developmental heuristics.
* **Spillover heuristics**: High-risk zones heuristically leak a fraction of their score to adjacent zones based on distance.
* **Future-risk heuristic**: A simple linear projection of the current rainfall trend to forecast future risk.
* **Dynamic radius**: Zone display radius scales geometrically with the risk score.
* **Adaptive weight behavior**: A simple deterministic heuristic alters weights ($W_r, W_p, W_e$) slightly based on recent trends in maximum risk scores.

## Routing logic

The routing logic relies on the public OSRM API to fetch valid road geometries between points. Instead of returning objectively the "safest route," the routing prototype evaluates available road-route alternatives using a risk-weighted cost function. 

Paths are penalized if they cross through Warning or Danger zones, and the system attempts to return the lowest-cost route among returned alternatives under the prototype risk function. The fallback behavior relies on Haversine distances when OSRM fails or restricts requests due to rate limits on the public API.

## Backend

The backend is built with Node.js, Express, and Prisma. It handles the coordination of shelters, simple risk computation endpoints, and SOS alerts. It is designed as a development prototype and is not intended for production readiness.

> [!NOTE]
> **Backend Model Difference:** The backend API (/api/risk) implements a separate, simplified linear prototype formula for risk calculation, while the frontend simulation uses the nonlinear prototype equation described above. The frontend historically does not depend on the backend's simplified formula for its main map simulation.

## Installation / local run

**Prerequisites:**
* Node.js (v18+)
* npm or yarn

**Backend Setup:**
1. Navigate to ackend/.
2. Copy the .env.example file to .env: cp .env.example .env`n3. Run 
pm install to install dependencies.
4. Initialize the Prisma database by running 
px prisma db push.
5. Start the backend server using 
pm run dev or 
pm start.
6. (Optional) Call the seed endpoint (POST /api/shelters/seed) to populate the local database if shelters are empty.

**Frontend Setup:**
1. Navigate to the root folder.
2. Serve the rontend/ directory using any local web server (e.g., 
px serve frontend or python -m http.server 3000 --directory frontend).
3. Open index.html in a web browser.

## Repository structure

* `frontend/`: The client-side dashboard, including the `riskEngine.js`, map interfaces, and visual simulation panels.
* `backend/`: The Node.js Express server, Prisma schema, and API controllers.
* `docs/`: Archival documentation, historical reports, and methodological outlines.

## Limitations

* **Legacy heuristic parameterization**: Parameters were selected theoretically, without rigorous data-fitting.
* **No independent scientific calibration**: Model weights and thresholds are not empirically validated.
* **No independent multi-catchment validation**: Spatial generalization is unknown.
* **Synthetic/hardcoded example zones**: Reference zones are predefined for demonstration.
* **Dependence on external routing service**: Public OSRM API is rate-limited and may fail.
* **Simplified future-risk projection**: Does not employ advanced hydrodynamic forecasting.
* **Simplified spillover behavior**: Radial distance-based spreading does not respect physical terrain contours.
* **Threshold assumptions**: Danger levels are provisional and not linked to specific real-world flood depths.
* **Non-operational emergency-use status**: Not intended for real-time disaster management.

## Safety statement

This software is a research and educational prototype. It must not be used as the sole basis for emergency evacuation, flood forecasting, disaster response, or life-safety decisions.

## Relationship to ongoing research

This repository preserves the original prototype implementation of AI SafeRoute and the MCFRI Legacy v1.0 engine. Later MCFRI scientific work, including rigorous calibration and spatial validation, is being conducted separately. Results from that later work are not represented here.

## Citation

If you use this software, please cite the archival software release. Refer to the `CITATION.cff` file in the repository root for citation details.

## Author

**Muhammed Sinan C**  
ORCID: [0009-0000-0667-3714](https://orcid.org/0009-0000-0667-3714)  
Brindavan College of Engineering  
B.E. Artificial Intelligence and Machine Learning

## License

Copyright © 2026 Muhammed Sinan C.

No open-source license is granted for this repository at this time.
The source code is publicly available for inspection, research reference,
and citation, but reuse, modification, redistribution, or commercial use
is not granted except where otherwise required by applicable platform
terms or with permission from the author.

A formal licensing decision may be revisited after the project's
intellectual-property position is clarified.




