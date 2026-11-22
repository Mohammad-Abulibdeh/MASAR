/* MASAR extras: menu bar, live map, nearby, my places, driver reports (Firebase), road alerts,
   share arrival time, where I parked, car colour, points and levels. Loaded after app.js and pages.js. */
(function () {
  const A = window.MasarApp, P = window.MasarPages, R = window.MasarRouter;
  const { store, persist, t, el, icon, show, toast, openModal, closeModal } = A;
  const $ = (id) => document.getElementById(id);

  if (!Array.isArray(store.myPois)) store.myPois = [];
  if (store.avoidReports === undefined) store.avoidReports = true;
  if (!store.carColor) store.carColor = 'yellow';
  if (!store.voted || typeof store.voted !== 'object') store.voted = {};

  Object.assign(A.STRINGS.ar, {
    tabHome: 'الرئيسية', tabMap: 'الخريطة', tabNearby: 'قريب مني', tabPlaces: 'أماكني', tabAccount: 'حسابي',
    places: 'أماكني', nearby: 'قريب مني', addedByYou: 'ضفته إنت',
    exploreSearch: 'وين بدك تروح؟', exploreHint: 'اضغط مطوّل على أي مكان بالخريطة لخيارات أكثر', myLocation: 'وين أنا',
    report: 'بلّغ', reportTitle: 'شو شايف على الطريق؟', reportSent: 'وصل بلاغك، شكرا! +30 نقطة', reportFail: 'ما قدرنا نبعث البلاغ. تأكد من الإنترنت.',
    needSignIn: 'سجّل دخول حتى تبلّغ', needSignInText: 'البلاغات بتطلع لكل السواقين، فلازم تكون داخل بحساب حتى ما يصير تخريب.', goSignIn: 'سجّل دخول',
    k_traffic: 'زحمة', k_accident: 'حادث', k_hazard: 'خطر على الطريق', k_police: 'شرطة', k_checkpoint: 'حاجز', k_closed: 'طريق مسكّر',
    stillThere: 'لسا موجود', notThere: 'مش موجود', stillAsk: 'لسا في {0}؟', thanksVote: 'شكرا! +5 نقاط', deleteReport: 'احذف بلاغي', yourReport: 'هاد بلاغك',
    agoNow: 'هلأ', agoMin: 'من {0} د', agoHour: 'من {0} ساعة', votes: '{0} قالوا لسا موجود · {1} قالوا لا',
    aheadAlert: '{0} بعد {1}', reportsOnRoute: 'على هالطريق: {0}', blockedWarn: 'هالطريق بيمر من مكان مبلّغ إنه مسكّر. ما في طريق تاني.',
    avoided: 'مسار تجنّب {0} مبلّغ عنها', reportsNow: '{0} بلاغ على الطرق هلأ', close: 'سكّر',
    spotGo: 'وصّلني لهون', spotReport: 'بلّغ عن إشي هون', spotSave: 'احفظه بأماكني', spotMissing: 'ضيف مكان ناقص هون', spotShare: 'شارك هالموقع',
    missingTitle: 'ضيف مكان ناقص', missingWhat: 'شو نوعه؟', missingNote: 'المكان بينحفظ عندك وبحسابك، وبصير يطلع بالبحث. حتى يشوفه الكل، ضيفه كمان على openstreetmap.org.',
    missingSaved: 'انضاف المكان، وصار يطلع بالبحث', pickMissing: 'حرّك الخريطة لمكانه', missingList: 'أماكن ضفتها للخريطة', addMissing: 'ضيف مكان ناقص',
    notSet: 'لسا مش محدد',moveUp: 'لفوق', moveDown: 'لتحت',
    parkedTitle: 'وين صفّيت', parkedAt: 'سيارتك صافّة {0}', parkedAgo: 'صفّيت {0}', showMap: 'شوف على الخريطة', forgetParked: 'انسى المكان',
    nearCats: 'شو بدك؟', nearIn: 'الأقرب إلك', nearApprox: 'ما عرفنا موقعك، فهاي الأقرب لدوار المنارة.', nearNone: 'ما لقينا إشي من هالنوع قريب.', straightLine: 'بخط مستقيم',
    c_fuel: 'بنزين', c_pharmacy: 'صيدلية', c_health: 'مستشفى وعيادة', c_food: 'أكل', c_coffee: 'قهوة', c_bank: 'بنك وصرافة', c_worship: 'مسجد وكنيسة',
    c_parking: 'موقف', c_wash: 'غسيل سيارات', c_hotel: 'فندق', c_police: 'شرطة', c_school: 'مدارس', c_shop: 'محلات',
    shareEta: 'شارك وقت وصولك', etaText: 'أنا بالطريق على {0}، بوصل تقريبا الساعة {1} (بعد {2}). من تطبيق مسار', shareSpotText: '{0}: {1}', copied: 'انسخ النص',
    carLook: 'لون سيارتك على الخريطة', avoidRep: 'تجنّب الطرق المسكّرة والحواجز المبلّغ عنها',
    points: 'نقطة', levelOf: 'المستوى {0}', toNext: 'باقي {0} نقطة للمستوى الجاي', topLevel: 'وصلت لأعلى مستوى!', earn: 'بتكسب نقاط من كل كيلومتر، وكل وصول، وكل بلاغ بيساعد غيرك.',
    earned: '+{0} نقطة', levelUp: 'طلعت مستوى! صرت {0}',
    lv1: 'مبتدئ', lv2: 'سوّاق جديد', lv3: 'سوّاق شاطر', lv4: 'معلّم طريق', lv5: 'خبير الطرق', lv6: 'أسطورة مسار',
    musicConnect: 'وصّل موسيقاك (Spotify، أنغامي...)', musicHint: 'فعّل «مسار» بالقائمة اللي رح تفتح، وارجع. مسار بيشوف بس شو الأغنية اللي شغّالة.',
    musicPrev: 'الأغنية اللي قبل', musicNext: 'الأغنية الجاي', musicToggle: 'شغّل / وقّف', musicOff: 'بلاش',
    speedAlert: 'نبّهني إذا سرعتي أكثر من', slowDown: 'خفّف! إنت أسرع من {0}', sharedOutside: 'هاد المكان برا المنطقة اللي بنغطيها (محافظة رام الله والبيرة)',
    sharedSwitch: 'تروح لـ {0}؟', sharedSwitchText: 'هاد المكان انبعتلك. إذا بدك، بنوقف الرحلة الحالية وبنروح عليه.', sharedGo: 'آه، روح عليه',
    col_yellow: 'أصفر', col_pink: 'زهري', col_teal: 'فيروزي', col_sky: 'سماوي', col_orange: 'برتقالي', col_lilac: 'بنفسجي',
  });
  Object.assign(A.STRINGS.en, {
    tabHome: 'Home', tabMap: 'Map', tabNearby: 'Nearby', tabPlaces: 'My places', tabAccount: 'Me',
    places: 'My places', nearby: 'Nearby', addedByYou: 'added by you',
    exploreSearch: 'Where to?', exploreHint: 'Long-press anywhere on the map for more options', myLocation: 'Where am I',
    report: 'Report', reportTitle: 'What do you see on the road?', reportSent: 'Report sent, thank you! +30 points', reportFail: "Couldn't send the report. Check your internet.",
    needSignIn: 'Sign in to report', needSignInText: 'Every driver sees reports, so you need an account to keep them trustworthy.', goSignIn: 'Sign in',
    k_traffic: 'Traffic', k_accident: 'Accident', k_hazard: 'Hazard', k_police: 'Police', k_checkpoint: 'Checkpoint', k_closed: 'Road closed',
    stillThere: 'Still there', notThere: 'Not there', stillAsk: 'Is the {0} still there?', thanksVote: 'Thanks! +5 points', deleteReport: 'Delete my report', yourReport: 'Your report',
    agoNow: 'just now', agoMin: '{0} min ago', agoHour: '{0} h ago', votes: '{0} said still there · {1} said no',
    aheadAlert: '{0} in {1}', reportsOnRoute: 'On this route: {0}', blockedWarn: 'This route passes a spot reported closed. There is no other way.',
    avoided: 'MASAR avoided {0} reported', reportsNow: '{0} road reports right now', close: 'Close',
    spotGo: 'Take me here', spotReport: 'Report something here', spotSave: 'Save to my places', spotMissing: 'Add a missing place here', spotShare: 'Share this spot',
    missingTitle: 'Add a missing place', missingWhat: 'What is it?', missingNote: 'It is kept on your phone and in your account, and shows up in search. For everyone to see it, add it on openstreetmap.org too.',
    missingSaved: 'Place added. It now shows up in search', pickMissing: 'Move the map to where it is', missingList: 'Places you added to the map', addMissing: 'Add a missing place',
    notSet: 'Not set yet',moveUp: 'Up', moveDown: 'Down',
    parkedTitle: 'Where I parked', parkedAt: 'Your car is parked {0}', parkedAgo: 'Parked {0}', showMap: 'Show on the map', forgetParked: 'Forget it',
    nearCats: 'What do you need?', nearIn: 'Closest to you', nearApprox: "We couldn't find you, so these are closest to Al Manara.", nearNone: 'Nothing of this kind close by.', straightLine: 'as the crow flies',
    c_fuel: 'Fuel', c_pharmacy: 'Pharmacy', c_health: 'Hospital & clinic', c_food: 'Food', c_coffee: 'Coffee', c_bank: 'Bank & exchange', c_worship: 'Mosque & church',
    c_parking: 'Parking', c_wash: 'Car wash', c_hotel: 'Hotel', c_police: 'Police', c_school: 'Schools', c_shop: 'Shops',
    shareEta: 'Share arrival time', etaText: "I'm on my way to {0}, arriving around {1} (in {2}). Sent from MASAR", shareSpotText: '{0}: {1}', copied: 'Text copied',
    carLook: 'Your car colour on the map', avoidRep: 'Avoid reported closures and checkpoints',
    points: 'points', levelOf: 'Level {0}', toNext: '{0} points to the next level', topLevel: 'You reached the top level!', earn: 'You earn points for every km, every arrival, and every report that helps others.',
    earned: '+{0} points', levelUp: 'Level up! You are now {0}',
    lv1: 'Beginner', lv2: 'New driver', lv3: 'Good driver', lv4: 'Road master', lv5: 'Road expert', lv6: 'MASAR legend',
    musicConnect: 'Connect your music (Spotify, Anghami...)', musicHint: 'Turn on "MASAR" in the list that opens, then come back. MASAR only sees which song is playing.',
    musicPrev: 'Previous song', musicNext: 'Next song', musicToggle: 'Play / pause', musicOff: 'No thanks',
    speedAlert: 'Warn me when I drive faster than', slowDown: 'Slow down! You are over {0}', sharedOutside: 'This place is outside the area we cover (Ramallah and Al-Bireh Governorate)',
    sharedSwitch: 'Go to {0}?', sharedSwitchText: 'Someone sent you this place. If you want, we stop the current trip and go there.', sharedGo: 'Yes, go there',
    col_yellow: 'Yellow', col_pink: 'Pink', col_teal: 'Teal', col_sky: 'Sky', col_orange: 'Orange', col_lilac: 'Lilac',
  });
  Object.assign(A.ICONS, {
    compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    report: '<path d="M4 5h16v11H9l-5 4zM12 8v3.5M12 13.8v.2"/>',
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>',
    jam: '<rect x="2.5" y="10" width="8.5" height="6" rx="2"/><rect x="13" y="10" width="8.5" height="6" rx="2"/><path d="M5 16v2M8.5 16v2M15.5 16v2M19 16v2M4 10l1.5-3h3L10 10M14.5 10l1.5-3h3L20.5 10"/>',
    crash: '<path d="M12 2.5l2 5 5-2-2 5 5 1.5-5 2.5 2 5-5-2-2 5-2-5-5 2 2-5-5-2.5 5-1.5-2-5 5 2z"/>',
    hazard: '<path d="M12 3L2 20h20zM12 10v4.5M12 17.2v.3"/>',
    police: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M12 8l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 14l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z"/>',
    barrier: '<rect x="2" y="8" width="20" height="5" rx="1.5"/><path d="M6.5 8l-3 5M11.5 8l-3 5M16.5 8l-3 5M21 9l-2.3 4M5 13v8M19 13v8"/>',
    noentry: '<circle cx="12" cy="12" r="9"/><path d="M7 12h10"/>',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/>',
    family: '<circle cx="8" cy="7" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M2.5 20a5.5 5.5 0 0 1 11 0M13 20a4 4 0 0 1 8 0"/>',
    school: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 19V5M8 7h7M8 11h5"/>',
    gym: '<path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"/>',
    food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 4 3 4v8"/>',
    coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>',
    shop: '<path d="M4 9l1.5-5h13L20 9M4 9h16v11H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M10 20v-5h4v5"/>',
    health: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>',
    mosque: '<path d="M4 21v-9a8 8 0 0 1 16 0v9zM12 4V2M9 21v-4a3 3 0 0 1 6 0v4M2 21h20"/>',
    fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 7h5v4H7zM15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3"/>',
    pill: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7zM7 7l7 7"/>',
    bank: '<path d="M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18"/>',
    parking: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
    hotel: '<path d="M3 20V6M3 14h18v6M3 10h7v4M21 14a4 4 0 0 0-4-4h-7"/>',
    wash: '<path d="M5 15l2-5h10l2 5v4H5zM5 19v2M19 19v2M8.5 3.5c0 1 1 2 1 3a1 1 0 0 1-2 0c0-1 1-2 1-3zM14.5 3.5c0 1 1 2 1 3a1 1 0 0 1-2 0c0-1 1-2 1-3z"/>',
    car: '<path d="M4 16l1.5-5.5A2 2 0 0 1 7.4 9h9.2a2 2 0 0 1 1.9 1.5L20 16v4h-3v-2H7v2H4zM4 16h16M7.5 13.5h.5M16 13.5h.5"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4.5a3.5 3.5 0 0 0 3.8 4M16 6h3.5a3.5 3.5 0 0 1-3.8 4M12 13v4M9 21h6M10 17h4v4h-4z"/>',
    ok: '<path d="M5 12.5l4.5 4.5L19 7"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    music: '<circle cx="7" cy="17.5" r="3"/><circle cx="17" cy="15.5" r="3"/><path d="M10 17.5V5l10-2v12.5"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>', pause: '<path d="M8 5v14M16 5v14"/>',
    next: '<path d="M5 5l10 7-10 7zM19 5v14"/>', prev: '<path d="M19 5L9 12l10 7zM5 5v14"/>',
    speed: '<path d="M4 17a8 8 0 1 1 16 0M12 17l4-5"/>',
  });

  const native = () => A.native();
  const hasCloud = () => P.cloud.on();
  const ago = (ms) => {
    const m = Math.round((Date.now() - ms) / 60000);
    return m < 1 ? t('agoNow') : m < 60 ? t('agoMin', m) : t('agoHour', Math.round(m / 60));
  };
  const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const buzz = (ms) => { const n = native(); if (n && n.buzz) n.buzz(ms); else if (navigator.vibrate) navigator.vibrate(ms); };

  function share(text) {
    const n = native();
    if (n && n.share) { n.share(text); return; }
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(t('copied')), () => toast(text));
    else toast(text);
  }

  /* -------------------------------------------------- car colour */
  const CAR_COLORS = { yellow: '#ffd21f', pink: '#ff3d8b', teal: '#19d3b4', sky: '#5cc8ff', orange: '#ff8a3c', lilac: '#c9a6ff' };
  const paintCar = () => document.documentElement.style.setProperty('--car', CAR_COLORS[store.carColor] || CAR_COLORS.yellow);
  paintCar();

  /* -------------------------------------------------- points and levels */
  const LEVELS = [0, 300, 1000, 3000, 8000, 20000];
  const tripPoints = (x) => Math.round(x.m / 100) + (x.done ? 20 : 0);
  const points = () => store.trips.reduce((a, x) => a + tripPoints(x), 0) + (store.reportsMade || 0) * 30 + (store.votesMade || 0) * 5;
  const levelOf = (p) => LEVELS.reduce((lv, min, i) => (p >= min ? i : lv), 0);

  function levelCard() {
    const p = points(), lv = levelOf(p), next = LEVELS[lv + 1];
    const frac = next ? (p - LEVELS[lv]) / (next - LEVELS[lv]) : 1;
    const bar = el('div', { class: 'xp' }, el('i'));
    requestAnimationFrame(() => requestAnimationFrame(() => { bar.firstChild.style.width = `${Math.round(frac * 100)}%`; }));
    return el('section', { class: 'card sticker level' },
      el('div', { class: 'level-top' }, el('span', { class: 'trophy', html: icon('trophy') }),
        el('div', {}, el('b', {}, t(`lv${lv + 1}`)), el('small', {}, `${t('levelOf', lv + 1)} · ${p} ${t('points')}`))),
      bar,
      el('small', { class: 'hint' }, next ? t('toNext', next - p) : t('topLevel')),
      el('small', { class: 'hint' }, t('earn')));
  }

  /* -------------------------------------------------- menu bar */
  const TABS = [['home', 'home', 'tabHome'], ['explore', 'map', 'tabMap'], ['nearby', 'compass', 'tabNearby'], ['places', 'star', 'tabPlaces'], ['account', 'user', 'tabAccount']];

  function goTab(name) {
    if (name === 'home') { A.state.query = ''; A.renderHome(); show('home'); $('home').scrollTop = 0; } else if (name === 'explore') openExplore();
    else { P.open(name, true); if (name === 'nearby') wantHere(); }
  }

  function renderTabs(active) {
    $('tabs').replaceChildren(...TABS.map(([name, ic, label]) => el('button', {
      class: 'tab', 'aria-current': active === name ? 'page' : null, on: () => goTab(name), html: icon(ic),
    }, el('span', {}, t(label)))));
  }

  function onShow(screen) {
    const root = screen === 'pages' ? P.root() : null;
    const active = screen === 'home' ? 'home' : screen === 'explore' ? 'explore' : TABS.some((x) => x[0] === root) ? root : screen === 'pages' ? 'account' : null;
    renderTabs(active);
    if (screen !== 'explore' && spotMarker) { spotMarker.remove(); spotMarker = null; }
  }

  /* -------------------------------------------------- driver reports (Firestore "reports", see FIREBASE_SETUP.md) */
  const KINDS = {
    traffic: { icon: 'jam', hex: '#ff8a3c', life: 60 },
    accident: { icon: 'crash', hex: '#ff3d8b', life: 120 },
    hazard: { icon: 'hazard', hex: '#ffd21f', life: 240 },
    police: { icon: 'police', hex: '#5cc8ff', life: 60 },
    checkpoint: { icon: 'barrier', hex: '#c9a6ff', life: 180 },
    closed: { icon: 'noentry', hex: '#ff2d55', life: 360 },
  };
  const AVOID_FACTOR = { closed: 80, checkpoint: 6, accident: 1.6, traffic: 1.5 };
  let reports = [], lastFetch = 0, fetching = null;
  const docs = () => `https://firestore.googleapis.com/v1/projects/${P.cloud.projectId()}/databases/(default)/documents`;
  const kindName = (k) => t(`k_${k}`);
  const active = () => reports.filter((r) => KINDS[r.kind] && Date.now() - r.t < KINDS[r.kind].life * 60000 && r.down < r.up + 2);

  function parseReport(d) {
    const f = d.fields || {}, num = (v) => (v ? Number(v.doubleValue ?? v.integerValue ?? 0) : 0);
    return {
      id: d.name.split('/').pop(), kind: f.kind && f.kind.stringValue, lat: num(f.lat), lng: num(f.lng), t: num(f.t),
      uid: f.uid && f.uid.stringValue, up: num(f.up), down: num(f.down),
    };
  }

  function fetchReports(timeoutMs = 6000) {
    if (!hasCloud()) return Promise.resolve(reports);
    if (fetching) return fetching;
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    const since = Date.now() - 6 * 3600 * 1000;
    fetching = fetch(`${docs()}:runQuery`, {
      method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ structuredQuery: {
        from: [{ collectionId: 'reports' }],
        where: { fieldFilter: { field: { fieldPath: 't' }, op: 'GREATER_THAN', value: { integerValue: String(since) } } },
        orderBy: [{ field: { fieldPath: 't' }, direction: 'DESCENDING' }], limit: 300,
      } }),
    }).then((r) => (r.ok ? r.json() : [])).then((rows) => {
      const old = new Map(reports.map((x) => [x.id, x]));
      reports = (Array.isArray(rows) ? rows : []).filter((x) => x.document).map((x) => {
        const r = parseReport(x.document), prev = old.get(r.id);
        if (prev && prev.edges) r.edges = prev.edges;
        return r;
      });
      lastFetch = Date.now();
      drawReports();
      return reports;
    }).catch(() => reports).finally(() => { clearTimeout(timer); fetching = null; });
    return fetching;
  }

  async function authed(url, opts = {}) {
    const tk = await P.cloud.token();
    const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    return r.status === 204 ? {} : r.json().catch(() => ({}));
  }

  async function createReport(kind, lat, lng) {
    const d = await authed(`${docs()}/reports`, {
      method: 'POST',
      body: JSON.stringify({ fields: {
        kind: { stringValue: kind }, lat: { doubleValue: lat }, lng: { doubleValue: lng }, t: { integerValue: String(Date.now()) },
        uid: { stringValue: P.cloud.uid() }, up: { integerValue: '0' }, down: { integerValue: '0' },
      } }),
    });
    reports.unshift(parseReport(d));
    store.reportsMade = (store.reportsMade || 0) + 1;
    store.voted[reports[0].id] = 1;
    persist();
    drawReports();
  }

  async function vote(r, still) {
    const field = still ? 'up' : 'down';
    await authed(`${docs()}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: [{
        transform: { document: `projects/${P.cloud.projectId()}/databases/(default)/documents/reports/${r.id}`, fieldTransforms: [{ fieldPath: field, increment: { integerValue: '1' } }] },
        currentDocument: { exists: true },
      }] }),
    });
    r[field]++;
    store.voted[r.id] = 1;
    const keep = Object.keys(store.voted).slice(-300);
    store.voted = Object.fromEntries(keep.map((k) => [k, 1]));
    store.votesMade = (store.votesMade || 0) + 1;
    persist();
    drawReports();
    toast(t('thanksVote'));
  }

  async function deleteReport(r) {
    await authed(`${docs()}/reports/${r.id}`, { method: 'DELETE' });
    reports = reports.filter((x) => x !== r);
    drawReports();
  }

  /* Reported closures and checkpoints make the roads under them cost more, so routes go around them. */
  function applyAvoid() {
    if (store.avoidReports === false) { R.setAvoid(null); return; }
    const m = new Map();
    active().forEach((r) => {
      const f = AVOID_FACTOR[r.kind];
      if (!f) return;
      if (!r.edges) r.edges = R.edgesNear(r.lat, r.lng, 35);
      r.edges.forEach((e) => m.set(e, Math.max(m.get(e) || 1, f)));
    });
    R.setAvoid(m);
  }

  async function prepareRoute() {
    if (hasCloud() && Date.now() - lastFetch > 90000) await fetchReports(3500);
    applyAvoid();
  }

  function routeNote(route) {
    const list = active();
    if (!list.length || !route) return '';
    const onPath = new Set(route.path);
    const hits = list.filter((r) => {
      if (!r.edges) r.edges = R.edgesNear(r.lat, r.lng, 35);
      return r.edges.some((e) => onPath.has(e));
    });
    if (!hits.length) return '';
    const kinds = [...new Set(hits.map((r) => r.kind))];
    return el('div', { class: `route-reports ${route.blocked ? 'warn' : ''}` },
      el('div', { class: 'rep-icons' }, kinds.map((k) => el('span', { class: 'rep mini', style: `--c:${KINDS[k].hex}`, html: icon(KINDS[k].icon) }))),
      el('span', {}, route.blocked ? t('blockedWarn') : t('reportsOnRoute', kinds.map(kindName).join('، '))));
  }

  /* -------------------------------------------------- map layers: reports, me, where I parked */
  let map = null, reportLayer = null, meMarker = null, parkMarker = null, spotMarker = null, here = null;

  function onMap(m) {
    map = m;
    reportLayer = L.layerGroup().addTo(map);
    map.on('contextmenu', (e) => { if (document.body.dataset.screen === 'explore') spotMenu(e.latlng); });
    drawReports();
  }

  function drawReports() {
    if (!reportLayer) return;
    reportLayer.clearLayers();
    active().forEach((r) => {
      const k = KINDS[r.kind];
      L.marker([r.lat, r.lng], {
        zIndexOffset: 500, keyboard: false,
        icon: L.divIcon({ className: 'rep-wrap', html: `<div class="rep" style="--c:${k.hex}">${icon(k.icon)}</div>`, iconSize: [40, 40], iconAnchor: [20, 20] }),
      }).on('click', () => reportInfo(r)).addTo(reportLayer);
    });
  }

  function drawMe() {
    if (!map || !here) return;
    if (!meMarker) {
      meMarker = L.marker([here.lat, here.lng], { interactive: false, keyboard: false, zIndexOffset: 900, icon: L.divIcon({ className: 'me-dot', iconSize: [22, 22] }) }).addTo(map);
    } else meMarker.setLatLng([here.lat, here.lng]);
  }

  function drawParked() {
    if (!map) return;
    if (parkMarker) { parkMarker.remove(); parkMarker = null; }
    if (!store.parked) return;
    parkMarker = L.marker([store.parked.lat, store.parked.lng], {
      keyboard: false, zIndexOffset: 800, icon: L.divIcon({ className: 'park-wrap', html: `<div class="park">${icon('parking')}</div>`, iconSize: [42, 42], iconAnchor: [21, 21] }),
    }).on('click', parkedInfo).addTo(map);
  }

  /* -------------------------------------------------- live map tab */
  function openExplore(opts = {}) {
    A.clearRoute();
    show('explore');
    if (!map) return;
    drawParked();
    const center = opts.center || (here ? [here.lat, here.lng] : [A.MANARA.lat, A.MANARA.lng]);
    map.setView(center, opts.zoom || 15, { animate: false });
    fetchReports();
    if (!opts.center) locateMe(false);
    if (!store.seenExploreHint) {
      store.seenExploreHint = true;
      persist();
      setTimeout(() => toast(t('exploreHint')), 600);
    }
  }

  async function locateMe(fresh) {
    const btn = $('exploreLocate');
    btn.classList.add('busy');
    const h = await A.locate(fresh);
    btn.classList.remove('busy');
    if (!h) { if (fresh) toast(t('locFail')); return; }
    here = { ...h, at: Date.now() };
    drawMe();
    if (document.body.dataset.screen === 'explore') map.setView([h.lat, h.lng], Math.max(map.getZoom(), 15));
  }

  function spotLabel(lat, lng) {
    const near = R.nearestNode(lat, lng);
    return near.meters <= R.MAX_SNAP_M ? t('nearStreet', A.streetName(R.nearestStreet(lat, lng))) : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  function spotMenu(ll) {
    const lat = ll.lat, lng = ll.lng, label = spotLabel(lat, lng), inside = R.nearestNode(lat, lng).meters <= R.MAX_SNAP_M;
    if (spotMarker) spotMarker.remove();
    spotMarker = L.marker([lat, lng], { interactive: false, icon: L.divIcon({ className: 'pin-wrap', html: '<div class="pin end drop"></div>', iconSize: [38, 50], iconAnchor: [19, 49] }) }).addTo(map);
    buzz(30);
    const item = (ic, label2, fn, cls = 'ghost') => el('button', { class: `btn ${cls}`, html: icon(ic), on: () => { closeModal(); fn(); } }, label2);
    openModal(el('h2', {}, label),
      inside ? item('flag', t('spotGo'), () => A.goTo({ label, lat, lng }), 'pink') : el('p', { class: 'hint' }, t('tooFar')),
      item('report', t('spotReport'), () => openReport({ lat, lng }), 'yellow'),
      inside ? item('star', t('spotSave'), () => { A.state.savedBack = 'explore'; A.addPlace({ lat, lng, label }); }, 'teal') : '',
      item('plus', t('spotMissing'), () => askMissing({ lat, lng }, 'explore')),
      item('share', t('spotShare'), () => share(t('shareSpotText', label, `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lng.toFixed(6)}#map=18/${lat.toFixed(6)}/${lng.toFixed(6)}`))));
  }

  /* -------------------------------------------------- report: pick a kind */
  function needSignIn() {
    openModal(el('h2', {}, t('needSignIn')), el('p', {}, t('needSignInText')),
      el('button', { class: 'btn pink', html: icon('user'), on: () => { closeModal(); P.open('account', true); } }, t('goSignIn')),
      el('button', { class: 'btn ghost', on: closeModal }, t('cancel')));
  }

  async function openReport(at) {
    if (!hasCloud() || !P.cloud.signedIn()) { needSignIn(); return; }
    let spot = at;
    if (!spot) {
      const nav = A.nav();
      if (nav && nav.pos) spot = { lat: nav.pos[0], lng: nav.pos[1] };
      else if (here && Date.now() - here.at < 120000) spot = here;
      else if (map && document.body.dataset.screen === 'explore') { const c = map.getCenter(); spot = { lat: c.lat, lng: c.lng }; }
    }
    if (!spot) { toast(t('locating')); const h = await A.locate(true); if (!h) { toast(t('locFail')); return; } spot = h; }
    const pick = async (kind, b) => {
      b.disabled = true;
      try { await createReport(kind, spot.lat, spot.lng); closeModal(); toast(t('reportSent')); buzz(40); } catch (e) { b.disabled = false; toast(t('reportFail')); }
    };
    const grid = el('div', { class: 'report-grid' }, Object.keys(KINDS).map((k) => {
      const b = el('button', { class: 'rep-pick', style: `--c:${KINDS[k].hex}` }, el('span', { class: 'rep', html: icon(KINDS[k].icon) }), el('b', {}, kindName(k)));
      b.addEventListener('click', () => pick(k, b));
      return b;
    }));
    openModal(el('h2', {}, t('reportTitle')), grid, el('button', { class: 'btn ghost', on: closeModal }, t('cancel')));
  }

  function reportInfo(r) {
    const k = KINDS[r.kind], mine = r.uid && r.uid === P.cloud.uid(), canVote = P.cloud.signedIn() && !mine && !store.voted[r.id];
    const act = (label, cls, fn, ic) => el('button', {
      class: `btn ${cls}`, html: ic ? icon(ic) : '',
      on: () => { closeModal(); fn().catch(() => toast(t('reportFail'))); },
    }, label);
    openModal(el('div', { class: 'rep-head' }, el('span', { class: 'rep big', style: `--c:${k.hex}`, html: icon(k.icon) }),
      el('div', {}, el('h2', {}, kindName(r.kind)), el('small', {}, `${ago(r.t)} · ${spotLabel(r.lat, r.lng)}`))),
    el('p', { class: 'hint' }, mine ? t('yourReport') : t('votes', r.up, r.down)),
    canVote ? act(t('stillThere'), 'teal', () => vote(r, true), 'ok') : '',
    canVote ? act(t('notThere'), 'ghost', () => vote(r, false), 'x') : '',
    mine ? act(t('deleteReport'), 'pink', () => deleteReport(r), 'trash') : '',
    el('button', { class: 'btn ghost', on: closeModal }, t('close')));
  }

  /* -------------------------------------------------- while driving: alerts ahead, "still there?", share ETA */
  let drive = null;

  function alertBox() {
    let box = $('roadAlert');
    if (!box) { box = el('div', { id: 'roadAlert', class: 'road-alert sticker', hidden: '' }); $('drive').append(box); }
    return box;
  }

  function showAlert(kids, ms) {
    const box = alertBox();
    box.replaceChildren(...kids);
    box.hidden = false;
    box.classList.remove('in');
    void box.offsetWidth;
    box.classList.add('in');
    clearTimeout(drive && drive.alertTimer);
    if (drive) drive.alertTimer = setTimeout(() => { box.hidden = true; }, ms);
  }

  function navStart() {
    drive = { alerted: new Set(), near: new Set(), asked: new Set(), alertTimer: 0, level: levelOf(points()), before: points() };
    alertBox().hidden = true;
    if (hasCloud() && Date.now() - lastFetch > 60000) fetchReports();
    musicStart();
  }

  function navTick(lat, lng) {
    const nav = A.nav();
    if (!nav || !drive) return;
    if (hasCloud() && Date.now() - lastFetch > 180000) fetchReports();
    for (const r of active()) {
      const d = R.haversine(lat, lng, r.lat, r.lng);
      if (d < 60) drive.near.add(r.id);
      if (drive.near.has(r.id) && d > 90 && !drive.asked.has(r.id)) {
        drive.asked.add(r.id);
        if (P.cloud.signedIn() && r.uid !== P.cloud.uid() && !store.voted[r.id]) askStill(r);
        continue;
      }
      if (drive.alerted.has(r.id) || d > 1000) continue;
      const hit = R.projectOnTrack(nav.track, r.lat, r.lng, nav.at, nav.at + 900);
      const ahead = hit.at - nav.at;
      if (hit.dist > 45 || ahead > 800 || ahead < 15) continue;
      drive.alerted.add(r.id);
      const k = KINDS[r.kind];
      showAlert([el('span', { class: 'rep', style: `--c:${k.hex}`, html: icon(k.icon) }),
        el('div', {}, el('b', {}, t('aheadAlert', kindName(r.kind), A.fmtDist(ahead))), el('small', {}, ago(r.t)))], 7000);
      buzz(250);
      A.speakText(t('aheadAlert', kindName(r.kind), A.fmtDist(ahead).replace(t('m'), t('meters')).replace(t('km'), t('kilometers'))));
    }
  }

  function askStill(r) {
    const k = KINDS[r.kind];
    const yes = el('button', { class: 'vote yes', 'aria-label': t('stillThere'), html: icon('ok') });
    const no = el('button', { class: 'vote no', 'aria-label': t('notThere'), html: icon('x') });
    const answer = (still) => { alertBox().hidden = true; vote(r, still).catch(() => {}); };
    yes.addEventListener('click', () => answer(true));
    no.addEventListener('click', () => answer(false));
    showAlert([el('span', { class: 'rep', style: `--c:${k.hex}`, html: icon(k.icon) }), el('div', {}, el('b', {}, t('stillAsk', kindName(r.kind)))), yes, no], 12000);
  }

  function shareEta() {
    const nav = A.nav();
    if (!nav) return;
    const remaining = Math.max(0, nav.track.total - nav.at), seconds = nav.route.time * (remaining / Math.max(nav.track.total, 1));
    const at = new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    share(t('etaText', A.state.dest.label, at, A.fmtTime(seconds)));
  }

  function driveButtons() {
    return [
      el('button', { class: 'round small report-btn', 'aria-label': t('report'), on: () => openReport(), html: icon('report') }),
      el('button', { class: 'round small share-btn', 'aria-label': t('shareEta'), on: shareEta, html: icon('share') }),
    ];
  }

  function navEnd(done, pos) {
    if (drive) { clearTimeout(drive.alertTimer); alertBox().hidden = true; }
    musicStop();
    if (done && pos) {
      store.parked = { lat: pos[0], lng: pos[1], t: Date.now(), label: spotLabel(pos[0], pos[1]) };
      persist();
    }
  }

  function arrivalExtra() {
    if (!drive) return '';
    const p = points(), gained = Math.max(0, p - drive.before), lv = levelOf(p);
    const kids = [el('span', { class: 'earned' }, t('earned', gained))];
    if (lv > drive.level) kids.push(el('p', { class: 'level-up' }, t('levelUp', t(`lv${lv + 1}`))));
    drive = null;
    return el('div', { class: 'arrival-extra' }, kids);
  }

  /* -------------------------------------------------- music bar while driving (any music app: Spotify, Anghami...) */
  let musicTimer = 0, musicKey = '';

  function musicBar() {
    let bar = $('musicBar');
    if (!bar) { bar = el('div', { id: 'musicBar', class: 'music-bar', hidden: '' }); $('driveBottom').prepend(bar); }
    return bar;
  }

  function paintMusic() {
    const n = native();
    if (!n || !n.musicState || !A.nav()) return;
    let s = {};
    try { s = JSON.parse(n.musicState()); } catch (e) { /* no music info */ }
    const bar = musicBar();
    if (!s.allowed) {
      if (store.musicDismissed) { bar.hidden = true; return; }
      if (musicKey === 'ask') return;
      musicKey = 'ask';
      bar.hidden = false;
      bar.className = 'music-bar ask';
      bar.replaceChildren(
        el('button', { class: 'music-connect', html: icon('music'), on: () => { toast(t('musicHint')); n.openMusicAccess(); } }, t('musicConnect')),
        el('button', { class: 'music-x', 'aria-label': t('musicOff'), html: icon('x'), on: () => { store.musicDismissed = true; persist(); bar.hidden = true; } }));
      return;
    }
    if (!s.has) { bar.hidden = true; musicKey = ''; return; }
    const key = `${s.title}|${s.artist}|${s.playing}|${s.art ? s.art.length : 0}`;
    if (key === musicKey && !bar.hidden) return;
    musicKey = key;
    bar.hidden = false;
    bar.className = `music-bar ${s.playing ? 'on' : ''}`;
    const act = (what, ic, label) => el('button', {
      class: `mbtn ${what}`, 'aria-label': label, html: icon(ic),
      on: () => { n.musicAction(what); setTimeout(paintMusic, 400); setTimeout(paintMusic, 1200); },
    });
    bar.replaceChildren(
      s.art ? el('img', { class: 'cover', src: s.art, alt: '' }) : el('span', { class: 'cover', html: icon('music') }),
      el('div', { class: 'song' }, el('b', { dir: 'auto' }, s.title || s.app || '♪'), el('small', { dir: 'auto' }, [s.artist, s.app].filter(Boolean).join(' · '))),
      act('prev', 'prev', t('musicPrev')), act('toggle', s.playing ? 'pause' : 'play', t('musicToggle')), act('next', 'next', t('musicNext')));
  }

  function musicStart() {
    musicKey = '';
    clearInterval(musicTimer);
    const n = native();
    if (!n || !n.musicState) return;
    paintMusic();
    musicTimer = setInterval(paintMusic, 2000);
  }

  function musicStop() {
    clearInterval(musicTimer);
    musicTimer = 0;
    const bar = $('musicBar');
    if (bar) bar.hidden = true;
  }

  /* -------------------------------------------------- personal speed alert */
  let lastSpeedWarn = 0;

  function speedTick(speed) {
    const nav = A.nav();
    if (!nav || !nav.speed) return;
    const limit = store.speedAlert || 0, kmh = speed === null || Number.isNaN(speed) ? 0 : speed * 3.6;
    const over = limit > 0 && kmh > limit + 2;
    nav.speed.parentElement.classList.toggle('over', over);
    if (over && Date.now() - lastSpeedWarn > 20000) {
      lastSpeedWarn = Date.now();
      buzz(450);
      toast(t('slowDown', `${limit} ${t('kmh')}`));
    }
  }

  /* -------------------------------------------------- a place another app sent (WhatsApp location, Maps link...) */
  window.masarSharedPlace = () => {
    const n = native();
    if (!n || !n.takePlace) return;
    if (!$('splash').classList.contains('gone')) { setTimeout(window.masarSharedPlace, 700); return; }
    const raw = n.takePlace();
    if (!raw) return;
    let p;
    try { p = JSON.parse(raw); } catch (e) { return; }
    if (p.query) { A.state.query = p.query; A.renderHome(); show('home'); return; }
    if (R.nearestNode(p.lat, p.lng).meters > R.MAX_SNAP_M) { toast(t('sharedOutside')); return; }
    const dest = { label: p.label || spotLabel(p.lat, p.lng), lat: p.lat, lng: p.lng };
    if (!A.nav()) { A.goTo(dest); return; }
    openModal(el('h2', {}, t('sharedSwitch', dest.label)), el('p', {}, t('sharedSwitchText')),
      el('button', { class: 'btn pink', on: () => { closeModal(); window.masarCarStop(); A.goTo(dest); } }, t('sharedGo')),
      el('button', { class: 'btn ghost', on: closeModal }, t('keepGoing')));
  };
  setTimeout(window.masarSharedPlace, 1500);

  /* -------------------------------------------------- where I parked */
  function parkedInfo() {
    const p = store.parked;
    if (!p) return;
    openModal(el('h2', {}, t('parkedTitle')), el('p', {}, t('parkedAt', p.label)), el('p', { class: 'hint' }, t('parkedAgo', ago(p.t))),
      el('button', { class: 'btn teal', html: icon('map'), on: () => { closeModal(); openExplore({ center: [p.lat, p.lng], zoom: 17 }); } }, t('showMap')),
      el('button', { class: 'btn ghost', html: icon('share'), on: () => share(t('shareSpotText', t('parkedTitle'), `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(6)}&mlon=${p.lng.toFixed(6)}#map=18/${p.lat.toFixed(6)}/${p.lng.toFixed(6)}`)) }, t('spotShare')),
      el('button', { class: 'btn ghost', html: icon('trash'), on: () => { store.parked = null; persist(); closeModal(); drawParked(); A.refreshView(); } }, t('forgetParked')));
  }

  /* -------------------------------------------------- missing places the user adds to the map */
  const MISSING_KINDS = [['school', 'school'], ['shop', 'shop'], ['restaurant', 'food'], ['cafe', 'coffee'], ['office', 'work'],
    ['clinic', 'health'], ['place_of_worship', 'mosque'], ['building', 'pin']];

  function askMissing(at, back) {
    if (!at) {
      A.openPicker({ title: t('pickMissing'), back, done: (lat, lng) => askMissing({ lat, lng }, back) });
      return;
    }
    const name = el('input', { class: 'field', placeholder: t('placeName'), 'aria-label': t('placeName'), maxlength: '40' });
    let kind = 'school';
    const kinds = el('div', { class: 'chips wrap' });
    const paint = () => kinds.replaceChildren(...MISSING_KINDS.map(([k, ic]) => el('button', {
      class: 'chip', 'aria-pressed': String(k === kind), html: icon(ic), on: () => { kind = k; paint(); },
    }, A.poiKind(k))));
    paint();
    const finish = () => {
      if (back === 'pages') { P.refresh(); show('pages'); } else if (back === 'explore') openExplore({ center: [at.lat, at.lng], zoom: 17 });
    };
    openModal(el('h2', {}, t('missingTitle')), name, el('p', { class: 'tlabel' }, t('missingWhat')), kinds, el('p', { class: 'hint' }, t('missingNote')),
      el('button', {
        class: 'btn teal',
        on: () => {
          const label = name.value.trim();
          if (!label) { toast(t('needName')); name.focus(); return; }
          store.myPois.push({ id: `p${Date.now()}`, name: label, kind, lat: at.lat, lng: at.lng });
          persist();
          closeModal();
          toast(t('missingSaved'));
          finish();
        },
      }, t('save')),
      el('button', { class: 'btn ghost', on: () => { closeModal(); finish(); } }, t('cancel')));
  }

  /* -------------------------------------------------- My places page */
  function renderPlaces() {
    const rows = store.saved.map((s, i) => {
      const isSet = s.lat !== null;
      const move = (dir) => {
        const j = i + dir;
        if (j < 0 || j >= store.saved.length) return;
        [store.saved[i], store.saved[j]] = [store.saved[j], store.saved[i]];
        persist();
        P.refresh();
      };
      return el('li', { class: 'pl-row sticker' },
        el('button', { class: `pl-main`, on: () => (isSet ? A.goTo({ label: A.savedLabel(s), lat: s.lat, lng: s.lng }) : A.setSavedLocation(s)) },
          el('span', { class: `pl-ic c${i % 6}`, html: icon(A.savedIcon(s)) }),
          el('span', { class: 'pl-text' }, el('b', {}, A.savedLabel(s)), el('small', {}, isSet ? s.note || '' : t('setIt')))),
        el('div', { class: 'pl-tools' },
          el('button', { 'aria-label': t('moveUp'), disabled: i === 0 ? '' : null, on: () => move(-1), html: icon('up') }),
          el('button', { 'aria-label': t('moveDown'), disabled: i === store.saved.length - 1 ? '' : null, on: () => move(1), html: icon('down') }),
          el('button', { 'aria-label': t('editPlace'), on: () => (isSet || s.kind === 'custom' ? A.editSaved(s) : A.setSavedLocation(s)), html: icon('edit') })));
    });
    const mine = store.myPois.map((p) => el('li', { class: 'pl-row sticker' },
      el('button', { class: 'pl-main', on: () => A.goTo({ label: p.name, lat: p.lat, lng: p.lng }) },
        el('span', { class: 'pl-ic c5', html: icon((MISSING_KINDS.find((m) => m[0] === p.kind) || [0, 'pin'])[1]) }),
        el('span', { class: 'pl-text' }, el('b', {}, p.name), el('small', {}, A.poiKind(p.kind)))),
      el('div', { class: 'pl-tools' }, el('button', {
        'aria-label': t('remove'), html: icon('trash'),
        on: () => { store.myPois = store.myPois.filter((x) => x !== p); persist(); P.refresh(); },
      }))));
    const parts = [
      el('ul', { class: 'pl-list' }, rows),
      el('button', { class: 'btn yellow', html: icon('plus'), on: () => A.addPlace() }, t('add')),
    ];
    if (store.parked) {
      parts.push(el('button', { class: 'parked-card sticker', on: parkedInfo, html: icon('parking') },
        el('span', {}, el('b', {}, t('parkedTitle')), el('small', {}, `${store.parked.label} · ${ago(store.parked.t)}`))));
    }
    parts.push(el('h2', { class: 'sub' }, t('missingList')));
    if (mine.length) parts.push(el('ul', { class: 'pl-list' }, mine));
    parts.push(el('button', { class: 'btn ghost', html: icon('pin'), on: () => askMissing(null, 'pages') }, t('addMissing')),
      el('p', { class: 'hint' }, t('missingNote')));
    return parts;
  }

  /* -------------------------------------------------- Nearby page */
  const CATS = [
    ['fuel', 'fuel', ['fuel']], ['pharmacy', 'pill', ['pharmacy']], ['health', 'health', ['hospital', 'clinic', 'doctors', 'dentist']],
    ['food', 'food', ['restaurant', 'fast_food']], ['coffee', 'coffee', ['cafe']], ['bank', 'bank', ['bank', 'bureau_de_change']],
    ['worship', 'mosque', ['place_of_worship']], ['parking', 'parking', ['parking']], ['wash', 'wash', ['car_wash']],
    ['hotel', 'hotel', ['hotel', 'hostel', 'guest_house']], ['police', 'police', ['police']], ['school', 'school', ['school', 'kindergarten', 'college', 'university']],
    ['shop', 'shop', ['shop']],
  ];
  const near = { cat: null, here: null, at: 0, loading: false, approx: false };

  function wantHere() {
    if (near.loading || (near.here && Date.now() - near.at < 120000)) return;
    near.loading = true;
    A.locate().then((h) => {
      const inside = h && R.nearestNode(h.lat, h.lng).meters <= R.MAX_SNAP_M;
      near.here = inside ? h : { lat: A.MANARA.lat, lng: A.MANARA.lng };
      near.approx = !inside;
      near.at = Date.now();
      if (inside) here = { ...h, at: Date.now() };
      near.loading = false;
      if (P.root() === 'nearby') P.refresh();
    });
  }

  function openNearby(cat) {
    near.cat = cat;
    P.open('nearby', true);
    wantHere();
  }

  function renderNearby() {
    const grid = el('div', { class: 'cat-grid' }, CATS.map(([key, ic], i) => el('button', {
      class: `cat c${i % 6}`, 'aria-pressed': String(near.cat === key), html: icon(ic),
      on: () => { near.cat = key; wantHere(); P.refresh(); },
    }, el('span', {}, t(`c_${key}`)))));
    const parts = [el('p', { class: 'tlabel' }, t('nearCats')), grid];
    if (!near.cat) return parts;
    if (!near.here) {
      parts.push(el('div', { class: 'busy' }, el('span', { html: icon('compass', 'spin') }), t('locating')));
      return parts;
    }
    const kinds = CATS.find((c) => c[0] === near.cat)[2];
    const { lat, lng } = near.here;
    const cos = Math.cos(lat * Math.PI / 180);
    const pool = [...A.POIS, ...store.myPois.map((p) => ({ ...p, ar: p.name, en: p.name }))].filter((p) => kinds.includes(p.kind));
    const best = pool.map((p) => [((p.lat - lat) ** 2 + ((p.lng - lng) * cos) ** 2), p]).sort((a, b) => a[0] - b[0]).slice(0, 25);
    parts.push(el('h2', { class: 'sub' }, t('nearIn')));
    if (near.approx) parts.push(el('p', { class: 'hint' }, t('nearApprox')));
    if (!best.length) { parts.push(el('div', { class: 'empty' }, t('nearNone'))); return parts; }
    parts.push(el('ul', { class: 'results near-list' }, best.map(([, p]) => {
      const label = store.lang === 'en' ? p.en || p.ar : p.ar || p.en;
      const m = R.haversine(lat, lng, p.lat, p.lng);
      return el('li', {}, el('button', { on: () => A.goTo({ label, lat: p.lat, lng: p.lng }), html: icon(CATS.find((c) => c[0] === near.cat)[1]) },
        el('span', {}, el('b', {}, label), el('small', {}, A.poiKind(p.kind))), el('span', { class: 'dist' }, A.fmtDist(m))));
    })));
    parts.push(el('p', { class: 'hint' }, `${t('straightLine')} · © OpenStreetMap`));
    return parts;
  }

  /* -------------------------------------------------- home extras: quick nearby, reports, where I parked */
  function homeExtras() {
    const out = [];
    const quick = [['fuel', 'fuel'], ['pharmacy', 'pill'], ['food', 'food'], ['coffee', 'coffee'], ['bank', 'bank'], ['parking', 'parking']];
    out.push(el('div', { class: 'quick' }, quick.map(([k, ic]) => el('button', { class: 'qbtn', on: () => openNearby(k), html: icon(ic) }, el('span', {}, t(`c_${k}`))))));
    const n = active().length;
    if (n) out.push(el('button', { class: 'reports-pill', on: () => openExplore(), html: icon('report') }, t('reportsNow', n)));
    if (store.parked && Date.now() - store.parked.t < 3 * 86400000) {
      out.push(el('button', { class: 'parked-card sticker', on: parkedInfo, html: icon('parking') },
        el('span', {}, el('b', {}, t('parkedTitle')), el('small', {}, `${store.parked.label} · ${ago(store.parked.t)}`))));
    }
    return out;
  }

  /* -------------------------------------------------- settings */
  function settingsSections(section, choices) {
    const swatches = el('div', { class: 'swatches' }, Object.entries(CAR_COLORS).map(([k, hex]) => el('button', {
      class: 'swatch', style: `--c:${hex}`, 'aria-pressed': String(store.carColor === k), 'aria-label': t(`col_${k}`),
      on: () => { store.carColor = k; persist(); paintCar(); P.refresh(); }, html: '<div class="car demo"></div>',
    })));
    const speeds = [[0, 'x', t('off')], ...[60, 80, 90, 100, 120].map((v) => [v, 'speed', `${v} ${t('kmh')}`])];
    return [
      section(t('carLook'), swatches),
      section(t('speedAlert'), el('div', { class: 'speed-pick' }, choices(speeds, store.speedAlert || 0, (v) => { store.speedAlert = v; persist(); }))),
      native() && native().musicState && store.musicDismissed
        ? section(t('musicConnect'), el('button', { class: 'btn teal', html: icon('music'), on: () => { store.musicDismissed = false; persist(); toast(t('musicHint')); native().openMusicAccess(); } }, t('musicConnect')))
        : '',
      section(t('avoidRep'), choices([[true, 'ok', t('on')], [false, 'x', t('off')]], store.avoidReports !== false, (v) => { store.avoidReports = v; persist(); })),
    ];
  }

  /* -------------------------------------------------- wiring */
  P.register('places', renderPlaces);
  P.register('nearby', renderNearby);
  $('exploreSearch').addEventListener('click', () => A.focusSearch());
  $('exploreLocate').addEventListener('click', () => locateMe(true));
  $('exploreReport').addEventListener('click', () => openReport());

  function paintStatic() {
    $('exploreSearch').innerHTML = `${icon('search')}<span>${t('exploreSearch')}</span>`;
    $('exploreLocate').innerHTML = icon('loc');
    $('exploreLocate').setAttribute('aria-label', t('myLocation'));
    $('exploreReport').innerHTML = `${icon('report')}<span>${t('report')}</span>`;
  }
  paintStatic();
  const setLang = A.setLang;
  A.setLang = () => { setLang(); paintStatic(); onShow(document.body.dataset.screen); };

  /* Reports load in the background, so the home screen can show how many there are. */
  if (hasCloud()) setTimeout(() => fetchReports().then(() => { if (document.body.dataset.screen === 'home' && !A.state.query) A.renderHome(); }), 4000);

  /* For voice commands (plus.js): report at the car's spot without opening the picker. */
  async function reportHere(kind) {
    if (!KINDS[kind]) return false;
    if (!hasCloud() || !P.cloud.signedIn()) { needSignIn(); return false; }
    const nav = A.nav();
    let spot = nav && nav.pos ? { lat: nav.pos[0], lng: nav.pos[1] } : here && Date.now() - here.at < 120000 ? here : await A.locate(true);
    if (!spot) { toast(t('locFail')); return false; }
    await createReport(kind, spot.lat, spot.lng);
    buzz(40);
    return true;
  }

  window.MasarFx = {
    onShow, onMap, openExplore, prepareRoute, routeNote, driveButtons, navStart, navTick, navEnd, arrivalExtra,
    homeExtras, levelCard, settingsSections, openNearby, speedTick,
    reportHere, shareEta, points, tripPoints, CATS, kindName, activeReports: () => active(),
    music: (what) => { const n = native(); if (n && n.musicAction) { n.musicAction(what); setTimeout(paintMusic, 500); return true; } return false; },
  };
  onShow(document.body.dataset.screen);
})();
