---
"tms": patch
---

Add fuzzy subsequence matching to picker filtering while preserving parent/child row context.

Improve picker error handling so async loader, render, resize, setup, and cleanup failures restore the terminal and surface the original error instead of exiting as a cancelled selection.
