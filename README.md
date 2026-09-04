# MCFRI Legacy v1.0 — AI SafeRoute

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

The legacy risk engine calculates a score $S(t)$ based on a set of deterministic formulas:

$$S(t) = 200 \times \Big[ w_{RM} \cdot F_{RM} + w_W \cdot F_W + w_T \cdot F_T + w_\Delta \cdot F_\Delta \Big]$$

Where the components are:
* $F_{RM}$: Rainfall–Moisture coupling
* $F_W$: Water / Drainage deficit
* $F_T$: Topography / Land Surface exposure
* $F_\Delta$: Rainfall Acceleration surge

**Important heuristic components:**
* **Normalization**: Variables are normalized using min-max scaling and Michaelis-Menten functions.
* **Thresholds**: Safe (<80), Warning (80-140), and Danger (>140) thresholds are developmental heuristics.
* **Spillover heuristics**: High-risk zones heuristically leak a portion of their risk to adjacent zones based on distance.
* **Future-risk heuristic**: Simple linear projection of current rainfall changes to forecast 1-6 hours ahead.
* **Adaptive weight behavior**: Weights shift marginally based on recent trend data, as a deterministic heuristic.
* **Shelter-protection heuristic**: Proximity to a designated shelter reduces local risk scores.

## Routing logic

The routing logic relies on the public OSRM API to fetch valid road geometries between points. Instead of returning objectively the "safest route," the routing prototype evaluates available road-route alternatives using a risk-weighted cost function. 

Paths are penalized if they cross through Warning or Danger zones, and the system attempts to return the lowest-cost route among returned alternatives under the prototype risk function. The fallback behavior relies on Haversine distances when OSRM fails or restricts requests due to rate limits on the public API.

## Backend

The backend is built with Node.js, Express, and Prisma, handling the coordination of shelters, risk computation data flows, and SOS alerts. It is designed as a development prototype and is not intended for production readiness.

## Installation / local run

**Prerequisites:**
* Node.js (v18+)
* npm or yarn

**Backend Setup:**
1. Navigate to `backend/`.
2. Run `npm install` to install dependencies.
3. Ensure Prisma generates the local SQLite database schema by running `npx prisma db push`.
4. Start the server using `npm run dev` or `npm start`. The server will run on the port specified in `.env` (default 5000).

**Frontend Setup:**
1. Navigate to the root folder.
2. Serve the `frontend/` directory using any local web server (e.g., `npx serve frontend` or `python -m http.server 3000 --directory frontend`).
3. Open `index.html` in a web browser.

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

Pending finalization (see `LICENSE_RECOMMENDATION.md`).
