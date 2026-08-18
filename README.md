# SmartFlow — Nagpur Traffic Command

**Team Coders 2.0 · Vikasit Nagpur Hackathon 2026 · Track: Web Dev**

> **Problem statement.** Peak-hour traffic is distributed unevenly across the jurisdictions of
> Nagpur's planning authorities.
>
> **Expected solution.** A simulation that supports traffic management during the peak windows
> 09:00–12:00 and 16:00–19:00.

SmartFlow measures that imbalance across 20 real Nagpur corridors, lets an authority simulate a
management strategy against a calibrated traffic model, ranks the interventions worth funding, and
issues a citable report — all before a single barricade is moved.

---

## Quick start

Requires **Node 18+** and a **MongoDB** instance on `mongodb://127.0.0.1:27017`.

```bash
npm run setup     # installs both workspaces and seeds the Nagpur network + demo users
npm run dev       # API on :5050, web app on :5173
```

Open **http://localhost:5173** and sign in with one of the demo accounts (all use the password
`smartflow`; the login screen has one-click buttons for each):

| Role | Email | Can do |
|---|---|---|
| Traffic Commissioner | `commissioner@nagpur.gov.in` | Everything, including committing a plan |
| Executive Engineer | `engineer@nmc.gov.in` | Simulate and apply strategies |
| Transport Analyst | `analyst@nmrda.gov.in` | Read and model only — cannot commit |

If MongoDB is not on the default URI, edit `server/.env`.
Re-seed from scratch at any time with `npm --workspace server run seed -- --reset`.

With the app running, `npm run verify` walks the entire six-step flow against the live API and
asserts the model behaves correctly — 65 checks covering auth, role enforcement, vehicle
conservation under diversion, strategy eligibility, recommendation quality and report generation.

---

## The 6-step flow (this is the demo)

The sidebar is numbered to match the implementation plan from the pitch deck.

**1 · Dashboard** — live KPIs across 20 corridors, the 24-hour congestion profile with both peak
windows shaded, and the jurisdiction load-balance panel. Opens on the morning peak automatically
when you're outside a peak window, so the network always looks like what the tool is for.

**2 · Live Map** — real Nagpur streets (Leaflet + OpenStreetMap). Corridors are coloured by
saturation. Drag the hour slider to watch the peak build; click a corridor for its saturation
curve, landmarks and the parallel routes it could divert onto.

**3 · Simulation Studio** — pick from eight fundable interventions, choose the corridors each
applies to (ineligible ones are dimmed using the same rule the engine enforces), and set the
deployment intensity.

**4 · Run** — the paired simulation solves in a few milliseconds, then plays the window back at
15-minute resolution: the timeline advances, KPIs tick, and animated flow lanes show baseline
traffic next to strategy traffic at the design hour.

**5 · Results & AI** — before/after across every corridor, the investment case with payback, and
ranked recommendations. Each recommendation was produced by *actually simulating* that
intervention, so every number quoted in its rationale is a model output.

**6 · Report** — save the scenario, commit it, and generate an ink-on-paper report with a
reference number, QR verification code, methodology note and signature block. Print or export to
PDF.

---

## How the model works

This is a real transport model, not a random-number generator.

**Link performance** uses the Bureau of Public Roads volume-delay function — the standard used in
production transport planning:

```
t = t₀ · (1 + 0.15 · (v/c)⁴)
```

plus a saturation-dependent signal delay term for the intersections along each corridor. Heavy
vehicles are converted at **3.0 PCU** (IRC:106), so a corridor with 28% trucks is charged the road
space it actually consumes. Everything downstream — speed, delay, queue length, CO₂, fuel, economic
loss — derives from that single evaluation, so a strategy that changes volume or capacity
propagates consistently through the whole KPI set.

**Level of Service** bands follow HCM thresholds on v/c. **Congestion index** is measured against a
reference travel time that includes the unavoidable share of signal delay, not against a physically
impossible free-flow ideal.

**The eight strategies** each transform the model inputs and carry a capital cost and a deployment
lead time:

| Strategy | Effect | Lead time |
|---|---|---|
| Adaptive Signal Control | −38% signal delay, +6% capacity | 21 d |
| Dynamic Corridor Diversion | Moves demand to parallel routes | 7 d |
| Reversible (Tidal) Lane | +30% directional capacity | 30 d |
| Staggered Office & School Hours | −17% peak demand | 45 d |
| Bus Priority & Headway Boost | Mode shift off the corridor | 60 d |
| Heavy Vehicle Peak Restriction | −72% heavy-vehicle share | 14 d |
| Junction Geometry Upgrade | +16% capacity, −22% signal delay | 120 d |
| One-Way Pairing | +36% capacity, loads the paired street | 20 d |

Diversion and one-way pairing **conserve vehicles**: traffic removed from a corridor is
redistributed onto its alternates in proportion to their spare capacity. If the alternates are
already full, the model shows them getting worse — which is the honest outcome, and the reason the
UI reports spillover.

**The recommendation engine** works the way a consultant does, in four stages:

1. **Diagnose** — classify why each congested corridor is failing (signal-bound, capacity-bound,
   heavy-vehicle-bound, sharply peaked, divertible).
2. **Sweep** — for every diagnosis, run the strategies that treat it through the full network
   simulation. Nothing is looked up in a table.
3. **Rank** — score on delay reduction, local relief, cost-effectiveness, deployment speed,
   diagnosis fit and spillover.
4. **Explain** — write the rationale from the evidence that produced the score.

**Jurisdiction balance** — the direct answer to the problem statement — measures vehicle-km carried
per lane-km of road each authority owns, and reports the worst-to-best ratio plus a Gini
coefficient. On the seeded network NMC carries roughly **1.9× the per-lane load of NIT** during the
morning peak, which is what drives the cross-jurisdiction diversion advisory.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, React Router |
| Map | Leaflet + react-leaflet, OpenStreetMap via CARTO dark tiles |
| Charts | Recharts |
| Backend | Node.js, Express |
| Database | MongoDB + Mongoose |
| Auth | JWT with bcrypt, three-tier role model |
| Reporting | html2pdf.js, qrcode.react |

---

## Project layout

```
smartflow/
├── server/
│   └── src/
│       ├── data/nagpurNetwork.js    20 Nagpur corridors: geometry, capacity, jurisdiction
│       ├── engine/
│       │   ├── trafficModel.js      BPR link performance, LOS, emissions, jurisdiction balance
│       │   ├── strategies.js        the eight interventions + vehicle-conserving reassignment
│       │   ├── simulator.js         paired baseline/treatment runs over a peak window
│       │   └── recommender.js       diagnose → sweep → rank → explain
│       ├── models/                  User, Corridor, Simulation, Report
│       ├── routes/                  auth, network, simulations, reports
│       └── seed.js
└── client/
    └── src/
        ├── pages/                   Login, Dashboard, MapView, SimulationStudio, Results, Reports
        ├── components/              app shell, UI primitives, animated FlowLane
        └── lib/                     api client, auth + scenario context, theme, formatting
```

## API

All routes except `/api/health` and `/api/auth/*` require a bearer token.

```
POST /api/auth/login                  GET  /api/network/meta
GET  /api/auth/me                     GET  /api/network/corridors
                                      GET  /api/network/corridors/:code
POST /api/simulations/run             GET  /api/network/state?hour=&live=
GET  /api/simulations/recommendations GET  /api/network/profile
POST /api/simulations                 POST /api/reports
POST /api/simulations/:id/apply       GET  /api/reports/:id
```

---

## Data provenance

Corridor geometry is traced along the real Nagpur alignments (Wardha Road, Central Avenue,
Sitabuldi, Kamptee Road, Amravati Road, the Inner Ring Road and others) and each is attributed to
the authority that owns it — NMC, NIT, NMRDA, State PWD/MSRDC or NHAI.

Traffic volumes are **synthetic but calibrated**: capacities follow IRC:106 guidance per road class,
and demand is set so that saturation at the design hour matches the pattern Nagpur actually
exhibits — dense inner-city corridors failing first while the ring roads hold spare capacity. They
are model inputs, not measured counts, and the generated report says so. Replacing them with real
detector or Google Maps data means changing one field per corridor in
`server/src/data/nagpurNetwork.js`; nothing else in the system has to move.
