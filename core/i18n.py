"""
Language support. English text is the key, so English needs no table and core code stays readable:

    tx("Traffic cleared.")              -> Arabic when the current language is Arabic
    tx("{n} drivers", n=3)              -> fills in the values in either language

The language belongs to the current run of the script, not to the process, so two browsers
can use different languages. tests/test_i18n.py fails if a tx() text has no Arabic.
"""
from __future__ import annotations

import re
from contextvars import ContextVar

EN, AR = "en", "ar"
_language: ContextVar[str] = ContextVar("masar_language", default=EN)


def set_language(lang: str) -> None:
    _language.set(AR if lang == AR else EN)


def language() -> str:
    return _language.get()


def tx(text: str, **values) -> str:
    if _language.get() == AR:
        text = ARABIC.get(text, text)
    return text.format(**values) if values else text


_EVENTS = [
    (re.compile(r"Departed on (\w+) route, estimated (\d+) s"), "Departed on {} route, estimated {} s"),
    (re.compile(r"Re-routed from node (.+): segment ahead closed"), "Re-routed from node {}: segment ahead closed"),
    (re.compile(r"Re-routed from node (.+): saves (\d+) s \(threshold (\d+) s\)"), "Re-routed from node {}: saves {} s (threshold {} s)"),
]


def tx_event(message: str) -> str:
    """Vehicle event logs are stored in English, because the simulator's logic reads them."""
    for pattern, template in _EVENTS:
        match = pattern.fullmatch(message)
        if match:
            parts = [tx(p) if p in ("distance", "fastest", "masar") else p for p in match.groups()]
            return tx(template).replace("{}", "\0").replace("\0", "{}").format(*parts)
    return tx(message)


ARABIC = {
    # ---- names used by several screens
    "Play": "اللعب",
    "Traffic table": "جدول المرور",
    "Many drivers": "سائقون كثيرون",
    "Experiment": "التجربة",
    "Model & data": "النموذج والبيانات",
    "Traffic routing playground": "ساحة تجارب توجيه المرور",
    "Central Ramallah": "وسط رام الله",
    "Compact centre": "المركز المصغّر",
    "Ramallah & Al-Bireh": "رام الله والبيرة",
    "Custom area": "منطقة مخصصة",
    "About 3 × 3 km around Al-Manara. The default map.": "حوالي 3 × 3 كم حول المنارة. الخريطة الافتراضية.",
    "About 2 × 2 km. Quick and close-up.": "حوالي 2 × 2 كم. سريعة وقريبة.",
    "About 6 × 6 km. The widest view.": "حوالي 6 × 6 كم. أوسع عرض.",
    "Ramallah villages": "قرى رام الله",
    "City": "مدينة",
    "Town": "بلدة",
    "Village": "قرية",
    "The whole governorate with its villages. The biggest map, so it is slower.": "المحافظة كلها مع قراها. أكبر خريطة، لذلك هي أبطأ.",
    "Your own area, half-width {dist} m.": "منطقتك الخاصة، نصف عرضها {dist} م.",
    "Central Ramallah compact": "المركز المصغّر",
    "Empty roads": "طرق فارغة",
    "No vehicles anywhere": "لا مركبات في أي مكان",
    "Quiet day": "يوم هادئ",
    "Light traffic everywhere": "حركة خفيفة في كل مكان",
    "Busy afternoon": "بعد ظهر مزدحم",
    "Main roads fill up": "الطرق الرئيسية تمتلئ",
    "Rush hour": "ساعة الذروة",
    "Main roads jammed, side streets busy": "الطرق الرئيسية مختنقة والفرعية مزدحمة",
    "Downtown jam": "اختناق وسط البلد",
    "Worst at the centre, clear at the edges": "الأسوأ في المركز، والأطراف سالكة",
    "Square": "ميدان",
    "Transport": "مواصلات",
    "City hall": "بلدية",
    "Hospital": "مستشفى",
    "University": "جامعة",
    "College": "كلية",
    "Museum": "متحف",
    # ---- play screen: messages from the server
    "Near {name}": "قرب {name}",
    "Unnamed road": "طريق بلا اسم",
    "MASAR route": "طريق مسار",
    "Shortest distance": "أقصر مسافة",
    "Fastest on empty roads": "الأسرع على طرق فارغة",
    "Alternative {n}": "بديل {n}",
    "A and B are at the same spot. Move one of them to another road.": "A وB في المكان نفسه. انقل إحداهما إلى طريق آخر.",
    "No drivable route connects A and B right now. A closed road or a one-way street may be blocking the way. Reopen a road or move a pin.":
        "لا يوجد طريق يصل بين A وB الآن. قد يكون طريق مغلق أو شارع باتجاه واحد يسد الطريق. أعد فتح طريق أو انقل دبوسًا.",
    "Traffic changed, so MASAR found a better route.": "تغيّرت حركة المرور، فوجد مسار طريقًا أفضل.",
    "That change could not be applied: {error}": "تعذّر تطبيق هذا التغيير: {error}",
    "Reset the drive first to change this.": "أعد ضبط القيادة أولًا لتغيير هذا.",
    "{name} applied. These are simulated vehicle counts.": "تم تطبيق «{name}». هذه أعداد مركبات محاكاة.",
    "Traffic cleared.": "تم مسح حركة المرور.",
    "Change undone.": "تم التراجع عن التغيير.",
    "Jammed that route: its estimate went from {before} to {after}.": "تم خنق هذا الطريق: تغيّر تقديره من {before} إلى {after}.",
    "That spot is too far from any road on this map. Click closer to a road.": "هذا المكان بعيد عن كل طرق هذه الخريطة. انقر أقرب إلى طريق.",
    "Trips start and end at junctions, so that pin moved {dist} m to the nearest one.": "تبدأ الرحلات وتنتهي عند التقاطعات، لذلك تحرك الدبوس {dist} م إلى أقرب تقاطع.",
    "Nothing found online for that search. Try the street list or click the map.": "لم يُعثر على شيء على الإنترنت لهذا البحث. جرّب قائمة الشوارع أو انقر على الخريطة.",
    "That place is outside the loaded map area.": "هذا المكان خارج منطقة الخريطة المحمّلة.",
    "Demo ready: simulated rush hour with A and B already placed.": "العرض جاهز: ساعة ذروة محاكاة، وA وB في مكانهما.",
    "Calculate a route before starting.": "احسب طريقًا قبل البدء.",
    "That map could not be downloaded. Check your internet connection and try again.": "تعذّر تنزيل هذه الخريطة. تحقق من اتصالك بالإنترنت وحاول مجددًا.",
    # ---- trip estimates
    "{s} s": "{s} ث",
    "{m} min {s} s": "{m} د {s} ث",
    "{m} min": "{m} د",
    "A and B are the same place, so there is nothing to drive.": "A وB في المكان نفسه، فلا توجد رحلة.",
    "This is the only sensible route here, and the roads on it are clear.": "هذا هو الطريق المعقول الوحيد هنا، وطرقه سالكة.",
    "This is the only sensible route here. Traffic adds about {time} to it.": "هذا هو الطريق المعقول الوحيد هنا. تضيف إليه حركة المرور حوالي {time}.",
    "It is a close call: the next best route is only {time} slower. Try jamming this route and see what changes.":
        "الفرق بسيط: الطريق التالي أبطأ بـ {time} فقط. جرّب خنق هذا الطريق وشاهد ما يتغير.",
    "Estimated {time} faster than the next best route": "أسرع بحوالي {time} من أفضل طريق تالٍ",
    ". It is {m} m longer, but it skips {heavy} m of heavy traffic": ". هو أطول بـ {m} م، لكنه يتجنب {heavy} م من الازدحام الشديد",
    ". It is {m} m longer, but its roads move faster": ". هو أطول بـ {m} م، لكن طرقه أسرع حركة",
    ", and it skips {heavy} m of heavy traffic": "، ويتجنب {heavy} م من الازدحام الشديد",
    ", and it is {m} m shorter": "، وهو أقصر بـ {m} م",
    # ---- routing errors
    "Origin or destination is not on the road network": "نقطة البداية أو النهاية ليست على شبكة الطرق",
    "No drivable route exists between these points (one-way streets, closures or a disconnected area).":
        "لا يوجد طريق بين هاتين النقطتين (شوارع باتجاه واحد أو إغلاقات أو منطقة منفصلة).",
    # ---- simulator event log
    "distance": "المسافة",
    "fastest": "الأسرع",
    "masar": "مسار",
    "Departed on {} route, estimated {} s": "انطلق على طريق {}، والتقدير {} ث",
    "Re-routed from node {}: segment ahead closed": "غيّر طريقه عند التقاطع {}: المقطع التالي مغلق",
    "Re-routed from node {}: saves {} s (threshold {} s)": "غيّر طريقه عند التقاطع {}: يوفر {} ث (الحد الأدنى {} ث)",
    "Segment ahead closed and no alternative exists; continuing": "المقطع التالي مغلق ولا يوجد بديل؛ يواصل",
    "Arrived at destination": "وصل إلى الوجهة",
    # ---- experiment
    "A. Shortest distance": "A. أقصر مسافة",
    "B. Fastest (no congestion awareness)": "B. الأسرع (دون مراعاة الازدحام)",
    "C. MASAR traffic-aware": "C. مسار المراعي للازدحام",
    "The MASAR vehicle did not reach the destination within the time limit.": "لم تصل مركبة مسار إلى الوجهة ضمن الحد الزمني.",
    "No meaningful difference: MASAR's simulated travel time ({time} s) equals the best baseline ({name}). With these inputs, traffic-awareness gave no advantage.":
        "لا فرق يُذكر: زمن رحلة مسار المحاكى ({time} ث) يساوي أفضل خيار مقارنة ({name}). مع هذه المدخلات لم تعطِ مراعاة الازدحام أي أفضلية.",
    "In this simulated scenario MASAR finished in {time} s, {diff} s ({pct}%) faster than the best baseline ({name}). This is a model estimate under simulated traffic, not a real-world measurement.":
        "في هذا السيناريو المحاكى أنهى مسار الرحلة في {time} ث، أسرع بـ {diff} ث ({pct}%) من أفضل خيار مقارنة ({name}). هذا تقدير من النموذج تحت حركة محاكاة، وليس قياسًا حقيقيًا.",
    "In this simulated scenario MASAR was {diff} s ({pct}%) SLOWER than {name}. Traffic changed after the decision was made, so the choice that looked best at the time did not pay off. This is an honest result of the simulation.":
        "في هذا السيناريو المحاكى كان مسار أبطأ بـ {diff} ث ({pct}%) من {name}. تغيّرت الحركة بعد اتخاذ القرار، فلم ينجح الخيار الذي بدا الأفضل وقتها. هذه نتيجة صادقة للمحاكاة.",
    "Experiment mode drives three simulated vehicles from the same origin to the same destination under identical traffic: <b>A</b> shortest distance, <b>B</b> fastest free-flow (no congestion awareness), <b>C</b> MASAR traffic-aware with re-routing. Results are <b>simulated estimates</b> from MASAR's traffic model and the current (simulated / user-defined) inputs — not real-world measurements.":
        "يقود وضع التجربة ثلاث مركبات محاكاة من نقطة البداية نفسها إلى الوجهة نفسها وتحت حركة المرور نفسها: <b>A</b> أقصر مسافة، <b>B</b> الأسرع على طرق فارغة (دون مراعاة الازدحام)، <b>C</b> مسار المراعي للازدحام مع تغيير الطريق. النتائج <b>تقديرات محاكاة</b> من نموذج مسار والمدخلات الحالية (محاكاة أو من المستخدم)، وليست قياسات حقيقية.",
    "Place A and B on two different roads in the {screen} screen first.": "ضع A وB على طريقين مختلفين في شاشة {screen} أولًا.",
    "Traffic changes during the trip": "تتغير الحركة أثناء الرحلة",
    "Seeded random walk applied identically for every strategy": "تغير عشوائي ببذرة ثابتة يُطبق بالتساوي على كل الاستراتيجيات",
    "Random seed": "البذرة العشوائية",
    "Change every (sim s)": "التغيير كل (ثانية محاكاة)",
    "Volatility": "شدة التقلب",
    "Scripted incident": "حادث مُعدّ مسبقًا",
    "At a set time, the chosen segments jump to a high load. Same for all strategies.": "في وقت محدد ترتفع حمولة المقاطع المختارة. الأمر نفسه لكل الاستراتيجيات.",
    "Incident at (sim s)": "وقت الحادث (ثانية محاكاة)",
    "Incident load (× capacity)": "حمولة الحادث (× السعة)",
    "Incident location": "مكان الحادث",
    "Middle of initial MASAR route": "منتصف طريق مسار الأولي",
    "Middle of shortest-distance route": "منتصف طريق أقصر مسافة",
    "A named street": "شارع محدد",
    "Street (if 'A named street')": "الشارع (إذا اخترت «شارع محدد»)",
    "Simulation step (s)": "خطوة المحاكاة (ث)",
    "Run experiment": "شغّل التجربة",
    "Simulating three vehicles…": "جارٍ محاكاة ثلاث مركبات…",
    "Event log per strategy": "سجل الأحداث لكل استراتيجية",
    "Computed in {took} s. Inputs: seed={seed}, dynamic={dynamic}, incident={incident} on {n} segments.":
        "حُسبت في {took} ث. المدخلات: البذرة={seed}، متغيرة={dynamic}، حادث={incident} على {n} مقطع.",
    "Strategy": "الاستراتيجية",
    "Arrived": "وصل",
    "yes": "نعم",
    "no": "لا",
    "Total distance": "المسافة الكلية",
    "Estimated time at departure": "الوقت المقدّر عند الانطلاق",
    "Final simulated travel time": "زمن الرحلة النهائي المحاكى",
    "Congestion exposure": "التعرض للازدحام",
    "Time in heavy congestion": "الوقت في ازدحام شديد",
    "Route changes": "تغييرات الطريق",
    "Final simulated travel time (min)": "زمن الرحلة النهائي المحاكى (دقيقة)",
    "Total distance (km)": "المسافة الكلية (كم)",
    "Congestion exposure (length-weighted mean load, %)": "التعرض للازدحام (متوسط الحمولة حسب الطول، %)",
    "Estimated time at departure vs final time (min)": "الوقت المقدّر عند الانطلاق مقابل الوقت النهائي (دقيقة)",
    "minutes": "دقائق",
    "km": "كم",
    "estimated at departure": "المقدّر عند الانطلاق",
    "final simulated": "النهائي المحاكى",
    "{x} km": "{x} كم",
    # ---- many drivers
    "Same advice for everyone": "نصيحة واحدة للجميع",
    "Advice that sees other drivers": "نصيحة ترى السائقين الآخرين",
    "Same advice": "نصيحة واحدة",
    "Sees other drivers": "ترى الآخرين",
    "No drivable trips could be found. Too many roads may be closed.": "تعذّر إيجاد رحلات. قد تكون طرق كثيرة مغلقة.",
    "The road network is too small for trips.": "شبكة الطرق أصغر من أن تتسع لرحلات.",
    "Street": "الشارع",
    "Vehicles added": "المركبات المضافة",
    "Load": "الحمولة",
    "These are model estimates, not real-world measurements.": "هذه تقديرات من النموذج، وليست قياسات حقيقية.",
    "Test 0% and at least one other share to compare.": "اختبر 0% ونسبة أخرى واحدة على الأقل للمقارنة.",
    "No meaningful gain: with these inputs, MASAR users did not lower the average trip by at least {pct}%.":
        "لا فائدة تُذكر: مع هذه المدخلات لم يخفّض مستخدمو مسار متوسط الرحلة بنسبة {pct}% على الأقل.",
    "The average trip fell from {before} s to {after} s ({pct}% less) with {share}% of drivers on MASAR, using {advice}.":
        "انخفض متوسط الرحلة من {before} ث إلى {after} ث (أقل بـ {pct}%) عندما استخدم {share}% من السائقين مسار، مع «{advice}».",
    "Be careful with one shared plan: at {share}% users it made the average trip {time} s, worse than having no MASAR users at all.":
        "انتبه من الخطة الواحدة المشتركة: عند {share}% من المستخدمين صار متوسط الرحلة {time} ث، وهذا أسوأ من عدم وجود مستخدمين لمسار أصلًا.",
    "With one shared plan the gain shrinks at high use: {time} s at {share}% users, but {most_time} s at {most_share}%.":
        "مع الخطة الواحدة المشتركة تقل الفائدة عند كثرة الاستخدام: {time} ث عند {share}% من المستخدمين، لكن {most_time} ث عند {most_share}%.",
    "What if many people used MASAR at once? This adds a wave of simulated drivers, all on the road together, on top of the current traffic. <b>Habit drivers</b> take the route that is fastest on empty roads. <b>MASAR users</b> avoid traffic, either all from <b>the same advice</b>, based on the traffic before this wave, or from <b>advice that sees other drivers</b>. Results are <b>simulated estimates</b> from MASAR's traffic model, not real-world measurements.":
        "ماذا لو استخدم كثيرون مسار في الوقت نفسه؟ يضيف هذا الوضع موجة من السائقين المحاكَين، كلهم على الطريق معًا، فوق حركة المرور الحالية. <b>سائقو العادة</b> يأخذون الطريق الأسرع على طرق فارغة. <b>مستخدمو مسار</b> يتجنبون الازدحام، إما من <b>نصيحة واحدة</b> مبنية على الحركة قبل هذه الموجة، أو من <b>نصيحة ترى السائقين الآخرين</b>. النتائج <b>تقديرات محاكاة</b> من نموذج مسار، وليست قياسات حقيقية.",
    "Drivers on the road": "السائقون على الطريق",
    "{n} sampled trips stand for all of them, so bigger numbers take no longer": "تمثلهم جميعًا {n} رحلة عيّنة، لذلك لا تستغرق الأعداد الكبيرة وقتًا أطول",
    "The same seed gives the same trips": "البذرة نفسها تعطي الرحلات نفسها",
    "Run many drivers": "شغّل السائقين",
    "Sending drivers onto the roads…": "جارٍ إرسال السائقين إلى الطرق…",
    "Traffic or the cost model changed after this run. Run it again to see up-to-date results.": "تغيّرت حركة المرور أو نموذج التكلفة بعد هذا التشغيل. شغّله مجددًا لرؤية نتائج محدّثة.",
    "Average trip, all drivers (min)": "متوسط الرحلة، كل السائقين (دقيقة)",
    "Congested roads (80% of capacity or more)": "الطرق المزدحمة (80% من السعة أو أكثر)",
    "MASAR users (%)": "مستخدمو مسار (%)",
    "Minutes": "دقائق",
    "Road segments": "مقاطع الطرق",
    "Spreading drivers out can raise this count while trips still get faster: more roads are busy, but fewer are badly jammed.":
        "توزيع السائقين قد يرفع هذا العدد مع أن الرحلات تصبح أسرع: طرق أكثر مشغولة، لكن طرقًا أقل مختنقة بشدة.",
    "Look closer": "نظرة أقرب",
    "Advice": "النصيحة",
    "Average trip": "متوسط الرحلة",
    "{d} min vs 0%": "{d} د مقارنة بـ 0%",
    "{n} MASAR users": "{n} من مستخدمي مسار",
    "{n} habit drivers": "{n} من سائقي العادة",
    "Lost to traffic": "الضائع في الازدحام",
    "{h} h": "{h} س",
    "{d} h vs 0%": "{d} س مقارنة بـ 0%",
    "Streets that gained the most vehicles": "الشوارع التي زادت فيها المركبات أكثر",
    "Show this on the Play map": "اعرض هذا على خريطة اللعب",
    "Replaces the vehicle counts on the map. Undo on the Play screen brings them back": "يستبدل أعداد المركبات على الخريطة. زر التراجع في شاشة اللعب يعيدها",
    "{n} simulated drivers added, {share}% on MASAR.": "أُضيف {n} سائق محاكى، {share}% منهم على مسار.",
    "{n} drivers, {trips} sampled trips. Nobody re-routes during the trip, and queues do not spill between roads.":
        "{n} سائق، {trips} رحلة عيّنة. لا أحد يغيّر طريقه أثناء الرحلة، ولا تمتد الطوابير بين الطرق.",
    # ---- sidebar
    "Custom map": "خريطة مخصصة",
    "Centre latitude": "خط عرض المركز",
    "Centre longitude": "خط طول المركز",
    "Half-width (m)": "نصف العرض (م)",
    "Load area": "حمّل المنطقة",
    "Needs internet the first time an area is used": "يحتاج إنترنت أول مرة تُستخدم فيها المنطقة",
    "Re-download from OpenStreetMap": "أعد التنزيل من OpenStreetMap",
    "Ignore the local cache and fetch fresh OSM data": "تجاهل النسخة المحلية واجلب بيانات OSM جديدة",
    "Cost model": "نموذج التكلفة",
    "Congestion penalty α": "عقوبة الازدحام α",
    "Penalty steepness β": "حدّة العقوبة β",
    "Max slowdown factor": "أقصى معامل تباطؤ",
    "Capacity: metres per vehicle per lane": "السعة: متر لكل مركبة في كل حارة",
    "Estimated capacity = lanes × length / this value (unless overridden)": "السعة المقدّرة = الحارات × الطول / هذه القيمة (ما لم تُعدَّل)",
    "Re-routing (MASAR vehicle)": "تغيير الطريق (مركبة مسار)",
    "Enable dynamic re-routing": "فعّل تغيير الطريق التلقائي",
    "Min improvement (%)": "أدنى تحسن (%)",
    "Min improvement (s)": "أدنى تحسن (ث)",
    "Periodic check every (simulated s)": "فحص دوري كل (ثانية محاكاة)",
    "Check immediately when traffic changes": "افحص فورًا عند تغير الحركة",
    "A new route is adopted only if it saves at least max(min %, min s) of the remaining time. The vehicle always finishes its current segment first.":
        "يُعتمد طريق جديد فقط إذا وفّر على الأقل الأكبر من (أدنى % وأدنى ث) من الوقت المتبقي. وتنهي المركبة مقطعها الحالي أولًا دائمًا.",
    "{i} intersections · {s} directed segments · {k} km · {o} one-way · {n} named streets": "{i} تقاطع · {s} مقطع باتجاه · {k} كم · {o} باتجاه واحد · {n} شارع مسمى",
    # ---- loading
    "Loading the OpenStreetMap road network for {area}… (first download can take a minute; it is cached afterwards)":
        "جارٍ تحميل شبكة طرق OpenStreetMap لمنطقة {area}… (أول تنزيل قد يستغرق دقيقة، ثم تُحفظ نسخة محلية)",
    "**Could not load the road network.** {error}": "**تعذّر تحميل شبكة الطرق.** {error}",
    "MASAR needs a one-time internet connection to download the OpenStreetMap data for an area. After that it works offline from `data/cache/`.":
        "يحتاج مسار إلى اتصال بالإنترنت مرة واحدة لتنزيل بيانات OpenStreetMap للمنطقة. بعدها يعمل دون إنترنت من `data/cache/`.",
    "Retry": "حاول مجددًا",
    # ---- traffic table
    "No live traffic feed is connected. Every vehicle count below is a <b>simulated, user-defined input</b>. Capacity is <b>estimated</b> from lanes × length unless you override it; free-flow speed comes from the OSM <code>maxspeed</code> tag or a default for the road type. The <i>source</i> columns show where each value came from.":
        "لا يوجد مصدر مباشر لبيانات المرور. كل عدد مركبات أدناه <b>مدخل محاكى يحدده المستخدم</b>. السعة <b>مقدّرة</b> من الحارات × الطول ما لم تعدّلها؛ وسرعة الطريق الفارغ من وسم <code>maxspeed</code> في OSM أو قيمة افتراضية لنوع الطريق. تبيّن أعمدة <i>المصدر</i> من أين جاءت كل قيمة.",
    "Segments": "المقاطع",
    "With input": "لها مدخلات",
    "Vehicles (input)": "المركبات (مدخل)",
    "Moderate": "متوسط",
    "High": "مرتفع",
    "Closed": "مغلق",
    "Search street (Arabic or English), ref or segment ID": "ابحث عن شارع (بالعربية أو الإنجليزية) أو رقمه أو رقم المقطع",
    "e.g. الإرسال, Irsal, Main, 12345-67890": "مثل: الإرسال، Irsal، Main، ‎12345-67890",
    "Congestion level": "مستوى الازدحام",
    "Choose levels": "اختر المستويات",
    "low": "منخفض",
    "moderate": "متوسط",
    "high": "مرتفع",
    "Only segments with input": "المقاطع ذات المدخلات فقط",
    "{n} matching segments": "{n} مقطع مطابق",
    " (showing first {n})": " (عرض أول {n})",
    "Segment table (editable)": "جدول المقاطع (قابل للتعديل)",
    "Whole street": "الشارع كاملًا",
    "Single segment": "مقطع واحد",
    "Scenarios & reset": "السيناريوهات وإعادة الضبط",
    "No segments match the search.": "لا مقاطع تطابق البحث.",
    "Road ID": "رقم الطريق",
    "Road name": "اسم الطريق",
    "Type": "النوع",
    "One-way": "باتجاه واحد",
    "Length (m)": "الطول (م)",
    "Vehicles ✎": "المركبات ✎",
    "Capacity ✎": "السعة ✎",
    "Free-flow km/h ✎": "سرعة الطريق الفارغ كم/س ✎",
    "Closed ✎": "مغلق ✎",
    "Congestion": "الازدحام",
    "Avg speed km/h": "متوسط السرعة كم/س",
    "Travel time (s)": "زمن العبور (ث)",
    "Vehicles source": "مصدر المركبات",
    "Capacity source": "مصدر السعة",
    "Speed source": "مصدر السرعة",
    "Updated {n} segment(s). Congestion and routes recalculated.": "تم تحديث {n} مقطع. أُعيد حساب الازدحام والطرق.",
    "This area has no named streets.": "لا توجد شوارع مسماة في هذه المنطقة.",
    "Set traffic as": "حدد الحركة كـ",
    "% of each segment's capacity": "% من سعة كل مقطع",
    "Vehicles per segment": "مركبات لكل مقطع",
    "Value": "القيمة",
    "Override capacity per segment (0 = keep current)": "تعديل السعة لكل مقطع (0 = إبقاء الحالية)",
    "Mark street as closed": "اعتبر الشارع مغلقًا",
    "Apply to whole street (both directions)": "طبّق على الشارع كاملًا (الاتجاهين)",
    "Applied to {n} segments of {street}.": "طُبّق على {n} مقطع من {street}.",
    "Search for a street above to choose a segment.": "ابحث عن شارع في الأعلى لاختيار مقطع.",
    "Road segment": "مقطع الطريق",
    "Vehicles": "المركبات",
    "Capacity": "السعة",
    "Avg speed": "متوسط السرعة",
    "Travel time": "زمن العبور",
    "source: {source}": "المصدر: {source}",
    "free-flow source: {source}": "مصدر سرعة الطريق الفارغ: {source}",
    "{x} km/h": "{x} كم/س",
    "Free-flow speed (km/h)": "سرعة الطريق الفارغ (كم/س)",
    "Apply": "طبّق",
    "Reset this segment": "أعد ضبط هذا المقطع",
    "**Generate a synthetic scenario** — fills every segment with random but reproducible vehicle counts (labelled *simulated*). Useful for demos; not real traffic.":
        "**أنشئ سيناريو صناعيًا**: يملأ كل مقطع بأعداد مركبات عشوائية يمكن تكرارها (موسومة *محاكاة*). مفيد للعروض، وليس حركة حقيقية.",
    "Seed": "البذرة",
    "Mean load": "متوسط الحمولة",
    "Spread": "التشتت",
    "Generate simulated traffic": "أنشئ حركة محاكاة",
    "Reset all vehicle counts to 0": "صفّر كل أعداد المركبات",
    "Reset ALL traffic data (counts, capacities, speeds, closures)": "أعد ضبط كل بيانات المرور (الأعداد والسعات والسرعات والإغلاقات)",
    "**Save / load scenarios** (stored in `data/scenarios/`)": "**حفظ وتحميل السيناريوهات** (تُخزن في `data/scenarios/`)",
    "Scenario name": "اسم السيناريو",
    "Save current traffic as scenario": "احفظ الحركة الحالية كسيناريو",
    "Saved data/scenarios/{name}.json": "حُفظ في data/scenarios/{name}.json",
    "Download scenario JSON": "نزّل السيناريو JSON",
    "Saved scenarios": "السيناريوهات المحفوظة",
    "Load selected scenario": "حمّل السيناريو المختار",
    "…or upload a scenario JSON": "…أو ارفع سيناريو JSON",
    "Load uploaded scenario": "حمّل السيناريو المرفوع",
    "Scenario loaded: {n} segments applied": "حُمّل السيناريو: طُبّق على {n} مقطع",
    ", {n} skipped (not in this map area)": "، وتُخطي {n} (خارج منطقة هذه الخريطة)",
    "residential": "سكني",
    "primary": "رئيسي",
    "secondary": "ثانوي",
    "tertiary": "فرعي",
    "trunk": "شرياني",
    "unclassified": "غير مصنف",
    "living street": "شارع حيّ",
    "service": "خدمة",
    "none": "لا يوجد",
    "user": "المستخدم",
    "simulated": "محاكاة",
    "scenario": "سيناريو",
    "estimated": "مقدّر",
    "osm/default": "OSM أو افتراضي",
    # ---- model and data screen
    "Congestion factor vs. load (current parameters)": "معامل الازدحام مقابل الحمولة (المعاملات الحالية)",
    "load (vehicles / capacity)": "الحمولة (المركبات / السعة)",
    "slowdown factor": "معامل التباطؤ",
    "Loaded network": "الشبكة المحمّلة",
    "__ABOUT__": """
#### كيف يختار مسار الطريق
يحسب مسار لكل مقطع طريق باتجاه معيّن زمن عبور مقدّرًا:

```
congestion_ratio  = vehicles / max(capacity, 1)
congestion_factor = min(1 + α · ratio^β, max_factor)        α={alpha}, β={beta}, max={max_factor}
free_flow_time    = length / free_flow_speed
edge_cost         = free_flow_time × congestion_factor      (speed never below {min_speed} km/h)
```

* **طريق المسافة:** خوارزمية Dijkstra على طول المقطع.
* **الطريق الأسرع:** خوارزمية Dijkstra على زمن الطريق الفارغ (تتجاهل المركبات).
* **طريق مسار:** خوارزمية A* على `edge_cost` مع دالة تقدير بالخط المستقيم، فهو الأمثل تمامًا حسب النموذج. ويختار طريقًا أطول كلما كان وقته المقدّر أقل.
* **البدائل:** تُوجد بجعل الطرق المستخدمة أغلى ثم البحث مجددًا. تُستخدم العقوبة في ذلك البحث فقط، ثم تُقيَّم كل الطرق تحت حركة المرور الحقيقية نفسها.

تُستخدم فقط المقاطع الموجودة في شبكة OSM ذات الاتجاهات، فتُحترم الشوارع ذات الاتجاه الواحد وتُستثنى المقاطع المغلقة.

#### ماذا تعني أرقام الرحلة
* **التأخير:** الوقت المقدّر ناقص الوقت على طرق فارغة.
* **كثافة المرور:** المركبات ÷ السعة، بمتوسط على طول الطريق حسب الطول.
* **الكفاءة:** الوقت على طرق فارغة ÷ الوقت المقدّر. 100% تعني أن الحركة لا تضيف تأخيرًا.
* **الوقت الموفَّر:** مقارنة بأبطأ طريق معروض، أو المقاس في القيادة عند انتهائها.

هذه الأرقام من النموذج أعلاه. إشارات المرور وتأخير المنعطفات والطوابير غير محسوبة، فهي ليست توقعات لرحلات حقيقية.

#### مصدر البيانات
* **الطرق:** بيانات OpenStreetMap حقيقية (© OpenStreetMap contributors, ODbL) نُزّلت عبر OSMnx وحُفظت محليًا.
* **المعالم:** أماكن مسماة من OpenStreetMap، محفوظة محليًا.
* **أعداد المركبات:** مدخلات محاكاة أو من المستخدم. لا يوجد مصدر مباشر لبيانات المرور.
* **السعة:** مقدّرة بـ الحارات × الطول / {spacing} م ما لم تُعدَّل.
* **سرعة الطريق الفارغ:** وسم `maxspeed` في OSM إن وُجد، وإلا قيمة افتراضية لنوع الطريق (افتراض).
""",
}
