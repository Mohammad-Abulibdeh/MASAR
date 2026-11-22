/* MASAR extra pages: account (Firebase email sign-in + sync), settings, my trips, about, privacy. */
(function () {
  const A = window.MasarApp;
  const { store, persist, t, el, icon, show, toast, openModal, closeModal } = A;
  const VERSION = '1.6.1';

  Object.assign(A.STRINGS.ar, {
    account: 'الحساب', settings: 'الإعدادات', trips: 'رحلاتي', about: 'عن مسار', privacy: 'الخصوصية',
    guest: 'ضيف', localOnly: 'بياناتك محفوظة على هالموبايل بس', signedAs: 'داخل باسم {0}',
    email: 'الإيميل', password: 'كلمة السر', signIn: 'تسجيل الدخول', signUp: 'حساب جديد', signOut: 'تسجيل الخروج',
    forgot: 'نسيت كلمة السر؟', resetSent: 'بعثنالك إيميل لتغيير كلمة السر', needEmail: 'اكتب إيميلك أول',
    signInWhy: 'سجّل دخول حتى تنحفظ أماكنك ورحلاتك وتلاقيها على أي موبايل.',
    authOff: 'تسجيل الدخول رح يشتغل قريبا. لهلأ كل إشي محفوظ على الموبايل.',
    welcomeBack: 'أهلا فيك!', accountMade: 'انعمل حسابك', signedOut: 'طلعت من حسابك',
    syncNow: 'زامن هلأ', synced: 'كل إشي محفوظ بحسابك', syncing: 'بزامن...', syncFail: 'ما قدرنا نزامن. تأكد من الإنترنت.',
    eExists: 'في حساب بهالإيميل. جرّب تسجيل الدخول.', eWrong: 'الإيميل أو كلمة السر غلط', eWeak: 'كلمة السر لازم تكون 6 حروف أو أكثر',
    eEmail: 'الإيميل مش مكتوب صح', eMany: 'محاولات كثير. استنى شوي وجرّب كمان مرة', eNet: 'ما في إنترنت، أو السيرفر مش راد', eOther: 'صار خطأ: {0}',
    name: 'الاسم', language: 'اللغة', voiceGuide: 'صوت الإرشادات', on: 'شغّال', off: 'مسكّر', defTraffic: 'الزحمة الافتراضية',
    noTrips: 'لسا ما في رحلات. أول ما تسوق مع مسار، رحلاتك بتطلع هون.', tripsCount: 'رحلة', totalKm: 'كم', totalTime: 'ساعة',
    arrivedBadge: 'وصلت', stoppedBadge: 'وقّفت', clearTrips: 'امسح الرحلات', clearTripsAsk: 'تمسح كل الرحلات؟', cleared: 'انمسحت',
    aboutText: 'مسار تطبيق ملاحة فلسطيني بيدوّرلك على أفضل طريق بمحافظة رام الله والبيرة وقراها، وبيرشدك بالصوت خطوة بخطوة، على الموبايل وعلى شاشة السيارة.',
    aboutHow: 'مسار بيقارن كذا طريق، وبيحسب حساب الزحمة وسرعة كل شارع، وبنصحك بالأسرع.',
    aboutData: 'الخريطة وأسماء الشوارع والأماكن من OpenStreetMap (رخصة ODbL)، بفضل المتطوعين اللي رسموها.',
    aboutTraffic: 'الزحمة بهالإصدار محاكاة من مشروع مسار، مش بيانات حية.', version: 'الإصدار {0}', madeIn: 'صُنع في فلسطين',
    pOnPhone: 'شو بنحفظ على موبايلك', pOnPhoneText: 'اسمك، أماكنك، رحلاتك (من وين لوين، المسافة والوقت)، وإعداداتك. هاي بتضل على الموبايل.',
    pLocation: 'موقعك', pLocationText: 'بنستعمل الموقع على الموبايل بس: حتى نعرف من وين تبلش ونرشدك وإنت سايق. ما بنبعث موقعك لحدا، وما بنحفظ الطريق اللي سقته.',
    pAccount: 'إذا سجّلت دخول', pAccountText: 'إيميلك، واسمك وأماكنك ورحلاتك وإعداداتك، بتنحفظ بحسابك على Firebase من Google، حتى تلاقيها على أي موبايل. موقعك اللحظي ما بينحفظ.',
    pCar: 'شاشة السيارة', pCarText: 'Android Auto بيعرض نفس الملاحة على شاشة السيارة، وما بينبعث منه إشي لبرا.',
    pReports: 'بلاغات الطريق', pReportsText: 'لما تبلّغ عن حادث أو حاجز أو زحمة، البلاغ بيطلع لكل مستخدمي مسار: نوعه ومكانه ووقته بس، بدون اسمك أو إيميلك. البلاغ بيختفي لحاله بعد ساعات، وبتقدر تحذف بلاغاتك.',
    pControl: 'إنت المتحكم', pControlText: 'بتقدر تمسح بياناتك من هالموبايل، أو تحذف حسابك وكل بياناته، بأي وقت.',
    wipeLocal: 'امسح بياناتي من هالموبايل', wipeLocalAsk: 'تمسح اسمك وأماكنك ورحلاتك وإعداداتك من هالموبايل؟',
    deleteAccount: 'احذف حسابي', deleteAccountAsk: 'تحذف حسابك وكل البيانات المحفوظة فيه؟ ما في رجعة.', accountDeleted: 'انحذف حسابك',
    reSignIn: 'لأمانك، سجّل دخول من جديد وبعدين احذف الحساب.', yesDo: 'آه، امسح',
    profile: 'تعديل الحساب', editAccount: 'عدّل الحساب', changePhoto: 'غيّر الصورة', pickPhoto: 'اختار صورة', removePhoto: 'شيل الصورة',
    photoHint: 'الصورة بتنحفظ على موبايلك، وبحسابك إذا كنت داخل.', photoBad: 'ما قدرنا نفتح هالصورة', cropTitle: 'زبّط الصورة',
    cropHint: 'حرّك الصورة بإصبعك، وكبّرها أو صغّرها من الشريط.', cropZoom: 'التكبير', done: 'تمام',
    saveChanges: 'احفظ التغييرات', savedProfile: 'انحفظ حسابك',
    changeEmail: 'غيّر الإيميل', newEmail: 'الإيميل الجديد', sameEmail: 'هاد نفس إيميلك',
    emailSent: 'بعثنا رابط تأكيد على {0}. افتحه، وبعدها سجّل دخول بالإيميل الجديد.',
    changePass: 'غيّر كلمة السر', currentPass: 'كلمة السر الحالية', newPass: 'كلمة السر الجديدة', passChanged: 'تغيّرت كلمة السر',
    guestEdit: 'سجّل دخول حتى تقدر تغيّر الإيميل وكلمة السر.', syncedBadge: 'محفوظ بحسابك', localBadge: 'على الموبايل بس',
    statPoints: 'نقطة',
  });
  Object.assign(A.STRINGS.en, {
    account: 'Account', settings: 'Settings', trips: 'My trips', about: 'About MASAR', privacy: 'Privacy',
    guest: 'Guest', localOnly: 'Your data is kept on this phone only', signedAs: 'Signed in as {0}',
    email: 'Email', password: 'Password', signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out',
    forgot: 'Forgot your password?', resetSent: 'We sent you an email to reset your password', needEmail: 'Type your email first',
    signInWhy: 'Sign in to keep your places and trips and find them on any phone.',
    authOff: 'Sign-in is coming soon. For now everything is kept on this phone.',
    welcomeBack: 'Welcome!', accountMade: 'Your account is ready', signedOut: 'Signed out',
    syncNow: 'Sync now', synced: 'Everything is saved to your account', syncing: 'Syncing...', syncFail: "Couldn't sync. Check your internet.",
    eExists: 'An account with this email exists. Try signing in.', eWrong: 'Wrong email or password', eWeak: 'The password needs 6 characters or more',
    eEmail: 'That email does not look right', eMany: 'Too many tries. Wait a little and try again', eNet: 'No internet, or the server is not answering', eOther: 'Something went wrong: {0}',
    name: 'Name', language: 'Language', voiceGuide: 'Voice directions', on: 'On', off: 'Off', defTraffic: 'Default traffic',
    noTrips: 'No trips yet. Once you drive with MASAR, your trips show up here.', tripsCount: 'trips', totalKm: 'km', totalTime: 'hours',
    arrivedBadge: 'Arrived', stoppedBadge: 'Stopped', clearTrips: 'Clear trips', clearTripsAsk: 'Clear all trips?', cleared: 'Cleared',
    aboutText: 'MASAR is a Palestinian navigation app that finds you the best way around Ramallah and Al-Bireh Governorate and its villages, with spoken turn-by-turn directions on the phone and on the car screen.',
    aboutHow: 'MASAR compares several routes, counts in traffic and the speed of every street, and suggests the quickest.',
    aboutData: 'Map, street and place names come from OpenStreetMap (ODbL licence), thanks to the volunteers who mapped them.',
    aboutTraffic: 'Traffic in this version is simulated by the MASAR project, not live data.', version: 'Version {0}', madeIn: 'Made in Palestine',
    pOnPhone: 'What we keep on your phone', pOnPhoneText: 'Your name, places, trips (from where to where, distance and time) and settings. They stay on the phone.',
    pLocation: 'Your location', pLocationText: 'Location is used on the phone only: to know where you start and to guide you while driving. It is never sent anywhere, and the path you drove is not stored.',
    pAccount: 'If you sign in', pAccountText: 'Your email, name, places, trips and settings are kept in your account on Google Firebase, so you find them on any phone. Your live location is never stored.',
    pCar: 'Car screen', pCarText: 'Android Auto shows the same navigation on the car screen. Nothing is sent out from it.',
    pReports: 'Road reports', pReportsText: 'When you report an accident, checkpoint or traffic, every MASAR user sees it: only its type, place and time, never your name or email. Reports disappear by themselves after a few hours, and you can delete your own.',
    pControl: 'You are in control', pControlText: 'You can wipe your data from this phone, or delete your account and all its data, at any time.',
    wipeLocal: 'Wipe my data from this phone', wipeLocalAsk: 'Wipe your name, places, trips and settings from this phone?',
    deleteAccount: 'Delete my account', deleteAccountAsk: 'Delete your account and everything saved in it? This cannot be undone.', accountDeleted: 'Your account was deleted',
    reSignIn: 'For your safety, sign in again, then delete the account.', yesDo: 'Yes, go ahead',
    profile: 'Edit account', editAccount: 'Edit account', changePhoto: 'Change photo', pickPhoto: 'Choose a photo', removePhoto: 'Remove photo',
    photoHint: 'The photo is kept on your phone, and in your account when you are signed in.', photoBad: "Couldn't open this picture", cropTitle: 'Fit your photo',
    cropHint: 'Drag the photo with your finger, and zoom with the slider.', cropZoom: 'Zoom', done: 'Done',
    saveChanges: 'Save changes', savedProfile: 'Your account is saved',
    changeEmail: 'Change email', newEmail: 'New email', sameEmail: 'That is already your email',
    emailSent: 'We sent a confirmation link to {0}. Open it, then sign in with the new email.',
    changePass: 'Change password', currentPass: 'Current password', newPass: 'New password', passChanged: 'Password changed',
    guestEdit: 'Sign in to change your email and password.', syncedBadge: 'Saved to your account', localBadge: 'On this phone only',
    statPoints: 'points',
  });
  Object.assign(A.ICONS, {
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    chev: '<path d="M9 5l7 7-7 7"/>', out: '<path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10"/>', cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 6.5l8.5 6 8.5-6"/>',
    camera: '<path d="M3.5 8.5h3.5l2-3h6l2 3h3.5v11h-17z"/><circle cx="12" cy="13.5" r="3.5"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>',
  });

  /* -------------------------------------------------- Firebase (REST, no SDK: the app stays light and offline-first) */
  const CFG = window.MASAR_FIREBASE || {};
  const authOn = () => !!(CFG.apiKey && CFG.projectId);
  let auth = null;
  try { auth = JSON.parse(localStorage.getItem('masar-auth') || 'null'); } catch (e) { auth = null; }
  const saveAuth = () => { try { localStorage.setItem('masar-auth', JSON.stringify(auth)); } catch (e) { /* this run only */ } };

  class AuthError extends Error {}
  const ERR = {
    EMAIL_EXISTS: 'eExists', EMAIL_NOT_FOUND: 'eWrong', INVALID_PASSWORD: 'eWrong', INVALID_LOGIN_CREDENTIALS: 'eWrong',
    INVALID_EMAIL: 'eEmail', MISSING_EMAIL: 'eEmail', MISSING_PASSWORD: 'eWeak', TOO_MANY_ATTEMPTS_TRY_LATER: 'eMany',
    CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'reSignIn', TOKEN_EXPIRED: 'reSignIn', USER_NOT_FOUND: 'eWrong', USER_DISABLED: 'eWrong',
  };
  const errText = (e) => {
    if (!(e instanceof AuthError)) return t('eNet');
    const code = e.message.split(' ')[0].split(':')[0];
    if (code.startsWith('WEAK_PASSWORD')) return t('eWeak');
    return ERR[code] ? t(ERR[code]) : t('eOther', e.message.slice(0, 60));
  };

  async function call(url, body, form) {
    let r;
    try {
      r = await fetch(url, form
        ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch (e) { throw new Error('network'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new AuthError((data.error && data.error.message) || String(r.status));
    return data;
  }
  const idt = (op) => `https://identitytoolkit.googleapis.com/v1/accounts:${op}?key=${CFG.apiKey}`;

  function setSession(d) {
    auth = {
      uid: d.localId || d.user_id, email: d.email || (auth && auth.email), token: d.idToken || d.id_token,
      refresh: d.refreshToken || d.refresh_token, expires: Date.now() + (Number(d.expiresIn || d.expires_in) || 3600) * 1000,
    };
    saveAuth();
  }

  async function token() {
    if (!auth) throw new AuthError('TOKEN_EXPIRED');
    if (Date.now() > auth.expires - 60000) {
      setSession(await call(`https://securetoken.googleapis.com/v1/token?key=${CFG.apiKey}`,
        { grant_type: 'refresh_token', refresh_token: auth.refresh }, true));
    }
    return auth.token;
  }

  const docUrl = () => `https://firestore.googleapis.com/v1/projects/${CFG.projectId}/databases/(default)/documents/users/${auth.uid}`;
  const SYNCED = ['name', 'saved', 'trips', 'lang', 'appearance', 'traffic', 'muted',
    'myPois', 'carColor', 'avoidReports', 'parked', 'reportsMade', 'votesMade', 'speedAlert', 'leavePlans', 'photo'];

  async function pull() {
    const r = await fetch(docUrl(), { headers: { Authorization: `Bearer ${await token()}` } });
    if (r.status === 404) return null;
    if (!r.ok) throw new AuthError(String(r.status));
    const d = await r.json();
    try { return JSON.parse(d.fields.profile.stringValue); } catch (e) { return null; }
  }

  async function push() {
    const profile = { updated: Date.now() };
    SYNCED.forEach((k) => { profile[k] = store[k]; });
    const r = await fetch(`${docUrl()}?updateMask.fieldPaths=profile`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { profile: { stringValue: JSON.stringify(profile) } } }),
    });
    if (!r.ok) throw new AuthError(String(r.status));
  }

  /* After signing in, the account's places win, and trips from both sides are kept. */
  let merging = false;
  async function syncAfterSignIn() {
    const remote = await pull();
    if (remote) {
      merging = true;
      if (remote.name) store.name = remote.name;
      if (remote.photo) store.photo = remote.photo;
      if (Array.isArray(remote.saved) && remote.saved.some((s) => s.lat !== null)) store.saved = remote.saved;
      ['lang', 'appearance', 'traffic', 'muted', 'carColor', 'avoidReports', 'speedAlert'].forEach((k) => { if (remote[k] !== undefined) store[k] = remote[k]; });
      ['reportsMade', 'votesMade'].forEach((k) => { store[k] = Math.max(store[k] || 0, remote[k] || 0); });
      if (remote.parked && (!store.parked || remote.parked.t > store.parked.t)) store.parked = remote.parked;
      if (Array.isArray(remote.leavePlans) && remote.leavePlans.length && !(store.leavePlans || []).length) {
        store.leavePlans = remote.leavePlans;
        if (window.MasarPlus) window.MasarPlus.syncAlarms();
      }
      const seen = new Set();
      store.trips = [...(remote.trips || []), ...store.trips].filter((x) => !seen.has(x.t) && seen.add(x.t))
        .sort((a, b) => b.t - a.t).slice(0, 100);
      const ids = new Set();
      store.myPois = [...(remote.myPois || []), ...(store.myPois || [])].filter((p) => !ids.has(p.id) && ids.add(p.id));
      persist();
      merging = false;
      A.applyTheme();
      document.documentElement.lang = store.lang;
      document.documentElement.dir = store.lang === 'ar' ? 'rtl' : 'ltr';
    }
    await push();
  }

  let pushTimer = 0;
  function onPersist() {
    if (merging || !auth || !authOn()) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => push().catch(() => { /* retried on the next change or "Sync now" */ }), 2500);
  }

  /* -------------------------------------------------- page frame */
  const stack = [];
  const PAGES = { account: renderAccount, profile: renderProfile, settings: renderSettings, trips: renderTrips, about: renderAbout, privacy: renderPrivacy };

  /* `root` starts a fresh stack (a tab of the menu bar); otherwise the page goes on top of the current one. */
  function open(name, root) {
    if (root || document.body.dataset.screen !== 'pages') stack.length = 0;
    stack.push(name);
    render();
    show('pages');
    document.getElementById('pages').scrollTop = 0;
  }

  function refresh() {
    if (!stack.length) return;
    const page = document.getElementById('pages'), top = page.scrollTop;
    render(true);
    page.scrollTop = top;
  }

  function back() {
    stack.pop();
    if (!stack.length) { A.renderHome(); show('home'); return; }
    render();
  }

  function render(quiet) {
    const name = stack[stack.length - 1];
    const backBtn = el('button', { class: 'round', 'aria-label': 'Back', on: back, html: icon('back', 'flip') });
    const page = document.getElementById('pages');
    page.classList.toggle('calm', !!quiet);
    page.replaceChildren(el('div', { class: 'page-in', 'data-page': name },
      el('header', { class: 'page-head' }, backBtn, el('h1', {}, t(name))),
      el('div', { class: 'page-body' }, PAGES[name]())));
  }

  const row = (iconName, label, on, cls = '') => el('button', { class: `menu-row ${cls}`, on, html: icon(iconName) },
    el('span', {}, label), el('span', { class: 'chev', html: icon('chev', 'flip') }));
  const section = (title, ...kids) => el('section', { class: 'card sticker' }, title ? el('h2', {}, title) : '', ...kids);
  const busy = async (button, fn) => {
    const label = button.textContent;
    button.disabled = true;
    try { await fn(); } catch (e) { toast(errText(e)); } finally { button.disabled = false; button.textContent = label; }
  };

  /* -------------------------------------------------- account */
  /* The person's photo, or the first letter of their name. */
  function avatar(cls = '', photo = store.photo, name = store.name) {
    const letter = (name || '').trim().charAt(0).toUpperCase();
    return el('div', { class: `avatar ${cls}` }, photo ? el('img', { src: photo, alt: '' }) : letter || el('span', { html: icon('user') }));
  }

  function openProfile() { draft = null; open('profile'); }

  function renderAccount() {
    const name = (store.name || '').trim();
    const km = store.trips.reduce((a, x) => a + x.m, 0) / 1000;
    const stat = (value, label) => el('div', {}, el('b', {}, value), el('small', {}, label));
    const head = el('section', { class: 'acct-hero sticker' },
      el('div', { class: 'acct-band', 'aria-hidden': 'true', html: '<svg viewBox="0 0 400 110" preserveAspectRatio="none"><path class="rd" d="M-10 92C70 92 120 30 210 42S330 104 410 58"/><path class="ln" d="M-10 92C70 92 120 30 210 42S330 104 410 58"/></svg>' }),
      el('button', { class: 'acct-pic', 'aria-label': t('changePhoto'), on: openProfile }, avatar('big'), el('span', { class: 'cam', html: icon('camera') })),
      el('b', { class: 'acct-name' }, name || t('guest')),
      auth ? el('small', { class: 'acct-mail', dir: 'ltr' }, auth.email) : '',
      el('span', { class: `acct-badge ${auth ? 'on' : ''}`, html: icon(auth ? 'cloud' : 'device') }, t(auth ? 'syncedBadge' : 'localBadge')),
      el('div', { class: 'acct-stats' },
        stat(String(store.trips.length), t('tripsCount')),
        stat(km.toFixed(km < 10 ? 1 : 0), t('totalKm')),
        stat(String(window.MasarFx ? window.MasarFx.points() : 0), t('statPoints'))),
      el('button', { class: 'btn yellow', html: icon('edit'), on: openProfile }, t('editAccount')));
    const parts = [head];
    if (window.MasarFx) parts.push(window.MasarFx.levelCard());

    if (!authOn()) parts.push(el('p', { class: 'hint' }, t('authOff')));
    else if (!auth) {
      const email = el('input', { class: 'field', type: 'email', placeholder: t('email'), 'aria-label': t('email'), autocomplete: 'email', dir: 'ltr' });
      const pass = el('input', { class: 'field', type: 'password', placeholder: t('password'), 'aria-label': t('password'), autocomplete: 'current-password', dir: 'ltr' });
      const go = (op, okMsg) => async function () {
        await busy(this, async () => {
          setSession(await call(idt(op), { email: email.value.trim(), password: pass.value, returnSecureToken: true }));
          toast(okMsg);
          try { await syncAfterSignIn(); } catch (e) { toast(t('syncFail')); }
          render();
        });
      };
      const signIn = el('button', { class: 'btn pink' }, t('signIn'));
      const signUp = el('button', { class: 'btn ghost' }, t('signUp'));
      signIn.addEventListener('click', go('signInWithPassword', t('welcomeBack')));
      signUp.addEventListener('click', go('signUp', t('accountMade')));
      const forgot = el('button', { class: 'linkbtn' }, t('forgot'));
      forgot.addEventListener('click', function () {
        if (!email.value.trim()) { toast(t('needEmail')); email.focus(); return; }
        busy(this, async () => {
          await call(idt('sendOobCode'), { requestType: 'PASSWORD_RESET', email: email.value.trim() });
          toast(t('resetSent'));
        });
      });
      parts.push(section(t('signIn'), el('p', { class: 'hint' }, t('signInWhy')), email, pass, signIn, signUp, forgot));
    } else {
      const sync = el('button', { class: 'btn teal', html: icon('cloud') }, t('syncNow'));
      sync.addEventListener('click', function () {
        const b = this;
        busy(b, async () => { b.textContent = t('syncing'); await syncAfterSignIn(); toast(t('synced')); });
      });
      parts.push(section('', el('p', { class: 'hint' }, t('synced')), sync,
        el('button', { class: 'btn ghost', html: icon('out'), on: () => { auth = null; saveAuth(); toast(t('signedOut')); render(); } }, t('signOut'))));
    }

    parts.push(el('nav', { class: 'menu sticker' },
      ...(window.MasarPlus ? window.MasarPlus.menuRows(row) : []),
      row('gear', t('settings'), () => open('settings')),
      row('clock', t('trips'), () => open('trips')),
      row('shield', t('privacy'), () => open('privacy')),
      row('info', t('about'), () => open('about'))));
    return parts;
  }

  /* -------------------------------------------------- edit account: photo, name, email, password */
  let draft = null;

  function pickPhoto(onDone) {
    // The input stays in the page while the gallery is open: on Android a detached one never hears back.
    document.querySelectorAll('input.photo-input').forEach((old) => old.remove());
    const input = el('input', { class: 'photo-input', type: 'file', accept: 'image/*', hidden: '' });
    document.body.append(input);
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => cropPhoto(img, onDone, () => URL.revokeObjectURL(url));
      img.onerror = () => { URL.revokeObjectURL(url); toast(t('photoBad')); };
      img.src = url;
    });
    input.click();
  }

  /* A round frame: drag to move, slider to zoom. The result is a small square JPEG (320 px). */
  function cropPhoto(img, onDone, cleanup) {
    const S = 260, OUT = 320;
    const canvas = el('canvas', { class: 'crop-canvas', width: String(S * 2), height: String(S * 2) });
    const g = canvas.getContext('2d');
    const base = Math.max(S / img.naturalWidth, S / img.naturalHeight);
    let zoom = 1, x = 0, y = 0;
    const fit = () => {
      const w = img.naturalWidth * base * zoom, h = img.naturalHeight * base * zoom;
      x = Math.max(-(w - S) / 2, Math.min((w - S) / 2, x));
      y = Math.max(-(h - S) / 2, Math.min((h - S) / 2, y));
    };
    const draw = (ctx, size) => {
      const k = size / S, w = img.naturalWidth * base * zoom * k, h = img.naturalHeight * base * zoom * k;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, size / 2 + x * k - w / 2, size / 2 + y * k - h / 2, w, h);
    };
    const paint = () => { fit(); draw(g, S * 2); };
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { drag = { px: e.clientX, py: e.clientY, x, y }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', (e) => { if (!drag) return; x = drag.x + e.clientX - drag.px; y = drag.y + e.clientY - drag.py; paint(); });
    canvas.addEventListener('pointerup', () => { drag = null; });
    canvas.addEventListener('pointercancel', () => { drag = null; });
    const range = el('input', { class: 'crop-zoom', type: 'range', min: '1', max: '3', step: '0.01', value: '1', 'aria-label': t('cropZoom') });
    range.addEventListener('input', () => { zoom = Number(range.value); paint(); });
    const ok = el('button', { class: 'btn pink', html: icon('ok') }, t('done'));
    ok.addEventListener('click', () => {
      const out = document.createElement('canvas');
      out.width = OUT; out.height = OUT;
      draw(out.getContext('2d'), OUT);
      cleanup();
      closeModal();
      onDone(out.toDataURL('image/jpeg', 0.85));
    });
    openModal(el('h2', {}, t('cropTitle')), el('div', { class: 'crop-stage' }, canvas), range, el('p', { class: 'hint' }, t('cropHint')),
      ok, el('button', { class: 'btn ghost', on: () => { cleanup(); closeModal(); } }, t('cancel')));
    paint();
  }

  function renderProfile() {
    if (!draft) draft = { photo: store.photo || null, name: store.name || '' };
    const choose = () => pickPhoto((data) => { draft.photo = data; refresh(); });
    const pic = el('button', { class: 'acct-pic big', 'aria-label': t('changePhoto'), on: choose }, avatar('huge', draft.photo, draft.name), el('span', { class: 'cam', html: icon('camera') }));
    const name = el('input', { class: 'field', value: draft.name, maxlength: '24', 'aria-label': t('name'), placeholder: t('name') });
    name.addEventListener('input', () => { draft.name = name.value; });
    const save = el('button', { class: 'btn pink', html: icon('ok') }, t('saveChanges'));
    save.addEventListener('click', () => {
      store.name = draft.name.trim();
      store.photo = draft.photo;
      persist();
      draft = null;
      toast(t('savedProfile'));
      back();
    });
    const parts = [
      el('section', { class: 'card sticker photo-edit' }, pic,
        el('div', { class: 'photo-btns' },
          el('button', { class: 'btn teal', html: icon('camera'), on: choose }, t('pickPhoto')),
          draft.photo ? el('button', { class: 'btn ghost', html: icon('trash'), on: () => { draft.photo = null; refresh(); } }, t('removePhoto')) : ''),
        el('p', { class: 'hint' }, t('photoHint'))),
      section(t('name'), name),
      save,
    ];
    if (!auth) { parts.push(el('p', { class: 'hint' }, t('guestEdit'))); return parts; }

    const mail = el('input', { class: 'field', type: 'email', dir: 'ltr', placeholder: t('newEmail'), 'aria-label': t('newEmail'), autocomplete: 'email' });
    const mailBtn = el('button', { class: 'btn ghost', html: icon('mail') }, t('changeEmail'));
    mailBtn.addEventListener('click', function () {
      const newEmail = mail.value.trim();
      if (!newEmail) { toast(t('needEmail')); mail.focus(); return; }
      if (newEmail.toLowerCase() === (auth.email || '').toLowerCase()) { toast(t('sameEmail')); return; }
      busy(this, async () => {
        await call(idt('sendOobCode'), { requestType: 'VERIFY_AND_CHANGE_EMAIL', idToken: await token(), newEmail });
        mail.value = '';
        toast(t('emailSent', newEmail));
      });
    });
    const cur = el('input', { class: 'field', type: 'password', dir: 'ltr', placeholder: t('currentPass'), 'aria-label': t('currentPass'), autocomplete: 'current-password' });
    const next = el('input', { class: 'field', type: 'password', dir: 'ltr', placeholder: t('newPass'), 'aria-label': t('newPass'), autocomplete: 'new-password' });
    const passBtn = el('button', { class: 'btn ghost', html: icon('key') }, t('changePass'));
    passBtn.addEventListener('click', function () {
      if (next.value.length < 6) { toast(t('eWeak')); next.focus(); return; }
      busy(this, async () => {
        // Firebase only changes a password right after signing in, so the current one is checked first.
        setSession(await call(idt('signInWithPassword'), { email: auth.email, password: cur.value, returnSecureToken: true }));
        setSession(await call(idt('update'), { idToken: auth.token, password: next.value, returnSecureToken: true }));
        cur.value = ''; next.value = '';
        toast(t('passChanged'));
      });
    });
    parts.push(
      section(t('changeEmail'), el('p', { class: 'hint', dir: 'ltr' }, auth.email), mail, mailBtn),
      section(t('changePass'), cur, next, passBtn));
    return parts;
  }

  /* -------------------------------------------------- settings */
  function choices(options, current, pick) {
    return el('div', { class: 'choices' }, options.map(([value, iconName, label]) => el('button', {
      class: 'choice', 'aria-pressed': String(current === value), on: () => { pick(value); render(); }, html: iconName ? icon(iconName) : '',
    }, label)));
  }

  function renderSettings() {
    const name = el('input', { class: 'field', value: store.name || '', maxlength: '24', 'aria-label': t('name'), placeholder: t('yourName') });
    name.addEventListener('change', () => { store.name = name.value.trim(); persist(); toast(t('savedToast')); });
    return [
      section(t('name'), name),
      section(t('language'), choices([['ar', '', 'العربية'], ['en', '', 'English']], store.lang, (v) => { if (store.lang !== v) A.setLang(); })),
      section(t('appearance'), choices([['light', 'sun', t('themeLight')], ['dark', 'moon', t('themeDark')], ['system', 'device', t('themeSystem')]],
        store.appearance, (v) => { store.appearance = v; persist(); A.applyTheme(); })),
      section(t('voiceGuide'), choices([[false, 'sound', t('on')], [true, 'muted', t('off')]], !!store.muted, (v) => { store.muted = v; persist(); })),
      section(t('defTraffic'), choices([['calm', '', t('calm')], ['busy', '', t('busy')], ['rush_hour', '', t('rush_hour')]],
        store.traffic, (v) => { store.traffic = v; persist(); })),
      ...(window.MasarFx ? window.MasarFx.settingsSections(section, choices) : []),
    ];
  }

  /* -------------------------------------------------- my trips */
  function renderTrips() {
    if (!store.trips.length) return [el('div', { class: 'empty-page' }, el('span', { html: icon('clock') }), el('p', {}, t('noTrips')))];
    const km = store.trips.reduce((a, x) => a + x.m, 0) / 1000;
    const hours = store.trips.reduce((a, x) => a + x.s, 0) / 3600;
    const fmtDate = new Intl.DateTimeFormat(store.lang === 'ar' ? 'ar-u-nu-latn' : 'en-GB',
      { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const stat = (value, label, cls) => el('div', { class: `stat ${cls}` }, el('b', {}, value), el('small', {}, label));
    const clear = () => openModal(el('h2', {}, t('clearTripsAsk')),
      el('button', { class: 'btn pink', on: () => { store.trips = []; persist(); closeModal(); toast(t('cleared')); render(); } }, t('yesDo')),
      el('button', { class: 'btn ghost', on: closeModal }, t('cancel')));
    return [
      window.MasarFx ? window.MasarFx.levelCard() : '',
      el('div', { class: 'stats' }, stat(String(store.trips.length), t('tripsCount'), 'c0'),
        stat(km.toFixed(km < 10 ? 1 : 0), t('totalKm'), 'c1'), stat(hours.toFixed(1), t('totalTime'), 'c2')),
      el('ul', { class: 'trip-list' }, store.trips.map((x) => el('li', {}, el('button', {
        class: 'trip sticker', on: () => A.goTo({ label: x.to, lat: x.lat, lng: x.lng }),
      }, el('span', { class: `badge ${x.done ? 'ok' : ''}` }, t(x.done ? 'arrivedBadge' : 'stoppedBadge')),
      el('b', {}, x.to), el('small', {}, `${t('fromLabel')}: ${x.from}`),
      el('small', {}, `${fmtDate.format(new Date(x.t))} · ${A.fmtDist(x.m)} · ${A.fmtTime(x.s)}`))))),
      el('button', { class: 'btn ghost', html: icon('trash'), on: clear }, t('clearTrips')),
    ];
  }

  /* -------------------------------------------------- about */
  function renderAbout() {
    return [
      el('div', { class: 'about-hero' }, el('img', { src: A.logoFile(), alt: '', 'data-logo': '' }),
        el('b', {}, store.lang === 'ar' ? 'مسار' : 'MASAR'), el('span', { class: 'pill' }, t('tag')), el('small', {}, t('version', VERSION))),
      section('', el('p', {}, t('aboutText')), el('p', {}, t('aboutHow'))),
      section('', el('p', {}, t('aboutData')), el('p', { class: 'hint' }, t('aboutTraffic'))),
      el('p', { class: 'made' }, t('madeIn')),
    ];
  }

  /* -------------------------------------------------- privacy */
  function confirmThen(question, action) {
    openModal(el('h2', {}, question),
      el('button', { class: 'btn pink', on: () => { closeModal(); action(); } }, t('yesDo')),
      el('button', { class: 'btn ghost', on: closeModal }, t('cancel')));
  }

  function renderPrivacy() {
    const wipe = () => {
      ['masar', 'masar-auth'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) { /* nothing stored */ } });
      location.reload();
    };
    const del = () => (async () => {
      const tk = await token();
      await fetch(docUrl(), { method: 'DELETE', headers: { Authorization: `Bearer ${tk}` } });
      await call(idt('delete'), { idToken: tk });
      auth = null; saveAuth();
      toast(t('accountDeleted'));
      render();
    })().catch((e) => toast(errText(e)));
    const para = (title, text) => section(title, el('p', {}, text));
    return [
      para(t('pOnPhone'), t('pOnPhoneText')), para(t('pLocation'), t('pLocationText')), para(t('pAccount'), t('pAccountText')),
      para(t('pCar'), t('pCarText')), para(t('pReports'), t('pReportsText')),
      ...(window.MasarPlus ? window.MasarPlus.privacyParts(para) : []), para(t('pControl'), t('pControlText')),
      el('button', { class: 'btn ghost', html: icon('trash'), on: () => confirmThen(t('wipeLocalAsk'), wipe) }, t('wipeLocal')),
      auth ? el('button', { class: 'btn pink', html: icon('trash'), on: () => confirmThen(t('deleteAccountAsk'), del) }, t('deleteAccount')) : '',
    ];
  }

  /* Shared with features.js: the driver reports live in the same Firebase project. */
  const cloud = {
    on: authOn, signedIn: () => !!(auth && authOn()), uid: () => auth && auth.uid, token, projectId: () => CFG.projectId,
  };

  window.MasarPages = {
    open, back, refresh, onPersist, cloud, avatar, openProfile,
    register: (name, fn) => { PAGES[name] = fn; },
    root: () => (document.body.dataset.screen === 'pages' ? stack[0] : null),
  };
})();
