# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Generated development database removed from release tree and ignored.
- Installation documentation corrected for reproducibility.
- Remaining prototype emergency wording qualified (SOS features clarified as demo-only).
- Archival naming standardized to MCFRI Legacy v1.0 / AI SafeRoute.
- Research status clarified in documentation to highlight prototype nature.
- Unsupported scientific and marketing claims (e.g., "100% accurate", "patent-worthy") removed or qualified.
- Legacy reports containing historical validation demonstrations moved to `docs/archive/` and prepended with archival disclaimers.

### Added
- `CITATION.cff` added for academic citation and Zenodo integration.
- Professional `README.md` containing clear architecture, limitations, and reproducible installation instructions.
- `docs/METHODOLOGY.md`, `docs/LIMITATIONS.md`, `docs/ARCHITECTURE.md`, and `docs/HISTORY.md` added.
- `LICENSE_RECOMMENDATION.md` and `RELEASE_CHECKLIST.md` added for archival preparation.

### Removed
- Generated development artifacts (`backend/dev.db`, `backend/.env`) removed from repository to ensure a clean clone environment.
