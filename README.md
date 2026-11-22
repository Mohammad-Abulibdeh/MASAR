# MASAR Routing V1
**Intelligent Urban Transportation Management: dynamic routing engine and traffic simulation**

MASAR V1 loads the **real OpenStreetMap drivable road network of central Ramallah**. You control traffic on any road segment, and MASAR compares three routing strategies: shortest distance, free-flow fastest, and traffic-aware (MASAR). A simulated vehicle drives the chosen route on the real road graph and can re-route as traffic changes.

> **Data honesty.** The roads are real OSM data. The traffic is not: no live traffic feed is connected, and every vehicle count is a *simulated / user-defined input*. Every travel time and experiment result is a **model estimate**, not a real-world measurement.

---

## 1. Quick start (Windows)
1. Install **Python 3.10 or newer** from python.org and tick *"Add python.exe to PATH"*.
2. Double-click **`run.bat`**. On the first run it will:
   * create a virtual environment in `.venv\`
   * install the packages from `requirements.txt` (a few minutes)
   * start the dashboard and open http://localhost:8501
3. The first time an area is loaded, its OSM data is downloaded (internet needed, roughly 10–60 s). It is then cached in `data\cache\`, and that area works offline from then on.

Later runs skip installation and start in a few seconds.

**Run the tests:** `run_tests.bat` (or `.venv\Scripts\python -m pytest -v`).

Manual setup on any OS:
```bash
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
streamlit run app.py
```

## 2. Using MASAR
**العربية / English:** the button at the top right switches the whole app between Arabic (right to left) and English. The choice is kept in the address as `?lang=ar`, so it survives a refresh; bookmark `http://localhost:8501/?lang=ar` to open in Arabic. Street and landmark names come from OpenStreetMap as they are.

The **Play** screen walks through five steps. Press **Try the 30-second demo** to skip straight to step 4.

1. **Map** – choose an area and explore. Hover over a road to see its name; pink dots are landmarks from OpenStreetMap.
2. **Traffic** – apply a preset, paint roads by level, or click a road to set its vehicles, level or closure, for one segment or the whole street.
3. **A → B** – click the map, drag a pin, or search for a landmark or street.
4. **Route** – compare the options by time, distance, delay, density and efficiency, and read why one is recommended. **Jam this route** shows MASAR reacting.
5. **Drive** – one car per route races under the same traffic. **Start / Pause / Resume / Reset** and 1×–30× speed control it. Change any road, or close one ahead of your car, while it drives. The MASAR car re-plans; the others re-plan only when a closure blocks them.

Your setup is saved in the browser and comes back after a refresh. Clearing traffic or changing the map asks first, and **Undo** reverses traffic changes.

| Other screens | What you can do |
|---|---|
| **Traffic table** | Search streets in Arabic or English. Edit vehicles, capacity, free-flow speed or closure per segment, set a whole street at once, generate a seeded scenario, reset, and save/load scenarios (`data/scenarios/`). |
| **Many drivers** | Adds up to 10,000 simulated drivers to the current traffic and tests 0–100 % MASAR users on the same seeded trips, with shared advice or advice that sees other drivers. Shows the average trip, congested roads and busiest streets, says plainly when there is no gain, and can put a result on the Play map (Undo brings the old traffic back). |
| **Experiment** | Runs three vehicles (A: distance, B: free-flow fastest, C: MASAR with re-routing) under identical traffic, with optional seeded fluctuation and a scripted incident. The verdict states plainly when MASAR does *not* help. |
| **Model & data** | The cost formula, what each trip number means, data provenance and network statistics. |

The collapsed sidebar (top-left arrow) holds advanced settings: custom map area, re-download, cost model, capacity model and re-routing policy.

Map colours by share of capacity: green < 50 %, yellow 50–80 %, orange 80–100 %, red ≥ 100 %, dashed white = closed. White dots are moving vehicles, and the dashboard shows how many vehicles one dot stands for.

### What the trip numbers mean
* **Delay** – estimated time minus the time on empty roads.
* **Traffic density** – vehicles ÷ capacity, averaged along the route by length.
* **Efficiency** – time on empty roads ÷ estimated time. 100 % means traffic adds no delay.
* **Saved** – estimated time compared with the slowest route offered.

## 3. How the routing algorithm chooses the best route
Each **directed** segment (a one-way street exists in one direction only) gets a cost in seconds:

```
congestion_ratio  = vehicles / max(capacity, 1)                 # never divides by zero
congestion_factor = min(1 + α · ratio^β, max_factor)            # defaults α=2, β=4, max=20
free_flow_time    = length / free_flow_speed
edge_cost         = free_flow_time × congestion_factor          # speed floor 3 km/h
```

The factor has the shape of the BPR volume-delay curve. An empty road costs exactly its free-flow time. A road at 75 % load is about 1.6× slower, at 100 % about 3×, and at 120 % about 5×.

| Strategy | Algorithm | Weight |
|---|---|---|
| Distance Route | Dijkstra | length (m) |
| Fastest Route | Dijkstra | free-flow time (ignores vehicles) |
| **MASAR Route** | **A\*** (admissible straight-line / max-speed heuristic, so the result is exactly optimal) | congestion-aware `edge_cost` |

All three routes are then **scored under the same current traffic**, and MASAR recommends the one with the lowest estimated travel time. That can be a *longer* road. For example, a 1.0 km street that is 120 % full takes about 221 s, while an empty 1.4 km parallel road takes about 101 s, so MASAR takes the longer road. This is tested in `tests/test_routing.py::test_masar_picks_longer_route_when_shortest_is_congested`.

**Capacity** (vehicles a segment holds before it counts as fully congested) is estimated as `lanes × length / 20 m`. You can change it per segment, or change the 20 m in the sidebar. **Free-flow speed** comes from the OSM `maxspeed` tag. Where that tag is missing, a default for the road type is used (e.g. primary 50, residential 25 km/h). The UI labels each value's source.

### Dynamic re-routing
The MASAR vehicle re-checks its route **when traffic inputs change** and **every N simulated seconds**:
* It is committed to the segment it is on: it never teleports and never U-turns mid-block, so the search starts from the end of the current segment.
* It switches only if the new plan saves at least `max(min_improvement_s, min_improvement_% × remaining time)` (defaults 10 s / 10 %). This prevents flip-flopping over trivial gains.
* Any vehicle is forced to re-plan if a segment ahead becomes **closed**.

### Many drivers
All the drivers are on the road at once. Each trip adds to a segment the share of its free-flow time spent there, so one driver is one vehicle in total. A sample of 200 trips stands for all the drivers.
* **Habit drivers** take the free-flow fastest path and ignore traffic.
* **Same advice:** every MASAR user is routed on the traffic from before this wave, so they can all pile onto the same road.
* **Advice that sees other drivers:** users are routed one after another, and each sees those already assigned.

Everyone is then scored under the final traffic. This is a static assignment: nobody re-routes during the trip. In the current model the advice that sees other drivers assumes MASAR knows where everyone is going, which is the best case rather than a prediction.

## 4. Project structure
```
MASAR/
├── app.py                    Streamlit entry point
├── core/i18n.py              Arabic text for the server side (ui/masar_map/i18n.js for the map screen)
├── core/                     no UI code; reusable by future modules
│   ├── map_loader.py         OSMnx download, local cache, offline fallback
│   ├── graph_manager.py      RoadNetwork (directed graph, names ar/en, speeds, geometry, search)
│   ├── traffic_manager.py    per-segment vehicles/capacity/speed/closure + provenance, scenarios
│   ├── cost_function.py      transparent, configurable edge cost
│   ├── routing_engine.py     distance / fastest / MASAR routing, alternatives, evaluation
│   ├── estimation.py         trip estimates and the plain-language explanation
│   ├── places.py             named landmarks from OSM, cached, downloaded in the background
│   ├── vehicle_simulator.py  movement along edges, re-routing policy
│   ├── experiment.py         A/B/C comparison under identical conditions
│   └── many_drivers.py       city-wide effect of a share of drivers using MASAR
├── ui/
│   ├── dashboard.py          Streamlit page, navigation, sidebar, advanced screens
│   ├── play_controller.py    rules of the Play screen, no Streamlit code, tested directly
│   ├── masar_map/            browser component: Leaflet (vendored), step panel, animation
│   └── traffic_controls.py, statistics.py
├── data/cache/               cached OSM networks (.json processed, .graphml raw) and landmarks
├── data/scenarios/           saved traffic scenarios
├── tests/                    pytest suite (synthetic graphs for deterministic logic tests)
├── requirements.txt  run.bat  run_tests.bat  README.md
```

## 5. Tests
`pytest` covers: shortest-path correctness (checked against brute force), A* = Dijkstra under random traffic, traffic-aware selection of a longer route (the deterministic congested scenario), the exact break-even point, one-way handling in both directions, unreachable or unknown destinations, invalid vehicle counts, zero-capacity roads, cost calculation, closures, re-routing (position preserved, only the remainder replaced, hysteresis, disabling), forced re-plan on closure, movement only along connected segments with no jumps, trip time matching the estimate, experiment fairness and determinism, an honest "no advantage" verdict, OSMnx conversion (Arabic/English names, parallel edges, mph, one-way), cache round-trip, and graceful failure when offline or when OSMnx is missing.

The tests use small **synthetic graphs** so the expected answers can be worked out by hand. They are not presented as Ramallah roads.

## 6. Limitations (V1)
* **No real traffic data.** All counts are simulated or user-defined, and all results are estimates of this model.
* The model is static and per segment. Vehicle counts do not propagate between segments, and the simulated vehicle does not add to traffic. There is no queue spill-back, and there are no turn penalties or signal delays (adaptive signals are a future module).
* Parallel OSM edges between the same two intersections are collapsed to the shortest one. Turn restrictions (OSM `restriction` relations) are not modelled.
* Default speeds, lanes and the capacity rule are assumptions. Missing OSM tags are common in Ramallah.
* OSM street-name coverage varies. Unnamed segments are labelled by road type.
* Background map images come from OpenStreetMap's public tile server and need internet. Roads, routing and the simulation still work without them.
* Cars are animated in the browser and report to the server about every 2.5 s, so at high speed a car may wait briefly at a closure for its new plan. The waiting time counts in its result. Leaving the Play screen or refreshing ends a running drive; the setup is kept.
* Saved setups live in that browser's storage, so they do not follow you to another browser.
* Live traffic swings during a drive only vary roads that already have vehicles, and they stop when the drive ends. They are random simulation, not forecasts.
* The **Ramallah villages** map covers the whole governorate (about 27,000 road segments). It works on the Play screen but is slower to open. OpenStreetMap does not record checkpoints or closed gates, so routes may use roads that are not open in reality.
* Online place search and first-time downloads need internet. Everything else works offline once an area is cached.

## 7. Future modules (not implemented)
Smart parking, adaptive traffic signals, ML demand prediction, and ESP32 + LED-strip physical simulation. `core/` has no UI dependencies, so these can import `RoadNetwork`, `TrafficManager` and `RoutingEngine` directly.

---
Map data © OpenStreetMap contributors, available under the ODbL.
