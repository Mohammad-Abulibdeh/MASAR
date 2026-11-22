/* MASAR app: intro, welcome, destination choice, suggested route and live GPS navigation. */
(function () {
  const NET = window.MASAR_NET, R = window.MasarRouter;
  const MANARA = NET.places.find((p) => p.en === 'Al Manara Square') || { ar: 'دوار المنارة', en: 'Al Manara Square', lat: 31.904947, lng: 35.20443 };
  const SPLASH_MS = 3700;

  const STRINGS = {
    ar: {
      tag: 'طريقك أقصر، وصولك أسرع', welcome: 'أهلا وسهلا!', welcomeText: 'أنا مسار، رفيقك على الطريق. قلّي وين بدك تروح، وأنا بدوّرلك على أحسن طريق.',
      yourName: 'شو اسمك؟ (اختياري)', start: 'يلا نبدأ', otherLang: 'English',
      appearance: 'المظهر', themeLight: 'فاتح', themeDark: 'غامق', themeSystem: 'حسب الجهاز',
      morning: 'صباح الخير', evening: 'مسا الخير', where: 'وين بدك تروح؟', search: 'دوّر على قرية أو شارع أو مكان',
      from: 'من', myLoc: 'موقعي الحالي', saved: 'أماكني', known: 'أماكن معروفة', pickMap: 'اختار من الخريطة',
      home: 'البيت', work: 'الشغل', mall: 'المول', uni: 'الجامعة', add: 'ضيف مكان', setIt: 'اضغط وحدد المكان',
      streets: 'شارع', place: 'مكان', coords: 'إحداثيات', noResults: 'ما لقينا إشي بهالاسم. جرب تختار من الخريطة.',
      coverage: 'التطبيق بغطي محافظة رام الله والبيرة مع قراها.', source: 'بيانات الطرق',
      pickDest: 'حرّك الخريطة لوين بدك تروح', pickSaved: 'حرّك الخريطة لمكان: {0}', pickStart: 'حرّك الخريطة لنقطة البداية',
      confirm: 'تمام، هون', tooFar: 'هاد المكان بعيد عن الشوارع اللي بنغطيها', noName: 'شارع بدون اسم', nearStreet: 'قريب من {0}',
      savedToast: 'انحفظ المكان', editPlace: 'عدّل المكان', placeName: 'اسم المكان', changeLoc: 'غيّر الموقع', setHereTitle: 'وين {0}؟', imHere: 'أنا هون هلأ', locating: 'بحدد موقعك...', locFail: 'ما قدرنا نعرف موقعك. شغّل الموقع وجرّب كمان مرة.', remove: 'احذف', save: 'احفظ', cancel: 'إلغاء',
      newPlace: 'مكان جديد', chooseOnMap: 'اختار موقعه على الخريطة', needName: 'اكتب اسم المكان أول',
      thinking: 'بدوّرلك على أفضل طريق', fromLabel: 'من', change: 'غيّر',
      startTitle: 'من وين بدك تبلش؟', locDenied: 'ما قدرنا نعرف موقعك. اختار نقطة البداية.', locOutside: 'موقعك برا المنطقة اللي بنغطيها (محافظة رام الله والبيرة). اختار نقطة بداية جواها.',
      noRoute: 'ما لقينا طريق سواقة بين النقطتين. جرب مكان قريب.', samePlace: 'إنت أصلا هناك! اختار مكان تاني.',
      rec: 'مسار بنصحك فيه', rDistance: 'الأقصر', rFastest: 'أسرع بدون زحمة', rAlt: 'طريق بديل',
      min: 'د', lessMin: '<1 د', km: 'كم', m: 'م',
      whySave: 'بوفّر عليك حوالي {0} دقيقة عن أبطأ خيار', whyLonger: 'أطول شوي، بس أسرع مع الزحمة', whyOnly: 'هاد أحسن طريق، وما في بديل مختلف كفاية', whyClose: 'كل الخيارات متقاربة، وهاد أسرعها',
      traffic: 'حالة الزحمة (تجريبية)', calm: 'هادي', busy: 'عادي', rush_hour: 'زحمة',
      go: 'يلا نمشي', showSteps: 'شوف الطريق خطوة خطوة', hideSteps: 'خبّي الخطوات',
      simNote: 'الزحمة هون محاكاة من مشروع مسار، مش بيانات حقيقية، والأوقات تقديرية. انتبه للطريق وإشارات المرور.',
      preciseTitle: 'شغّل الموقع الدقيق', preciseText: 'مسار عنده إذن الموقع التقريبي بس، وهاد ما بيكفي للملاحة. افتح الإعدادات ← الأذونات ← الموقع، وفعّل «استخدام الموقع الدقيق».', openSettings: 'افتح الإعدادات',
      waitGps: 'بدوّر على إشارة GPS', weakGps: 'إشارة GPS ضعيفة', gpsHint: 'تأكد إن الموقع شغّال وإنك بمكان مفتوح', offRoute: 'طلعت عن الطريق', rerouted: 'غيّرنا الطريق', outsideNav: 'إنت برا المنطقة اللي بنغطيها',
      afterDist: 'بعد {0}', afterSay: 'بعد {0}، {1}', meters: 'متر', kilometers: 'كيلومتر', arriveSoon: 'بتوصل', arriveNow: 'وصلت', letsGo: 'يلا نمشي',
      arriveAt: 'الوصول', kmh: 'كم/س', recenter: 'رجّع الخريطة علي', voice: 'الصوت', noVoice: 'الصوت العربي مش متوفر على هاد الموبايل', stopAsk: 'بدك توقف الملاحة؟', keepGoing: 'كمّل',
      start_turn: 'بلّش على', straight: 'كمّل دغري على', slight_right: 'ميل يمين على', slight_left: 'ميل شمال على', right: 'لف يمين على', left: 'لف شمال على', uturn: 'ارجع لورا على',
      arrive: 'وصلت!', arrivedAt: 'وصلت على {0}. يعطيك العافية!', again: 'رجوع للبداية',
      left_label: 'باقي', kmLeft: 'مسافة', stop: 'وقّف الملاحة',
    },
    en: {
      tag: 'Shorter road, faster arrival', welcome: 'Welcome!', welcomeText: "I'm MASAR, your road buddy. Tell me where you're going and I'll find you the best way.",
      yourName: 'Your name (optional)', start: "Let's go", otherLang: 'العربية',
      appearance: 'Appearance', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'Same as the phone',
      morning: 'Good morning', evening: 'Good evening', where: 'Where to?', search: 'Search a village, street or place',
      from: 'From', myLoc: 'My location', saved: 'My places', known: 'Popular places', pickMap: 'Pick on the map',
      home: 'Home', work: 'Work', mall: 'Mall', uni: 'University', add: 'Add a place', setIt: 'Tap to set it',
      streets: 'Street', place: 'Place', coords: 'Coordinates', noResults: 'Nothing found. Try picking on the map.',
      coverage: 'The app covers Ramallah and Al-Bireh Governorate with its villages.', source: 'Road data',
      pickDest: 'Move the map to where you are going', pickSaved: 'Move the map to: {0}', pickStart: 'Move the map to your start',
      confirm: 'Right here', tooFar: 'This spot is too far from the roads we cover', noName: 'Unnamed street', nearStreet: 'Near {0}',
      savedToast: 'Place saved', editPlace: 'Edit place', placeName: 'Place name', changeLoc: 'Change location', setHereTitle: 'Where is {0}?', imHere: "I'm here now", locating: 'Finding you...', locFail: "We couldn't get your location. Turn location on and try again.", remove: 'Delete', save: 'Save', cancel: 'Cancel',
      newPlace: 'New place', chooseOnMap: 'Choose it on the map', needName: 'Type a name first',
      thinking: 'Finding your best way', fromLabel: 'From', change: 'change',
      startTitle: 'Where do you start?', locDenied: "We couldn't get your location. Choose a start.", locOutside: 'You are outside the area we cover (Ramallah and Al-Bireh Governorate). Choose a start inside it.',
      noRoute: 'No driving route between these points. Try somewhere close by.', samePlace: 'You are already there! Choose another place.',
      rec: 'MASAR suggests', rDistance: 'Shortest', rFastest: 'Fastest if empty', rAlt: 'Alternative',
      min: 'min', lessMin: '<1 min', km: 'km', m: 'm',
      whySave: 'Saves about {0} min over the slowest option', whyLonger: 'A bit longer, but quicker in this traffic', whyOnly: 'The best way, with no different alternative', whyClose: 'All options are close, and this is the quickest',
      traffic: 'Traffic (demo)', calm: 'Quiet', busy: 'Normal', rush_hour: 'Rush',
      go: "Let's go", showSteps: 'See step by step', hideSteps: 'Hide steps',
      simNote: 'Traffic here is simulated by the MASAR project, not real data. Times are estimates. Watch the road and obey traffic signs.',
      preciseTitle: 'Turn on precise location', preciseText: 'MASAR only has approximate location, which is not enough to navigate. Open Settings > Permissions > Location and turn on "Use precise location".', openSettings: 'Open settings',
      waitGps: 'Looking for GPS', weakGps: 'Weak GPS signal', gpsHint: 'Check that location is on and you are outdoors', offRoute: 'You left the route', rerouted: 'Route updated', outsideNav: 'You are outside the area we cover',
      afterDist: 'In {0}', afterSay: 'In {0}, {1}', meters: 'meters', kilometers: 'kilometers', arriveSoon: 'you arrive', arriveNow: 'You have arrived', letsGo: "Let's go",
      arriveAt: 'Arrival', kmh: 'km/h', recenter: 'Back to my car', voice: 'Voice', noVoice: 'Voice directions are not available on this phone', stopAsk: 'Stop navigating?', keepGoing: 'Keep going',
      start_turn: 'Start on', straight: 'Continue on', slight_right: 'Bear right onto', slight_left: 'Bear left onto', right: 'Turn right onto', left: 'Turn left onto', uturn: 'U-turn onto',
      arrive: 'You made it!', arrivedAt: 'You reached {0}. Well done!', again: 'Back to start',
      left_label: 'Left', kmLeft: 'Distance', stop: 'Stop navigation',
    },
  };

  const ICONS = {
    home: '<path d="M3 11l9-8 9 8M5.5 9.5V21h13V9.5M10 21v-6h4v6"/>',
    work: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 13h18"/>',
    mall: '<path d="M5 8h14l1.2 13H3.8zM8.5 11V6.5a3.5 3.5 0 0 1 7 0V11"/>',
    uni: '<path d="M2 9.5l10-5 10 5-10 5zM6 12v5c3 2.5 9 2.5 12 0v-5M22 9.5V15"/>',
    star: '<path d="M12 3l2.7 5.8 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3.1 1.2-6.2L3 9.6l6.3-.8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', edit: '<path d="M4 20l1-4L16 5l3 3L8 19zM13.5 7.5l3 3"/>',
    pin: '<path d="M12 21c-5-6-7-9-7-12a7 7 0 0 1 14 0c0 3-2 6-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    road: '<path d="M8 3L4 21M16 3l4 18M12 4v3M12 11v3M12 18v3"/>', loc: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>', back: '<path d="M15 5l-7 7 7 7"/>', map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
    straight: '<path d="M12 21V4M6 10l6-6 6 6"/>', right: '<path d="M6 21v-8a4 4 0 0 1 4-4h9M14 4l5 5-5 5"/>', left: '<path d="M18 21v-8a4 4 0 0 0-4-4H5M10 4L5 9l5 5"/>',
    slight_right: '<path d="M8 21v-7l9-9M10 5h7v7"/>', slight_left: '<path d="M16 21v-7L7 5M14 5H7v7"/>', uturn: '<path d="M7 21V9a5 5 0 0 1 10 0v5M12 10l5 5 5-5"/>', start: '<circle cx="12" cy="12" r="6"/>', sound: '<path d="M4 9v6h4l5 4V5L8 9zM16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>', moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', device: '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>', muted: '<path d="M4 9v6h4l5 4V5L8 9zM17 10l4 4M21 10l-4 4"/>', flag: '<path d="M6 21V4M6 4h12l-3 4 3 4H6"/>',
  };
  const BAND_COLORS = { low: '#19e68c', moderate: '#ffe11a', heavy: '#ff8a1f', very_heavy: '#ff2d55' };
  const icon = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ICONS.pin}</svg>`;

  /* -------------------------------------------------- saved state */
  const DEFAULT_SAVED = ['home', 'work', 'mall', 'uni'].map((kind) => ({ id: kind, kind, lat: null, lng: null }));
  const store = { name: null, lang: 'ar', traffic: 'busy', saved: DEFAULT_SAVED, appearance: 'system' };
  try { Object.assign(store, JSON.parse(localStorage.getItem('masar') || '{}')); } catch (e) { /* first run or storage blocked */ }
  if (!Array.isArray(store.trips)) store.trips = [];
  function persist() {
    try { localStorage.setItem('masar', JSON.stringify(store)); } catch (e) { /* kept for this run only */ }
    if (window.MasarPages) window.MasarPages.onPersist();
  }

  const state = { from: null, dest: null, start: null, routes: [], sel: 0, showSteps: false, picker: null, driveRaf: 0, query: '' };

  const $ = (id) => document.getElementById(id);
  const t = (k, ...a) => (STRINGS[store.lang][k] ?? k).replace(/\{(\d)\}/g, (_, i) => a[i]);
  const pname = (p) => (store.lang === 'ar' ? p.ar || p.en : p.en || p.ar).replace(/\s*;\s*/g, ' / ');
  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'html') n.innerHTML = v;
      else if (k === 'on') n.addEventListener('click', v);
      else if (k === 'class') n.className = v;
      else if (v !== undefined && v !== null) n.setAttribute(k, v);
    }
    kids.flat().forEach((c) => n.append(c));
    return n;
  }
  const streetName = (idx) => (idx < 0 ? t('noName') : pname({ ar: NET.names[idx][0], en: NET.names[idx][1] }));
  const savedLabel = (s) => (s.kind === 'custom' ? s.label : t(s.kind));
  const savedIcon = (s) => s.icon || (ICONS[s.kind] ? s.kind : 'star');

  function fmtTime(sec) {
    const m = Math.round(sec / 60);
    return m < 1 ? t('lessMin') : `${m} ${t('min')}`;
  }
  const fmtDist = (m) => (m < 950 ? `${Math.round(m / 10) * 10} ${t('m')}` : `${(m / 1000).toFixed(1)} ${t('km')}`);

  function show(screen) {
    document.body.dataset.screen = screen;
    if (['picker', 'route', 'drive', 'explore'].includes(screen)) {
      /* Drawn on first use: painting the whole road network would stutter the intro on slow phones. */
      if (!map) initMap();
      setTimeout(() => map.invalidateSize(), 0);
    }
    if (window.MasarFx) window.MasarFx.onShow(screen);
  }

  /* Screens that list saved places (home, "My places") are redrawn after a change. */
  function refreshView() {
    if (document.body.dataset.screen === 'pages' && window.MasarPages) window.MasarPages.refresh();
    else renderHome();
  }

  let toastTimer;
  function toast(msg) {
    const n = $('toast');
    n.textContent = msg;
    n.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { n.hidden = true; }, 2600);
  }

  function openModal(...kids) {
    const card = $('modalCard');
    card.replaceChildren(...kids);
    $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; }
  $('modal').addEventListener('click', (e) => { if (e.target.id === 'modal' && !state.modalLocked) closeModal(); });

  /* -------------------------------------------------- map */
  let map, routeLayer, labelLayer, minorRoads, roadLines = [], labelData = null, labelView = null;
  const MAX_LABELS = 45, ROAD_CELL_DEG = 0.02, MINOR_ROADS_ZOOM = 13.5;
  const PLACE_ZOOM = { city: 11, town: 12, village: 13 };

  function initMap() {
    const lats = NET.lat, lngs = NET.lng;
    const bounds = L.latLngBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]]);
    map = L.map('map', {
      zoomControl: false, preferCanvas: true, maxBounds: bounds.pad(0.6), minZoom: 11, maxZoom: 18,
      attributionControl: true, zoomSnap: 0.5,
    }).setView([MANARA.lat, MANARA.lng], 15);
    map.attributionControl.setPrefix(false).addAttribution('© OpenStreetMap');
    map.createPane('minorRoads').style.zIndex = 350;
    drawRoadNetwork();
    routeLayer = L.layerGroup().addTo(map);
    labelLayer = L.layerGroup().addTo(map);
    map.on('zoomend', () => { styleRoads(); refreshLabels(); });
    map.on('moveend', () => { refreshLabels(); updatePickerStreet(); document.querySelector('.center-pin').classList.remove('lift'); });
    map.on('movestart', () => document.querySelector('.center-pin').classList.add('lift'));
    styleRoads();
    refreshLabels();
    if (window.MasarFx) window.MasarFx.onMap(map);
  }

  /* Roads are cut into map squares, so a pan only repaints what is on screen. Side roads get their
     own canvas: they come and go with the zoom without landing on top of the main roads. */
  function drawRoadNetwork() {
    const cells = new Map(), seen = new Set();
    NET.edges.forEach((e, i) => {
      if (seen.has(`${e[1]}-${e[0]}`)) return;
      seen.add(`${e[0]}-${e[1]}`);
      const key = `${e[5]}|${Math.floor(NET.lat[e[0]] / ROAD_CELL_DEG)}|${Math.floor(NET.lng[e[0]] / ROAD_CELL_DEG)}`;
      if (!cells.has(key)) cells.set(key, { rank: e[5], lines: [] });
      cells.get(key).lines.push(R.edgeLatLngs(i));
    });
    const mainCanvas = L.canvas({ padding: 0.5 }), minorCanvas = L.canvas({ padding: 0.5, pane: 'minorRoads' });
    minorRoads = L.layerGroup();
    const widths = [[7, 4], [8, 5], [9.5, 6], [11, 7.5]];
    [0, 1].forEach((pass) => {
      for (let rank = 0; rank < 4; rank++) {
        cells.forEach((cell) => {
          if (cell.rank !== rank) return;
          const weight = widths[rank][pass];
          const line = L.polyline(cell.lines, {
            renderer: rank ? mainCanvas : minorCanvas, color: ROAD_COLORS[theme()][rank][pass], weight, interactive: false,
          });
          roadLines.push({ line, weight, rank, pass });
          line.addTo(rank ? map : minorRoads);
        });
      }
    });
    roadLines.theme = theme();
  }

  function styleRoads() {
    const z = map.getZoom();
    const scale = z >= 15 ? 1 : z >= 14 ? 0.7 : z >= 13 ? 0.5 : 0.32;
    if (roadLines.scale !== scale || roadLines.theme !== theme()) {
      roadLines.scale = scale;
      roadLines.theme = theme();
      roadLines.forEach((r) => r.line.setStyle({
        weight: Math.max(1, r.weight * scale), color: ROAD_COLORS[roadLines.theme][r.rank][r.pass],
      }));
    }
    if (z >= MINOR_ROADS_ZOOM) minorRoads.addTo(map); else minorRoads.remove();
  }

  function buildLabelData() {
    const best = new Map();
    NET.edges.forEach((e, i) => {
      if (e[4] < 0 || e[2] < 90) return;
      const b = best.get(e[4]);
      if (b === undefined || e[2] > NET.edges[b][2]) best.set(e[4], i);
    });
    const list = [];
    best.forEach((i, nameIdx) => {
      const e = NET.edges[i], pts = R.edgeLatLngs(i), mid = pts[Math.floor(pts.length / 2)];
      list.push({ lat: mid[0], lng: mid[1], text: streetName(nameIdx), zoom: e[5] >= 1 ? 15 : 16.5, order: 100 - e[5], cls: 'road-label' });
    });
    NET.places.forEach((p) => {
      const zoom = PLACE_ZOOM[p.cat];
      list.push(zoom
        ? { lat: p.lat, lng: p.lng, text: pname(p), zoom, order: zoom, cls: `place-label ${p.cat}` }
        : { lat: p.lat, lng: p.lng, text: '', zoom: 15, order: 50, cls: 'lm' });
    });
    return list.sort((a, b) => a.order - b.order);
  }

  /* Only the names in view exist on the page, and they are rebuilt only after a real move. */
  function refreshLabels(force) {
    if (!map) return;
    const z = map.getZoom(), c = map.getCenter(), view = map.getBounds();
    if (!force && labelView && labelView.z === z && Math.abs(c.lat - labelView.lat) < (view.getNorth() - view.getSouth()) / 4
      && Math.abs(c.lng - labelView.lng) < (view.getEast() - view.getWest()) / 4) return;
    labelView = { z, lat: c.lat, lng: c.lng };
    if (!labelData) labelData = buildLabelData();
    const area = view.pad(0.3);
    labelLayer.clearLayers();
    let shown = 0;
    for (const item of labelData) {
      if (shown >= MAX_LABELS) break;
      if (z < item.zoom || !area.contains([item.lat, item.lng])) continue;
      const html = item.text ? `<span>${item.text.replace(/</g, '')}</span>` : '';
      L.marker([item.lat, item.lng], { interactive: false, keyboard: false, icon: L.divIcon({ className: item.cls, html }) }).addTo(labelLayer);
      shown++;
    }
  }

  function resetLabels() {
    labelData = null;
    refreshLabels(true);
  }

  /* -------------------------------------------------- intro */
  function endSplash() {
    const s = $('splash');
    if (s.classList.contains('leaving')) return;
    s.classList.add('leaving');
    if (store.name === null) { renderWelcome(); show('welcome'); } else openStart();
    setTimeout(() => s.classList.add('gone'), 520);
  }

  /* After the intro: the welcome screen (plus.js), or straight to a trip that a "Leave now" reminder opened. */
  function openStart() {
    if (window.MasarPlus) window.MasarPlus.afterIntro();
    else { renderHome(); show('home'); }
  }

  function renderWelcome() {
    const input = el('input', { class: 'field', placeholder: t('yourName'), 'aria-label': t('yourName'), maxlength: '24', autocomplete: 'off' });
    const begin = () => { store.name = input.value.trim(); persist(); openStart(); };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') begin(); });
    $('welcome').replaceChildren(el('div', { class: 'welcome-in' },
      el('img', { src: logoFile(), alt: '', 'data-logo': '' }),
      el('h1', {}, t('welcome')),
      el('p', {}, t('welcomeText')),
      input,
      el('button', { class: 'btn yellow', on: begin }, t('start')),
      el('button', { class: 'lang', on: () => { setLang(); renderWelcome(); } }, t('otherLang'))));
  }

  function setLang() {
    store.lang = store.lang === 'ar' ? 'en' : 'ar';
    persist();
    applyLang();
    if (map) resetLabels();
  }

  /* -------------------------------------------------- appearance: light, dark, or as the phone is set */
  const ROAD_COLORS = {
    light: [['#d8cbb0', '#ffffff'], ['#b9a98f', '#fffaf0'], ['#1d0f3a', '#ffe3a3'], ['#1d0f3a', '#ffd21f']],
    dark: [['#2a1b52', '#3d2d6e'], ['#2f2060', '#54448a'], ['#07031a', '#d9b33a'], ['#07031a', '#ffd21f']],
  };

  function systemIsDark() {
    if (native && native.isNightMode) return native.isNightMode();
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function theme() {
    if (store.appearance === 'light' || store.appearance === 'dark') return store.appearance;
    return systemIsDark() ? 'dark' : 'light';
  }

  const logoFile = () => (theme() === 'dark' ? 'logo-dark.svg' : 'logo-light.svg');

  function applyTheme() {
    document.documentElement.dataset.theme = theme();
    document.querySelectorAll('[data-logo]').forEach((img) => { img.src = logoFile(); });
    if (map) {
      styleRoads();
      if (state.routes.length && ['route', 'drive'].includes(document.body.dataset.screen)) drawRoutes(false);
    }
  }

  function chooseAppearance() {
    const pick = (value) => {
      store.appearance = value;
      persist();
      applyTheme();
      closeModal();
      renderHome();
    };
    const option = (value, iconName, label) => el('button', {
      class: 'choice', 'aria-pressed': String(store.appearance === value), on: () => pick(value), html: icon(iconName),
    }, label);
    openModal(el('h2', {}, t('appearance')), el('div', { class: 'choices' },
      option('light', 'sun', t('themeLight')), option('dark', 'moon', t('themeDark')), option('system', 'device', t('themeSystem'))));
  }

  /* The phone tells the page when its own dark mode changes. */
  window.masarSystemTheme = () => { if (store.appearance === 'system') { applyTheme(); if (document.body.dataset.screen === 'home') renderHome(); } };
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', window.masarSystemTheme);

  function applyLang() {
    document.documentElement.lang = store.lang;
    document.documentElement.dir = store.lang === 'ar' ? 'rtl' : 'ltr';
    document.title = store.lang === 'ar' ? 'مسار' : 'MASAR';
    $('splashTag').textContent = t('tag');
    document.querySelectorAll('[data-back]').forEach((b) => { b.innerHTML = icon('back', 'flip'); });
  }

  /* -------------------------------------------------- home */
  function fromLabel() { return state.from ? state.from.label : t('myLoc'); }

  function renderHome() {
    const hour = new Date().getHours();
    const hi = `${t(hour >= 4 && hour < 12 ? 'morning' : 'evening')}${store.name ? `، ${store.name}` : ''}`;
    const q = el('input', { class: 'field', type: 'search', placeholder: t('search'), 'aria-label': t('search'), autocomplete: 'off', value: state.query });
    const body = el('div');
    q.addEventListener('input', () => { state.query = q.value; renderHomeBody(body); });
    renderHomeBody(body);
    $('home').replaceChildren(el('div', { class: 'home-in' },
      el('header', { class: 'hero' },
        el('div', { class: 'hero-top' }, el('span', {}, hi), el('div', { class: 'hero-top-actions' },
          el('button', { on: chooseAppearance, 'aria-label': t('appearance'), html: icon(theme() === 'dark' ? 'moon' : 'sun') }),
          el('button', { class: 'avatar', on: () => window.MasarPages.open('account'), 'aria-label': t('account') },
            store.photo ? el('img', { src: store.photo, alt: '' }) : (store.name || '').trim().charAt(0).toUpperCase() || el('span', { html: icon('user') })))),
        el('h1', {}, t('where'))),
      el('div', { class: 'searchbox' }, q, el('span', { html: icon('search') }), window.MasarPlus ? window.MasarPlus.micButton('search-mic') : ''),
      el('button', { class: 'from-row', on: chooseStart, html: icon('loc') },
        el('span', {}, el('small', {}, `${t('from')}: `), fromLabel())),
      body));
    if (state.focusSearch) { state.focusSearch = false; setTimeout(() => q.focus(), 50); }
  }

  function renderHomeBody(body) {
    if (state.query.trim()) { body.replaceChildren(...searchResults(state.query)); return; }
    const cards = store.saved.map((s, i) => {
      const isSet = s.lat !== null;
      const kids = [el('button', {
        class: `place tap c${i % 6}`, on: () => (isSet ? goTo({ label: savedLabel(s), lat: s.lat, lng: s.lng }) : setSavedLocation(s)),
        html: icon(savedIcon(s)),
      }, el('b', {}, savedLabel(s)), el('small', {}, isSet ? s.note || '' : t('setIt')))];
      if (isSet || s.kind === 'custom') kids.push(el('button', { class: 'edit', 'aria-label': `${t('editPlace')}: ${savedLabel(s)}`, on: () => editSaved(s), html: icon('edit') }));
      return el('div', { class: 'place-wrap' }, kids);
    });
    cards.push(el('div', { class: 'place-wrap' }, el('button', { class: 'place add tap', on: addPlace, html: icon('plus') }, el('b', {}, t('add')))));
    const chips = NET.places.filter((p) => !/[֐-׿]/.test(p.ar + p.en)).slice(0, 12).map((p) => el('button', { class: 'chip', on: () => goTo({ label: pname(p), lat: p.lat, lng: p.lng }) }, pname(p)));
    body.replaceChildren(
      ...(window.MasarFx ? window.MasarFx.homeExtras() : []),
      el('h2', { class: 'sec' }, t('saved')),
      el('div', { class: 'saved' }, cards),
      el('button', { class: 'btn teal mapbtn', on: pickDestination, html: icon('map') }, t('pickMap')),
      el('h2', { class: 'sec' }, t('known')),
      el('div', { class: 'chips' }, chips),
      el('p', { class: 'foot' }, `${t('coverage')} ${t('source')}: © OpenStreetMap`));
  }

  /* -------------------------------------------------- search */
  function norm(s) {
    return (s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
      .replace(/^(شارع|ش\.)\s*/, '').replace(/\s+/g, ' ').trim();
  }

  const streetPoints = (() => {
    const best = new Map();
    NET.edges.forEach((e, i) => {
      if (e[4] < 0 || !NET.snap[e[0]]) return;
      const b = best.get(e[4]);
      if (!b || e[2] > NET.edges[b][2]) best.set(e[4], i);
    });
    const seen = new Set(), list = [];
    best.forEach((i, n) => {
      const key = norm(NET.names[n][0] || NET.names[n][1]);
      if (seen.has(key)) return;
      seen.add(key);
      const pts = R.edgeLatLngs(i), mid = pts[Math.floor(pts.length / 2)];
      list.push({ ar: NET.names[n][0], en: NET.names[n][1], lat: mid[0], lng: mid[1] });
    });
    return list;
  })();

  /* Named buildings, schools, shops... from OpenStreetMap (data/pois.js). */
  const POIS = (window.MASAR_POIS || []).map(([ar, en, kind, lat, lng]) => ({ ar, en, kind, lat, lng, key: `${norm(ar)} | ${norm(en)}` }));
  const POI_KIND = {
    school: ['مدرسة', 'School'], kindergarten: ['روضة', 'Kindergarten'], university: ['جامعة', 'University'], college: ['كلية', 'College'],
    shop: ['محل', 'Shop'], restaurant: ['مطعم', 'Restaurant'], cafe: ['كافيه', 'Café'], fast_food: ['مطعم', 'Fast food'],
    hospital: ['مستشفى', 'Hospital'], clinic: ['عيادة', 'Clinic'], doctors: ['عيادة', 'Doctor'], pharmacy: ['صيدلية', 'Pharmacy'], dentist: ['طبيب أسنان', 'Dentist'],
    place_of_worship: ['مكان عبادة', 'Place of worship'], bank: ['بنك', 'Bank'], fuel: ['محطة وقود', 'Fuel station'],
    office: ['مكتب', 'Office'], building: ['مبنى', 'Building'], public_building: ['مبنى عام', 'Public building'], apartment: ['عمارة', 'Building'],
    community_centre: ['مركز', 'Centre'], townhall: ['بلدية / مجلس', 'Town hall'], hotel: ['فندق', 'Hotel'], park: ['حديقة', 'Park'],
    sports_centre: ['نادي رياضي', 'Sports centre'], historic: ['معلم أثري', 'Historic site'], taxi: ['موقف تكسي', 'Taxi stand'],
  };
  function poiKind(kind) { const k = POI_KIND[kind]; return k ? k[store.lang === 'en' ? 1 : 0] : t('place'); }

  function searchResults(query) {
    const items = searchItems(query);
    if (!items.length) {
      return [el('div', { class: 'empty' }, t('noResults')),
        el('button', { class: 'btn teal mapbtn', on: pickDestination, html: icon('map') }, t('pickMap'))];
    }
    return [el('ul', { class: 'results' }, items.slice(0, 16).map((it) => el('li', {},
      el('button', { on: () => goTo({ label: it.label, lat: it.lat, lng: it.lng }), html: icon(it.icon) },
        el('span', {}, el('b', {}, it.label), el('small', {}, it.kind))))))];
  }

  /* Everything that matches a search, best first: coordinates, my places, villages, streets, buildings. */
  function searchItems(query) {
    const raw = query.trim();
    const coord = raw.match(/^(-?\d{1,2}\.\d+)\s*[,،\s]\s*(-?\d{1,3}\.\d+)$/);
    const q = norm(raw);
    const hit = (p) => norm(p.ar).includes(q) || norm(p.en).includes(q);
    const items = [];
    if (coord) items.push({ icon: 'pin', kind: t('coords'), label: `${coord[1]}, ${coord[2]}`, lat: +coord[1], lng: +coord[2] });
    // Places the user added to the map themself come first.
    (store.myPois || []).filter((p) => q && norm(p.name).includes(q))
      .forEach((p) => items.push({ icon: 'star', kind: `${poiKind(p.kind)} · ${t('addedByYou')}`, label: p.name, lat: p.lat, lng: p.lng }));
    store.saved.filter((s) => s.lat !== null && q && norm(savedLabel(s)).includes(q))
      .forEach((s) => items.push({ icon: savedIcon(s), kind: t('saved'), label: savedLabel(s), lat: s.lat, lng: s.lng }));
    NET.places.filter(hit).forEach((p) => items.push({ icon: 'pin', kind: t('place'), label: pname(p), lat: p.lat, lng: p.lng }));
    if (q) streetPoints.filter(hit).slice(0, 4).forEach((p) => items.push({ icon: 'road', kind: t('streets'), label: pname(p), lat: p.lat, lng: p.lng }));
    if (q.length >= 2) {
      // Buildings and shops: names that start with the query come first.
      const found = [];
      for (const p of POIS) {
        const a = p.key.indexOf(q);
        if (a >= 0) found.push([a === 0 || p.key[a - 1] === ' ' ? 0 : 1, p]);
        if (found.length > 400) break;
      }
      found.sort((x, y) => x[0] - y[0]).slice(0, 12).forEach(([, p]) => items.push({
        icon: 'pin', kind: poiKind(p.kind), label: (store.lang === 'en' ? p.en || p.ar : p.ar || p.en), lat: p.lat, lng: p.lng,
      }));
    }
    return items;
  }

  /* -------------------------------------------------- map picker */
  function openPicker(opts) {
    state.picker = opts;
    $('pickerTitle').textContent = opts.title;
    $('pickerOk').textContent = t('confirm');
    show('picker');
    routeLayer.clearLayers();
    map.setView(opts.center || [MANARA.lat, MANARA.lng], 16, { animate: false });
    setTimeout(updatePickerStreet, 30);
  }

  function updatePickerStreet() {
    if (document.body.dataset.screen !== 'picker') return;
    const c = map.getCenter(), near = R.nearestNode(c.lat, c.lng), ok = near.meters <= R.MAX_SNAP_M;
    $('pickerOk').disabled = !ok;
    state.pickerLabel = streetName(R.nearestStreet(c.lat, c.lng));
    $('pickerStreet').textContent = ok ? t('nearStreet', state.pickerLabel) : t('tooFar');
  }

  $('pickerOk').addEventListener('click', () => {
    const c = map.getCenter(), p = state.picker;
    if (!p) return;
    state.picker = null;
    p.done(c.lat, c.lng, t('nearStreet', state.pickerLabel));
  });

  function pickDestination() {
    openPicker({ title: t('pickDest'), back: 'home', done: (lat, lng, label) => goTo({ label, lat, lng }) });
  }

  /* Where to go after a place is saved: home, or back to the screen that asked (My places, the map). */
  function afterSaved() {
    const back = state.savedBack || 'home';
    state.savedBack = null;
    if (back === 'pages') { window.MasarPages.refresh(); show('pages'); } else if (back === 'explore') window.MasarFx.openExplore();
    else { renderHome(); show('home'); }
  }

  function saveSaved(s, lat, lng, label) {
    s.lat = lat; s.lng = lng; s.note = label;
    persist();
    afterSaved();
    toast(t('savedToast'));
  }

  function pickSavedOnMap(s) {
    openPicker({
      title: t('pickSaved', savedLabel(s)), back: state.savedBack || 'home',
      center: s.lat !== null ? [s.lat, s.lng] : null,
      done: (lat, lng, label) => saveSaved(s, lat, lng, label),
    });
  }

  /* "I'm here now" saves the phone's location, so home can be set while standing in it. */
  async function saveSavedHere(s, button) {
    button.disabled = true;
    button.textContent = t('locating');
    const here = await locate(true);
    closeModal();
    if (!here) { toast(t('locFail')); return; }
    if (R.nearestNode(here.lat, here.lng).meters > R.MAX_SNAP_M) { toast(t('tooFar')); return; }
    saveSaved(s, here.lat, here.lng, t('nearStreet', streetName(R.nearestStreet(here.lat, here.lng))));
  }

  function setSavedLocation(s) {
    if (!state.savedBack && document.body.dataset.screen === 'pages') state.savedBack = 'pages';
    const here = el('button', { class: 'btn pink', html: icon('loc') }, t('imHere'));
    here.addEventListener('click', () => saveSavedHere(s, here));
    openModal(el('h2', {}, t('setHereTitle', savedLabel(s))), here,
      el('button', { class: 'btn teal', on: () => { closeModal(); pickSavedOnMap(s); }, html: icon('map') }, t('pickMap')),
      el('button', { class: 'btn ghost', on: () => { state.savedBack = null; closeModal(); } }, t('cancel')));
  }

  /* A row of icons to give a custom place its own look. */
  const PLACE_ICONS = ['star', 'heart', 'family', 'school', 'gym', 'food', 'coffee', 'shop', 'health', 'mosque', 'uni', 'work'];
  function iconPicker(current, pick) {
    const row = el('div', { class: 'icon-pick' });
    const paint = (sel) => row.replaceChildren(...PLACE_ICONS.map((n) => el('button', {
      'aria-pressed': String(n === sel), 'aria-label': n, html: icon(n), on: () => { pick(n); paint(n); },
    })));
    paint(current);
    return row;
  }

  function editSaved(s) {
    const name = s.kind === 'custom' ? el('input', { class: 'field', value: s.label, 'aria-label': t('placeName') }) : null;
    let chosen = savedIcon(s);
    const close = () => {
      if (name && name.value.trim()) s.label = name.value.trim();
      if (s.kind === 'custom') s.icon = chosen;
      persist();
      refreshView();
      closeModal();
    };
    const clear = () => {
      if (s.kind === 'custom') store.saved = store.saved.filter((x) => x !== s);
      else { s.lat = null; s.lng = null; s.note = ''; }
      persist();
      refreshView();
      closeModal();
    };
    openModal(el('h2', {}, t('editPlace')), name || el('p', {}, savedLabel(s)),
      s.kind === 'custom' ? iconPicker(chosen, (n) => { chosen = n; }) : '',
      el('button', { class: 'btn teal', on: () => { close(); setSavedLocation(s); } }, t('changeLoc')),
      el('button', { class: 'btn pink', on: clear }, t('remove')),
      el('button', { class: 'btn ghost', on: close }, t('save')));
  }

  /* `at` (optional) is a spot already chosen, e.g. a long press on the map. */
  function addPlace(at) {
    const name = el('input', { class: 'field', placeholder: t('placeName'), 'aria-label': t('placeName'), maxlength: '24' });
    let chosen = 'star';
    if (!state.savedBack && document.body.dataset.screen === 'pages') state.savedBack = 'pages';
    openModal(el('h2', {}, t('newPlace')), name, iconPicker(chosen, (n) => { chosen = n; }),
      el('button', {
        class: 'btn teal',
        on: () => {
          const label = name.value.trim();
          if (!label) { toast(t('needName')); name.focus(); return; }
          const s = { id: `c${Date.now()}`, kind: 'custom', label, icon: chosen, lat: null, lng: null };
          store.saved.push(s);
          closeModal();
          if (at && at.lat !== undefined) saveSaved(s, at.lat, at.lng, at.label);
          else { persist(); setSavedLocation(s); }
        },
      }, at && at.lat !== undefined ? t('save') : t('chooseOnMap')),
      el('button', { class: 'btn ghost', on: () => { state.savedBack = null; closeModal(); } }, t('cancel')));
  }

  /* -------------------------------------------------- start point */
  function chooseStart(message) {
    const pick = (from) => {
      state.from = from;
      closeModal();
      if (state.dest) computeRoutes(); else renderHome();
    };
    const fromMap = () => {
      closeModal();
      const back = state.dest ? 'route' : 'home';
      openPicker({
        title: t('pickStart'), back,
        done: (lat, lng, label) => {
          state.from = { label, lat, lng };
          if (state.dest) { show('route'); computeRoutes(); } else { renderHome(); show('home'); }
        },
      });
    };
    openModal(el('h2', {}, t('startTitle')),
      typeof message === 'string' ? el('p', {}, message) : '',
      el('button', { class: 'btn teal', on: () => pick(null) }, t('myLoc')),
      el('button', { class: 'btn yellow', on: () => pick({ label: pname(MANARA), lat: MANARA.lat, lng: MANARA.lng }) }, pname(MANARA)),
      el('button', { class: 'btn ghost', on: fromMap }, t('pickMap')));
  }

  function locate(fresh) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: fresh ? 25000 : 15000, maximumAge: fresh ? 10000 : 300000 });
    });
  }

  /* -------------------------------------------------- routes */
  function goTo(dest) {
    state.dest = dest;
    state.query = '';
    state.showSteps = false;
    show('route');
    computeRoutes();
  }

  async function computeRoutes() {
    $('routeSheet').classList.remove('calm');
    $('routeSheet').replaceChildren(el('div', { class: 'busy' }, el('span', { html: icon('road', 'spin') }), t('thinking'), ' ',
      el('span', { class: 'dot' }, '•'), el('span', { class: 'dot' }, '•'), el('span', { class: 'dot' }, '•')));
    routeLayer.clearLayers();
    let start = state.from;
    if (!start) {
      const here = await locate();
      if (document.body.dataset.screen !== 'route') return;
      if (!here) { routeProblem(t('locDenied')); return; }
      if (R.nearestNode(here.lat, here.lng).meters > R.MAX_SNAP_M) { routeProblem(t('locOutside')); return; }
      start = { label: t('myLoc'), ...here };
    }
    state.start = start;
    const a = R.nearestNode(start.lat, start.lng), b = R.nearestNode(state.dest.lat, state.dest.lng);
    if (b.meters > R.MAX_SNAP_M) { backHome(t('coverage')); return; }
    if (a.node === b.node) { backHome(t('samePlace')); return; }
    if (window.MasarFx) {
      await window.MasarFx.prepareRoute(); // fresh driver reports, so closures can be avoided
      if (document.body.dataset.screen !== 'route') return;
    }
    state.routes = R.options(a.node, b.node, store.traffic);
    state.sel = 0;
    if (!state.routes.length) { backHome(t('noRoute')); return; }
    renderRoute(true);
  }

  function routeProblem(msg) {
    $('routeSheet').replaceChildren(el('button', { class: 'btn teal', on: () => chooseStart(msg) }, t('startTitle')));
    chooseStart(msg);
  }

  function backHome(msg) {
    state.dest = null;
    renderHome();
    show('home');
    toast(msg);
  }

  function routeTag(r, i) {
    if (i === 0) return t('rec');
    return t({ distance: 'rDistance', fastest: 'rFastest' }[r.mode] || 'rAlt');
  }

  function whyText() {
    const best = state.routes[0];
    if (state.routes.length === 1) return t('whyOnly');
    const slowest = Math.max(...state.routes.map((r) => r.time));
    const shortest = Math.min(...state.routes.map((r) => r.distance));
    const saved = Math.round((slowest - best.time) / 60);
    if (saved >= 1 && best.distance > shortest * 1.05) return `${t('whyLonger')}. ${t('whySave', saved)}`;
    return saved >= 1 ? t('whySave', saved) : t('whyClose');
  }

  let routeDrawId = 0;
  const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function drawRoutes(fit) {
    routeLayer.clearLayers();
    const selected = state.routes[state.sel];
    state.routes.forEach((r, i) => {
      if (i === state.sel) return;
      L.polyline(r.path.map(R.edgeLatLngs).flat(), { color: theme() === 'dark' ? '#c9a6ff' : '#5a2be0', weight: 6, opacity: 0.85, dashArray: '2 12', interactive: false }).addTo(routeLayer);
    });
    const line = selected.path.map(R.edgeLatLngs).flat();
    const outline = L.polyline([line[0]], { color: '#1d0f3a', weight: 12, lineJoin: 'round', interactive: false }).addTo(routeLayer);
    let end = 0;
    const segs = selected.path.map((e) => {
      const pts = R.edgeLatLngs(e);
      end += pts.length;
      return { pts, end, color: BAND_COLORS[R.band(R.ratio(e, store.traffic))] };
    });
    const addSeg = (s) => L.polyline(s.pts, { color: s.color, weight: 7, lineCap: 'round', interactive: false }).addTo(routeLayer);
    const id = ++routeDrawId;
    if (!fit || !motionOK()) {
      outline.setLatLngs(line);
      segs.forEach(addSeg);
    } else {
      /* A new route draws itself from the start to the destination. */
      const t0 = performance.now(), dur = Math.min(1100, 450 + segs.length * 12);
      let added = 0;
      const step = (now) => {
        if (id !== routeDrawId) return;
        const k = Math.min(1, (now - t0) / dur), n = Math.max(1, Math.round((1 - (1 - k) ** 3) * line.length));
        outline.setLatLngs(line.slice(0, n));
        while (added < segs.length && segs[added].end <= n) addSeg(segs[added++]);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
    L.marker(line[0], { interactive: false, icon: L.divIcon({ className: 'startdot', iconSize: [22, 22] }) }).addTo(routeLayer);
    L.marker(line[line.length - 1], {
      interactive: false, icon: L.divIcon({ className: 'pin-wrap', html: '<div class="pin end drop"></div>', iconSize: [38, 50], iconAnchor: [19, 49] }),
    }).addTo(routeLayer);
    if (fit) {
      const sheet = $('routeSheet').offsetHeight;
      map.fitBounds(L.latLngBounds(line), { paddingTopLeft: [34, 80], paddingBottomRight: [34, sheet + 24], animate: false });
    }
  }

  function renderRoute(fit) {
    const sel = state.routes[state.sel];
    const cards = state.routes.map((r, i) => el('button', {
      class: 'rcard', 'aria-pressed': String(i === state.sel),
      on: () => { state.sel = i; renderRoute(false); },
    }, el('span', { class: 'tag' }, routeTag(r, i)), el('b', {}, fmtTime(r.time)), el('small', {}, fmtDist(r.distance))));
    const seg = ['calm', 'busy', 'rush_hour'].map((p) => el('button', {
      'aria-pressed': String(store.traffic === p),
      on: () => { store.traffic = p; persist(); computeRoutes(); },
    }, t(p)));
    const kids = [
      el('div', { class: 'grab' }),
      el('h2', { class: 'to' }, state.dest.label),
      el('button', { class: 'fromline', on: chooseStart }, `${t('fromLabel')}: ${state.start.label} · `, el('u', {}, t('change'))),
      el('div', { class: 'cards' }, cards),
      el('p', { class: 'why' }, whyText()),
      window.MasarFx ? window.MasarFx.routeNote(sel) : '',
      el('p', { class: 'tlabel' }, t('traffic')),
      el('div', { class: 'seg' }, seg),
      el('button', { class: 'btn pink', on: startNav }, t('go')),
      el('button', { class: 'stepsbtn', on: () => { state.showSteps = !state.showSteps; renderRoute(false); } }, t(state.showSteps ? 'hideSteps' : 'showSteps')),
    ];
    if (state.showSteps) kids.push(renderSteps(sel));
    kids.push(el('p', { class: 'note' }, t('simNote')));
    const sheet = $('routeSheet'), top = sheet.scrollTop;
    sheet.classList.toggle('calm', !fit); // cards only bounce in for a new route, not on every tap
    sheet.replaceChildren(...kids);
    sheet.scrollTop = top;
    drawRoutes(fit);
  }

  const stepText = (s) => `${t(s.turn === 'start' ? 'start_turn' : s.turn)} ${streetName(s.name)}`;

  function renderSteps(route) {
    const list = R.steps(route.path).map((s) => el('li', {},
      el('div', { class: 'turn', html: icon(s.turn) }),
      el('span', {}, stepText(s), el('small', {}, fmtDist(s.distance)))));
    list.push(el('li', {}, el('div', { class: 'turn', html: icon('flag') }), el('span', {}, state.dest.label)));
    return el('ol', { class: 'steps' }, list);
  }

  /* -------------------------------------------------- live GPS navigation */
  const native = window.MasarNative || null;
  const REROUTE_GAP_MS = 8000, WEAK_ACCURACY_M = 80, ARRIVE_M = 30, PAN_EVERY_MS = 300;
  let nav = null;

  /* Recorded Arabic clips (www/voice, listed in VOICE_RECORDINGS.md) are played by the phone in order.
     The phone's own text-to-speech is only the fallback: many phones have no Arabic voice. */
  const VOICE_DISTANCES = [50, 100, 150, 200, 300, 400, 500, 700, 1000, 1500, 2000];
  const distClip = (m) => `d${VOICE_DISTANCES.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a))}`;
  const turnClip = (s) => (s.turn === 'start' ? 'straight' : s.turn);

  function speak(text, clips) {
    if (!nav || store.muted || !native) return;
    if (store.lang === 'ar' && clips && native.playClips && native.playClips(clips.join(','))) return;
    if (!native.speak(text, store.lang) && !nav.voiceWarned) {
      nav.voiceWarned = true;
      toast(t('noVoice'));
    }
  }

  const sayDist = (m) => (m < 950 ? `${Math.round(m / 10) * 10} ${t('meters')}` : `${(m / 1000).toFixed(1)} ${t('kilometers')}`);
  const sayTurn = (s) => (s.name < 0 ? t(s.turn).replace(/\s(على|onto|on)$/, '') : stepText(s));

  function startNav() {
    const route = state.routes[state.sel];
    state.routes = [route];
    state.sel = 0;
    nav = {
      startedAt: Date.now(), startLabel: state.start ? state.start.label : t('myLoc'),
      route, track: R.buildTrack(route.path), at: 0, off: 0, fixes: 0, follow: true, spoken: new Set(),
      lastReroute: 0, lastPan: 0, shown: null, watch: null, raf: 0, voiceWarned: false,
    };
    show('drive');
    drawRoutes(false);
    nav.car = L.marker(R.trackPoint(nav.track, 0).pos, {
      interactive: false, zIndexOffset: 1000, icon: L.divIcon({ className: '', html: '<div class="car"></div>', iconSize: [0, 0] }),
    }).addTo(map);
    map.setView(nav.car.getLatLng(), 17, { animate: false });
    map.on('dragstart', stopFollowing);
    renderNavChrome();
    if (window.MasarFx) window.MasarFx.navStart();
    setNavBanner('loc', t('waitGps'), '');
    if (native) native.setNavigating(true);
    pushCarRoute();
    /* The phone's own GPS keeps running with the screen locked, as it must while driving with Android Auto. */
    if (native && native.startLocation) { native.startLocation(); return; }
    if (!navigator.geolocation) { endNav(); toast(t('locDenied')); return; }
    nav.watch = navigator.geolocation.watchPosition(onFix, onFixError, { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 });
  }

  function stopFollowing() {
    if (!nav) return;
    nav.follow = false;
    $('navCenter').hidden = false;
  }

  function renderNavChrome() {
    nav.left = el('b');
    nav.dist = el('b');
    nav.eta = el('b');
    nav.speed = el('b');
    const mute = el('button', { class: 'round small', 'aria-label': t('voice') });
    const paintMute = () => { mute.innerHTML = icon(store.muted ? 'muted' : 'sound'); mute.setAttribute('aria-pressed', String(!store.muted)); };
    mute.addEventListener('click', () => { store.muted = !store.muted; persist(); paintMute(); });
    paintMute();
    nav.paintMute = paintMute;
    const center = el('button', {
      id: 'navCenter', class: 'btn teal', hidden: '',
      on: () => { nav.follow = true; $('navCenter').hidden = true; map.panTo(nav.car.getLatLng()); },
    }, t('recenter'));
    $('driveBottom').replaceChildren(
      el('div', { class: 'drive-stats' },
        el('div', {}, nav.left, el('small', {}, t('left_label'))),
        el('div', {}, nav.dist, el('small', {}, t('kmLeft'))),
        el('div', {}, nav.eta, el('small', {}, t('arriveAt'))),
        el('div', {}, nav.speed, el('small', {}, t('kmh')))),
      center,
      el('div', { class: 'drive-actions' }, mute, ...(window.MasarFx ? window.MasarFx.driveButtons() : []),
        el('button', { class: 'btn ghost', on: askStopNav }, t('stop'))));
  }

  function setNavBanner(iconName, title, sub) {
    const key = `${iconName}|${title}|${sub}`;
    if (nav.shown === key) return;
    nav.shown = key;
    $('driveTop').replaceChildren(el('div', { class: 'turn', html: icon(iconName) }), el('div', {}, el('b', {}, title), sub));
    /* While there is no usable GPS, the car screen shows the same reason instead of a spinner. */
    if (iconName === 'loc' && native && native.carUpdate) {
      const pos = nav.pos || R.trackPoint(nav.track, 0).pos;
      native.carUpdate(JSON.stringify({
        nav: true, loading: true, msg: title, msgText: sub || '', lat: pos[0], lng: pos[1], bearing: nav.bearing || 0, dest: state.dest.label,
      }));
    }
  }

  /* Android lets people give only an approximate location, which is useless for driving directions. */
  window.masarPreciseNeeded = () => {
    if (!nav) return;
    setNavBanner('loc', t('preciseTitle'), t('preciseText'));
    openModal(el('h2', {}, t('preciseTitle')), el('p', {}, t('preciseText')),
      el('button', { class: 'btn pink', on: () => { closeModal(); native.openAppSettings(); } }, t('openSettings')),
      el('button', { class: 'btn ghost', on: closeModal }, t('cancel')));
  };

  function onFixError(err) {
    if (!nav) return;
    if (err.code === 1) { endNav(); show('route'); computeRoutes(); toast(t('locDenied')); return; }
    setNavBanner('loc', t('waitGps'), t('gpsHint'));
  }

  function onFix(p) {
    if (!nav) return;
    const { latitude: lat, longitude: lng, accuracy, speed, heading } = p.coords;
    nav.speed.textContent = speed === null || Number.isNaN(speed) ? '-' : String(Math.round(speed * 3.6));
    if (window.MasarFx) window.MasarFx.speedTick(speed);
    if (accuracy > WEAK_ACCURACY_M) { setNavBanner('loc', t('weakGps'), t('gpsHint')); return; }
    if (R.nearestNode(lat, lng).meters > R.MAX_SNAP_M) { setNavBanner('loc', t('outsideNav'), ''); moveCar([lat, lng], null); return; }

    const moving = speed !== null && speed > 2;
    const track = nav.track, first = nav.fixes === 0;
    nav.fixes++;
    const reach = Math.max(300, (speed || 0) * 15);
    let hit = first ? R.projectOnTrack(track, lat, lng) : R.projectOnTrack(track, lat, lng, nav.at - 40, nav.at + reach);
    const limit = Math.max(40, Math.min(accuracy, 60) + 15);
    if (hit.dist > limit && !first) {
      const ahead = R.projectOnTrack(track, lat, lng, nav.at);
      if (ahead.dist <= limit) hit = ahead;
    }
    if (hit.dist > limit) {
      nav.off++;
      moveCar([lat, lng], moving ? heading : null);
      const due = Date.now() - nav.lastReroute > REROUTE_GAP_MS;
      if ((first || nav.off >= 3) && due && reroute(lat, lng, moving ? heading : null, first)) return;
      setNavBanner('loc', t('offRoute'), '');
      return;
    }
    nav.off = 0;
    nav.at = Math.max(nav.at, hit.at);
    moveCar(hit.pos, moving && heading !== null ? heading : hit.bearing);
    updateProgress(lat, lng, speed || 0);
    if (nav && window.MasarFx) window.MasarFx.navTick(lat, lng, speed || 0);
  }

  function reroute(lat, lng, heading, quiet) {
    const route = R.routeFromHere(lat, lng, heading, destNode(), store.traffic);
    nav.lastReroute = Date.now();
    if (!route) return false;
    nav.before = (nav.before || 0) + (nav.at || 0); // distance driven on the earlier routes, for "My trips"
    nav.route = route;
    nav.track = R.buildTrack(route.path);
    nav.at = 0;
    nav.off = 0;
    nav.spoken = new Set();
    state.routes = [route];
    state.sel = 0;
    drawRoutes(false);
    pushCarRoute();
    if (!quiet) { toast(t('rerouted')); nav.opening = 'rerouted'; }
    const hit = R.projectOnTrack(nav.track, lat, lng);
    nav.at = hit.at;
    updateProgress(lat, lng, 0);
    return true;
  }

  const destNode = () => R.nearestNode(state.dest.lat, state.dest.lng).node;

  function updateProgress(lat, lng, speed) {
    const { track, route, at } = nav;
    const remaining = track.total - at;
    if (remaining <= ARRIVE_M || R.haversine(lat, lng, state.dest.lat, state.dest.lng) <= ARRIVE_M) {
      speak(t('arriveNow'), ['arrived']);
      endNav(true);
      arrived();
      return;
    }
    const seconds = route.time * (remaining / track.total);
    nav.left.textContent = fmtTime(seconds);
    nav.dist.textContent = fmtDist(remaining);
    nav.eta.textContent = new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const next = track.steps.findIndex((s) => s.start > at);
    if (next < 0) {
      setNavBanner('flag', t('afterDist', fmtDist(remaining)), state.dest.label);
      pushCar({ turn: 'arrive', dist: remaining, street: state.dest.label, cue: state.dest.label, leftM: remaining, leftS: seconds });
      announce('end-far', remaining <= 250,
        () => [t('afterSay', sayDist(remaining), t('arriveSoon')), [distClip(remaining), 'arrive_soon']]);
      return;
    }
    const s = track.steps[next], d = s.start - at;
    setNavBanner(s.turn, stepText(s), t('afterDist', fmtDist(d)));
    pushCar({ turn: s.turn, dist: d, street: s.name < 0 ? '' : streetName(s.name), cue: stepText(s), leftM: remaining, leftS: seconds });
    if (!nav.spoken.has('begin')) {
      nav.spoken.add('begin');
      const opening = nav.opening || 'lets_go';
      speak(`${t(opening === 'rerouted' ? 'rerouted' : 'letsGo')}. ${t('afterSay', sayDist(d), sayTurn(s))}`,
        [opening, distClip(d), turnClip(s)]);
      if (d <= 350) nav.spoken.add(`far${next}`);
      return;
    }
    announce(`far${next}`, d <= 350 && d > 120, () => [t('afterSay', sayDist(d), sayTurn(s)), [distClip(d), turnClip(s)]]);
    announce(`now${next}`, d <= Math.max(50, speed * 6), () => [sayTurn(s), [turnClip(s)]]);
  }

  function announce(key, due, say) {
    if (!due || nav.spoken.has(key)) return;
    nav.spoken.add(key);
    speak(...say());
  }

  /* GPS gives about one fix a second: glide between them so the car doesn't jump. */
  function moveCar(to, bearing) {
    cancelAnimationFrame(nav.raf);
    nav.pos = to;
    if (bearing !== null && bearing !== undefined && !Number.isNaN(bearing)) nav.bearing = bearing;
    const from = nav.car.getLatLng(), began = performance.now();
    const node = nav.car.getElement() && nav.car.getElement().firstChild;
    if (node && bearing !== null && bearing !== undefined && !Number.isNaN(bearing)) node.style.transform = `rotate(${bearing}deg)`;
    const step = (now) => {
      if (!nav) return;
      const f = Math.min((now - began) / 900, 1);
      const pos = [from.lat + (to[0] - from.lat) * f, from.lng + (to[1] - from.lng) * f];
      nav.car.setLatLng(pos);
      if (nav.follow && (f === 1 || now - nav.lastPan > PAN_EVERY_MS)) {
        nav.lastPan = now;
        map.panTo(pos, { animate: false });
      }
      if (f < 1) nav.raf = requestAnimationFrame(step);
    };
    nav.raf = requestAnimationFrame(step);
  }

  /* "My trips": every finished drive, and stopped ones after a few hundred meters. */
  function recordTrip(done) {
    const driven = (nav.before || 0) + (done ? nav.route.distance : Math.min(nav.at || 0, nav.route.distance));
    if (!done && driven < 300) return;
    store.trips.unshift({
      t: nav.startedAt, from: nav.startLabel, to: state.dest.label, lat: state.dest.lat, lng: state.dest.lng,
      m: Math.round(driven), s: Math.round((Date.now() - nav.startedAt) / 1000), done: !!done,
    });
    store.trips = store.trips.slice(0, 100);
    persist();
  }

  function endNav(done) {
    if (!nav) return;
    try { recordTrip(done); } catch (e) { /* a trip that cannot be recorded never stops navigation */ }
    try { if (window.MasarFx) window.MasarFx.navEnd(done, nav.pos); } catch (e) { /* extras never block stopping */ }
    if (nav.watch !== null) navigator.geolocation.clearWatch(nav.watch);
    if (native && native.stopLocation) native.stopLocation();
    if (native && native.carUpdate) native.carUpdate('{"nav":false}');
    cancelAnimationFrame(nav.raf);
    nav.car.remove();
    map.off('dragstart', stopFollowing);
    if (native) native.setNavigating(false);
    nav = null;
  }

  /* Android Auto: the car screen draws what the phone is doing, so every change is passed on. */
  function pushCar(step) {
    if (!nav || !native || !native.carUpdate) return;
    const pos = nav.pos || R.trackPoint(nav.track, 0).pos;
    native.carUpdate(JSON.stringify({
      nav: true, loading: !step, lat: pos[0], lng: pos[1], bearing: nav.bearing || 0, dest: state.dest.label,
      ...(step && { ...step, eta: Date.now() + step.leftS * 1000 }),
    }));
  }

  function pushCarRoute() {
    if (!nav || !native || !native.carRoute) return;
    const edges = nav.route.path.map((e) => [R.band(R.ratio(e, store.traffic)), ...R.edgeLatLngs(e).flat()]);
    native.carRoute(JSON.stringify({ edges, dest: [state.dest.lat, state.dest.lng] }));
  }

  window.masarFix = (lat, lng, accuracy, speed, heading) => onFix({ coords: { latitude: lat, longitude: lng, accuracy, speed, heading } });
  window.masarFixError = (code) => onFixError({ code });
  window.masarCarStop = () => { if (nav) { endNav(); show('route'); computeRoutes(); } };
  window.masarCarMute = (muted) => { store.muted = muted; persist(); if (nav && nav.paintMute) nav.paintMute(); };

  function askStopNav() {
    openModal(el('h2', {}, t('stopAsk')),
      el('button', { class: 'btn pink', on: () => { closeModal(); endNav(); show('route'); computeRoutes(); } }, t('stop')),
      el('button', { class: 'btn ghost', on: closeModal }, t('keepGoing')));
  }

  function arrived() {
    state.driveRaf = 0;
    const colors = ['#ff3d8b', '#ffd21f', '#19d3b4', '#5cc8ff', '#ff8a3c'];
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < 36; i++) {
        const c = el('div', { class: 'confetti' });
        c.style.left = `${Math.random() * 100}%`;
        c.style.background = colors[i % colors.length];
        c.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
        c.style.animationDelay = `${Math.random() * 0.5}s`;
        document.body.append(c);
        c.addEventListener('animationend', () => c.remove());
      }
    }
    const done = () => { closeModal(); state.dest = null; renderHome(); show('home'); };
    openModal(el('div', { class: 'celebrate' }, el('div', { class: 'big' }, t('arrive')), el('p', {}, t('arrivedAt', state.dest.label)),
      window.MasarFx ? window.MasarFx.arrivalExtra() : ''),
      el('button', { class: 'btn yellow', on: done }, t('again')));
  }

  /* -------------------------------------------------- back button (the Android activity calls this) */
  function goBack() {
    if (!$('modal').hidden) { closeModal(); return true; }
    const screen = document.body.dataset.screen;
    if (!$('splash').classList.contains('gone')) { endSplash(); return true; }
    if (screen === 'pages') { window.MasarPages.back(); return true; }
    if (screen === 'explore') { renderHome(); show('home'); return true; }
    if (screen === 'drive') { askStopNav(); return true; }
    if (screen === 'route') { state.dest = null; renderHome(); show('home'); return true; }
    if (screen === 'picker') {
      const target = state.picker ? state.picker.back : 'home';
      state.picker = null;
      state.savedBack = null;
      if (target === 'route' && state.routes.length) { show('route'); renderRoute(true); } else if (target === 'pages') { window.MasarPages.refresh(); show('pages'); } else if (target === 'explore') window.MasarFx.openExplore();
      else { renderHome(); show('home'); }
      return true;
    }
    if (screen === 'home' && state.query) { state.query = ''; renderHome(); return true; }
    if (screen === 'home' && window.MasarPlus) { window.MasarPlus.openHello(); return true; }
    return false;
  }
  window.masarBack = goBack;
  document.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', goBack));

  /* What the extra pages (pages.js: account, settings, trips, about, privacy) use from here. */
  window.MasarApp = {
    STRINGS, ICONS, store, persist, t, el, icon, show, toast, openModal, closeModal, renderHome, renderWelcome,
    applyTheme, setLang, logoFile, goTo, fmtTime, fmtDist, native: () => native,
    state, norm, pname, streetName, savedLabel, savedIcon, poiKind, POIS, POI_KIND, locate, openPicker, MANARA,
    setSavedLocation, editSaved, addPlace, saveSaved, iconPicker, refreshView, theme,
    map: () => map, nav: () => nav, speakText: (text) => speak(text), clearRoute: () => { if (routeLayer) routeLayer.clearLayers(); },
    focusSearch: () => { state.focusSearch = true; state.query = ''; renderHome(); show('home'); },
    searchItems, askStopNav,
    stopNav: () => { if (nav) { endNav(); state.dest = null; routeLayer.clearLayers(); renderHome(); show('home'); } },
    setMuted: (muted) => { store.muted = muted; persist(); if (nav && nav.paintMute) nav.paintMute(); },
  };

  /* -------------------------------------------------- start */
  applyLang();
  applyTheme();
  $('splash').addEventListener('click', endSplash);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* The intro starts once loading is over, so a slow phone still sees all of it. */
  setTimeout(() => {
    $('splash').classList.add('run');
    if (!reduced) try { $('splashDrive').beginElement(); } catch (e) { /* no SMIL: the car stays hidden */ }
    setTimeout(endSplash, reduced ? 1000 : SPLASH_MS);
  }, 0);
})();
