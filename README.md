# 639 CAOC — Virtual CAOC pages

Clickable prototype of the 639th virtual Combined Air Operations Center (CAOC) website for DCS World campaigns.
Static HTML/CSS/JS — no build step. Data is stored in the browser (localStorage) and logins are a
client-side demo gate only; a real deployment needs server-side auth and a shared database.

> **Earlier material is archived in [`OLD/`](OLD/)** — the original docs (charter, TTP 1-1, AOD, glossary…), the static
> tool snapshots, the JIPTL pipeline (Python) and scripts. Everything kept its history; only the paths changed,
> e.g. `tools/jiptl_pipeline/…` is now `OLD/tools/jiptl_pipeline/…`. See [Moved files](#moved-files) below.

## Run it

Serve the repo root with any static web server and open `login.html`, for example:

```
python -m http.server 8765
```

then browse to http://localhost:8765/login.html. (The theater map and target nomination pages load Leaflet and map tiles from the internet.)

## Pages

| Page | Who | What |
|---|---|---|
| `login.html` | CAOC staff | Staff sign-in |
| `index.html` | CAOC staff | Campaign dashboard: products, deliverables tracker (CFACC), requests, groups |
| `product.html?p=<id>` | CAOC staff | Product builder + live preview (CI, AOD, JIPTL, TDP, ATO, ACO, SPINS, Comm Plan, BDA) |
| `map.html` | CAOC staff | Theater map from the ACO: nav/spider/dest points, threats with DCS range rings, FLOT, FSCL, MRR, AR tracks, HVAA orbits, artillery ROZ |
| `targeting.html` | CAOC staff | Target nomination (from the JIPTL): REDFOR order of battle → JIPTL, ported from the JIPTL pipeline |
| `campaign-review.html` | CAOC staff (CFC decides) | Campaign proposal review queue |
| `unit-login.html` | Participating groups | Group sign-in |
| `unit.html` | Groups (staff can observe) | Op Status: product board, distribution matrix, ATO lines, group pack download; the JFACC group also sees its ATO line requests filling |
| `ato-request.html` | Campaign's Group JFACC / LNO | Request ATO lines from the group's `.miz` (player slots → Human, rest → AI) or a form; Human lines are posted on Discord for commitment |
| `campaign-submit.html` | Groups | Campaign proposal wizard (JFACC, intent, win/loss, REDFOR, schedule…) |

## Demo accounts (prototype only)

- Staff: ATLAS (CFC), OVERLORD (CFACC), SPARTAN, CHALICE, WIZARD, DARKSTAR — password `aoc-demo`
- Groups: viper, hornet, eagle, hawg, knights, tomcat, harrier, mistral, thunder, keepers, ridge, support — code `unit-demo`

## Roles

- **CFC** — manages the CAOC, decides on campaign proposals, can assist the CFACC.
- **CFACC** — makes sure every deliverable is built and approved; approves and publishes.
- **Group JFACC** — elected by the sponsoring group; manages the campaign and is the CAOC's single POC.

## Target nomination (JIPTL pipeline)

Browser port of `OLD/tools/jiptl_pipeline/jiptl_generate.py`:

1. **Key tasks & priorities** — the cycle config: Key Task weights and per-task caps, tier weights, default grades.
   Task 5 (CAS/TST) is continuous and never ranked.
2. **Area of interest** — a box (N/S/E/W bounds) or a point + radius, typed in or set by clicking the page's map.
   Defined on this page only; it is independent of the ACO and the theater map.
3. **REDFOR order of battle** — Coalition Parser CSV exports (`Group, Unit, Type, Latitude, Longitude, Altitude (ft)`;
   DMS or decimal). `samples/iron_trident_redfor.csv` is an example.
4. **Run** — classify each DCS type, group by DCS group, name the group after its doctrinally-critical unit
   (e.g. an SA-11 by its TELARs, an SA-6 by its 1S91 radar), keep groups inside the area of interest,
   score = task weight + tier weight, rank, cap per task, number `T10001…`.
5. **Review** — tabs for JIPTL / Watchlist (cut by caps) / Outside area / Unclassified types / Not targets;
   re-grade, re-order, cut or promote lines, then **Send to JIPTL** (the JIPTL returns to Draft for CFACC approval).

The built-in unit table covers ~130 common DCS types. Load the full
`OLD/tools/jiptl_pipeline/config/unit_classification.json` on the page to use the complete catalogue.
`.miz` intake still needs the Python `OLD/tools/jiptl_pipeline/miz_intake.py` (calibrated theater projection).

## ATO line requests (Discord commit)

1. The campaign's **Group JFACC / LNO** opens *ATO requests* in the unit portal and loads their group's `.miz`
   (read in the browser: BLUE flights, player slots → **Human**, others → **AI**) or fills in the request form
   (airframe, number of aircraft, mission, Human/AI, TOT, JIPTL target, package, commit-by, notes).
2. **AI** lines go straight onto the ATO for the sponsor to build in the `.miz`.
   **Human** lines get a mission number and are posted — via the existing Discord bot — to every registered group
   whose airframes include that type, with a **Commit** button.
3. The first unit to press **Commit** fills the line: it becomes the tasked unit on the ATO, joins the campaign, and the
   JFACC sees "Filled by …" on the request page and Op Status. Later commits are rejected.
4. The JFACC can cancel an open line or release a commitment (the line is re-posted).

The bot contract (event payloads, the `ato_commit:<line_id>` button and the commit endpoint) is in
[`docs/ATO_Discord_Integration.md`](docs/ATO_Discord_Integration.md). The prototype can't receive real Discord
commits, so the request page's *Discord post* preview has "Commit as …" buttons that run the same commit logic.
`samples/iron_trident_viper.miz` is a sample sponsor mission.

## Files

- `js/data.js` — seed data (fictional groups, campaigns, sample products, proposals, map)
- `js/app.js` — storage, auth gates, roles/permissions, shared chrome
- `js/products.js` — product schemas and document renderers (incl. comm matrix)
- `js/proposal.js` — campaign proposal questions and renderer
- `js/targeting.js` — JIPTL nomination pipeline, built-in DCS unit table, SAM kill doctrine
- `js/ato.js` — ATO line registry, `.miz` reader (zip + Lua table parser), Discord payloads, commit logic
- `samples/iron_trident_redfor.csv` — sample Coalition Parser export for the demo campaign
- `samples/iron_trident_viper.miz` — sample sponsor `.miz` for ATO line requests
- `docs/ATO_Discord_Integration.md` — contract for the Discord bot (post, commit, filled/cancelled)
- `css/styles.css` — three visual styles (Ops Floor, Night Vision, Staff Paper)

DKS (Digital Kneeboard Simulator) export buttons are placeholders until that integration is built.

## Moved files

Everything that was at the top of this repo before now lives one level down in `OLD/`:

| Was | Now |
|---|---|
| `README.md` | `OLD/README.md` |
| `docs/…` | `OLD/docs/…` |
| `scripts/…` | `OLD/scripts/…` |
| `tools/…` (incl. `tools/jiptl_pipeline/…`) | `OLD/tools/…` |

If anything links to a file by its old path (for example an integration reading
`tools/jiptl_pipeline/config/unit_classification.json`), update it to the `OLD/` path.
