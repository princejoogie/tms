---
"tms": patch
---

Improve picker startup without repository caching by rendering a loading UI before discovery, moving OpenTUI drawing helpers under `src/ui`, and centralizing binary builds in `scripts/build.ts`. Fix raw picker key parsing so `Ctrl-J` cycles down the list instead of selecting the current item.
