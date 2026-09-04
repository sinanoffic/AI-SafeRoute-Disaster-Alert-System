# System Architecture

The AI SafeRoute prototype relies on a decoupled frontend-backend model built over Node.js.

## Frontend (Client)
- **Framework:** Vanilla JavaScript, HTML5, CSS3 (Glassmorphism UI).
- **Core Engine (`riskEngine.js`):** Contains the core MCFRI Legacy v1.0 mathematical functions and adaptive state tracking.
- **Routing Engine (`routingEngine.js`):** Communicates with the external OSRM API, requesting road geometries, and evaluating them against the computed risk zones to find a risk-minimized path.
- **Mapping:** Leaflet.js rendering dynamic circular risk zones and polyline routes.
- **State Management (`stateManager.js`):** Coordinates data flow between sliders (simulated inputs), the engine, and the visual map.

## Backend (Server)
- **Environment:** Node.js + Express.
- **Database:** Prisma ORM with a local SQLite database (`dev.db`).
- **Endpoints:**
  - `GET /api/shelters` - Retrieves predefined emergency shelters.
  - `POST /api/risk` - Simple stateless risk controller (an older linear version of risk).
  - `POST /api/sos` - Receives and stores SOS alerts for triage sorting.

## Data Flow
1. User interacting with simulator sliders changes environmental state.
2. The `stateManager` triggers the `RiskEngine` to compute new zone scores.
3. Updated scores alter the Leaflet map display.
4. If a route is active, `RoutingEngine` fetches paths from OSRM, scores them against the new risk zones, and draws the lowest-cost path.
