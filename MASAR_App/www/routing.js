/* MASAR router: the same cost model and route options as core/routing_engine.py, offline. */
(function () {
  const NET = window.MASAR_NET;
  const ALPHA = 2, BETA = 4, MAX_FACTOR = 20, MIN_SPEED_KPH = 3;
  const MODERATE_MAX = 0.8, LOW_MAX = 0.5, HEAVY_MAX = 1;
  const MAX_SNAP_M = 600;
  const out = NET.lat.map(() => []);
  NET.edges.forEach((e, i) => out[e[0]].push(i));
  const vmax = Math.max(...NET.edges.map((e) => e[3]), MIN_SPEED_KPH) / 3.6;

  function haversine(lat1, lng1, lat2, lng2) {
    const r = Math.PI / 180, R = 6371008.8;
    const a = Math.sin((lat2 - lat1) * r / 2) ** 2 +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lng2 - lng1) * r / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  const ratio = (i, preset) => (NET.traffic[preset][i] || 0) / Math.max(NET.capacity[i], 1);
  const freeTime = (i) => NET.edges[i][2] / (Math.max(NET.edges[i][3], MIN_SPEED_KPH) / 3.6);

  function trafficTime(i, preset) {
    const free = Math.max(NET.edges[i][3], MIN_SPEED_KPH);
    const factor = Math.min(1 + ALPHA * ratio(i, preset) ** BETA, MAX_FACTOR);
    return NET.edges[i][2] / (Math.max(free / factor, MIN_SPEED_KPH) / 3.6);
  }

  function band(r) {
    if (r < LOW_MAX) return 'low';
    if (r < MODERATE_MAX) return 'moderate';
    return r < HEAVY_MAX ? 'heavy' : 'very_heavy';
  }

  /* Road segments drivers reported closed or blocked: edge index -> cost factor (1 = normal). */
  let AVOID = new Map();
  const CLOSED_FACTOR = 50;
  const setAvoid = (m) => { AVOID = m || new Map(); };

  function search(from, to, baseWeight, heuristic) {
    const weight = AVOID.size ? (i) => baseWeight(i) * (AVOID.get(i) || 1) : baseWeight;
    const dist = new Float64Array(NET.lat.length).fill(Infinity);
    const via = new Int32Array(NET.lat.length).fill(-1);
    const done = new Uint8Array(NET.lat.length);
    const heap = [[0, from]];
    dist[from] = 0;
    while (heap.length) {
      const [, u] = heapPop(heap);
      if (done[u]) continue;
      if (u === to) break;
      done[u] = 1;
      for (const i of out[u]) {
        const v = NET.edges[i][1], d = dist[u] + weight(i);
        if (d < dist[v]) {
          dist[v] = d;
          via[v] = i;
          heapPush(heap, [d + (heuristic ? heuristic(v) : 0), v]);
        }
      }
    }
    if (from !== to && via[to] < 0) return null;
    const path = [];
    for (let n = to; n !== from; n = NET.edges[via[n]][0]) path.push(via[n]);
    return path.reverse();
  }

  function heapPush(h, item) {
    h.push(item);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) break;
      [h[p], h[i]] = [h[i], h[p]];
      i = p;
    }
  }

  function heapPop(h) {
    const top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m === i) break;
        [h[m], h[i]] = [h[i], h[m]];
        i = m;
      }
    }
    return top;
  }

  function evaluate(path, mode, preset) {
    let distance = 0, free = 0, time = 0, weighted = 0, blocked = 0;
    for (const i of path) {
      const len = NET.edges[i][2];
      if ((AVOID.get(i) || 1) >= CLOSED_FACTOR) blocked++; // only closures, not slow-downs like an accident
      distance += len;
      free += freeTime(i);
      time += trafficTime(i, preset);
      weighted += ratio(i, preset) * len;
    }
    return { mode, path, distance, free, time, delay: time - free, density: distance ? weighted / distance : 0, blocked };
  }

  function route(from, to, mode, preset) {
    let path;
    if (mode === 'distance') path = search(from, to, (i) => NET.edges[i][2]);
    else if (mode === 'fastest') path = search(from, to, freeTime);
    else {
      const h = (n) => haversine(NET.lat[n], NET.lng[n], NET.lat[to], NET.lng[to]) * 0.999 / vmax;
      path = search(from, to, (i) => trafficTime(i, preset), h);
    }
    return path && evaluate(path, mode, preset);
  }

  const samePath = (a, b) => a.path.length === b.path.length && a.path.every((e, i) => e === b.path[i]);

  function overlap(a, b) {
    if (!a.distance) return 1;
    const other = new Set(b.path);
    return a.path.reduce((s, e) => s + (other.has(e) ? NET.edges[e][2] : 0), 0) / a.distance;
  }

  /* Distinct real paths, best first. Every path is scored under the same traffic. */
  function options(from, to, preset, maxRoutes = 3) {
    const best = route(from, to, 'masar', preset);
    if (!best) return [];
    const found = [best];
    for (const mode of ['distance', 'fastest']) {
      const r = route(from, to, mode, preset);
      if (r && found.length < maxRoutes && !found.some((f) => samePath(f, r))) found.push(r);
    }
    const used = new Map();
    found.forEach((r) => r.path.forEach((e) => used.set(e, 1)));
    for (let attempt = 0; attempt < 6 && found.length < maxRoutes && best.path.length; attempt++) {
      const path = search(from, to, (i) => trafficTime(i, preset) * (1 + 0.6 * (used.get(i) || 0)));
      if (!path) break;
      const r = evaluate(path, 'alt', preset);
      path.forEach((e) => used.set(e, (used.get(e) || 0) + 1));
      if (found.some((f) => overlap(r, f) > 0.8)) continue;
      if (r.time <= 2 * Math.max(best.time, 1)) found.push(r);
    }
    /* A route through a reported closure only comes first when there is no other way. */
    return found.sort((a, b) => (a.blocked > 0) - (b.blocked > 0) || a.time - b.time);
  }

  /* Edges passing within `radius` metres of a point (a driver's report). */
  function edgesNear(lat, lng, radius = 35) {
    const hits = [], box = radius / 90000 + 0.004;
    NET.edges.forEach((e, i) => {
      if (Math.abs(NET.lat[e[0]] - lat) > box && Math.abs(NET.lat[e[1]] - lat) > box) return;
      if (Math.abs(NET.lng[e[0]] - lng) > box * 1.2 && Math.abs(NET.lng[e[1]] - lng) > box * 1.2) return;
      const pts = edgeLatLngs(i);
      for (let j = 0; j < pts.length - 1; j++) {
        if (nearestOnSegment(pts[j], pts[j + 1], lat, lng).dist <= radius) { hits.push(i); return; }
      }
    });
    return hits;
  }

  function nearestNode(lat, lng) {
    let best = -1, bestD = Infinity;
    const cos = Math.cos(lat * Math.PI / 180);
    for (let i = 0; i < NET.lat.length; i++) {
      if (!NET.snap[i]) continue;
      const a = NET.lat[i] - lat, b = (NET.lng[i] - lng) * cos, d = a * a + b * b;
      if (d < bestD) { bestD = d; best = i; }
    }
    return { node: best, meters: best < 0 ? Infinity : haversine(lat, lng, NET.lat[best], NET.lng[best]) };
  }

  function nearestStreet(lat, lng) {
    const { node } = nearestNode(lat, lng);
    const named = out[node].map((i) => NET.edges[i][4]).find((n) => n >= 0);
    return named === undefined ? -1 : named;
  }

  function edgeLatLngs(i) {
    const e = NET.edges[i];
    return [[NET.lat[e[0]], NET.lng[e[0]]], ...e[6], [NET.lat[e[1]], NET.lng[e[1]]]];
  }

  function bearing(a, b) {
    const r = Math.PI / 180, y = Math.sin((b[1] - a[1]) * r) * Math.cos(b[0] * r);
    const x = Math.cos(a[0] * r) * Math.sin(b[0] * r) -
      Math.sin(a[0] * r) * Math.cos(b[0] * r) * Math.cos((b[1] - a[1]) * r);
    return Math.atan2(y, x) / r;
  }

  function turnBetween(prev, next) {
    const p = edgeLatLngs(prev), n = edgeLatLngs(next);
    let d = bearing(n[0], n[1]) - bearing(p[p.length - 2], p[p.length - 1]);
    d = ((d + 540) % 360) - 180;
    const size = Math.abs(d);
    if (size < 35) return 'straight';
    if (size > 150) return 'uturn';
    return d > 0 ? (size < 60 ? 'slight_right' : 'right') : (size < 60 ? 'slight_left' : 'left');
  }

  /* Directions: a new step wherever the street changes or the road clearly turns. */
  function steps(path) {
    const list = [];
    path.forEach((e, idx) => {
      const name = NET.edges[e][4], len = NET.edges[e][2];
      const turn = idx ? turnBetween(path[idx - 1], e) : 'start';
      const last = list[list.length - 1];
      const clearTurn = turn !== 'straight' && turn !== 'slight_left' && turn !== 'slight_right';
      if (last && name === last.name && !clearTurn) last.distance += len;
      else if (last && turn === 'straight' && name < 0) last.distance += len;
      else list.push({ turn, name, distance: len, edge: idx });
    });
    return list;
  }

  /* A route as one line, measured in metres, for following it with GPS. */
  function buildTrack(path) {
    const pts = [], cum = [], list = steps(path), edgeStart = [];
    let total = 0;
    path.forEach((e) => {
      edgeStart.push(total);
      edgeLatLngs(e).forEach((p) => {
        if (pts.length) {
          const q = pts[pts.length - 1];
          if (q[0] === p[0] && q[1] === p[1]) return;
          total += haversine(q[0], q[1], p[0], p[1]);
        }
        pts.push(p);
        cum.push(total);
      });
    });
    list.forEach((s) => { s.start = edgeStart[s.edge]; });
    return { pts, cum, total, steps: list };
  }

  function nearestOnSegment(a, b, lat, lng) {
    const k = Math.cos(lat * Math.PI / 180) * 111320, m = 110540;
    const bx = (b[1] - a[1]) * k, by = (b[0] - a[0]) * m, px = (lng - a[1]) * k, py = (lat - a[0]) * m;
    const len2 = bx * bx + by * by;
    const u = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0;
    return { u, dist: Math.hypot(px - u * bx, py - u * by) };
  }

  function trackPoint(track, at) {
    let i = 0;
    while (i < track.pts.length - 2 && track.cum[i + 1] < at) i++;
    const a = track.pts[i], b = track.pts[i + 1] || a, span = (track.cum[i + 1] - track.cum[i]) || 1;
    const u = Math.max(0, Math.min(1, (at - track.cum[i]) / span));
    return { pos: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], bearing: bearing(a, b) };
  }

  /* Closest point of the track, optionally only between two distances along it. */
  function projectOnTrack(track, lat, lng, from = -Infinity, to = Infinity) {
    let best = { dist: Infinity, at: 0, pos: track.pts[0], bearing: 0 };
    for (let i = 0; i < track.pts.length - 1; i++) {
      if (track.cum[i + 1] < from || track.cum[i] > to) continue;
      const a = track.pts[i], b = track.pts[i + 1], s = nearestOnSegment(a, b, lat, lng);
      if (s.dist < best.dist) {
        best = {
          dist: s.dist, at: track.cum[i] + s.u * (track.cum[i + 1] - track.cum[i]),
          pos: [a[0] + (b[0] - a[0]) * s.u, a[1] + (b[1] - a[1]) * s.u], bearing: bearing(a, b),
        };
      }
    }
    return best;
  }

  /* The road segment the car is on: close by and, when moving, pointing the same way. */
  function nearestEdge(lat, lng, heading) {
    let best = -1, bestScore = Infinity;
    NET.edges.forEach((e, i) => {
      if (Math.abs(NET.lat[e[0]] - lat) > 0.02 || Math.abs(NET.lng[e[0]] - lng) > 0.02) return;
      const pts = edgeLatLngs(i);
      for (let j = 0; j < pts.length - 1; j++) {
        const d = nearestOnSegment(pts[j], pts[j + 1], lat, lng).dist;
        if (d > 60) continue;
        let score = d;
        if (heading !== null && heading !== undefined && !Number.isNaN(heading)) {
          const diff = Math.abs(((bearing(pts[j], pts[j + 1]) - heading + 540) % 360) - 180);
          score += diff > 90 ? 1000 : diff / 6;
        }
        if (score < bestScore) { bestScore = score; best = i; }
      }
    });
    return bestScore < 1000 ? best : -1;
  }

  /* New route from where the car really is, carrying on in its direction of travel. */
  function routeFromHere(lat, lng, heading, to, preset) {
    const edge = heading === null || heading === undefined ? -1 : nearestEdge(lat, lng, heading);
    if (edge >= 0) {
      const head = NET.edges[edge][1];
      if (head === to) return evaluate([edge], 'masar', preset);
      const rest = route(head, to, 'masar', preset);
      if (rest) return evaluate([edge, ...rest.path], 'masar', preset);
    }
    const near = nearestNode(lat, lng);
    return near.node === to ? null : route(near.node, to, 'masar', preset);
  }

  window.MasarRouter = {
    MAX_SNAP_M, band, ratio, route, options, nearestNode, nearestStreet, edgeLatLngs, steps, haversine,
    buildTrack, trackPoint, projectOnTrack, nearestEdge, routeFromHere, setAvoid, edgesNear,
  };
})();
