# 639 CAOC — DCS AOC Cooperative

Documentation and web tools for the 639th Combined Air Operations Center (CAOC): a coordination layer that lets independent DCS groups plan, resource, and fly campaigns together without folding into a single organization.

## Docs (`/docs`)

| File | What it is |
|---|---|
| `Combined_AOC_Charter_v0.7.md` | The charter — command structure, governing principles, the Buy/Pass requirements process, and all annexes |
| `639CAOC_TTP-1-1_Thinking_Like_a_CFACC.md` | The CFACC's working TTP — the Combined AOD, ALR/ROE, the three-question targeting test, and forms |
| `639CAOC_Combined_Campaign_Intent.md` | A filled-out example Combined Campaign Intent |
| `639CAOC_Combined_Campaign_Intent_Template.md` | The blank one-page Intent template |
| `639CAOC_Campaign_Cycle_and_Combined_AOD.md` | The end-to-end campaign cycle, Stage A/B, and a worked Combined AOD example |
| `639CAOC_Glossary_of_Acronyms.md` | Every acronym used across the document set |

## Tools (`/tools`)

These are static HTML snapshots of the live, interactive web tools. Each one is self-contained (open the `.html` file directly in a browser) but the **live, shared versions** — with persistent data, multi-user sync, and ongoing edits — are hosted as Claude artifacts:

| Tool | Live version |
|---|---|
| The 639 CAOC Process (flow diagram + stage reference) | https://claude.ai/artifact/1EFXxDWjbTGFBPqhhCcqFi |
| Comm Grid Builder (theater comm plan) | https://claude.ai/artifact/4uNTmEoYTEWjrkT9wAzFKb |
| AOD Builder | https://claude.ai/artifact/SqhPRCX7kEFhj2X3qSeSaw |
| Package Plan Builder (MAAP) | https://claude.ai/artifact/8Fr8aCnTGiseYWf8WZw6DE |
| Intent Builder | https://claude.ai/artifact/T1McQ5z9AJwnMirFHMeWUo |

If you're integrating these into a site, the HTML files in `/tools` are a good starting point for layout and styling — but swap in your own data backend if you need live, shared state, since the copies here don't connect to the Claude-hosted database the live versions use.

## Process overview

Nine stages, one feedback loop: **Combined Campaign Intent → Combined AOD → JIPTL → Package Plan (MAAP) → ACO + Theater Comm Plan → ATO → Mission Planning and Execution → BDA / Debrief**, looping back into the next AOD (and occasionally revising the Intent itself). See `639CAOC_Campaign_Cycle_and_Combined_AOD.md` and the process page in `/tools` for the full walkthrough.
