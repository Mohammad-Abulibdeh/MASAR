/* MASAR map screen. The server owns traffic and routing; this file draws them and animates vehicles. */
'use strict';

const BANDS = ['low', 'moderate', 'heavy', 'very_heavy'];
const BAND = {
  low: {label: 'Low', color: '#19e68c', range: 'under 50%', load: .25},
  moderate: {label: 'Moderate', color: '#ffe11a', range: '50–80%', load: .65},
  heavy: {label: 'Heavy', color: '#ff8a1f', range: '80–100%', load: .9},
  very_heavy: {label: 'Very heavy', color: '#ff2d55', range: '100%+', load: 1.2},
};
const ROUTE_COLORS = ['#27d7ff', '#c77dff', '#ff5fd2', '#fff4d9'];
const STEPS = ['Map', 'Traffic', 'A → B', 'Route', 'Drive'];
const SPEEDS = [1, 5, 10, 30];
/* One free OpenStreetMap tile source, restyled in CSS. CARTO's dark and light tiles now need an API key. */
const TILES = {Disco: 'tiles-disco', Streets: '', Retro: 'tiles-retro'};
const STORE_KEY = 'masar.setup.v2';
const TICK_MS = 2500;
const REDUCED = matchMedia('(prefers-reduced-motion:reduce)').matches;
const ROUTE_FIT = {paddingTopLeft: [50, 60], paddingBottomRight: [50, 100], maxZoom: 16.5};  // room for the drive controls

const $ = id => document.getElementById(id);
function tx(text, values) {
  let out = S.lang === 'ar' ? (ARABIC[text] ?? text) : text;
  for (const k in values || {}) out = out.split(`{${k}}`).join(values[k]);
  return out;
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const icon = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const bandOf = r => r < .5 ? 'low' : r < .8 ? 'moderate' : r < 1 ? 'heavy' : 'very_heavy';
const fmtTime = s => { s = Math.max(0, Math.round(s)); if (s < 60) return tx('{s} s', {s}); const m = Math.floor(s / 60), r = s % 60; return r ? tx('{m} min {s} s', {m, s: r}) : tx('{m} min', {m}); };
const fmtClock = s => { s = Math.max(0, Math.floor(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const fmtKm = m => m < 1000 ? tx('{n} m', {n: Math.round(m)}) : tx('{n} km', {n: (m / 1000).toFixed(2)});

/* ------------------------------------------------------------ app state */
const S = {
  lang: 'en', view: null, step: 1, pinTarget: 'a', baseMap: 'Disco', speed: 10, brush: null,
  selection: null,            // {edges:[…], name, scope, link}
  scopeWhole: false, hoverLink: null, search: '', searchOnline: '',
  edges: [], links: [], streets: new Map(), trafficRev: -1, routesRev: -1, areaKey: null,
  veh: [], cap: [], mps: [], closed: new Set(),
  race: null, lastProposal: 0, lastNotice: 0, restored: false,
};

/* ------------------------------------------------- Streamlit component link */
const cid = Math.random().toString(36).slice(2);
let seq = 0, queue = [], flushTimer = null, lastSent = 0;
function post(type, data) { window.parent.postMessage({isStreamlitMessage: true, type, ...data}, '*'); }
function send(type, data = {}) {
  queue.push({seq: ++seq, type, ...data});
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flush, 25);
}
function flush() {
  if (!queue.length) return;
  lastSent = performance.now();
  post('streamlit:setComponentValue', {value: {cid, events: queue, n: seq}, dataType: 'json'});
}
setInterval(() => { if (queue.length && performance.now() - lastSent > 2000) flush(); }, 1000);

function resizeFrame() {
  let h = 680;
  const narrow = matchMedia('(max-width:920px)').matches;
  if (narrow) {
    h = $('app').scrollHeight + 4;
  } else {
    try {
      const frame = window.frameElement;
      const top = frame.getBoundingClientRect().top + (window.parent.scrollY || 0);
      h = Math.max(620, window.parent.innerHeight - top - 10);
    } catch (e) { /* cross-origin host: keep the default height */ }
  }
  if (h !== S.frameH) { S.frameH = h; post('streamlit:setFrameHeight', {height: h}); }
}
window.addEventListener('resize', resizeFrame);
try { window.parent.addEventListener('resize', resizeFrame); } catch (e) { /* see above */ }

window.addEventListener('message', ev => {
  if (ev.data && ev.data.type === 'streamlit:render') onRender(ev.data.args.view);
});
post('streamlit:componentReady', {apiVersion: 1});

/* ---------------------------------------------------------------- map */
const map = L.map('map', {zoomControl: true, preferCanvas: true, attributionControl: true, zoomSnap: .25, minZoom: 10, maxZoom: 19});
map.zoomControl.setPosition('bottomright');
const roadRenderer = L.canvas({padding: .3, tolerance: 7});
let tileLayer = null;
function setLanguage(lang) {
  lang = lang === 'ar' ? 'ar' : 'en';
  if (lang === S.lang) return;
  S.lang = lang;
  document.documentElement.lang = lang;
  document.body.classList.toggle('ar', lang === 'ar');
  $('loading').textContent = tx('Loading road network…');
  renderMapStyle();
  closeRoadCard();
}
function setBaseMap(name) {
  S.baseMap = name;
  $('map').classList.remove('tiles-disco', 'tiles-retro');
  if (TILES[name]) $('map').classList.add(TILES[name]);
  renderMapStyle();
}
tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '&copy; OpenStreetMap contributors', maxZoom: 19}).addTo(map);
tileLayer.on('tileerror', () => {
  if (!S.tileWarned) { S.tileWarned = true; toast({text: tx('Background map images could not load. Roads and routing still work.'), kind: 'warn'}); }
});
['dragstart', 'dblclick'].forEach(ev => map.on(ev, () => { S.userMoved = true; }));
map.getContainer().addEventListener('wheel', () => { S.userMoved = true; }, {passive: true});
/* The frame starts small and grows, so re-fit the map until the user has moved it themselves. */
new ResizeObserver(() => {
  map.invalidateSize({animate: false});
  if (S.bounds && !S.userMoved) map.fitBounds(S.bounds, {...(S.routeFit ? ROUTE_FIT : {padding: [20, 20]}), animate: false});
}).observe($('mapwrap'));
map.createPane('placesPane').style.zIndex = 470;
const pinLayer = L.layerGroup().addTo(map);
const placeLayer = L.layerGroup().addTo(map);
const roadTip = L.tooltip({className: 'road-tip', sticky: true, direction: 'top', offset: [0, -8]});

map.on('click', e => {
  if (S.step === 3 && !isLive()) placePin(e.latlng);
  else closeRoadCard();
});

/* Mercator world coordinates (0..1), so animating thousands of dots needs no Leaflet calls. */
function world(lat, lng) {
  const s = Math.sin(lat * Math.PI / 180);
  return [(lng + 180) / 360, .5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)];
}

function buildRoads(roads) {
  S.areaKey = roads.key;
  S.links.forEach(l => l.line.remove());
  S.edges = roads.edges.map(e => {
    const pts = [], latlng = [];
    for (let i = 0; i < e.c.length; i += 2) { pts.push(world(e.c[i], e.c[i + 1])); latlng.push([e.c[i], e.c[i + 1]]); }
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return {pts, latlng, cum, len: e.l, name: e.n, street: e.s, major: !!e.m, twin: e.t, kind: e.h, link: -1};
  });
  S.links = [];
  S.streets = new Map();
  S.edges.forEach((e, i) => {
    if (e.link < 0) {
      const edges = e.twin >= 0 ? [i, e.twin] : [i];
      const link = {id: S.links.length, edges, name: e.name, street: e.street, major: e.major, kind: e.kind, style: ''};
      edges.forEach(x => { S.edges[x].link = link.id; });
      link.line = L.polyline(e.latlng, {renderer: roadRenderer, weight: e.major ? 5 : 3, color: BAND.low.color, opacity: .4, lineCap: 'round'}).addTo(map);
      link.line.on('click', ev => { L.DomEvent.stop(ev); onRoadClick(link, ev.latlng); });
      link.line.on('mouseover', ev => onRoadHover(link, ev.latlng));
      link.line.on('mousemove', ev => roadTip.setLatLng(ev.latlng));
      link.line.on('mouseout', () => { S.hoverLink = null; roadTip.remove(); });
      S.links.push(link);
    }
    if (e.street) {
      if (!S.streets.has(e.street)) S.streets.set(e.street, []);
      S.streets.get(e.street).push(i);
    }
  });
  S.bounds = roads.bounds;
  S.userMoved = S.routeFit = false;
  map.invalidateSize({animate: false});
  map.fitBounds(roads.bounds, {padding: [20, 20], animate: false});
  $('loading').hidden = true;
  send('roads_ok', {key: roads.key});
}

function linkRatio(link) {
  return Math.max(...link.edges.map(e => S.veh[e] / Math.max(S.cap[e], 1)));
}
function roadName(link) { return link.name || (S.lang === 'ar' ? tx('Unnamed road') : 'Unnamed ' + link.kind); }
function linkClosed(link) { return link.edges.every(e => S.closed.has(e)); }

function paintLink(link) {
  const closed = linkClosed(link), r = linkRatio(link), band = bandOf(r);
  const empty = link.edges.every(e => !S.veh[e]);
  const color = closed ? '#e5e7eb' : BAND[band].color;
  const base = link.major ? 5 : 3;
  const key = `${color}|${empty}|${closed}`;
  if (key === link.style) return;
  link.style = key;
  link.line.setStyle(closed ? {color, opacity: .95, dashArray: '4 6', weight: base}
    : {color, dashArray: null, opacity: empty ? .32 : .92, weight: empty ? base - 1 : base + (band === 'very_heavy' ? 1 : 0)});
}
function paintAll() { S.links.forEach(paintLink); rebuildDots(); }

function onRoadHover(link, latlng) {
  S.hoverLink = link;
  const veh = link.edges.reduce((a, e) => a + S.veh[e], 0), cap = link.edges.reduce((a, e) => a + S.cap[e], 0);
  const r = linkRatio(link), mps = Math.min(...link.edges.map(e => S.mps[e]));
  roadTip.setContent(`<b dir="auto">${esc(roadName(link))}</b><br>` + (linkClosed(link) ? tx('Closed')
    : `${tx('{level} traffic · {veh} of {cap} vehicles', {level: tx(BAND[bandOf(r)].label), veh, cap})}<br>${tx('About {kmh} km/h (model)', {kmh: Math.round(mps * 3.6)})}`));
  roadTip.setLatLng(latlng).addTo(map);
}

function onRoadClick(link, latlng) {
  if (S.step === 3 && !isLive()) { placePin(latlng); return; }
  if (S.brush) { paintWithBrush(link); return; }
  S.scopeWhole = false;
  selectLink(link);
}

function paintWithBrush(link) {
  const edges = link.edges;
  if (S.brush === 'closed') {
    setClosedLocal(edges, !linkClosed(link));
    send('set_closed', {edges, closed: linkClosed(link)});
  } else {
    if (linkClosed(link)) { setClosedLocal(edges, false); send('set_closed', {edges, closed: false}); }
    applyLoad(edges, BAND[S.brush].load);
  }
  tickNow();
}

/* ---------------------------------------------------- traffic edits */
function setLoadLocal(edges, ratio) { edges.forEach(e => { S.veh[e] = Math.round(ratio * Math.max(S.cap[e], 1)); }); touched(edges); }
function setClosedLocal(edges, closed) { edges.forEach(e => closed ? S.closed.add(e) : S.closed.delete(e)); touched(edges); }
function touched(edges) { new Set(edges.map(e => S.edges[e].link)).forEach(l => paintLink(S.links[l])); rebuildDots(); }
function applyLoad(edges, ratio) { setLoadLocal(edges, ratio); send('set_load', {edges, ratio}); tickNow(); }

function selectLink(link) {
  const edges = S.scopeWhole && link.street ? S.streets.get(link.street) : link.edges;
  S.selection = {edges, link, name: roadName(link)};
  renderRoadCard();
}
function closeRoadCard() { S.selection = null; $('road-card').hidden = true; }

function renderRoadCard() {
  const sel = S.selection, card = $('road-card');
  if (!sel) { card.hidden = true; return; }
  const veh = sel.edges.reduce((a, e) => a + S.veh[e], 0), cap = sel.edges.reduce((a, e) => a + Math.max(S.cap[e], 1), 0);
  const ratio = veh / cap, closed = sel.edges.every(e => S.closed.has(e)), band = bandOf(ratio);
  const kmh = Math.round(Math.min(...sel.edges.map(e => S.mps[e])) * 3.6);
  const hasStreet = !!sel.link.street && S.streets.get(sel.link.street).length > sel.link.edges.length;
  const active = document.activeElement && document.activeElement.id;
  card.innerHTML = `
    <div class="rc-head"><div><b dir="auto">${esc(sel.name)}</b><div class="small">${closed ? tx('Closed to traffic') : tx('{level} · {pct}% full · about {kmh} km/h', {level: tx(BAND[band].label), pct: Math.round(ratio * 100), kmh})}</div></div>
      <button class="iconbtn" data-act="road-close" data-tip="${tx('Close this card')}" aria-label="${tx('Close')}">${icon('close')}</button></div>
    ${hasStreet ? `<div class="seg" role="group" aria-label="${tx('Apply to')}">
      <button class="${S.scopeWhole ? '' : 'on'}" data-act="scope" data-v="0">${tx('This segment')}</button>
      <button class="${S.scopeWhole ? 'on' : ''}" data-act="scope" data-v="1">${tx('Whole street')}</button></div>` : ''}
    <div><div class="lbl">${tx('Vehicles on it')}</div>
      <div class="stepper"><button class="iconbtn" data-act="veh-minus" data-tip="${tx('Remove vehicles')}" aria-label="${tx('Fewer vehicles')}" ${closed ? 'disabled' : ''}>${icon('minus')}</button>
      <input id="veh-input" type="number" min="0" value="${veh}" aria-label="${tx('Number of vehicles')}" ${closed ? 'disabled' : ''}>
      <button class="iconbtn" data-act="veh-plus" data-tip="${tx('Add vehicles')}" aria-label="${tx('More vehicles')}" ${closed ? 'disabled' : ''}>${icon('plus')}</button></div>
      <div class="small">${tx('It holds about {cap} before it counts as full. That capacity is estimated from its length and lanes.', {cap})}</div></div>
    <input id="load-range" type="range" min="0" max="150" step="5" value="${Math.min(Math.round(ratio * 100), 150)}" aria-label="${tx('How full this road is')}" ${closed ? 'disabled' : ''}>
    <div class="chips">${BANDS.map(b => `<button class="chip ${band === b && veh ? 'on' : ''}" data-act="band" data-v="${b}" data-tip="${tx('{range} of capacity', {range: tx(BAND[b].range)})}" ${closed ? 'disabled' : ''}><i style="background:${BAND[b].color}"></i>${tx(BAND[b].label)}</button>`).join('')}</div>
    <button class="btn ${closed ? 'on' : 'danger'}" data-act="toggle-closed" data-tip="${closed ? tx('Open it again') : tx('No route may use a closed road')}">${icon('block')}${closed ? tx('Reopen this road') : tx('Close this road')}</button>`;
  card.hidden = false;
  if (active === 'veh-input') $('veh-input').focus();
  $('load-range').oninput = e => { setLoadLocal(sel.edges, +e.target.value / 100); updateCardText(); };
  $('load-range').onchange = e => { send('set_load', {edges: sel.edges, ratio: +e.target.value / 100}); tickNow(); renderRoadCard(); };
  $('veh-input').onchange = e => setTotal(Math.max(0, Math.floor(+e.target.value || 0)));
}
function updateCardText() {
  const sel = S.selection, veh = sel.edges.reduce((a, e) => a + S.veh[e], 0);
  $('veh-input').value = veh;
}
function setTotal(total) {
  const sel = S.selection, cap = sel.edges.reduce((a, e) => a + Math.max(S.cap[e], 1), 0);
  setLoadLocal(sel.edges, total / cap);
  send('set_total', {edges: sel.edges, total});
  tickNow();
  renderRoadCard();
}

/* ---------------------------------------------------- pins */
function placePin(latlng) {
  if (isLive()) return;
  const which = S.pinTarget;
  S.awaitPin = {which, node: S.view[which] && S.view[which].node};  // the server may refuse the spot
  S.pinTarget = which === 'a' ? 'b' : 'a';
  send('set_pin', {which, lat: latlng.lat, lng: latlng.lng});
  renderAll();
}
function pinIcon(letter) {
  return L.divIcon({className: 'pin-wrap', iconSize: [28, 28], iconAnchor: [14, 14],
    html: `<div class="pinball ${letter.toLowerCase()}">${letter}</div>`});
}
function renderPins() {
  pinLayer.clearLayers();
  [['a', S.view.a], ['b', S.view.b]].forEach(([k, p]) => {
    if (!p) return;
    const m = L.marker([p.lat, p.lng], {icon: pinIcon(k.toUpperCase()), draggable: !isLive(), zIndexOffset: 1000,
      title: tx('{kind}: {label}. Drag to move.', {kind: tx(k === 'a' ? 'Start' : 'Destination'), label: p.label}), keyboard: true});
    m.on('dragend', () => { const c = m.getLatLng(); send('set_pin', {which: k, lat: c.lat, lng: c.lng}); });
    m.addTo(pinLayer);
  });
}
function renderPlaces() {
  placeLayer.clearLayers();
  (S.view.places || []).forEach(p => {
    const m = L.marker([p.lat, p.lng], {pane: 'placesPane', icon: L.divIcon({className: 'pin-wrap', iconSize: [10, 10], html: '<div class="place-dot"></div>'}), title: p.name});
    m.bindTooltip(`<b>${esc(p.name)}</b><br>${esc(p.label)}`, {className: 'road-tip', direction: 'top'});
    m.on('click', () => { if (S.step === 3) placePin(L.latLng(p.lat, p.lng)); });
    m.addTo(placeLayer);
  });
}

/* ---------------------------------------------------- server updates */
function onRender(v) {
  S.view = v;
  setLanguage(v.lang);
  if (v.roads && v.roads.key !== S.areaKey) {
    S.trafficRev = -1;
    closeRoadCard();
    buildRoads(v.roads);
    renderPlaces();
  } else if (v.roads) {
    send('roads_ok', {key: v.roads.key});
  }
  if (v.cid === cid) queue = queue.filter(e => e.seq > v.acked);
  if (!S.edges.length) {
    if (!v.roads) send('need_roads');  // a re-created frame has lost the map the server thinks it holds
    return;
  }

  if (S.awaitPin && !queue.length) {
    const {which, node} = S.awaitPin, pin = v[which];
    if (!pin || pin.node === node) S.pinTarget = which;
    S.awaitPin = null;
  }
  if (v.traffic.rev !== S.trafficRev && !queue.length) {
    S.trafficRev = v.traffic.rev;
    S.veh = v.traffic.veh; S.cap = v.traffic.cap; S.mps = v.traffic.mps; S.closed = new Set(v.traffic.closed);
    paintAll();
    if (S.selection && document.activeElement?.type !== 'range') renderRoadCard();
  }
  if (v.routes_rev !== S.routesRev) {
    S.routesRev = v.routes_rev;
    if (v.routes.length && !isLive() && S.step >= 4) fitRoute();
  }
  syncRace(v);
  applyProposals(v);
  showNotices(v);
  if (!S.restored) tryRestore(v);
  autosave(v);
  renderPins();
  renderAll();
  resizeFrame();
}

function fitRoute() {
  const pts = [];
  S.view.routes.forEach(r => r.edges.forEach(e => pts.push(S.edges[e].latlng[0])));
  if (S.view.b) pts.push([S.view.b.lat, S.view.b.lng]);
  if (!pts.length) return;
  S.bounds = L.latLngBounds(pts);  // a later frame resize keeps this view
  S.userMoved = false;
  S.routeFit = true;
  map.flyToBounds(S.bounds, {...ROUTE_FIT, duration: .6});
}

/* -------------------- keeping the setup across reloads */
function autosave(v) {
  if (!v.saved_traffic || v.fresh) return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({area: v.area_key, traffic: v.saved_traffic, a: v.a && v.a.node, b: v.b && v.b.node,
      selected: v.selected, step: S.step, baseMap: S.baseMap, speed: S.speed}));
  } catch (e) { /* storage full or blocked: the app still works without it */ }
}
function readSaved() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
}
function tryRestore(v) {
  S.restored = true;
  const saved = readSaved();
  if (!saved) return;
  if (!v.fresh) {  // back from another screen: the server kept the setup, only the view needs restoring
    if (saved.area === v.area_key && saved.step) S.step = Math.min(saved.step, maxStep());
    return;
  }
  if (saved.baseMap && TILES[saved.baseMap]) setBaseMap(saved.baseMap);
  if (SPEEDS.includes(saved.speed)) S.speed = saved.speed;
  if (!saved.traffic.length && saved.a == null && saved.b == null) return;
  if (saved.area !== v.area_key) {
    if (v.areas.some(a => a.key === saved.area)) { S.restored = false; send('set_area', {key: saved.area}); }
    return;
  }
  send('restore', {saved});
  S.step = saved.step || 1;
  toast({text: tx('Welcome back. Your traffic and pins were restored.'), kind: 'success'});
}

/* ---------------------------------------------------- toasts, dialogs, tips */
function toast(n) {
  const el = document.createElement('div');
  el.className = `toast ${n.kind || ''}`;
  el.textContent = n.text;
  if (n.undo) {
    const b = document.createElement('button');
    b.textContent = tx('Undo');
    b.onclick = () => { send('undo'); el.remove(); };
    el.append(b);
  }
  $('toasts').append(el);
  setTimeout(() => el.remove(), n.undo ? 7000 : 4500);
}
function showNotices(v) {
  v.notices.forEach(n => { if (n.id > S.lastNotice) { S.lastNotice = n.id; toast(n); } });
}
function confirmAction(title, body, label, onYes) {
  const m = $('modal');
  m.innerHTML = `<div class="dialog" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="title">${esc(title)}</div><p class="lead">${esc(body)}</p>
    <div class="row"><button class="btn" id="m-no">${tx('Keep my setup')}</button><button class="btn primary" id="m-yes">${esc(label)}</button></div></div>`;
  m.hidden = false;
  $('m-no').focus();
  $('m-no').onclick = () => { m.hidden = true; };
  $('m-yes').onclick = () => { m.hidden = true; onYes(); };
}
function hasSetup() { return S.veh.some(x => x > 0) || S.closed.size > 0 || !!S.view?.a || !!S.view?.b; }

document.addEventListener('mouseover', e => {
  const t = e.target.closest?.('[data-tip]'), tip = $('tip');
  if (!t) { tip.hidden = true; return; }
  tip.textContent = t.dataset.tip;
  tip.hidden = false;
  const r = t.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = `${Math.min(Math.max(6, r.left + r.width / 2 - w / 2), innerWidth - w - 6)}px`;
  tip.style.top = `${r.top - h - 6 < 4 ? r.bottom + 6 : r.top - h - 6}px`;
});
document.addEventListener('mouseleave', () => { $('tip').hidden = true; });

/* ---------------------------------------------------- rendering */
function isLive() { return !!S.race && (S.race.status === 'running' || S.race.status === 'paused'); }
function routeColor(i) { return ROUTE_COLORS[i % ROUTE_COLORS.length]; }
function goStep(n) {
  if ((n === 1 || n === 3) && isLive()) {  // these steps change the trip itself, so the drive can't carry on
    resetSim();
    toast({text: tx('Drive stopped so you can change the trip. Your traffic and pins are kept.')});
  }
  S.step = n;
  if (n === 3) { S.pinTarget = !S.view.a ? 'a' : !S.view.b ? 'b' : S.pinTarget; closeRoadCard(); }
  if (n !== 2) S.brush = null;
  S.search = '';
  renderAll(true);
  autosave(S.view);
}
function maxStep() {
  const v = S.view;
  return !v ? 1 : v.routes.length || S.race ? 5 : v.a && v.b ? 4 : 3;
}
function renderAll(animate) {
  renderStepper();
  renderStep(animate);
  renderDash();
  renderFoot();
  renderHint();
  renderLegend();
  renderSimbar();
  $('map').classList.toggle('pick', S.step === 3 && !isLive());
}
function renderStepper() {
  const top = maxStep();
  $('stepper').innerHTML = STEPS.map((name, i) => {
    const n = i + 1, cls = n === S.step ? 'on' : n < S.step ? 'done' : '';
    const needs = n === 4 ? tx('Place A and B first') : n === 5 ? tx('Calculate a route first') : tx('Go to step {n}', {n});
    return `<li><button class="stp ${cls}" data-act="step" data-v="${n}" ${n > top ? 'disabled' : ''} data-tip="${needs}" ${n === S.step ? 'aria-current="step"' : ''}><b>${n}</b>${tx(name)}</button></li>`;
  }).join('');
}
const keepScroll = fn => { const b = $('step-body'), y = b.scrollTop; fn(b); b.scrollTop = y; };
function renderStep(animate) {
  const v = S.view;
  if (!v) return;
  if (document.activeElement && document.activeElement.id === 'place-search') { renderPlaceResults(); return; }
  keepScroll(b => {
    b.innerHTML = [step1, step2, step3, step4, step5][S.step - 1](v);
    if (animate) { b.style.animation = 'none'; void b.offsetWidth; b.style.animation = ''; b.scrollTop = 0; }
  });
  const q = $('place-search');
  if (q) {
    q.oninput = () => { S.search = q.value; renderPlaceResults(); };
    renderPlaceResults();
  }
}

function step1(v) {
  return `<div><div class="title">${tx('Welcome to MASAR')}</div>
      <p class="lead">${tx('Put cars on real city roads and watch the smartest way through change.')}</p></div>
    <button class="btn primary wide" data-act="demo" data-tip="${tx('Adds simulated rush hour and places A and B for you')}">${icon('bolt')}${tx('Try the 30-second demo')}</button>
    <div class="lbl">${tx('Or choose a map')}</div>
    ${v.areas.map(a => `<button class="choice ${a.key === v.area_key ? 'on' : ''}" data-act="area" data-v="${esc(a.key)}">
       <b>${esc(a.label)}${a.cached ? '' : `<span class="tag">${tx('downloads once')}</span>`}</b><span>${esc(a.desc)}</span></button>`).join('')}
    <div class="stats"><div><b>${v.stats.streets}</b>${tx('named streets')}</div><div><b>${v.stats.intersections}</b>${tx('intersections')}</div><div><b>${tx('{n} km', {n: v.stats.km})}</b>${tx('of road')}</div></div>
    <p class="small">${tx('Hover over a road to see its name. Pink dots are landmarks. Road data: OpenStreetMap.')}</p>
    <button class="btn wide" data-act="step" data-v="2">${tx('Next: set the traffic')}</button>`;
}
function step2(v) {
  return `<div><div class="title">${tx('Set the traffic')}</div><p class="lead">${tx('Pick a pattern, then click any road to fine-tune it.')}</p></div>
    <div class="grid2">${v.presets.map(p => `<button class="choice" data-act="preset" data-v="${p.id}" data-tip="${esc(p.hint)}"><b>${esc(p.label)}</b></button>`).join('')}</div>
    <div><div class="lbl">${tx('Paint roads')}</div><p class="small" style="margin:2px 0 6px">${tx('Choose a level, then click roads on the map. Click the level again to stop.')}</p>
    <div class="chips five">${BANDS.map(b => `<button class="chip ${S.brush === b ? 'on' : ''}" data-act="brush" data-v="${b}"><i style="background:${BAND[b].color}"></i>${tx(BAND[b].label)}</button>`).join('')}
      <button class="chip ${S.brush === 'closed' ? 'on' : ''}" data-act="brush" data-v="closed" data-tip="${tx('Click a road to close it, click again to reopen it')}"><i class="closed" style="background:repeating-linear-gradient(90deg,#e5e7eb 0 4px,#1d0f3a 4px 7px)"></i>${tx('Close')}</button></div></div>
    <p class="small">${tx('Vehicle counts are simulated inputs you control. No live traffic feed is connected.')}</p>
    <button class="btn wide primary" data-act="step" data-v="3">${tx('Next: choose A and B')}</button>`;
}
function step3(v) {
  const slot = (k, name, p) => `<button class="slot ${S.pinTarget === k ? 'on' : ''} ${p ? 'set' : ''}" data-act="pin-target" data-v="${k}" aria-pressed="${S.pinTarget === k}">
      <div class="pinball ${k}">${k.toUpperCase()}</div><span dir="auto">${p ? esc(p.label) : `<i class="small">${tx(name)}</i>`}</span></button>`;
  return `<div><div class="title">${tx('Choose A and B')}</div><p class="lead">${tx(v.a && v.b ? 'Both are set. Click the map to move {pin}, or drag a pin.' : 'Click the map to drop {pin}.', {pin: `<b>${S.pinTarget.toUpperCase()}</b>`})}</p></div>
    ${slot('a', 'Where do you start?', v.a)}${slot('b', 'Where are you going?', v.b)}
    <div class="row"><button class="btn tiny" data-act="swap" ${v.a && v.b ? '' : 'disabled'} data-tip="${tx('Swap start and destination')}">${icon('swap')}${tx('Swap')}</button>
      <button class="btn tiny" data-act="clear-pins" ${v.a || v.b ? '' : 'disabled'}>${icon('clear')}${tx('Clear pins')}</button></div>
    <div><label class="lbl" for="place-search">${tx('Or search for a place or street')}</label>
    <input id="place-search" type="search" placeholder="${tx('Museum, hospital, street…')}" value="${esc(S.search)}" autocomplete="off" dir="auto"></div>
    <div class="list" id="place-results"></div>
    ${v.route_error ? `<div class="err">${esc(v.route_error)}</div>` : ''}
    <button class="btn wide primary" data-act="calc" ${v.a && v.b ? '' : 'disabled'}>${tx('Find the best route')}</button>`;
}
function renderPlaceResults() {
  const box = $('place-results');
  if (!box) return;
  const q = S.search.trim().toLowerCase(), v = S.view;
  const places = v.places.filter(p => !q || p.name.toLowerCase().includes(q) || p.label.toLowerCase().includes(q)).map(p => ({name: p.name, tag: p.label, lat: p.lat, lng: p.lng}));
  const streets = !q ? [] : [...S.streets.keys()].filter(n => n.toLowerCase().includes(q) || S.edges[S.streets.get(n)[0]].name.toLowerCase().includes(q)).slice(0, 25).map(n => {
    const list = S.streets.get(n), e = S.edges[list[Math.floor(list.length / 2)]];
    return {name: n, tag: tx('Street'), lat: e.latlng[0][0], lng: e.latlng[0][1]};
  });
  const rows = [...places, ...streets];
  box.innerHTML = rows.map(r => `<button data-act="pick" data-lat="${r.lat}" data-lng="${r.lng}"><span dir="auto">${esc(r.name)}</span><em>${esc(r.tag)}</em></button>`).join('')
    + (q ? `<button data-act="geocode" data-tip="${tx('Searches OpenStreetMap online')}"><span>${tx('Search online for “{q}”', {q: esc(S.search)})}</span><em>${tx('Online')}</em></button>` : '');
}
function routeCard(r, i, v) {
  const on = v.selected === r.id;
  return `<button class="rcard ${on ? 'on' : ''}" style="--c:${routeColor(i)}" data-act="route" data-v="${r.id}" aria-pressed="${on}">
    <div class="rtop"><div class="rname"><i class="rdot"></i>${esc(r.label)}${i === 0 ? `<span class="best">${tx('BEST')}</span>` : ''}</div><div class="rtime">${fmtTime(r.time_s)}</div></div>
    <div class="rgrid">
      <div data-tip="${tx('Length of this route')}"><b>${fmtKm(r.distance_m)}</b>${tx('distance')}</div>
      <div data-tip="${tx('Extra time compared with empty roads')}"><b>+${fmtTime(r.delay_s)}</b>${tx('delay')}</div>
      <div data-tip="${tx('Time on empty roads ÷ estimated time. 100% means no traffic delay')}"><b>${Math.round(r.efficiency_pct)}%</b>${tx('efficiency')}</div>
    </div>
    <div class="rmore"><span data-tip="${tx('Vehicles ÷ capacity, averaged along the route')}">${tx('{level} traffic ({pct}% full)', {level: tx(BAND[r.band].label), pct: Math.round(r.density_pct)})}</span>${i > 0 ? ` · ${tx('{time} slower than best', {time: fmtTime(r.extra_vs_best_s)})}` : r.saved_s >= 1 ? ` · ${tx('saves {time} vs slowest', {time: fmtTime(r.saved_s)})}` : ''}</div>
    <div class="bar" style="margin-top:6px"><i style="width:${Math.min(r.density_pct, 150) / 1.5}%;background:${BAND[r.band].color}"></i></div></button>`;
}
function step4(v) {
  if (v.route_error) return `<div class="title">${tx('No route found')}</div><div class="err">${esc(v.route_error)}</div>
    <button class="btn wide" data-act="step" data-v="3">${tx('Move the pins')}</button><button class="btn wide" data-act="step" data-v="2">${tx('Change traffic or closures')}</button>`;
  if (!v.routes.length) return `<div class="title">${tx('Best route')}</div><p class="lead">${tx('Place A and B first.')}</p><button class="btn wide primary" data-act="step" data-v="3">${tx('Choose A and B')}</button>`;
  const best = v.routes.find(r => r.id === v.selected) || v.routes[0];
  return `<div class="title">${tx('Best route')}</div>
    <div class="why"><b>${tx('Why this one?')}</b> ${esc(v.explanation)}</div>
    ${v.routes.map((r, i) => routeCard(r, i, v)).join('')}
    ${v.routes.length === 1 ? `<p class="small">${tx('No clearly different alternative exists between these points.')}</p>` : ''}
    <button class="btn wide primary" data-act="drive">${icon('play')}${tx('Drive {route}', {route: esc(best.label)})}</button>
    <button class="btn wide" data-act="jam" data-v="${best.id}" data-tip="${tx('Fills this route to 120% of capacity so you can watch MASAR react')}">${icon('bolt')}${tx('Jam this route. What will MASAR do?')}</button>
    <p class="model">${tx("Estimates come from MASAR's traffic model and your simulated vehicle counts. They are not real-world predictions. Signals and turn delays are not modelled.")}</p>`;
}
function step5(v) {
  const race = S.race;
  if (!race) {
    return `<div class="title">${tx('Ready to drive')}</div><p class="lead">${tx('Each route gets its own car, in the same traffic, so you can see which one really wins.')}</p>
      <label class="row small"><input type="checkbox" id="live-toggle" data-act="live-pref" ${S.livePref !== false ? 'checked' : ''}>${tx('Traffic keeps changing during the drive (simulated)')}</label>
      <button class="btn wide primary" data-act="start">${icon('play')}${tx('Start simulation')}</button>`;
  }
  const res = v.sim && v.sim.results;
  let top = '';
  if (race.status === 'finished' && res) {
    const hero = res.rows.find(r => r.id === res.hero) || res.rows[0];
    const first = res.rows[0], arrived = res.rows.filter(r => r.arrived);
    let headline = tx('Nobody got through'), text = tx('A closure blocked every car. Reopen a road and run it again.');
    if (arrived.length && !hero.arrived) {
      headline = tx('{name} won', {name: first.label});
      text = tx('Your car on {hero} was blocked by a closure, and {name} arrived in {time}.', {hero: hero.label, name: first.label, time: fmtTime(first.elapsed)});
    } else if (arrived.length === 1 && res.rows.length === 1) {
      headline = tx('{name} arrived', {name: first.label});
      text = tx('The trip took {time} over {dist}.', {time: fmtTime(hero.elapsed), dist: fmtKm(hero.distance)});
    } else if (arrived.length) {
      const last = arrived[arrived.length - 1];
      headline = tx('{name} won', {name: first.label});
      text = tx('Your car, on {hero}, took {time}. ', {hero: hero.label, time: fmtTime(hero.elapsed)}) + (res.winner === res.hero
        ? (arrived.length > 1 ? tx('That beat the slowest arrival by {time}.', {time: fmtTime(last.elapsed - hero.elapsed)}) : tx('No other car got through.'))
        : tx('That was {time} behind the winner.', {time: fmtTime(hero.elapsed - first.elapsed)}));
    }
    top = `<div class="result"><div class="lbl">${tx('Simulation finished')}</div><div class="big">${esc(headline)}</div><p>${esc(text)}</p></div>`;
  }
  return `<div class="title">${tx(race.status === 'finished' ? 'Results' : 'The drive')}</div>${top}
    <div id="lanes">${lanesHtml()}</div>
    ${isLive() ? `<button class="btn wide" data-act="surprise" data-tip="${tx('Closes a road just ahead of your car until this drive ends. Watch what it does next')}">${icon('block')}${tx('Close a road ahead')}</button>
      <label class="row small"><input type="checkbox" data-act="live-toggle" ${v.sim && v.sim.live ? 'checked' : ''}>${tx('Traffic keeps changing (simulated)')}</label>
      <p class="small">${tx('You can click any road and change it while cars are moving.')}</p>` : ''}
    ${race.status === 'finished' ? `<button class="btn wide primary" data-act="start">${icon('reset')}${tx('Run again')}</button><button class="btn wide" data-act="back-routes">${tx('Back to routes')}</button>` : ''}
    ${race.log.length ? `<div><div class="lbl">${tx('What happened')}</div><div class="log">${race.log.slice().reverse().map(l => `<div>${fmtClock(l.t)} · ${esc(l.text)}</div>`).join('')}</div></div>` : ''}
    <p class="model">${tx("Times are simulated by MASAR's model, not measured on real roads.")}</p>`;
}
function lanesHtml() {
  const race = S.race;
  if (!race) return '';
  return race.cars.map(c => {
    const total = c.travelled + remainingM(c), pct = c.done ? 100 : total > 0 ? 100 * c.travelled / total : 0;
    const label = c.id === race.hero ? tx('{label} (your car)', {label: c.label}) : c.label;
    return `<div class="lane ${c.id === race.hero ? 'hero' : ''}" style="--c:${c.color};margin-bottom:6px"><div><b style="color:${c.color}">●</b> ${esc(label)}</div>
      <small>${c.done ? tx('arrived {time}', {time: fmtClock(c.elapsed)}) : c.stuck ? tx('blocked') : c.waiting ? tx('waiting at closure') : tx('{time} left', {time: fmtClock(remainingS(c))})}</small>
      <div class="bar"><i style="width:${pct}%;background:${c.color}"></i></div>
      <small style="grid-column:1/-1">${fmtKm(c.travelled)} · ${tx('{kmh} km/h', {kmh: Math.round(c.done ? 0 : S.mps[c.edges[c.idx]] * 3.6)})}${c.changes ? ` · ${tx('re-routed {n}×', {n: c.changes})}` : ''}</small></div>`;
  }).join('');
}
function renderFoot() {
  $('panel-foot').innerHTML = `
    <button class="btn tiny" data-act="undo" ${S.view.can_undo && !isLive() ? '' : 'disabled'} data-tip="${tx('Undo the last traffic change')}">${icon('undo')}${tx('Undo')}</button>
    <button class="btn tiny danger" data-act="clear-traffic" ${isLive() ? 'disabled' : ''} data-tip="${tx('Remove all vehicles and closures. You will be asked first, and you can undo it')}">${icon('clear')}${tx('Clear traffic')}</button>
    <button class="btn tiny danger" data-act="default-map" ${isLive() ? 'disabled' : ''} data-tip="${tx('Go back to Central Ramallah and start over. You will be asked first')}">${icon('map')}${tx('Default map')}</button>`;
}
function renderDash() {
  const v = S.view, d = v.dash, sel = v.routes.find(r => r.id === v.selected);
  const status = S.race ? S.race.status : v.routes.length ? 'ready' : 'setup';
  const statusText = tx({setup: 'Setting up', ready: 'Route ready', running: 'Driving', paused: 'Paused', finished: 'Finished'}[status]);
  const total = BANDS.reduce((a, b) => a + d.bands[b], 0) || 1;
  $('dash').innerHTML = `
    <div class="card" data-tip="${tx('Sum of the vehicle counts on all roads. These are simulated inputs')}"><div class="k">${tx('Simulated vehicles')}</div><div class="v">${d.vehicles.toLocaleString('en')}</div><div class="s">${S.dots && S.dots.scale > 1 ? tx('1 moving dot ≈ {n} vehicles', {n: S.dots.scale}) : tx('on the whole map')}</div></div>
    <div class="card" data-tip="${tx('Road segments at 80% of capacity or more. The bar shows all {n} segments by level', {n: d.roads})}"><div class="k">${tx('Congested roads')}</div><div class="v">${d.congested}<span class="small">${tx(' of {n}', {n: d.roads})}</span></div>
      <div class="bands">${BANDS.map(b => `<i style="flex-grow:${d.bands[b] / total};background:${BAND[b].color}"></i>`).join('')}</div></div>
    <div class="card" data-tip="${tx('Average model estimate across the routes offered for A → B')}"><div class="k">${tx('Average est. time')}</div><div class="v">${d.avg_time_s == null ? '—' : fmtTime(d.avg_time_s)}</div><div class="s">${d.route_count ? tx(d.route_count > 1 ? 'across {n} routes (model)' : 'across {n} route (model)', {n: d.route_count}) : tx('place A and B first')}</div></div>
    <div class="card"><div class="k">${tx('Simulation')}</div><div class="v status ${status}"><i></i>${statusText}</div><div class="s">${d.closed ? tx(d.closed > 1 ? '{n} closed directions' : '{n} closed direction', {n: d.closed}) : S.race ? tx('{n}× speed', {n: S.speed}) : tx('not started')}</div></div>
    <div class="card" data-tip="${tx('The route you selected')}"><div class="k">${tx('Selected route')}</div><div class="v">${sel ? fmtTime(sel.time_s) : '—'}</div><div class="s">${sel ? `${esc(sel.label)} · ${fmtKm(sel.distance_m)}` : tx('none yet')}</div></div>`;
}
function renderHint() {
  const v = S.view;
  let t = '';
  if (S.step === 1) t = tx('Hover over roads to explore. Scroll to zoom.');
  else if (S.step === 2) t = S.brush ? tx('Click roads to paint: {what}', {what: tx(S.brush === 'closed' ? 'close or reopen' : BAND[S.brush].label)}) : tx('Click a road to change its traffic');
  else if (S.step === 3) t = tx('Click the map to place {pin}', {pin: S.pinTarget.toUpperCase()});
  else if (isLive() && S.race.status === 'paused') t = tx('Paused. Change traffic, then press Resume.');
  $('hint').textContent = t;
}
function renderLegend() {
  const routes = S.view.routes.length > 0;
  $('legend').innerHTML = BANDS.map(b => `<div><i style="background:${BAND[b].color}"></i>${tx(BAND[b].label)} <span style="opacity:.7">${tx(BAND[b].range)}</span></div>`).join('')
    + `<div><i class="closed"></i>${tx('Closed')}</div>` + (routes ? `<div><i class="route"></i>${tx('Your route')}</div>` : '');
}
function renderMapStyle() {
  $('map-style').innerHTML = Object.keys(TILES).map(n => `<button class="${n === S.baseMap ? 'on' : ''}" data-act="base" data-v="${n}" aria-pressed="${n === S.baseMap}">${tx(n)}</button>`).join('');
}
function renderSimbar() {
  const bar = $('simbar'), v = S.view;
  const show = S.step === 5 && v.routes.length > 0;
  bar.hidden = !show;
  if (!show) return;
  const race = S.race, live = isLive();
  bar.innerHTML = `
    ${race && live ? (race.status === 'running'
      ? `<button class="btn" data-act="pause" data-tip="${tx('Freeze the cars (Space)')}">${icon('pause')}${tx('Pause')}</button>`
      : `<button class="btn primary" data-act="resume" data-tip="${tx('Keep driving (Space)')}">${icon('play')}${tx('Resume')}</button>`)
    : `<button class="btn primary" data-act="start" data-tip="${tx('Send a car down each route')}">${icon('play')}${tx('Start')}</button>`}
    <button class="btn" data-act="reset" ${race ? '' : 'disabled'} data-tip="${tx('Remove the cars and go back to the start. Your traffic and pins stay')}">${icon('reset')}${tx('Reset')}</button>
    <div class="seg" role="group" aria-label="${tx('Animation speed')}" data-tip="${tx('How fast simulated time runs')}">${SPEEDS.map(s => `<button class="${S.speed === s ? 'on' : ''}" data-act="speed" data-v="${s}" aria-pressed="${S.speed === s}">${s}×</button>`).join('')}</div>
    <div class="clock" id="clock" data-tip="${tx('Simulated time')}">${fmtClock(race ? race.clock : 0)}</div>`;
}

/* ---------------------------------------------------- actions */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const a = t.dataset.act, val = t.dataset.v;
  $('tip').hidden = true;
  switch (a) {
    case 'step': goStep(+val); if (+val >= 4 && S.view.routes.length && !S.race) fitRoute(); break;
    case 'demo':
      if (hasSetup()) confirmAction(tx('Start the demo?'), tx('The demo replaces your current traffic and pins. You can undo the traffic change.'), tx('Start demo'), startDemo);
      else startDemo();
      break;
    case 'area':
      if (val === S.view.area_key) break;
      confirmOr(() => send('set_area', {key: val}), tx('Change map?'), tx('Traffic and pins belong to one map, so they are cleared when you switch.'), tx('Change map'));
      break;
    case 'base': setBaseMap(val); autosave(S.view); break;
    case 'preset': send('preset', {name: val}); break;
    case 'brush': S.brush = S.brush === val ? null : val; closeRoadCard(); renderAll(); break;
    case 'road-close': closeRoadCard(); break;
    case 'scope': S.scopeWhole = val === '1'; selectLink(S.selection.link); break;
    case 'veh-minus': case 'veh-plus': {
      const cur = S.selection.edges.reduce((s, x) => s + S.veh[x], 0);
      const step = Math.max(1, Math.round(S.selection.edges.reduce((s, x) => s + Math.max(S.cap[x], 1), 0) * .1));
      setTotal(Math.max(0, cur + (a === 'veh-plus' ? step : -step)));
      break;
    }
    case 'band': applyLoad(S.selection.edges, BAND[val].load); renderRoadCard(); break;
    case 'toggle-closed': {
      const closing = !S.selection.edges.every(x => S.closed.has(x));
      setClosedLocal(S.selection.edges, closing);
      send('set_closed', {edges: S.selection.edges, closed: closing});
      tickNow();
      renderRoadCard();
      break;
    }
    case 'pin-target': S.pinTarget = val; renderAll(); break;
    case 'swap': send('swap_pins'); break;
    case 'clear-pins': send('clear_pins'); S.pinTarget = 'a'; break;
    case 'pick': placePin(L.latLng(+t.dataset.lat, +t.dataset.lng)); S.search = ''; document.activeElement.blur(); renderAll(); break;
    case 'geocode': send('geocode', {query: S.search, which: S.pinTarget}); break;
    case 'calc': send('calc'); S.step = 4; renderAll(true); break;
    case 'route': send('select_route', {id: val}); S.view.selected = val; renderAll(); break;
    case 'jam': send('jam_route', {id: val}); break;
    case 'drive': goStep(5); break;
    case 'live-pref': S.livePref = t.checked; break;
    case 'live-toggle': send('sim_live', {live: t.checked, cars: carStates()}); break;
    case 'start': startSim(); break;
    case 'pause': setPaused(true); break;
    case 'resume': setPaused(false); break;
    case 'reset': resetSim(); break;
    case 'speed': S.speed = +val; renderAll(); autosave(S.view); break;
    case 'surprise': surpriseClosure(); break;
    case 'back-routes': send('sim_reset'); S.race = null; goStep(4); break;
    case 'undo': send('undo'); break;
    case 'clear-traffic':
      confirmAction(tx('Clear all traffic?'), tx('This removes every vehicle count and closure. You can undo it right after.'), tx('Clear traffic'), () => send('clear_traffic'));
      break;
    case 'default-map':
      confirmAction(tx('Return to the default map?'), tx('This goes back to Central Ramallah and clears your traffic and pins.'), tx('Start over'), () => {
        try { localStorage.removeItem(STORE_KEY); } catch (err) { /* nothing was saved */ }
        const def = S.view.areas.find(x => x.default);
        send('clear_pins');
        send('clear_traffic');
        if (def && def.key !== S.view.area_key) send('set_area', {key: def.key});
        S.race = null; closeRoadCard(); goStep(1);
      });
      break;
  }
});
function confirmOr(action, title, body, label) {
  if (hasSetup()) confirmAction(title, body, label, action); else action();
}
function startDemo() { send('demo'); S.step = 4; renderAll(true); }
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space' && isLive()) { e.preventDefault(); setPaused(S.race.status === 'running'); }
  if (e.key === 'Escape') { closeRoadCard(); S.brush = null; $('modal').hidden = true; renderAll(); }
});

/* ---------------------------------------------------- the race */
function syncRace(v) {
  const sim = v.sim;
  if (!sim) { if (S.race && !queue.length) S.race = null; return; }
  if (S.race && S.race.run === sim.run) {
    if (sim.status === 'finished') S.race.status = 'finished';
    return;
  }
  if (sim.status === 'finished' || S.ignoreRun === sim.run) return;
  const labels = Object.fromEntries(v.routes.map((r, i) => [r.id, {label: r.label, color: routeColor(i)}]));
  S.race = {run: sim.run, hero: sim.hero, status: sim.status, clock: 0, log: [], nextTick: performance.now() + TICK_MS, finishing: false,
    cars: sim.cars.map(c => ({id: c.id, label: labels[c.id].label, color: labels[c.id].color, edges: c.edges.slice(), idx: 0, offset: 0, elapsed: 0, travelled: 0, done: false, changes: 0}))};
  S.race.log.push({t: 0, text: tx(S.race.cars.length > 1 ? '{n} cars set off' : '{n} car set off', {n: S.race.cars.length})});
  closeRoadCard();
}
function startSim() {
  if (S.step !== 5) S.step = 5;
  S.race = null;
  send('sim_start', {live: S.livePref !== false});
  renderAll(true);
}
function setPaused(p) {
  S.race.status = p ? 'paused' : 'running';
  S.lastFrame = performance.now();
  S.race.nextTick = performance.now() + TICK_MS;
  send(p ? 'sim_pause' : 'sim_resume', {cars: carStates()});
  renderAll();
}
function resetSim() {
  const run = S.race && S.race.run;
  S.ignoreRun = run;
  S.race = null;
  send('sim_reset');
  renderAll();
}
function carStates() {
  return S.race ? S.race.cars.map(c => ({id: c.id, idx: c.idx, offset: c.offset, elapsed: c.elapsed, travelled: c.travelled, done: c.done, stuck: !!c.stuck, edges: c.edges, changes: c.changes})) : [];
}
function tickNow() {
  if (isLive() && S.race.status === 'running') S.race.nextTick = 0;
  else if (isLive()) send('sim_tick', {cars: carStates()});
}
function remainingM(c) {
  if (c.done) return 0;
  let m = S.edges[c.edges[c.idx]].len - c.offset;
  for (let i = c.idx + 1; i < c.edges.length; i++) m += S.edges[c.edges[i]].len;
  return m;
}
function remainingS(c) {
  if (c.done) return 0;
  let t = (S.edges[c.edges[c.idx]].len - c.offset) / Math.max(S.mps[c.edges[c.idx]], .01);
  for (let i = c.idx + 1; i < c.edges.length; i++) t += S.edges[c.edges[i]].len / Math.max(S.mps[c.edges[i]], .01);
  return t;
}
/* Same rule as VehicleSimulator.step: move at the current segment's model speed, carrying left-over time on. */
function advance(c, dt) {
  while (dt > 1e-9 && !c.done) {
    const e = c.edges[c.idx], len = S.edges[e].len, speed = Math.max(S.mps[e], .001), left = Math.max(len - c.offset, 0);
    const need = left / speed;
    const used = need <= dt ? need : dt, move = need <= dt ? left : speed * dt;
    c.offset += move; c.travelled += move; c.elapsed += used; dt -= used;
    if (c.offset < len - 1e-9) continue;
    if (c.idx + 1 >= c.edges.length) {
      c.done = true; c.offset = len;
      S.race.log.push({t: c.elapsed, text: tx('{name} arrived', {name: c.label})});
    } else if (S.closed.has(c.edges[c.idx + 1])) {
      // A re-plan may still be on its way from the server: wait at the junction, never drive onto a closed road.
      c.offset = len; c.elapsed += dt;
      if (!c.waiting) { c.waiting = true; c.waitTicks = 0; S.race.nextTick = 0; }
      return;
    } else {
      c.idx++; c.offset = 0; c.waiting = false; c.stuck = false;
    }
  }
}
function applyProposals(v) {
  const race = S.race;
  v.proposals.forEach(p => {
    if (p.rev <= S.lastProposal) return;
    S.lastProposal = p.rev;
    if (!race) return;
    const c = race.cars.find(x => x.id === p.car);
    // The server planned from where the car was; apply only if it has not driven past the change since.
    if (!c || c.done || p.edges[c.idx] !== c.edges[c.idx] || p.edges.join() === c.edges.join()) return;
    c.edges = p.edges;
    c.changes++;
    c.waiting = c.stuck = false;
    const text = p.closed ? tx('{name}: road ahead closed, new way found', {name: c.label}) : tx('{name} found a faster way ({time} left)', {name: c.label, time: fmtTime(p.time_s)});
    race.log.push({t: c.elapsed, text});
    if (c.id === race.hero) toast({text, kind: p.closed ? 'warn' : 'success'});
  });
}
function surpriseClosure() {
  const c = S.race.cars.find(x => x.id === S.race.hero);
  const target = c.edges.slice(c.idx + 2, c.idx + 8).find(e => S.edges[e].len > 25) ?? c.edges[c.idx + 1];
  if (target === undefined || c.done) { toast({text: tx('Your car is too close to the destination.'), kind: 'warn'}); return; }
  const edges = S.links[S.edges[target].link].edges;
  setClosedLocal(edges, true);
  send('set_closed', {edges, closed: true, temporary: true});
  S.race.log.push({t: c.elapsed, text: tx('You closed {name}', {name: S.edges[target].name || tx('a road')})});
  send('sim_tick', {cars: carStates()});
}
function finishRace() {
  const race = S.race;
  race.finishing = true;
  send('sim_finish', {cars: carStates()});
  race.status = 'finished';
  if (!REDUCED) confetti();
  renderAll(true);
}
function confetti() {
  const colors = ['#ff3d8b', '#27d7ff', '#19e68c', '#ffd21f', '#c77dff', '#ff8a3c'], wrap = $('mapwrap');
  for (let i = 0; i < 44; i++) {
    const d = document.createElement('div');
    d.className = 'confetti';
    d.style.left = `${Math.random() * 100}%`;
    d.style.background = colors[i % colors.length];
    d.style.animationDelay = `${Math.random() * .5}s`;
    wrap.append(d);
    setTimeout(() => d.remove(), 2600);
  }
}

/* ---------------------------------------------------- overlay: routes, cars and traffic dots */
const canvas = $('overlay'), ctx = canvas.getContext('2d');
let zooming = false;
map.on('zoomstart', () => { zooming = true; });
map.on('zoomend', () => { zooming = false; });

function rebuildDots() {
  const total = S.veh.reduce((a, x) => a + x, 0);
  const maxDots = matchMedia('(max-width:920px)').matches ? 350 : 1100;
  const scale = Math.max(1, Math.ceil(total / maxDots));
  const dots = [];
  S.veh.forEach((n, e) => {
    if (!n || S.closed.has(e)) return;
    const count = Math.floor(n / scale + Math.random());  // a random round-up keeps the total honest to the scale
    for (let i = 0; i < count; i++) dots.push({e, f: Math.random()});
  });
  S.dots = {list: dots, scale};
}
function pointAt(e, f) {
  const edge = S.edges[e], total = edge.cum[edge.cum.length - 1], target = f * total;
  let i = 1;
  while (i < edge.cum.length - 1 && edge.cum[i] < target) i++;
  const span = edge.cum[i] - edge.cum[i - 1] || 1e-12, t = (target - edge.cum[i - 1]) / span;
  const a = edge.pts[i - 1], b = edge.pts[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, b[0] - a[0], b[1] - a[1]];
}
function drawPath(edges, toScreen, startFrac) {
  ctx.beginPath();
  edges.forEach((e, n) => {
    const edge = S.edges[e];
    let from = 0;
    if (n === 0 && startFrac) {
      const p = pointAt(e, startFrac), s = toScreen(p[0], p[1]);
      ctx.moveTo(s[0], s[1]);
      const target = startFrac * edge.cum[edge.cum.length - 1];
      while (from < edge.cum.length - 1 && edge.cum[from] <= target) from++;
    }
    for (let i = from; i < edge.pts.length; i++) {
      const s = toScreen(edge.pts[i][0], edge.pts[i][1]);
      if (n === 0 && i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
    }
  });
}
function drawCar(c, toScreen, isHero) {
  const e = c.edges[c.idx], f = c.done ? 1 : c.offset / Math.max(S.edges[e].len, .01);
  const p = pointAt(e, Math.min(f, 1)), s = toScreen(p[0], p[1]);
  const angle = Math.atan2(p[3], p[2]);
  ctx.save();
  ctx.translate(s[0], s[1]);
  ctx.rotate(angle);
  const size = isHero ? 1.5 : 1;
  ctx.shadowColor = c.color; ctx.shadowBlur = isHero ? 16 : 7;
  ctx.fillStyle = c.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = isHero ? 2 : 1.2;
  ctx.beginPath();
  ctx.moveTo(9 * size, 0); ctx.lineTo(-6 * size, 5.5 * size); ctx.lineTo(-3 * size, 0); ctx.lineTo(-6 * size, -5.5 * size); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawOverlay(now) {
  const size = map.getSize(), dpr = window.devicePixelRatio || 1;
  if (canvas.width !== size.x * dpr || canvas.height !== size.y * dpr) {
    canvas.width = size.x * dpr; canvas.height = size.y * dpr;
    canvas.style.width = `${size.x}px`; canvas.style.height = `${size.y}px`;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size.x, size.y);
  if (!S.edges.length || !S.view || zooming) return;
  const zoom = map.getZoom(), scale = 256 * 2 ** zoom, center = map.project(map.getCenter(), zoom);
  const ox = size.x / 2 - center.x, oy = size.y / 2 - center.y;
  const toScreen = (x, y) => [x * scale + ox, y * scale + oy];

  // traffic dots
  if (S.dots && zoom >= 13) {
    const w = zoom >= 16 ? 3.4 : 2.4;
    ctx.fillStyle = 'rgba(255,255,255,.88)';  // white, so traffic reads as cars on top of the coloured roads
    for (const d of S.dots.list) {
      const p = pointAt(d.e, d.f), x = p[0] * scale + ox, y = p[1] * scale + oy;
      if (x < -5 || y < -5 || x > size.x + 5 || y > size.y + 5) continue;
      const len = Math.hypot(p[2], p[3]) || 1e-12, off = 1.6; // keep to the right, so opposite directions separate
      ctx.fillRect(x - p[3] / len * off - w / 2, y + p[2] / len * off - w / 2, w, w);
    }
  }

  // selected road
  if (S.selection) {
    ctx.strokeStyle = 'rgba(255,244,217,.95)'; ctx.lineWidth = 7; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    S.selection.edges.forEach(e => { if (e === S.links[S.edges[e].link].edges[0]) { drawPath([e], toScreen); ctx.stroke(); } });
  }

  // routes: alternatives underneath, chosen route on top with white casing
  const v = S.view, race = S.race && (isLive() || S.step === 5) ? S.race : null;  // old results never hide the current route
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const paths = race
    ? race.cars.map(c => {
      const over = race.status === 'finished';  // show the whole way each car took
      return {edges: over ? c.edges : c.done ? [] : c.edges.slice(c.idx), start: over ? 0 : c.offset / Math.max(S.edges[c.edges[c.idx]].len, .01), color: c.color, hero: c.id === race.hero};
    })
    : v.routes.map((r, i) => ({edges: r.edges, start: 0, color: routeColor(i), hero: r.id === v.selected}));
  paths.sort((a, b) => a.hero - b.hero);
  for (const p of paths) {
    if (!p.edges.length) continue;
    drawPath(p.edges, toScreen, p.start);
    if (p.hero) {
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 8; ctx.setLineDash([]); ctx.stroke();
      ctx.strokeStyle = p.color; ctx.lineWidth = 5; ctx.stroke();
      if (!REDUCED) {
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 2; ctx.setLineDash([3, 15]);
        ctx.lineDashOffset = -(now / 40) % 18; ctx.stroke(); ctx.setLineDash([]);
      }
    } else {
      ctx.strokeStyle = 'rgba(29,15,58,.9)'; ctx.lineWidth = 6; ctx.setLineDash([]); ctx.stroke();
      ctx.strokeStyle = p.color; ctx.lineWidth = 3.5; ctx.setLineDash([9, 8]); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (race) {
    const hero = race.cars.find(c => c.id === race.hero);
    race.cars.filter(c => c !== hero).forEach(c => drawCar(c, toScreen, false));
    if (hero) drawCar(hero, toScreen, true);
  }
}

let lastDraw = 0, lastLanes = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const running = S.race && S.race.status === 'running';
  if (!running && now - lastDraw < 33) return;   // 30 fps is plenty when only the dots are moving
  const dtReal = Math.min((now - (S.lastFrame || now)) / 1000, .12);
  S.lastFrame = now;
  lastDraw = now;
  const racePaused = S.race && S.race.status === 'paused';
  if (S.dots && !racePaused && !REDUCED && !(S.race && S.race.status === 'finished')) {
    const pace = dtReal * (running ? S.speed : 3);
    for (const d of S.dots.list) {
      d.f += (S.mps[d.e] / Math.max(S.edges[d.e].len, 1)) * pace;
      if (d.f > 1) d.f -= Math.floor(d.f);
    }
  }
  if (running) {
    const race = S.race, dt = dtReal * S.speed;
    race.cars.forEach(c => advance(c, dt));
    race.clock += race.cars.every(c => c.done) ? 0 : dt;
    const clock = $('clock');
    if (clock) clock.textContent = fmtClock(race.clock);
    if (now - lastLanes > 400) {
      lastLanes = now;
      const lanes = $('lanes');
      if (lanes) lanes.innerHTML = lanesHtml();
    }
    if (race.cars.every(c => c.done || c.stuck) && !race.finishing) finishRace();
    else if (now >= race.nextTick) {
      race.nextTick = now + TICK_MS;
      race.cars.filter(c => c.waiting && !c.stuck).forEach(c => {
        if (++c.waitTicks > 3) {  // the server has had several chances and found no way around
          c.stuck = true;
          race.log.push({t: c.elapsed, text: tx('{name} is blocked: no way around the closure', {name: c.label})});
        }
      });
      send('sim_tick', {cars: carStates()});
    }
  }
  drawOverlay(now);
}

/* ---------------------------------------------------- start */
try { setLanguage(new URLSearchParams(window.parent.location.search).get('lang')); } catch (e) { /* cross-origin host: the first render says */ }
setBaseMap(S.baseMap);
map.setView([31.9038, 35.2042], 14);
requestAnimationFrame(frame);
resizeFrame();
