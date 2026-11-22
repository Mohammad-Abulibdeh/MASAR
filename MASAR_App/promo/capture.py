"""Captures real MASAR screens for the promo video (Chrome via Playwright, app served on localhost:8600).

GPS is set to Ramallah, the phone bridge is faked (a song playing), and the reports request returns
demo reports, so every screen shows real app UI with believable content.
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

URL = 'http://localhost:8600/www/index.html'
OUT = Path(__file__).with_name('shots')
OUT.mkdir(exist_ok=True)
NOW = int(time.time() * 1000)

STORE = {
    'name': 'مصطفى', 'lang': 'ar', 'appearance': 'light', 'traffic': 'busy', 'seenExploreHint': True,
    'saved': [
        {'id': 'home', 'kind': 'home', 'lat': 31.9129, 'lng': 35.2155, 'note': 'قريب من شارع القدس'},
        {'id': 'work', 'kind': 'work', 'lat': 31.9049, 'lng': 35.2044, 'note': 'قريب من دوار المنارة'},
        {'id': 'mall', 'kind': 'mall', 'lat': None, 'lng': None},
        {'id': 'uni', 'kind': 'uni', 'lat': 31.9585, 'lng': 35.1820, 'note': 'جامعة بيرزيت'},
    ],
    'trips': [
        {'t': NOW - 86400000 * i, 'from': 'البيت', 'to': to, 'lat': 31.95, 'lng': 35.18, 'm': m, 's': s, 'done': True}
        for i, (to, m, s) in enumerate([('جامعة بيرزيت', 12400, 1500), ('دوار المنارة', 3200, 600),
                                         ('البيرة', 5100, 840), ('سردا', 8800, 1020), ('بيتونيا', 6600, 960)] * 6)
    ],
    'reportsMade': 6, 'votesMade': 14,
    'parked': {'lat': 31.9052, 'lng': 35.2039, 't': NOW - 3600000 * 2, 'label': 'قريب من شارع ركب'},
}

FAKE_NATIVE = """
window.__music = {allowed:true, has:true, playing:true, title:'على هدير البوسطة', artist:'فيروز', app:'Spotify', art:''};
window.MasarNative = {setNavigating(){}, playClips(){return true}, startLocation(){}, stopLocation(){}, isNightMode(){return false},
  openAppSettings(){}, carUpdate(){}, carRoute(){}, speak(){return true}, share(){}, buzz(){}, takePlace(){return null},
  musicState(){return JSON.stringify(window.__music)}, musicAction(){}, openMusicAccess(){}};
"""


def report_doc(i, kind, lat, lng, minutes):
    return {'document': {'name': f'projects/masar-d1fab/databases/(default)/documents/reports/demo{i}', 'fields': {
        'kind': {'stringValue': kind}, 'lat': {'doubleValue': lat}, 'lng': {'doubleValue': lng},
        't': {'integerValue': str(NOW - minutes * 60000)}, 'uid': {'stringValue': 'demo'},
        'up': {'integerValue': '3'}, 'down': {'integerValue': '0'}}}}


REPORTS = [report_doc(1, 'accident', 31.9068, 35.2051, 6), report_doc(2, 'traffic', 31.9032, 35.2072, 12),
           report_doc(3, 'checkpoint', 31.9110, 35.1985, 25), report_doc(4, 'police', 31.8995, 35.2010, 9),
           report_doc(5, 'hazard', 31.9089, 35.2120, 30)]


def main(theme='light'):
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True)
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, locale='ar',
                                  geolocation={'latitude': 31.9100, 'longitude': 35.2000}, permissions=['geolocation'],
                                  reduced_motion='reduce')
        store = dict(STORE, appearance=theme)
        auth = {'uid': 'demo', 'email': 'mustafa@masar.app', 'token': 'demo', 'refresh': 'demo', 'expires': NOW + 86400000}
        ctx.add_init_script(FAKE_NATIVE + f"localStorage.setItem('masar', {json.dumps(json.dumps(store, ensure_ascii=False))});"
                            + f"localStorage.setItem('masar-auth', {json.dumps(json.dumps(auth))});")
        page = ctx.new_page()
        # Nothing reaches the real project: reports are demo data, and account saves are answered locally.
        page.route('**/firestore.googleapis.com/**', lambda r: r.fulfill(
            status=200, content_type='application/json',
            body=json.dumps(REPORTS) if ':runQuery' in r.request.url else '{}'))
        page.goto(URL)
        page.wait_for_timeout(2500)
        js = page.evaluate

        def shot(name, wait=900):
            page.wait_for_timeout(wait)
            page.screenshot(path=str(OUT / f'{theme}_{name}.png'))
            print('shot', theme, name, flush=True)

        js("() => { document.getElementById('splash').classList.add('gone'); MasarApp.renderHome(); MasarApp.show('home'); }")
        page.wait_for_timeout(2500)  # reports load in the background, then home shows the count
        js("() => MasarApp.renderHome()")
        shot('home')
        js("() => { MasarApp.state.query = 'جامعة'; MasarApp.renderHome(); }")
        shot('search')
        js("() => { MasarApp.state.query = ''; MasarApp.state.from = null; MasarApp.goTo({label: 'جامعة بيرزيت', lat: 31.9585, lng: 35.1820}); }")
        shot('route', 4000)
        js("() => [...document.querySelectorAll('#routeSheet button')].find(b => b.innerText.includes('يلا نمشي')).click()")
        page.wait_for_timeout(800)
        js("""() => { const R = MasarRouter, nav = MasarApp.nav(); const p = R.trackPoint(nav.track, 350).pos;
                     window.masarFix(p[0], p[1], 6, 13.9, null); }""")
        page.wait_for_timeout(2500)
        shot('drive')
        js("() => { window.masarCarStop(); MasarFx.openExplore({center: [31.9055, 35.2045], zoom: 15.5}); }")
        shot('map', 3000)
        js("() => { MasarApp.map().fire('contextmenu', {latlng: L.latLng(31.9049, 35.2044), originalEvent: new MouseEvent('contextmenu')}); }")
        shot('longpress', 1200)
        js("() => MasarApp.closeModal()")
        # The report picker, shown as a signed-in driver sees it.
        js("() => document.getElementById('exploreReport').click()")
        shot('report', 1500)
        js("() => { MasarApp.closeModal(); MasarFx.openNearby('fuel'); }")
        shot('nearby', 3000)
        js("() => MasarPages.open('places', true)")
        shot('places')
        js("() => MasarPages.open('account', true)")
        shot('account', 1600)
        js("() => MasarPages.open('trips', true)")
        shot('trips', 1600)
        browser.close()


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'light')
