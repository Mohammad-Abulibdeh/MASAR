/* MASAR plus: the welcome screen, "Leave now" reminders, the monthly summary, the emergency page and voice commands.
   Loaded last, after app.js, pages.js and features.js. */
(function () {
  const A = window.MasarApp, P = window.MasarPages, R = window.MasarRouter, F = window.MasarFx;
  const { store, persist, t, el, icon, show, toast, openModal, closeModal } = A;
  const $ = (id) => document.getElementById(id);
  const native = () => A.native();
  const isAr = () => store.lang !== 'en';
  const motionOK = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!Array.isArray(store.leavePlans)) store.leavePlans = [];
  if (!Array.isArray(store.sosContacts)) store.sosContacts = [];

  Object.assign(A.STRINGS.ar, {
    helloMorning: 'صباح الخير', helloNoon: 'نهارك سعيد', helloEvening: 'مسا الخير', helloNight: 'سهرة سعيدة',
    helloSub: 'شو الخطة اليوم؟', whereToday: 'وين رايح اليوم؟', letsGo: 'يلا نبلّش', sosShort: 'طوارئ',
    leave: 'اطلع هلأ', leaveIntro: 'قلّي إيمتى بدك توصل، وأنا بحسب الطريق والزحمة وبنبّهك إيمتى لازم تطلع.',
    leaveAdd: 'ضيف تذكير', leaveNone: 'ما في تذكيرات لسا.', leaveCard: 'اطلع الساعة {0} عشان توصل {1} الساعة {2}',
    leaveNowCard: 'اطلع هلأ! عشان توصل {0} الساعة {1}', leaveSoon: 'لازم تطلع بعد {0} عشان توصل {1}',
    leaveSetup: 'خليني أذكّرك إيمتى تطلع', leaveSetupSub: 'بحسبلك الطريق والزحمة وبنبّهك قبلها',
    leaveWhere: 'لوين؟', leaveArrive: 'بدي أوصل الساعة', leaveDays: 'بأي أيام؟', leaveFrom: 'من: {0}', leaveOut: 'اطلع', leaveIn: 'توصل',
    leaveTrip: 'الطريق حوالي {0}، وزدت {1} دقايق احتياط.', leaveSaved: 'تمام! رح أذكّرك الساعة {0}',
    leaveNotif: 'اطلع هلأ', leaveNotifText: 'عشان توصل {0} الساعة {1}. الطريق حوالي {2}.', leaveGo: 'يلا نمشي', leaveLater: 'بعدين',
    leaveDelete: 'احذف التذكير', leaveOn: 'شغّال', leaveOff: 'موقّف', leavePickMap: 'من الخريطة',
    leaveNeedPlace: 'اختار لوين أول', leaveNeedDay: 'اختار يوم واحد على الأقل', leaveNoRoute: 'ما لقيت طريق لهالمكان',
    leaveAppOnly: 'بالمتصفح التذكير بيطلع بس إذا مسار مفتوح. على الموبايل بيوصلك إشعار حتى لو مسكّر.',
    leaveNotifsOff: 'إشعارات مسار مسكّرة، فما رح يوصلك التذكير. فعّلها من إعدادات الموبايل.', openSettings: 'افتح الإعدادات',
    leaveEarly: 'الاحتياط', saveIt: 'احفظ', leaveEdit: 'عدّل',
    d0: 'أحد', d1: 'اثنين', d2: 'ثلاثاء', d3: 'أربعاء', d4: 'خميس', d5: 'جمعة', d6: 'سبت',
    month: 'ملخص الشهر', monthTrips: 'رحلة', monthKm: 'كيلومتر', monthHours: 'ساعة سواقة', monthTop: 'أكثر مكان رحت عليه',
    monthTimes: '{0} مرات', monthOnce: 'مرة وحدة', monthTwice: 'مرتين', monthLongest: 'أطول مشوار', monthDay: 'أكثر يوم سقت فيه', monthArrived: 'وصلت لوجهتك {0} من أصل {1} رحلة',
    monthPoints: 'كسبت {0} نقطة', monthNone: 'ما في رحلات بهالشهر.', monthMore: 'أكثر بـ {0}% من الشهر اللي قبله', monthLess: 'أقل بـ {0}% من الشهر اللي قبله',
    monthNablus: 'كأنك رحت من رام الله لنابلس {0} مرات', monthBirzeit: 'كأنك رحت من المنارة لبيرزيت {0} مرات',
    monthShare: 'شارك الملخص', monthReady: 'ملخص شهر {0} جاهز!', monthSoFar: 'هالشهر لحد هلأ: {1} كم · عدد الرحلات {0}', monthOf: 'ملخص شهر',
    monthShareText: 'ملخصي على مسار لشهر {0}: {1} رحلة، {2} كم، و{3} ساعة سواقة.', monthCard: 'ملخصي الشهري على مسار',
    monthPrev: 'الشهر اللي قبل', monthNext: 'الشهر اللي بعد',
    sos: 'طوارئ', sosSend: 'ابعت موقعي لأهلي', sosSendSub: 'بتفتح رسالة جاهزة فيها موقعك، وإنت بتكبس إرسال',
    sosCall: 'اتصال سريع', sosAmb: 'إسعاف', sosPolice: 'شرطة', sosFire: 'دفاع مدني', sosContacts: 'لمين نبعت؟',
    sosNoContacts: 'ضيف رقم واحد على الأقل (أبوك، أمك، أخوك، صاحبك...).', sosName: 'الاسم', sosPhone: 'رقم الموبايل', sosAdd: 'ضيف الرقم',
    sosLocal: 'الأرقام بتنحفظ على موبايلك بس، وما بتطلع على حسابك.', sosLocating: 'بحدد موقعك...', sosShareAny: 'ابعت موقعي لأي حدا',
    sosMsg: 'أنا بحاجة لمساعدة. موقعي هلأ: {0} (الساعة {1}). مبعوثة من تطبيق مسار', sosNoLoc: 'أنا بحاجة لمساعدة، وما قدرت أحدد موقعي بالضبط. مبعوثة من تطبيق مسار',
    sosBadPhone: 'الرقم مش واضح', sosMax: 'بتقدر تضيف لحد 5 أرقام', sosRemove: 'شيل {0}',
    voiceHelp: 'الأوامر الصوتية', micLabel: 'احكي شو بدك', listening: 'سامعك...',
    voiceTry: 'جرّب: «وديني عالبيت»، «أقرب بنزينة»، «بلّغ عن حادث»، «إيمتى بوصل؟»', voiceNo: 'ما فهمت «{0}»',
    voiceNone: 'ما سمعت إشي. جرّب كمان مرة.', voiceUnsupported: 'تعرّف الصوت مش متوفر على هالجهاز.',
    voiceGoing: 'ماشيين على {0}', voiceNearest: 'أقرب {0}: {1}', voiceStopped: 'وقّفت الملاحة', voiceMuted: 'سكّتت الصوت', voiceUnmuted: 'رجّعت الصوت',
    voiceEta: 'باقي {0}، وبتوصل الساعة {1}', voiceNoTrip: 'ما في رحلة شغّالة هلأ', voiceReported: 'بلّغت عن {0}. شكرا!',
    voiceNoLeave: 'ما في تذكير طلعة اليوم', voiceLeave: 'لازم تطلع الساعة {0} عشان توصل {1} الساعة {2}', voiceNoMusic: 'وصّل موسيقاك أول من الإعدادات',
    voiceNotSet: 'لسا ما حددت مكان {0}', voiceTryNow: 'جرّب هلأ', voiceExamples: 'شو بتقدر تحكيلي',
    vxGo: 'وديني عالبيت · خذني على جامعة بيرزيت', vxNear: 'أقرب بنزينة · أقرب صيدلية', vxTrip: 'إيمتى بوصل؟ · ابعت وقت وصولي · وقّف الملاحة',
    vxReport: 'بلّغ عن حادث · بلّغ عن حاجز · بلّغ عن زحمة', vxMusic: 'الأغنية الجاي · وقّف الموسيقى · سكّت الصوت', vxMore: 'إيمتى لازم أطلع؟ · طوارئ',
    pVoice: 'الصوت وأرقام الطوارئ', pVoiceText: 'لما تكبس المايك، كلامك بيروح لخدمة تعرّف الصوت تبعت موبايلك (Google) وبيرجع نص بس. مسار ما بيسجّل صوتك ولا بيحفظه. أرقام الطوارئ بتضل على موبايلك بس.',
  });
  Object.assign(A.STRINGS.en, {
    helloMorning: 'Good morning', helloNoon: 'Good afternoon', helloEvening: 'Good evening', helloNight: 'Good night',
    helloSub: "What's the plan today?", whereToday: 'Where to today?', letsGo: "Let's go", sosShort: 'SOS',
    leave: 'Leave now', leaveIntro: "Tell me when you want to arrive. I work out the road and the traffic and tell you when it's time to leave.",
    leaveAdd: 'Add a reminder', leaveNone: 'No reminders yet.', leaveCard: 'Leave at {0} to reach {1} by {2}',
    leaveNowCard: 'Leave now to reach {0} by {1}!', leaveSoon: 'Leave in {0} to reach {1}',
    leaveSetup: 'Remind me when to leave', leaveSetupSub: 'I count in the road and traffic and tell you in time',
    leaveWhere: 'Where to?', leaveArrive: 'I want to arrive at', leaveDays: 'Which days?', leaveFrom: 'From: {0}', leaveOut: 'Leave', leaveIn: 'Arrive',
    leaveTrip: 'The drive takes about {0}, plus {1} minutes to spare.', leaveSaved: "Done! I'll remind you at {0}",
    leaveNotif: 'Time to leave', leaveNotifText: 'to reach {0} by {1}. The drive is about {2}.', leaveGo: "Let's go", leaveLater: 'Later',
    leaveDelete: 'Delete reminder', leaveOn: 'On', leaveOff: 'Off', leavePickMap: 'From the map',
    leaveNeedPlace: 'Pick where to first', leaveNeedDay: 'Pick at least one day', leaveNoRoute: "Couldn't find a road to this place",
    leaveAppOnly: 'In the browser the reminder only shows while MASAR is open. On the phone a notification comes even when it is closed.',
    leaveNotifsOff: "MASAR's notifications are off, so reminders can't reach you. Turn them on in the phone settings.", openSettings: 'Open settings',
    leaveEarly: 'Spare time', saveIt: 'Save', leaveEdit: 'Edit',
    d0: 'Sun', d1: 'Mon', d2: 'Tue', d3: 'Wed', d4: 'Thu', d5: 'Fri', d6: 'Sat',
    month: 'Monthly summary', monthTrips: 'trips', monthKm: 'kilometres', monthHours: 'hours driving', monthTop: 'Your top destination',
    monthTimes: '{0} times', monthOnce: 'once', monthTwice: 'twice', monthLongest: 'Longest drive', monthDay: 'Your busiest day', monthArrived: 'You arrived on {0} of {1} trips',
    monthPoints: 'You earned {0} points', monthNone: 'No trips this month.', monthMore: '{0}% more than the month before', monthLess: '{0}% less than the month before',
    monthNablus: 'Like driving Ramallah to Nablus {0} times', monthBirzeit: 'Like driving Al Manara to Birzeit {0} times',
    monthShare: 'Share the summary', monthReady: 'Your {0} summary is ready!', monthSoFar: 'This month so far: {0} trips · {1} km', monthOf: 'Summary of',
    monthShareText: 'My {0} on MASAR: {1} trips, {2} km and {3} hours of driving.', monthCard: 'My month on MASAR',
    monthPrev: 'Previous month', monthNext: 'Next month',
    sos: 'Emergency', sosSend: 'Send my location to family', sosSendSub: 'Opens a ready message with your location; you press send',
    sosCall: 'Quick call', sosAmb: 'Ambulance', sosPolice: 'Police', sosFire: 'Civil defence', sosContacts: 'Who gets it?',
    sosNoContacts: 'Add at least one number (a parent, sibling, friend...).', sosName: 'Name', sosPhone: 'Mobile number', sosAdd: 'Add number',
    sosLocal: 'Numbers stay on your phone only and never go to your account.', sosLocating: 'Finding your location...', sosShareAny: 'Send my location to anyone',
    sosMsg: 'I need help. My location now: {0} (at {1}). Sent from MASAR', sosNoLoc: "I need help, and I couldn't get my exact location. Sent from MASAR",
    sosBadPhone: "That number doesn't look right", sosMax: 'You can add up to 5 numbers', sosRemove: 'Remove {0}',
    voiceHelp: 'Voice commands', micLabel: 'Say what you need', listening: 'Listening...',
    voiceTry: 'Try: "Take me home", "Nearest gas station", "Report an accident", "When do I arrive?"', voiceNo: 'I didn\'t get "{0}"',
    voiceNone: "I didn't hear anything. Try again.", voiceUnsupported: 'Speech recognition is not available on this device.',
    voiceGoing: 'Going to {0}', voiceNearest: 'Nearest {0}: {1}', voiceStopped: 'Navigation stopped', voiceMuted: 'Voice off', voiceUnmuted: 'Voice on',
    voiceEta: '{0} left, arriving at {1}', voiceNoTrip: 'No trip is running', voiceReported: 'Reported {0}. Thanks!',
    voiceNoLeave: 'No leave reminder today', voiceLeave: 'Leave at {0} to reach {1} by {2}', voiceNoMusic: 'Connect your music first in settings',
    voiceNotSet: "You haven't set {0} yet", voiceTryNow: 'Try it now', voiceExamples: 'What you can say',
    vxGo: 'Take me home · Take me to Birzeit University', vxNear: 'Nearest gas station · Nearest pharmacy', vxTrip: 'When do I arrive? · Share my arrival · Stop navigation',
    vxReport: 'Report an accident · Report a checkpoint · Report traffic', vxMusic: 'Next song · Pause music · Mute', vxMore: 'When should I leave? · Emergency',
    pVoice: 'Voice and emergency numbers', pVoiceText: "When you tap the mic, your words go to your phone's speech service (Google) and only text comes back. MASAR doesn't record or keep your voice. Emergency numbers stay on your phone only.",
  });
  Object.assign(A.ICONS, {
    mic: '<rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
    alarm: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.2l2.6 1.8M3.5 5.5L7 3M20.5 5.5L17 3"/>',
    chart: '<path d="M3 21h18M6 17v-5M11 17V7M16 17v-8M21 17V4"/>',
    siren: '<path d="M6 18v-6a6 6 0 0 1 12 0v6M4 18h16v3H4zM12 2v2M3.5 6l1.6 1.2M20.5 6l-1.6 1.2M10 12a2 2 0 0 1 2-2"/>',
    phone: '<path d="M5 3.5h3.5l2 5-2.5 1.5a11 11 0 0 0 5.5 5.5l1.5-2.5 5 2V18.5a2 2 0 0 1-2 2A17 17 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
    send: '<path d="M21 3L3 10.5l7 2.5 2.5 7zM21 3L10 13"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  });

  const pad = (n) => String(n).padStart(2, '0');
  const hm = (mins) => { const m = ((Math.round(mins) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
  const toMin = (s) => { const [h, m] = String(s).split(':').map(Number); return h * 60 + (m || 0); };
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5]; // the week starts on Saturday here
  const MONTHS_AR = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthName = (m) => (isAr() ? MONTHS_AR : MONTHS_EN)[m];

  /* Spoken answers: the phone's voice when there is one, the browser's otherwise. */
  function say(text) {
    if (store.muted) return;
    const n = native();
    if (n && n.speak && n.speak(text, store.lang)) return;
    if (!n && window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = isAr() ? 'ar' : 'en';
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    }
  }

  function shareText(text) {
    const n = native();
    if (n && n.share) { n.share(text); return; }
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast(t('copied')), () => toast(text));
    else toast(text);
  }

  const buzz = (ms) => { const n = native(); if (n && n.buzz) n.buzz(ms); else if (navigator.vibrate) navigator.vibrate(ms); };

  function countUp(node, to, decimals = 0) {
    if (!motionOK()) { node.textContent = to.toFixed(decimals); return; }
    const t0 = performance.now(), dur = 1000;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - (1 - k) ** 3;
      node.textContent = (to * e).toFixed(decimals);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ================================================== "Leave now" reminders */
  const EARLY = 5; // minutes to spare
  const presetAt = (min) => {
    const h = Math.floor(min / 60);
    return (h >= 7 && h < 9) || (h >= 14 && h < 17) ? 'rush_hour' : h >= 22 || h < 6 ? 'calm' : 'busy';
  };
  const leaveMin = (p) => toMin(p.arrive) - Math.ceil(p.travel / 60) - EARLY;

  function travelSeconds(from, to, arriveMin) {
    const a = R.nearestNode(from.lat, from.lng), b = R.nearestNode(to.lat, to.lng);
    if (a.meters > R.MAX_SNAP_M || b.meters > R.MAX_SNAP_M) return null;
    if (a.node === b.node) return 60;
    const best = R.options(a.node, b.node, presetAt(arriveMin), 1);
    return best.length ? best[0].time : null;
  }

  function homeStart() {
    const h = store.saved.find((s) => s.kind === 'home' && s.lat !== null);
    return h ? { label: A.savedLabel(h), lat: h.lat, lng: h.lng } : null;
  }

  /* The phone keeps the alarms (they fire even when MASAR is closed); the page only hands them over. */
  function syncAlarms() {
    const n = native();
    if (!n || !n.setLeaveAlarms) return;
    n.setLeaveAlarms(JSON.stringify(store.leavePlans.filter((p) => p.on).map((p) => {
      const lm = leaveMin(p), shift = lm < 0 ? 6 : 0; // leaving before midnight means the day before
      return {
        id: p.id, minute: ((lm % 1440) + 1440) % 1440, days: p.days.map((d) => (d + shift) % 7),
        title: t('leaveNotif'), text: t('leaveNotifText', p.dest.label, p.arrive, A.fmtTime(p.travel)), go: t('leaveGo'),
      };
    })));
  }

  /* Today's next reminder, for the welcome screen: minutes until leaving (negative = late already). */
  function todaysLeave() {
    const day = new Date().getDay(), now = nowMin();
    let best = null;
    store.leavePlans.forEach((p) => {
      if (!p.on || !p.days.includes(day)) return;
      const diff = leaveMin(p) - now;
      if (diff < -20 || diff > 14 * 60) return;
      if (!best || diff < best.diff) best = { p, diff };
    });
    return best;
  }

  function goPlan(p) {
    closeModal();
    A.state.from = null;
    A.goTo({ ...p.dest });
  }

  const fired = new Set();
  function checkLeave() {
    if (document.hidden || document.body.dataset.screen === 'drive') return;
    const day = new Date().getDay(), now = nowMin(), stamp = new Date().toDateString();
    store.leavePlans.forEach((p) => {
      if (!p.on || !p.days.includes(day) || leaveMin(p) !== now || fired.has(p.id + stamp)) return;
      fired.add(p.id + stamp);
      buzz(400);
      say(`${t('leaveNotif')}. ${t('leaveNotifText', p.dest.label, p.arrive, A.fmtTime(p.travel))}`);
      openModal(el('div', { class: 'leave-alert' }, el('span', { class: 'leave-ic big', html: icon('alarm') }),
        el('h2', {}, t('leaveNotif')), el('p', {}, t('leaveNotifText', p.dest.label, p.arrive, A.fmtTime(p.travel)))),
      el('button', { class: 'btn pink', html: icon('arrow', 'flip'), on: () => goPlan(p) }, t('leaveGo')),
      el('button', { class: 'btn ghost', on: closeModal }, t('leaveLater')));
    });
  }
  setInterval(checkLeave, 20000);

  function dayChips(days, onToggle) {
    return el('div', { class: 'day-chips' }, DAY_ORDER.map((d) => {
      const b = el('button', { class: 'daychip', 'aria-pressed': String(days.includes(d)) }, t(`d${d}`));
      if (onToggle) b.addEventListener('click', () => { onToggle(d); b.setAttribute('aria-pressed', String(days.includes(d))); });
      else b.disabled = true;
      return b;
    }));
  }

  function renderLeave() {
    const parts = [el('div', { class: 'leave-hero sticker' }, el('span', { class: 'leave-ic', html: icon('alarm') }), el('p', {}, t('leaveIntro')))];
    const n = native();
    if (!n || !n.setLeaveAlarms) parts.push(el('p', { class: 'hint' }, t('leaveAppOnly')));
    else if (n.notificationsOn && !n.notificationsOn() && store.leavePlans.some((p) => p.on)) {
      parts.push(el('div', { class: 'warn-card sticker' }, el('p', {}, t('leaveNotifsOff')),
        el('button', { class: 'btn ghost', on: () => n.openAppSettings() }, t('openSettings'))));
    }
    if (!store.leavePlans.length) parts.push(el('div', { class: 'empty' }, t('leaveNone')));
    store.leavePlans.forEach((p, i) => {
      const toggle = el('button', { class: 'switch', role: 'switch', 'aria-checked': String(p.on), 'aria-label': p.on ? t('leaveOn') : t('leaveOff') }, el('i'));
      toggle.addEventListener('click', () => { p.on = !p.on; persist(); syncAlarms(); if (p.on) askNotifs(); P.refresh(); });
      parts.push(el('section', { class: `card sticker leave-card tone${i % 4} ${p.on ? '' : 'off'}` },
        el('div', { class: 'leave-top' }, el('span', { class: 'leave-dest', html: icon(p.dest.icon || 'pin') }),
          el('div', {}, el('b', {}, p.dest.label), el('small', {}, t('leaveFrom', p.from.label))), toggle),
        el('div', { class: 'leave-times' },
          el('div', {}, el('small', {}, t('leaveOut')), el('b', {}, hm(leaveMin(p)))),
          el('span', { class: 'leave-road', html: icon('arrow', 'flip') }, el('small', {}, A.fmtTime(p.travel))),
          el('div', {}, el('small', {}, t('leaveIn')), el('b', {}, p.arrive))),
        dayChips(p.days),
        el('div', { class: 'leave-actions' },
          el('button', { class: 'btn ghost', html: icon('edit'), on: () => editPlan({ ...p, days: [...p.days] }) }, t('leaveEdit')),
          el('button', { class: 'btn ghost', 'aria-label': t('leaveDelete'), html: icon('trash'), on: () => {
            store.leavePlans = store.leavePlans.filter((x) => x.id !== p.id); persist(); syncAlarms(); P.refresh();
          } }))));
    });
    parts.push(el('button', { class: 'btn pink', html: icon('plus'), on: () => editPlan(null) }, t('leaveAdd')));
    return parts;
  }

  function askNotifs() { const n = native(); if (n && n.askNotifications) n.askNotifications(); }

  function editPlan(draft) {
    const d = draft || { id: `p${Date.now().toString(36)}`, dest: null, arrive: '08:00', days: [6, 0, 1, 2, 3, 4], on: true };
    const same = (a, b) => a && b && Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
    const set = store.saved.filter((s) => s.lat !== null);
    const options = set.map((s) => ({ label: A.savedLabel(s), lat: s.lat, lng: s.lng, icon: A.savedIcon(s) }));
    if (d.dest && !options.some((o) => same(o, d.dest))) options.push(d.dest);
    const dests = el('div', { class: 'leave-dests' }, options.map((o) => el('button', {
      class: 'chip', 'aria-pressed': String(same(o, d.dest)), html: icon(o.icon || 'pin'), on: () => { d.dest = o; editPlan(d); },
    }, o.label)), el('button', {
      class: 'chip', html: icon('map'), on: () => {
        closeModal();
        A.openPicker({ title: t('leaveWhere'), back: 'pages', done: (lat, lng, label) => { d.dest = { label, lat, lng, icon: 'pin' }; show('pages'); P.refresh(); editPlan(d); } });
      },
    }, t('leavePickMap')));
    const time = el('input', { class: 'field time', type: 'time', value: d.arrive, dir: 'ltr', 'aria-label': t('leaveArrive') });
    time.addEventListener('change', () => { if (time.value) d.arrive = time.value; });
    const days = dayChips(d.days, (day) => { d.days = d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day]; });
    const save = el('button', { class: 'btn pink' }, t('saveIt'));
    save.addEventListener('click', async () => {
      if (time.value) d.arrive = time.value;
      if (!d.dest) { toast(t('leaveNeedPlace')); return; }
      if (!d.days.length) { toast(t('leaveNeedDay')); return; }
      save.disabled = true;
      let from = homeStart();
      if (!from || R.haversine(from.lat, from.lng, d.dest.lat, d.dest.lng) < 300) {
        const here = await A.locate();
        from = here && R.nearestNode(here.lat, here.lng).meters <= R.MAX_SNAP_M ? { label: t('myLoc'), ...here } : { label: A.pname(A.MANARA), lat: A.MANARA.lat, lng: A.MANARA.lng };
      }
      const travel = travelSeconds(from, d.dest, toMin(d.arrive));
      save.disabled = false;
      if (travel === null) { toast(t('leaveNoRoute')); return; }
      const plan = { ...d, from, travel, on: true };
      const i = store.leavePlans.findIndex((x) => x.id === plan.id);
      if (i >= 0) store.leavePlans[i] = plan; else store.leavePlans.push(plan);
      persist();
      syncAlarms();
      askNotifs();
      closeModal();
      toast(t('leaveSaved', hm(leaveMin(plan))));
      if (document.body.dataset.screen === 'pages') P.refresh(); else P.open('leave');
    });
    openModal(el('h2', {}, draft && store.leavePlans.some((x) => x.id === d.id) ? t('leaveEdit') : t('leaveAdd')),
      el('p', { class: 'tlabel' }, t('leaveWhere')), dests,
      el('p', { class: 'tlabel' }, t('leaveArrive')), time,
      el('p', { class: 'tlabel' }, t('leaveDays')), days,
      el('p', { class: 'hint' }, t('leaveSetupSub')),
      save, el('button', { class: 'btn ghost', on: closeModal }, t('cancel')));
  }

  /* A reminder notification was tapped: the phone keeps its id until the page takes it. */
  function takeLeave() {
    const n = native();
    const id = n && n.takeLeave ? n.takeLeave() : null;
    return id ? store.leavePlans.find((p) => p.id === id) || null : null;
  }
  window.masarLeave = () => { const p = takeLeave(); if (p) goPlan(p); };

  /* ================================================== monthly summary */
  let monthOff = 0;

  function monthRange(off) {
    const d = new Date();
    return [new Date(d.getFullYear(), d.getMonth() + off, 1), new Date(d.getFullYear(), d.getMonth() + off + 1, 1)];
  }
  const monthLabel = (off) => { const [s] = monthRange(off); return `${monthName(s.getMonth())} ${s.getFullYear()}`; };

  function monthStats(off) {
    const [s, e] = monthRange(off);
    const trips = store.trips.filter((x) => x.t >= s.getTime() && x.t < e.getTime());
    const km = trips.reduce((a, x) => a + x.m, 0) / 1000;
    const hours = trips.reduce((a, x) => a + x.s, 0) / 3600;
    const counts = new Map(), days = new Array(7).fill(0);
    trips.forEach((x) => { counts.set(x.to, (counts.get(x.to) || 0) + 1); days[new Date(x.t).getDay()]++; });
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || null;
    const longest = trips.reduce((a, x) => (!a || x.m > a.m ? x : a), null);
    const busiest = days.indexOf(Math.max(...days));
    return {
      trips, count: trips.length, km, hours, top, longest, busiest,
      done: trips.filter((x) => x.done).length, points: trips.reduce((a, x) => a + F.tripPoints(x), 0),
    };
  }

  function renderMonth() {
    const s = monthStats(monthOff), prev = monthStats(monthOff - 1);
    const nav = el('div', { class: 'month-nav' },
      el('button', { class: 'round small', 'aria-label': t('monthPrev'), html: icon('back', 'flip'), on: () => { monthOff--; P.refresh(); } }),
      el('b', {}, monthLabel(monthOff)),
      el('button', { class: 'round small', 'aria-label': t('monthNext'), disabled: monthOff >= 0 ? '' : null, html: icon('chev', 'flip'), on: () => { if (monthOff < 0) { monthOff++; P.refresh(); } } }));
    if (!s.count) return [nav, el('div', { class: 'empty-page' }, el('span', { html: icon('chart') }), el('p', {}, t('monthNone')))];
    const big = (value, label, cls, dec) => {
      const b = el('b', {}, '0');
      countUp(b, value, dec);
      return el('div', { class: `wrap-stat ${cls}` }, b, el('small', {}, label));
    };
    const fact = (ic, title, value) => el('li', {}, el('span', { html: icon(ic) }), el('div', {}, el('small', {}, title), el('b', {}, value)));
    const facts = [];
    if (s.top) facts.push(fact('star', t('monthTop'), `${s.top[0]} · ${s.top[1] === 1 ? t('monthOnce') : s.top[1] === 2 ? t('monthTwice') : t('monthTimes', s.top[1])}`));
    if (s.longest) facts.push(fact('road', t('monthLongest'), `${A.fmtDist(s.longest.m)} · ${s.longest.to}`));
    facts.push(fact('calendar', t('monthDay'), t(`d${s.busiest}`)));
    facts.push(fact('ok', t('monthArrived', s.done, s.count), ''));
    facts.push(fact('trophy', t('monthPoints', s.points), ''));
    const compare = s.km >= 50 ? t('monthNablus', (s.km / 50).toFixed(1)) : s.km >= 10 ? t('monthBirzeit', (s.km / 10).toFixed(1)) : '';
    let trend = '';
    if (prev.km > 0) {
      const pct = Math.round((s.km - prev.km) / prev.km * 100);
      if (pct) trend = pct > 0 ? t('monthMore', pct) : t('monthLess', -pct);
    }
    const shareBtn = el('button', { class: 'btn yellow', html: icon('share') }, t('monthShare'));
    shareBtn.addEventListener('click', async () => { shareBtn.disabled = true; await shareMonth(monthOff, s).catch(() => {}); shareBtn.disabled = false; });
    return [nav,
      el('section', { class: 'wrap-card sticker' },
        el('small', { class: 'wrap-kicker' }, t('monthOf')), el('h2', {}, monthLabel(monthOff)),
        el('div', { class: 'wrap-stats' }, big(s.count, t('monthTrips'), 'c0', 0), big(s.km, t('monthKm'), 'c1', s.km < 10 ? 1 : 0), big(s.hours, t('monthHours'), 'c2', 1)),
        compare ? el('p', { class: 'wrap-fun' }, compare) : '',
        trend ? el('p', { class: 'wrap-trend' }, trend) : ''),
      el('ul', { class: 'wrap-facts sticker' }, facts),
      shareBtn];
  }

  function rr(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function sticker(g, x, y, w, h, r, fill) {
    g.fillStyle = '#1d0f3a'; rr(g, x + 10, y + 12, w, h, r); g.fill();
    g.fillStyle = fill; rr(g, x, y, w, h, r); g.fill();
    g.lineWidth = 7; g.strokeStyle = '#1d0f3a'; g.stroke();
  }
  const loadImg = (src) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = src; });

  /* A story-sized picture (1080×1920) of the month, for WhatsApp or Instagram. */
  async function drawMonth(off, s) {
    await Promise.all(['400 120px Lalezar', '700 48px Baloo'].map((f) => document.fonts.load(f, 'مسار MASAR'))).catch(() => {});
    const c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, 1920);
    bg.addColorStop(0, '#6c3df0'); bg.addColorStop(1, '#3d14a8');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1920);
    g.lineCap = 'round'; g.lineWidth = 34;
    [['#ffd21f', [-60, 1500, 300, 1300, 200, 1050, 560, 980]], ['#19d3b4', [1140, 300, 820, 420, 980, 700, 700, 860]], ['#ff3d8b', [880, 1980, 820, 1700, 1100, 1600, 1160, 1400]]]
      .forEach(([col, p]) => { g.strokeStyle = col; g.globalAlpha = 0.85; g.beginPath(); g.moveTo(p[0], p[1]); g.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]); g.stroke(); });
    g.globalAlpha = 1;
    try {
      const logo = await loadImg('logo-light.svg');
      g.save(); g.translate(540, 260); g.rotate(-0.07);
      g.fillStyle = '#1d0f3a'; rr(g, -100 + 10, -100 + 12, 200, 200, 46); g.fill();
      rr(g, -100, -100, 200, 200, 46); g.clip(); g.drawImage(logo, -100, -100, 200, 200);
      g.restore();
      g.save(); g.translate(540, 260); g.rotate(-0.07); g.lineWidth = 7; g.strokeStyle = '#1d0f3a'; rr(g, -100, -100, 200, 200, 46); g.stroke(); g.restore();
    } catch (e) { /* no logo: the name still says it */ }
    g.direction = isAr() ? 'rtl' : 'ltr';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const shadowText = (text, x, y, font, fill) => { g.font = font; g.fillStyle = '#1d0f3a'; g.fillText(text, x + 6, y + 8); g.fillStyle = fill; g.fillText(text, x, y); };
    shadowText(t('monthCard'), 540, 470, '400 64px Lalezar, Baloo, sans-serif', '#fffaf0');
    shadowText(monthLabel(off), 540, 590, '400 112px Lalezar, Baloo, sans-serif', '#ffd21f');
    const tiles = [[s.count, t('monthTrips'), '#ffd21f'], [Math.round(s.km), t('monthKm'), '#19d3b4'], [s.hours.toFixed(1), t('monthHours'), '#ff3d8b']];
    const order = isAr() ? [...tiles].reverse() : tiles;
    order.forEach(([v, label, col], i) => {
      const x = 60 + i * 330;
      sticker(g, x, 720, 300, 330, 44, col);
      g.fillStyle = '#1d0f3a';
      g.font = '400 128px Lalezar, Baloo, sans-serif'; g.fillText(String(v), x + 150, 860);
      g.font = '700 40px Baloo, sans-serif'; g.fillText(label, x + 150, 975);
    });
    const lines = [];
    if (s.top) lines.push([t('monthTop'), s.top[0]]);
    if (s.longest) lines.push([t('monthLongest'), `${A.fmtDist(s.longest.m)} · ${s.longest.to}`]);
    lines.push([t('monthDay'), t(`d${s.busiest}`)]);
    sticker(g, 60, 1140, 960, 90 + lines.length * 130, 44, '#fffaf0');
    lines.forEach(([title, value], i) => {
      const y = 1222 + i * 130;
      g.fillStyle = '#51416f'; g.font = '700 38px Baloo, sans-serif'; g.fillText(title, 540, y - 22);
      g.fillStyle = '#1d0f3a'; g.font = '400 58px Lalezar, Baloo, sans-serif';
      let text = value;
      while (g.measureText(text).width > 880 && text.length > 4) text = `${text.slice(0, -2)}…`;
      g.fillText(text, 540, y + 36);
    });
    g.fillStyle = '#fffaf0';
    g.font = '400 56px Lalezar, Baloo, sans-serif'; g.fillText(isAr() ? 'مسار' : 'MASAR', 540, 1760);
    g.font = '700 36px Baloo, sans-serif'; g.fillText(t('tag'), 540, 1830);
    return c.toDataURL('image/png');
  }

  async function shareMonth(off, s) {
    const text = t('monthShareText', monthLabel(off), s.count, Math.round(s.km), s.hours.toFixed(1));
    const n = native();
    try {
      const png = await drawMonth(off, s);
      if (n && n.shareImage) { n.shareImage(png.split(',')[1], text); return; }
      const blob = await (await fetch(png)).blob();
      const file = new File([blob], 'masar-month.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text }); return; }
      const a = el('a', { href: png, download: 'masar-month.png' });
      document.body.append(a); a.click(); a.remove();
      return;
    } catch (e) { /* drawing failed: share the words */ }
    shareText(text);
  }

  /* ================================================== emergency */
  const EMERGENCY = [['101', 'sosAmb', 'health'], ['100', 'sosPolice', 'police'], ['102', 'sosFire', 'siren']];

  function dial(number) {
    const n = native();
    if (n && n.dial) n.dial(number); else location.href = `tel:${number}`;
  }

  async function sendSos() {
    toast(t('sosLocating'));
    const nav = A.nav();
    let at = nav && nav.pos ? { lat: nav.pos[0], lng: nav.pos[1] } : null;
    if (!at) at = await Promise.race([A.locate(true), new Promise((ok) => setTimeout(() => ok(null), 9000))]);
    if (!at) at = await A.locate(false);
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msg = at ? t('sosMsg', `https://maps.google.com/?q=${at.lat.toFixed(6)},${at.lng.toFixed(6)}`, time) : t('sosNoLoc');
    const numbers = store.sosContacts.map((c) => c.phone).join(',');
    const n = native();
    buzz(120);
    if (numbers && n && n.sms) n.sms(numbers, msg);
    else if (numbers) location.href = `sms:${numbers}?body=${encodeURIComponent(msg)}`;
    else shareText(msg);
  }

  function renderSos() {
    const big = el('button', { class: 'sos-big', on: sendSos },
      el('span', { class: 'sos-ring', html: icon('siren') }), el('b', {}, t('sosSend')), el('small', {}, t('sosSendSub')));
    const calls = el('div', { class: 'sos-calls' }, EMERGENCY.map(([num, label, ic], i) => el('button', {
      class: `sos-call c${i}`, html: icon(ic), on: () => dial(num),
    }, el('b', {}, num), el('small', {}, t(label)))));
    const name = el('input', { class: 'field', placeholder: t('sosName'), 'aria-label': t('sosName'), maxlength: '24' });
    const phone = el('input', { class: 'field', type: 'tel', placeholder: t('sosPhone'), 'aria-label': t('sosPhone'), dir: 'ltr', maxlength: '20' });
    const add = el('button', { class: 'btn teal', html: icon('plus') }, t('sosAdd'));
    add.addEventListener('click', () => {
      const num = phone.value.replace(/[^\d+]/g, '');
      if (num.length < 7) { toast(t('sosBadPhone')); phone.focus(); return; }
      if (store.sosContacts.length >= 5) { toast(t('sosMax')); return; }
      store.sosContacts.push({ name: name.value.trim() || num, phone: num });
      persist();
      P.refresh();
    });
    const list = store.sosContacts.length
      ? el('ul', { class: 'sos-list' }, store.sosContacts.map((c, i) => el('li', {},
        el('span', { html: icon('user') }), el('div', {}, el('b', {}, c.name), el('small', { dir: 'ltr' }, c.phone)),
        el('button', { class: 'mini', 'aria-label': t('sosRemove', c.name), html: icon('x'), on: () => { store.sosContacts.splice(i, 1); persist(); P.refresh(); } }))))
      : el('p', { class: 'hint' }, t('sosNoContacts'));
    return [
      big,
      el('section', { class: 'card sticker' }, el('h2', {}, t('sosCall')), calls),
      el('section', { class: 'card sticker' }, el('h2', {}, t('sosContacts')), list, name, phone, add, el('p', { class: 'hint' }, t('sosLocal'))),
      el('button', { class: 'btn ghost', html: icon('share'), on: async () => {
        const at = await A.locate();
        shareText(at ? t('sosMsg', `https://maps.google.com/?q=${at.lat.toFixed(6)},${at.lng.toFixed(6)}`, new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) : t('sosNoLoc'));
      } }, t('sosShareAny')),
    ];
  }

  /* ================================================== voice commands */
  function micButton(cls = '') {
    return el('button', { class: `mic ${cls}`, 'aria-label': t('micLabel'), html: icon('mic'), on: listen });
  }

  function listen() {
    const n = native();
    if (n && n.listen) {
      if (!n.listen(isAr() ? 'ar-PS' : 'en-US', t('listening'))) toast(t('voiceUnsupported'));
      return;
    }
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) { toast(t('voiceUnsupported')); return; }
    const rec = new Rec();
    rec.lang = isAr() ? 'ar-PS' : 'en-US';
    rec.maxAlternatives = 5;
    rec.interimResults = true;
    const partial = el('p', { class: 'listen-text' }, '');
    let done = false;
    const finish = (list) => { if (done) return; done = true; closeModal(); heard(list); };
    rec.onresult = (e) => {
      const r = e.results[e.results.length - 1];
      partial.textContent = r[0].transcript;
      if (r.isFinal) finish([...r].map((a) => a.transcript));
    };
    rec.onerror = () => finish([]);
    rec.onend = () => finish([]);
    openModal(el('div', { class: 'listen' }, el('span', { class: 'listen-mic', html: icon('mic') }), el('h2', {}, t('listening')), partial,
      el('small', { class: 'hint' }, t('voiceTry'))),
    el('button', { class: 'btn ghost', on: () => { done = true; rec.abort(); closeModal(); } }, t('cancel')));
    try { rec.start(); } catch (e) { finish([]); }
  }

  /* The phone's speech service answers here: a list of what it heard, best first. */
  window.masarHeard = (list) => heard(Array.isArray(list) ? list : []);

  const clean = (s) => A.norm(String(s).replace(/[؟?!.,،"«»]/g, ' ')).replace(/\s+/g, ' ').trim();

  function heard(list) {
    const said = list.map(clean).filter(Boolean);
    if (!said.length) { toast(t('voiceNone')); return; }
    for (const text of said) {
      for (const [re, run] of COMMANDS) {
        if (re.test(text) && run(text) !== false) return;
      }
    }
    toast(`${t('voiceNo', list[0])}\n${t('voiceTry')}`);
  }

  function reply(text) { toast(text); say(text); }

  const REPORT_WORDS = [
    [/حادث|حوادث|تصادم|accident|crash/, 'accident'], [/زحم|ازمه|عجق|traffic|jam/, 'traffic'], [/حاجز|حواجز|checkpoint/, 'checkpoint'],
    [/شرطه|بوليس|police/, 'police'], [/مسكر|مغلق|سكر|مسدود|closed/, 'closed'], [/خطر|حفره|جوره|حجار|زيت|hazard|pothole/, 'hazard'],
  ];
  const NEAR_WORDS = [
    [/بنزين|محطه|كازيه|كازي|وقود|gas|fuel|petrol/, 'fuel'], [/صيدل|pharmac/, 'pharmacy'], [/مستشف|hospital/, 'health', ['hospital']], [/عياد|دكتور|طبيب|clinic|doctor/, 'health'],
    [/مطعم|اكل|food|restaurant|eat/, 'food'], [/قهوه|كافيه|كوفي|coffee|cafe/, 'coffee'], [/بنك|صراف|atm|bank/, 'bank'],
    [/مسجد|جامع|كنيسه|mosque|church/, 'worship'], [/موقف|باركن|parking/, 'parking'], [/غسيل|مغسله|wash/, 'wash'],
    [/فندق|hotel/, 'hotel'], [/شرطه|police/, 'police'], [/مدرسه|school/, 'school'], [/محل|سوبر|ماركت|دكان|shop|market/, 'shop'],
  ];

  function stopCmd() {
    if (!A.nav()) { reply(t('voiceNoTrip')); return true; }
    A.stopNav();
    reply(t('voiceStopped'));
    return true;
  }

  function muteCmd(muted) {
    if (!muted) A.setMuted(false);
    reply(t(muted ? 'voiceMuted' : 'voiceUnmuted'));
    if (muted) A.setMuted(true);
    return true;
  }

  function musicCmd(what) {
    if (!F.music(what)) reply(t('voiceNoMusic'));
    return true;
  }

  function etaCmd() {
    const nav = A.nav();
    if (!nav) { reply(t('voiceNoTrip')); return true; }
    const left = Math.max(0, nav.track.total - nav.at), seconds = nav.route.time * (left / Math.max(nav.track.total, 1));
    reply(t('voiceEta', A.fmtTime(seconds), new Date(Date.now() + seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
    return true;
  }

  function shareEtaCmd() {
    if (!A.nav()) { reply(t('voiceNoTrip')); return true; }
    F.shareEta();
    return true;
  }

  function leaveCmd() {
    const next = todaysLeave();
    reply(next ? t('voiceLeave', hm(leaveMin(next.p)), next.p.dest.label, next.p.arrive) : t('voiceNoLeave'));
    return true;
  }

  function reportCmd(text) {
    const hit = REPORT_WORDS.find(([re]) => re.test(text));
    if (!hit) return false;
    F.reportHere(hit[1]).then((ok) => { if (ok) reply(t('voiceReported', F.kindName(hit[1]))); }).catch(() => toast(t('reportFail')));
    return true;
  }

  function nearestCmd(text) {
    const hit = NEAR_WORDS.find(([re]) => re.test(text));
    if (!hit) return false;
    const cat = F.CATS.find((c) => c[0] === hit[1]);
    const nav = A.nav();
    (nav && nav.pos ? Promise.resolve({ lat: nav.pos[0], lng: nav.pos[1] }) : A.locate()).then((h) => {
      if (!h || R.nearestNode(h.lat, h.lng).meters > R.MAX_SNAP_M) { F.openNearby(hit[1]); return; }
      const cos = Math.cos(h.lat * Math.PI / 180);
      const kinds = hit[2] || cat[2];
      const pool = [...A.POIS, ...store.myPois.map((p) => ({ ...p, ar: p.name, en: p.name }))].filter((p) => kinds.includes(p.kind));
      let best = null, bestD = Infinity;
      pool.forEach((p) => { const d = (p.lat - h.lat) ** 2 + ((p.lng - h.lng) * cos) ** 2; if (d < bestD) { bestD = d; best = p; } });
      if (!best) { F.openNearby(hit[1]); return; }
      const label = isAr() ? best.ar || best.en : best.en || best.ar;
      reply(t('voiceNearest', t(`c_${hit[1]}`), label));
      if (nav) return; // never replace a running trip by voice
      A.state.from = null;
      A.goTo({ label, lat: best.lat, lng: best.lng });
    });
    return true;
  }

  const SAVED_WORDS = [[/^(ال)?(بيت|دار)( ي)?$|^بيتي$|^داري$|^home$/, 'home'], [/^(ال)?(شغل|دوام|مكتب|عمل)$|^work$/, 'work'],
    [/^(ال)?جامعه$|^university$/, 'uni'], [/^(ال)?مول$|^mall$/, 'mall']];

  function navigateCmd(text) {
    const verb = /^(يلا )?(وديني|ودني|ودي|خدني|خذني|وصلني|روحني|بدي اروح|بدي|خليني اروح|نروح|اروح|روح|سوق|take me|navigate|drive|go)( to)?\s*/;
    const hasVerb = verb.test(text);
    let q = text.replace(verb, '').replace(/^(علي|عل|الي|لعند|عند|ع|to)\s+/, '').replace(/^(عال|عل)(?=\S)/, 'ال').replace(/^لل/, 'ال').trim();
    if (!q) return false;
    const saved = SAVED_WORDS.find(([re]) => re.test(q));
    if (saved) {
      const s = store.saved.find((x) => x.kind === saved[1]);
      if (s && s.lat !== null) return go({ label: A.savedLabel(s), lat: s.lat, lng: s.lng });
      if (s) { reply(t('voiceNotSet', A.savedLabel(s))); return true; }
    }
    let items = A.searchItems(q);
    if (!items.length && q.startsWith('ال')) items = A.searchItems(q.slice(2));
    if (!items.length) return hasVerb ? (toast(t('voiceNo', q)), true) : false;
    return go(items[0]);
  }

  function go(dest) {
    if (A.nav()) A.stopNav();
    reply(t('voiceGoing', dest.label));
    A.state.from = null;
    A.goTo({ label: dest.label, lat: dest.lat, lng: dest.lng });
    return true;
  }

  const COMMANDS = [
    [/^(وقف|اوقف|بطل|خلص|الغي|سكر)( ال)?(ملاحه|رحله|مشوار|توجيه|طريق)?$|^(stop|cancel)( navigation| the trip)?$/, stopCmd],
    [/(سكت|اسكت|طفي|اطفي|وقف|سكر|اقفل) (ال)?صوت|^(mute|be quiet)/, () => muteCmd(true)],
    [/(شغل|رجع|افتح|ارجع) (ال)?صوت|^unmute/, () => muteCmd(false)],
    [/(اغنيه|غنيه).*(الجاي|بعد|التالي)|(غير|بدل) (ال)?(اغنيه|غنيه)|^(next song|skip( song)?|next track)$/, () => musicCmd('next')],
    [/(اغنيه|غنيه).*(قبل|السابق)|^previous (song|track)$/, () => musicCmd('prev')],
    [/(وقف|اوقف|سكر|شغل|كمل) (ال)?(موسيق|اغاني|اغنيه|غنيه)|^(pause|play|resume)( the)? music$/, () => musicCmd('toggle')],
    [/(ابعت|شارك|ارسل|بعت|ابعث).*(وصول|وقت)|^share.*(eta|arrival)/, shareEtaCmd],
    [/(ايمت|امت|متي|اديش|قديش|كم).*(بوصل|اوصل|نوصل|باقي|ضايل|ظايل)|when.*arrive|how long/, etaCmd],
    [/(ايمت|امت|متي|اديش).*(اطلع|اتحرك)|when.*leave/, leaveCmd],
    [/طوارئ|طوارء|نجده|ساعدوني|ساعدني|النجده|اسعفوني|^sos$|emergency|help me/, () => { P.open('sos'); return true; }],
    [/^(بلغ|بلغي|ابلاغ|بلاغ|report)/, reportCmd],
    [/(اقرب|اقربلي|nearest|closest)/, nearestCmd],
    [/./, navigateCmd],
  ];

  function voiceHelp() {
    const ex = (ic, key) => el('li', {}, el('span', { html: icon(ic) }), el('span', {}, t(key)));
    openModal(el('h2', {}, t('voiceExamples')),
      el('ul', { class: 'voice-ex' }, ex('home', 'vxGo'), ex('compass', 'vxNear'), ex('clock', 'vxTrip'), ex('report', 'vxReport'), ex('music', 'vxMusic'), ex('alarm', 'vxMore')),
      el('button', { class: 'btn pink', html: icon('mic'), on: () => { closeModal(); listen(); } }, t('voiceTryNow')),
      el('button', { class: 'btn ghost', on: closeModal }, t('close')));
  }

  /* ================================================== welcome screen */
  function renderHello() {
    const d = new Date(), h = d.getHours();
    const greet = t(h >= 4 && h < 12 ? 'helloMorning' : h >= 12 && h < 17 ? 'helloNoon' : h >= 17 && h < 22 ? 'helloEvening' : 'helloNight');
    const day = new Intl.DateTimeFormat(isAr() ? 'ar-u-nu-latn' : 'en-GB', { weekday: 'long' }).format(d);
    const date = `${day} ${d.getDate()} ${monthName(d.getMonth())}`;
    const night = h < 6 || h >= 19;
    const name = (store.name || '').trim();

    const quick = store.saved.filter((s) => s.lat !== null).slice(0, 4).map((s, i) => el('button', {
      class: `hello-place c${i % 6}`, html: icon(A.savedIcon(s)), on: () => { A.state.from = null; A.goTo({ label: A.savedLabel(s), lat: s.lat, lng: s.lng }); },
    }, el('span', {}, A.savedLabel(s))));

    const cards = [];
    const next = todaysLeave();
    if (next) {
      const lm = leaveMin(next.p);
      const text = next.diff <= 0 ? t('leaveNowCard', next.p.dest.label, next.p.arrive)
        : next.diff <= 45 ? t('leaveSoon', A.fmtTime(next.diff * 60), next.p.dest.label) : t('leaveCard', hm(lm), next.p.dest.label, next.p.arrive);
      cards.push(el('button', { class: `hello-card sticker leave-now ${next.diff <= 0 ? 'urgent' : ''}`, on: () => (next.diff <= 30 ? goPlan(next.p) : P.open('leave', true)), html: icon('alarm') },
        el('span', {}, el('b', {}, text), el('small', {}, `${A.fmtTime(next.p.travel)} · ${t('leaveFrom', next.p.from.label)}`))));
    } else {
      cards.push(el('button', { class: 'hello-card sticker', on: () => P.open('leave', true), html: icon('alarm') },
        el('span', {}, el('b', {}, t('leaveSetup')), el('small', {}, t('leaveSetupSub')))));
    }
    const last = monthStats(-1), cur = monthStats(0), lastKey = monthLabel(-1);
    if (d.getDate() <= 7 && last.count && store.monthSeen !== lastKey) {
      cards.push(el('button', { class: 'hello-card sticker month-ready', html: icon('chart'), on: () => { store.monthSeen = lastKey; persist(); monthOff = -1; P.open('month', true); } },
        el('span', {}, el('b', {}, t('monthReady', monthName(monthRange(-1)[0].getMonth()))), el('small', {}, t('monthSoFar', last.count, Math.round(last.km))))));
    } else if (cur.count) {
      cards.push(el('button', { class: 'hello-card sticker', html: icon('chart'), on: () => { monthOff = 0; P.open('month', true); } },
        el('span', {}, el('b', {}, t('month')), el('small', {}, t('monthSoFar', cur.count, cur.km.toFixed(cur.km < 10 ? 1 : 0))))));
    }
    const reports = F.activeReports().length;
    if (reports) cards.push(el('button', { class: 'hello-card sticker', html: icon('report'), on: () => F.openExplore() }, el('span', {}, el('b', {}, t('reportsNow', reports)))));

    $('hello').replaceChildren(el('div', { class: `hello-in ${night ? 'sky-night' : 'sky-day'}` },
      el('div', { class: 'hello-sky', 'aria-hidden': 'true' },
        el('span', { class: 'orb' }), el('span', { class: 'cloud c1' }), el('span', { class: 'cloud c2' }),
        el('span', { class: 'star s1' }), el('span', { class: 'star s2' }), el('span', { class: 'star s3' }),
        el('div', { class: 'hello-road', html: '<svg viewBox="0 0 400 120" preserveAspectRatio="none"><path class="rd" d="M-10 100C80 100 110 40 200 50S330 110 410 60"/><path class="ln" d="M-10 100C80 100 110 40 200 50S330 110 410 60"/></svg>' })),
      el('div', { class: 'hello-top' },
        el('img', { class: 'hello-logo', src: A.logoFile(), alt: '', 'data-logo': '' }),
        el('div', { class: 'hello-top-end' },
          el('button', { class: 'hello-sos', on: () => P.open('sos', true), html: icon('siren') }, t('sosShort')),
          el('button', { class: 'hello-me', 'aria-label': t('account'), on: () => P.open('account', true) }, P.avatar('small')))),
      el('div', { class: 'hello-greet' },
        el('small', {}, date),
        el('h1', {}, `${greet}${name ? '،' : ''}`, name ? el('span', {}, name) : ''),
        el('p', {}, t('helloSub'))),
      el('div', { class: 'hello-ask sticker' },
        el('button', { class: 'hello-where', html: icon('search'), on: () => A.focusSearch() }, el('span', {}, t('whereToday'))),
        micButton('hello-mic')),
      quick.length ? el('div', { class: 'hello-quick' }, quick) : '',
      el('div', { class: 'hello-cards' }, cards),
      el('button', { class: 'btn yellow hello-go', on: () => { A.state.query = ''; A.renderHome(); show('home'); } },
        t('letsGo'), el('span', { html: icon('arrow', 'flip') }))));
  }

  function openHello() {
    renderHello();
    show('hello');
    $('hello').scrollTop = 0;
  }

  function afterIntro() {
    const p = takeLeave();
    if (p) { goPlan(p); return; }
    openHello();
  }

  /* ================================================== wiring */
  P.register('leave', renderLeave);
  P.register('month', renderMonth);
  P.register('sos', renderSos);

  function paintStatic() {
    const mic = $('driveMic');
    mic.innerHTML = icon('mic');
    mic.setAttribute('aria-label', t('micLabel'));
  }
  $('driveMic').addEventListener('click', listen);
  paintStatic();
  const setLang = A.setLang;
  A.setLang = () => { setLang(); paintStatic(); };

  /* The plans' notification text follows the language, and alarms are rebuilt after an update of the app. */
  syncAlarms();

  window.MasarPlus = {
    afterIntro, openHello, micButton, listen, syncAlarms,
    menuRows: (row) => [
      row('alarm', t('leave'), () => P.open('leave')),
      row('chart', t('month'), () => { monthOff = 0; P.open('month'); }),
      row('mic', t('voiceHelp'), voiceHelp),
      row('siren', t('sos'), () => P.open('sos'), 'sos-row'),
    ],
    privacyParts: (para) => [para(t('pVoice'), t('pVoiceText'))],
    heard, drawMonth: () => drawMonth(monthOff, monthStats(monthOff)), // for tests
  };
})();
