# MCFRI Legacy v1.0.0 — AI SafeRoute Archival Research-Software Release

This is the first formal archival release of the original **MCFRI Legacy** experimental flood-risk engine and the **AI SafeRoute** risk-aware road routing prototype.

## About This Release

This release establishes the canonical **v1.0.0** legacy identity for the prototype. It preserves the original arithmetic heuristic logic, mapping tools, shelter management, and SOS triage workflows exactly as they were developed, while restructuring documentation to meet professional research-software archival standards.

This release acts as the historical predecessor to the later, more rigorous MCFRI scientific research programme which is being conducted and validated independently.

## Disclaimer

> **This release does not constitute scientific validation of the MCFRI formulation and is not intended for operational emergency decision-making.** The parameters and models included are deterministic prototypes and have not been empirically fitted to real-world hydrological catchments.

## Key Changes in this Archival Release

* **Documentation Standardization:** Complete rewrite of the `README.md` to clarify the research status, prototype architecture, and system limitations.
* **Archival Preservation:** Moved legacy internal V2/V3/V4 demonstration reports to `docs/archive/` with appropriate historical disclaimers.
* **Citation Metadata:** Added a CFF 1.2.0 compliant `CITATION.cff` for Zenodo DOI indexing.
* **Reproducibility:** Cleaned up development artifacts (e.g., local SQLite databases, environment files) to ensure a clean clone experience for researchers.
* **Methodology Clarification:** Added `METHODOLOGY.md`, `LIMITATIONS.md`, and `ARCHITECTURE.md` to accurately describe the implemented logic without unsupported scientific claims.
