# System Limitations

The AI SafeRoute / MCFRI Legacy v1.0 prototype possesses severe constraints that render it unsuitable for operational flood forecasting.

## 1. Lack of Empirical Validation
Parameters, exponents, and weights were established theoretically to satisfy mathematical bounds. They have not been fitted to real-world hydrologic data. The thresholds defining Safe, Warning, and Danger states are provisional heuristics.

## 2. No Hydrodynamic Modeling
The system calculates flood risk as a point-in-time arithmetic score based on environmental proxies. It does not solve Saint-Venant equations, model water surface elevation dynamically, or simulate physical fluid routing across a terrain mesh.

## 3. Simplified Routing & Distance Decay
Risk propagation (spillover) and shelter mitigation use simple Euclidean distance (Haversine) models rather than considering actual topographic divides, urban blockages, or true drainage networks.

## 4. OSRM Dependency
Risk-aware routing uses the public OSRM demonstration server, which is rate-limited, can experience downtime, and may return suboptimal routes or timeout when asked to generate numerous alternatives.

## 5. Prototype Backend
The backend utilizes SQLite for simple local development and does not possess the caching, concurrency handling, or security hardening required for a real-time emergency responder network.
