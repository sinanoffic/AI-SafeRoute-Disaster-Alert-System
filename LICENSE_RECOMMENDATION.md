# License Recommendation

This repository does not contain a root-level open-source LICENSE file, and `backend/package.json` is now explicitly marked `UNLICENSED`. The current v1.0.0 decision is to retain software and IP rights while still making the research-software record publicly viewable and citable. 

Given the project's association with a provisional patent filing, selecting the appropriate open-source license is critical if the decision changes in the future. Here is a high-level comparison of common licenses regarding patents. **This is not legal advice.**

## 1. Apache License 2.0
- **Patent Grant:** Contains an explicit, perpetual, worldwide, non-exclusive, no-charge, royalty-free, irrevocable patent license. If you hold a patent on this software, anyone using it under Apache 2.0 receives a license to those patent claims.
- **Retaliation Clause:** If a user sues you (or anyone else) for patent infringement regarding this software, their patent license granted by Apache 2.0 terminates.
- **Recommendation:** Generally considered the safest and most robust open-source license for software involving patents, provided you *want* to grant patent rights to users.

## 2. MIT / ISC License
- **Patent Grant:** Silent on patents. It grants rights to "deal in the Software without restriction," which some courts might interpret as an implied patent license, but it is ambiguous.
- **Recommendation:** Due to the ambiguity, it is often not recommended for software with active patent claims unless paired with a separate explicit patent grant.

## 3. GNU General Public License v3.0 (GPL-3.0)
- **Patent Grant:** Contains an explicit patent grant similar to Apache 2.0.
- **Copyleft:** It is a strong "copyleft" license, meaning anyone who distributes modified versions must also release their source code under GPL-3.0.
- **Recommendation:** Good if you want to force downstream users to share their improvements under the same open terms, but it can restrict commercial adoption.

## Current Status

**CURRENT DECISION:**
No open-source software license will be granted for MCFRI Legacy v1.0.0 at this stage. Repository copyright remains with Muhammed Sinan C.

**Reason:**
IP/patent position is still being preserved and clarified.

This decision may be revisited later after the project's intellectual-property position is clarified.
