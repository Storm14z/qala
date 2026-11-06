/* Qala prototype — app logic (vanilla JS, no build step).
   Screens: Onboarding · Home Map · Place Card · Events · My Day · Profile (+ AI Day Planner sheet). */
(() => {
  "use strict";
  const D = QALA_DATA, P = QalaPlanner;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const place = (id) => D.PLACES.find((p) => p.id === id);
  const event = (id) => D.EVENTS.find((e) => e.id === id);
  const money = (n) => (n === 0 ? "Free" : n.toLocaleString("en-US") + " KZT");
  const km1 = (n) => n.toFixed(1);

  /* ---------------- state (saved in localStorage) ---------------- */
  const KEY = "qala-proto-v1";
  const fresh = () => ({
    onboarded: false, name: "", role: "Tourist", interests: [],
    myday: [], savedPlaces: [], checkins: [], reviews: {}, friends: D.FRIENDS.slice(), friendsAdded: 0,
    acceptedPlan: false, badges: [], avoid: [], dayOffset: 0
  });
  let S;
  try { S = Object.assign(fresh(), JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) { S = fresh(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } };
  const ui = { screen: "map", prev: "map", evDay: 0, evCat: "All", layers: { places: true, events: true }, selected: null, ai: null };

  /* ---------------- dates ---------------- */
  const today0 = new Date(); today0.setHours(0, 0, 0, 0);
  const dateOf = (off) => { const d = new Date(today0); d.setDate(d.getDate() + off); return d; };
  const dLabel = (off) => dateOf(off).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const rel = (off) => (off === 0 ? "Today" : off === 1 ? "Tomorrow" : dLabel(off));
  const isOpenNow = (p) => { const h = new Date().getHours(); return h >= p.open[0] && h < p.open[1]; };

  /* ---------------- tiny UI helpers ---------------- */
  let toastT;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2400);
  }
  function openSheet(html) {
    $("#sheet").innerHTML = '<div class="grab"></div><div class="body">' + html + "</div>";
    $("#sheet").hidden = false; $("#backdrop").hidden = false;
  }
  function closeSheet() { $("#sheet").hidden = true; $("#backdrop").hidden = true; $("#sheet").innerHTML = ""; }
  const chips = (list, sel, act, extra = "") => list.map((x) => `<button class="chip ${sel.includes(x) ? "on" : ""}" data-act="${act}" data-v="${esc(x)}" ${extra}>${esc(x)}</button>`).join("");

  /* ---------------- My Day data helpers ---------------- */
  function info(it) {
    if (it.kind === "place") { const p = place(it.id); return { title: p.name, sub: p.cat, lat: p.lat, lng: p.lng, price: p.price }; }
    const e = event(it.id), p = place(e.place);
    return { title: e.title, sub: "Event · " + p.name, lat: p.lat, lng: p.lng, price: e.price };
  }
  const dayItems = (off) => S.myday.filter((i) => i.day === off).sort((a, b) => a.start - b.start);
  const inMyDay = (kind, id) => S.myday.some((i) => i.kind === kind && i.id === id);
  function overlaps(list) {
    const bad = new Set();
    list.forEach((a, i) => list.slice(i + 1).forEach((b) => { if (b.start < a.start + a.dur && a.start < b.start + b.dur) { bad.add(a.uid); bad.add(b.uid); } }));
    return bad;
  }
  const uid = () => Math.random().toString(36).slice(2, 9);
  function suggestStart(day) {
    const l = dayItems(day); if (!l.length) return 600;
    const last = l[l.length - 1]; return Math.min(1260, Math.ceil((last.start + last.dur + 30) / 5) * 5);
  }
  function updateBadge() { const n = S.myday.length, b = $("#mydayBadge"); b.hidden = !n; b.textContent = n; }

  /* ---------------- badges ---------------- */
  function earnedBadges() {
    const got = new Set();
    if (S.savedPlaces.length >= 3) got.add("explorer");
    if (S.checkins.some((id) => P.toMin(event(id).start) >= 18 * 60)) got.add("nightowl");
    if (S.savedPlaces.some((id) => place(id).tags.includes("Food")) || S.checkins.some((id) => event(id).cat === "Food")) got.add("foodie");
    if (S.acceptedPlan) got.add("planner");
    if (S.friendsAdded > 0) got.add("social");
    if (Object.values(S.reviews).some((l) => l.some((r) => r.mine))) got.add("critic");
    return got;
  }
  function checkBadges() {
    const got = earnedBadges();
    const fresh = [...got].filter((b) => !S.badges.includes(b));
    if (fresh.length) {
      S.badges = [...got]; save();
      const b = D.BADGES.find((x) => x.id === fresh[0]);
      setTimeout(() => toast("Badge earned: " + b.icon + " " + b.name), 350);
    }
  }

  /* ---------------- navigation ---------------- */
  const SCREENS = ["onb", "map", "place", "events", "myday", "profile"];
  function go(name, opts = {}) {
    if (name === "place") { if (ui.screen !== "place") ui.prev = ui.screen; } else ui.prev = name;
    ui.screen = name;
    SCREENS.forEach((s) => $("#s-" + s).classList.toggle("active", s === name));
    const tabName = name === "place" ? ui.prev : name;
    $$(".tab").forEach((t) => t.classList.toggle("on", t.dataset.screen === tabName));
    $("#tabbar").classList.toggle("hidden", name === "onb");
    ({ onb: renderOnb, events: renderEvents, myday: renderMyDay, profile: renderProfile, map: showMap }[name] || (() => {}))(opts);
    updateBadge();
  }

  /* ================= 1 · ONBOARDING ================= */
  function renderOnb() {
    $("#s-onb").innerHTML = `
      <div class="onb">
        <div class="logo">Q</div>
        <h1>Qala</h1>
        <p class="lead">One app. One map.<br>Everything happening.</p>
        <label class="lbl" for="obName">Your name</label>
        <input id="obName" class="input" placeholder="e.g. Amir" maxlength="24" value="${esc(S.name)}">
        <span class="lbl">I am a</span>
        <div class="seg">
          <button data-act="setRole" data-v="Tourist" class="${S.role === "Tourist" ? "on" : ""}">Tourist</button>
          <button data-act="setRole" data-v="Local citizen" class="${S.role === "Local citizen" ? "on" : ""}">Local citizen</button>
        </div>
        <span class="lbl">Pick your interests</span>
        <div class="grid3">${D.GENRES.map((g) => `<button data-act="togInterest" data-v="${g}" class="${S.interests.includes(g) ? "on" : ""}">${g}</button>`).join("")}</div>
        <div class="err" id="obErr"></div>
        <button class="btn block" data-act="finishOnb">Continue</button>
      </div>`;
  }

  /* ================= 2 · HOME MAP ================= */
  let map, placeLayer, eventLayer, routeLayer, meMarker; const pins = {};
  function pinIcon(cls, html) { return L.divIcon({ className: "", html: `<div class="pin ${cls}">${html}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] }); }
  function showMap() {
    if (!map) initMap();
    setTimeout(() => map && map.invalidateSize(), 60);
    $("#searchResults").hidden = true;
  }
  function initMap() {
    if (typeof L === "undefined") {
      $("#map").innerHTML = '<div class="map-fallback"><div><big style="font-size:40px">🗺️</big><p>The map library could not be loaded.<br>Check your internet connection and reload.</p></div></div>';
      return;
    }
    map = L.map("map", { zoomControl: false, attributionControl: true }).setView([D.USER_LOC.lat, D.USER_LOC.lng], 12);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19, subdomains: "abcd", attribution: "© OpenStreetMap contributors © CARTO"
    }).addTo(map);
    placeLayer = L.layerGroup().addTo(map); eventLayer = L.layerGroup().addTo(map); routeLayer = L.layerGroup().addTo(map);
    meMarker = L.marker([D.USER_LOC.lat, D.USER_LOC.lng], { icon: pinIcon("me", ""), zIndexOffset: 500, interactive: false }).addTo(map);
    D.PLACES.forEach((p) => {
      const m = L.marker([p.lat, p.lng], { icon: pinIcon("place", p.emoji) }).addTo(placeLayer);
      m.on("click", () => selectItem("place", p.id));
      pins["p:" + p.id] = m;
    });
    D.EVENTS.filter((e) => e.day === 0).forEach((e) => {
      const p = place(e.place);
      const m = L.marker([p.lat + 0.0016, p.lng + 0.0016], { icon: pinIcon("event", "★") }).addTo(eventLayer);
      m.on("click", () => selectItem("event", e.id));
      pins["e:" + e.id] = m;
    });
    map.on("click", () => { $("#mapCard").hidden = true; unselect(); });
  }
  function unselect() {
    if (ui.selected && pins[ui.selected]) { const el = pins[ui.selected].getElement(); el && el.firstChild.classList.remove("sel"); }
    ui.selected = null;
  }
  function selectItem(kind, id) {
    unselect();
    const key = (kind === "place" ? "p:" : "e:") + id;
    ui.selected = key;
    const card = $("#mapCard");
    if (kind === "place") {
      const p = place(id);
      const evs = D.EVENTS.filter((e) => e.place === id && e.day === 0);
      card.innerHTML = `
        <h3>${esc(p.name)}</h3>
        <div class="meta"><span class="stars">★ ${p.rating.toFixed(1)}</span> · ${km1(P.km(D.USER_LOC, p))} km · ${isOpenNow(p) ? '<span style="color:var(--green)">Open now</span>' : "Closed now"}</div>
        ${evs.map((e) => `<div class="hint-box ev" data-act="openEvent" data-id="${e.id}">Event today ${e.start}<br><b>${esc(e.title)}</b></div>`).join("")}
        <div class="row" style="margin-top:12px"><button class="btn sec grow" data-act="openPlace" data-id="${id}">Details</button>
        <button class="btn grow" data-act="addPlace" data-id="${id}">${inMyDay("place", id) ? "In My Day ✓" : "+ My Day"}</button></div>`;
      map && map.panTo([p.lat, p.lng], { animate: true });
    } else {
      const e = event(id), p = place(e.place);
      card.innerHTML = `
        <h3>${esc(e.title)}</h3>
        <div class="meta">Today ${e.start} · ${esc(p.name)} · ${money(e.price)}</div>
        <div class="row"><button class="btn sec grow" data-act="openEvent" data-id="${id}">Details</button>
        <button class="btn grow" data-act="addEvent" data-id="${id}">${inMyDay("event", id) ? "In My Day ✓" : "+ My Day"}</button></div>`;
      map && map.panTo([p.lat + 0.0016, p.lng + 0.0016], { animate: true });
    }
    card.hidden = false;
    const pin = pins[key]; if (pin) { const el = pin.getElement(); el && el.firstChild.classList.add("sel"); }
  }
  function runSearch(q) {
    const box = $("#searchResults"); q = q.trim().toLowerCase();
    if (!q) { box.hidden = true; return; }
    const res = [];
    D.PLACES.forEach((p) => { if ((p.name + " " + p.cat + " " + p.tags.join(" ") + " " + p.tagsUI.join(" ")).toLowerCase().includes(q)) res.push({ kind: "place", id: p.id, t: p.name, s: p.cat, e: p.emoji }); });
    D.EVENTS.forEach((e) => { if ((e.title + " " + e.cat).toLowerCase().includes(q)) res.push({ kind: "event", id: e.id, t: e.title, s: rel(e.day) + " " + e.start + " · " + e.cat, e: "★" }); });
    box.innerHTML = res.length ? res.slice(0, 8).map((r) => `<button data-act="pickResult" data-kind="${r.kind}" data-id="${r.id}"><span style="font-size:20px">${r.e}</span><span><b>${esc(r.t)}</b><small>${esc(r.s)}</small></span></button>`).join("") : '<div class="empty" style="padding:16px">No results</div>';
    box.hidden = false;
  }
  function drawRoute(off) {
    const list = dayItems(off); if (!map) return;
    routeLayer.clearLayers();
    if (list.length < 1) return;
    const pts = list.map((i) => { const x = info(i); return [x.lat, x.lng]; });
    L.polyline(pts, { color: "#60a5fa", weight: 4, dashArray: "8 8" }).addTo(routeLayer);
    list.forEach((i, k) => L.marker(pts[k], { icon: pinIcon("num", k + 1), zIndexOffset: 800 }).addTo(routeLayer));
    map.fitBounds(pts, { padding: [60, 90] });
    const dist = pts.slice(1).reduce((a, p, k) => a + P.km({ lat: pts[k][0], lng: pts[k][1] }, { lat: p[0], lng: p[1] }), 0);
    $("#mapCard").innerHTML = `<h3>Route · ${rel(off)}</h3><div class="meta">${list.length} stops · ${km1(dist)} km between stops</div>
      <div class="row"><button class="btn sec grow" data-act="clearRoute">Clear route</button><button class="btn grow" data-act="go" data-screen="myday">Back to My Day</button></div>`;
    $("#mapCard").hidden = false;
  }

  /* ================= 3 · PLACE CARD ================= */
  function placeRating(p) {
    const mine = (S.reviews[p.id] || []).filter((r) => r.mine);
    const n = p.reviews + mine.length, sum = p.rating * p.reviews + mine.reduce((a, r) => a + r.rating, 0);
    return { avg: sum / n, n };
  }
  let gIdx = 0;
  function renderPlace(id) {
    const p = place(id), r = placeRating(p);
    const slides = [p.emoji, "🌅", "📸"];
    const revs = (S.reviews[id] || []).concat(D.REVIEWS[id] || []);
    const evs = D.EVENTS.filter((e) => e.place === id).sort((a, b) => a.day - b.day);
    gIdx = 0;
    $("#s-place").innerHTML = `
      <div class="gallery" id="gal">
        <button class="back" data-act="back" aria-label="Back">‹</button>
        <div class="g-track" id="gTrack">${slides.map((s, i) => `<div class="g-slide" style="background:linear-gradient(135deg,${p.grad[0]},${p.grad[1]})">${s}</div>`).join("")}</div>
        <button class="g-nav l" data-act="gal" data-d="-1" aria-label="Previous photo">‹</button>
        <button class="g-nav r" data-act="gal" data-d="1" aria-label="Next photo">›</button>
        <span class="g-cap" id="gCap">Photo gallery 1/3</span>
        <div class="g-dots" id="gDots">${slides.map((_, i) => `<i class="${i === 0 ? "on" : ""}"></i>`).join("")}</div>
      </div>
      <div class="scroll" style="padding:0">
        <div class="place-body">
          <h2>${esc(p.name)}</h2>
          <div class="row" style="margin:4px 0"><span class="stars">★ ${r.avg.toFixed(1)}</span><span class="mute">(${r.n} reviews)</span></div>
          <div class="mute small">${esc(p.addr)} · ${km1(P.km(D.USER_LOC, p))} km · ${p.open[0] === 0 ? "Open 24h" : "Open " + p.open[0] + ":00–" + p.open[1] + ":00"}</div>
          <div style="margin:12px 0 4px">${p.tagsUI.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}<span class="tag">${money(p.price)}</span></div>
          <p style="color:#c7d3ea">${esc(p.desc)}</p>
          ${evs.length ? `<div class="sec-t">Events here</div>${evs.map((e) => `<button class="card" style="width:100%;text-align:left;margin-bottom:8px" data-act="openEvent" data-id="${e.id}"><b>${esc(e.title)}</b><div class="mute small">${rel(e.day)} · ${e.start} · ${money(e.price)}</div></button>`).join("")}` : ""}
          <div class="row sp" style="margin-top:18px"><div class="sec-t" style="margin:0">Reviews</div><button class="btn sec sm" data-act="writeReview" data-id="${id}">Write a review</button></div>
          ${revs.length ? revs.map((v) => `<div class="review"><b>${esc(v.who)}</b> <span class="stars">${"★".repeat(v.rating)}</span><div style="color:#c7d3ea">“${esc(v.text)}”</div></div>`).join("") : '<p class="mute" style="margin-top:8px">No reviews yet. Be the first!</p>'}
        </div>
      </div>
      <div class="actions">
        <button class="btn sec" data-act="navigate" data-id="${id}">Navigate</button>
        <button class="btn" data-act="addPlace" data-id="${id}">${inMyDay("place", id) ? "In My Day ✓" : "+ My Day"}</button>
      </div>`;
  }
  function moveGallery(d) {
    gIdx = (gIdx + d + 3) % 3;
    $("#gTrack").style.transform = `translateX(-${gIdx * 100}%)`;
    $("#gCap").textContent = "Photo gallery " + (gIdx + 1) + "/3";
    $$("#gDots i").forEach((x, i) => x.classList.toggle("on", i === gIdx));
  }

  /* ================= 4 · EVENTS ================= */
  function renderEvents() {
    const days = [0, 1, 2, 3, 4, 5, 6];
    let list = D.EVENTS.filter((e) => e.day === ui.evDay && (ui.evCat === "All" || e.cat === ui.evCat)).sort((a, b) => a.start.localeCompare(b.start));
    $("#s-events").innerHTML = `
      <div class="hdr"><h2>Events</h2><p>${dateOf(ui.evDay).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p></div>
      <div class="days">${days.map((d) => `<button class="day ${d === ui.evDay ? "on" : ""}" data-act="evDay" data-v="${d}"><small>${dateOf(d).toLocaleDateString("en-US", { weekday: "short" })}</small><b>${dateOf(d).getDate()}</b></button>`).join("")}</div>
      <div class="filters"><div class="chips-row">${["All", ...D.GENRES].map((g) => `<button class="chip ${ui.evCat === g ? "on" : ""}" data-act="evCat" data-v="${g}">${g}</button>`).join("")}</div></div>
      <div class="scroll">
        ${list.length ? list.map((e) => { const p = place(e.place); const added = inMyDay("event", e.id); return `
          <div class="ev-row"><div class="ev-time">${e.start}</div>
            <div class="ev-card ${e.cat}" data-act="openEvent" data-id="${e.id}" role="button" tabindex="0">
              <h4>${esc(e.title)}</h4>
              <div class="mute small">${esc(p.name)} · ${e.price === 0 ? "Free" : "from " + e.price.toLocaleString("en-US") + " KZT"}</div>
              <span class="tag" style="margin:8px 0 0">${e.cat}</span>
              <button class="btn ${added ? "sec" : ""} sm add" data-act="addEvent" data-id="${e.id}">${added ? "In My Day ✓" : "+ My Day"}</button>
            </div></div>`; }).join("")
          : `<div class="empty"><big>🗓️</big>No ${ui.evCat === "All" ? "" : ui.evCat + " "}events on this day.<br>Try another date or category.</div>`}
      </div>`;
  }
  function openEvent(id) {
    const e = event(id), p = place(e.place), done = S.checkins.includes(id), added = inMyDay("event", id);
    openSheet(`
      <span class="tag">${e.cat}</span>
      <h3>${esc(e.title)}</h3>
      <div class="mute small" style="margin-bottom:10px">${rel(e.day)} · ${e.start}–${P.fmt(P.toMin(e.start) + e.dur)} · ${esc(p.name)}</div>
      <p style="color:#c7d3ea">${esc(e.desc)}</p>
      <div class="two" style="margin:14px 0"><div class="card"><div class="mute small">Price</div><b>${money(e.price)}</b></div><div class="card"><div class="mute small">Organizer</div><b>${esc(e.organizer)}</b></div></div>
      <div class="row" style="margin-bottom:10px"><button class="btn sec grow" data-act="showOnMap" data-kind="place" data-id="${p.id}">View on map</button><button class="btn sec grow" data-act="navigate" data-id="${p.id}">Navigate</button></div>
      <div class="row"><button class="btn ${done ? "sec" : "sec"} grow" data-act="checkin" data-id="${id}">${done ? "Checked in ✓" : "Check in"}</button>
      <button class="btn grow" data-act="addEvent" data-id="${id}">${added ? "In My Day ✓" : "+ My Day"}</button></div>`);
  }

  /* ================= 5 · MY DAY ================= */
  function renderMyDay() {
    const off = S.dayOffset, list = dayItems(off), bad = overlaps(list);
    let dist = 0, hours = 0;
    list.forEach((i, k) => { hours += i.dur; if (k) dist += P.km(info(list[k - 1]), info(i)); });
    const h = list.length ? list[0].start : 0, endT = list.length ? Math.max(...list.map((i) => i.start + i.dur)) : 0;
    $("#s-myday").innerHTML = `
      <div class="hdr"><h2>My Day</h2></div>
      <div class="scroll" style="padding-top:4px">
        <div class="dnav"><button class="arrow" data-act="dayShift" data-d="-1" ${off === 0 ? "disabled style='opacity:.3'" : ""} aria-label="Previous day">‹</button>
          <h3>${rel(off)}<div class="mute small" style="font-weight:600">${dLabel(off)}${list.length ? " · " + P.fmt(h) + "–" + P.fmt(endT) : ""}</div></h3>
          <button class="arrow" data-act="dayShift" data-d="1" ${off === 6 ? "disabled style='opacity:.3'" : ""} aria-label="Next day">›</button></div>
        <button class="ai-cta" data-act="openAI" data-from="myday"><i>✨</i><span><b>Plan my day with AI</b><span>Personal route from places and live events</span></span></button>
        ${list.length ? list.map((i, k) => {
          const x = info(i);
          const w = k ? P.travelMin(info(list[k - 1]), x) : null;
          return `${w !== null ? `<div class="walk">↓ ${w} min ${P.km(info(list[k - 1]), x) <= 1.8 ? "walk" : "by bus / taxi"} · ${km1(P.km(info(list[k - 1]), x))} km</div>` : ""}
            <div class="stop"><div class="t">${P.fmt(i.start)}</div><div class="dot ${i.kind}"></div>
              <div class="c ${bad.has(i.uid) ? "clash" : ""}" data-act="editStop" data-uid="${i.uid}" role="button" tabindex="0">
                <div class="row sp"><h4>${esc(x.title)}</h4><button class="x" data-act="removeStop" data-uid="${i.uid}" aria-label="Remove">×</button></div>
                <div class="mute small">${esc(x.sub)} · ${(i.dur / 60).toString().replace(/\.0$/, "")} h · ${money(x.price)}${i.ai ? " · ✨ AI" : ""}</div>
                ${bad.has(i.uid) ? '<div class="small" style="color:#fca5a5;margin-top:4px">Time conflict with another stop</div>' : ""}
              </div></div>`;
        }).join("") : `<div class="empty"><big>📍</big>Nothing planned for this day yet.<br>Add places from the map, events from the timeline, or let AI plan it.</div>`}
        ${list.length ? `<div class="totals"><div><b>${list.length}</b><span>stops</span></div><div><b>${(hours / 60).toFixed(1).replace(/\.0$/, "")} h</b><span>planned</span></div><div><b>${km1(dist)} km</b><span>distance</span></div></div>
        <div class="row" style="margin-top:12px"><button class="btn sec grow" data-act="showRoute">Show route on map</button><button class="btn ghost grow" data-act="clearDay">Clear day</button></div>` : ""}
      </div>`;
  }
  function addSheetForPlace(id) {
    const p = place(id), day = S.dayOffset, st = Math.max(suggestStart(day), p.open[0] * 60);
    openSheet(`
      <h3>Add to My Day</h3><div class="mute small">${esc(p.name)} · ${p.open[0] === 0 ? "open 24h" : "open " + p.open[0] + ":00–" + p.open[1] + ":00"}</div>
      <div class="field"><label>Day</label><select class="input" id="fDay">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${d === day ? "selected" : ""}>${rel(d)}</option>`).join("")}</select></div>
      <div class="two"><div class="field"><label>Start time</label><input class="input" type="time" id="fTime" value="${P.fmt(st)}"></div>
      <div class="field"><label>Duration</label><select class="input" id="fDur">${[30, 45, 60, 90, 120, 150, 180].map((m) => `<option value="${m}" ${m === p.dur ? "selected" : ""}>${m} min</option>`).join("")}</select></div></div>
      <button class="btn block" style="margin-top:18px" data-act="confirmAddPlace" data-id="${id}">Add to My Day</button>`);
  }

  /* ================= 6 · PROFILE ================= */
  function renderProfile() {
    const got = earnedBadges(), name = S.name || "Guest";
    const initials = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "G";
    const locked = D.BADGES.filter((b) => !got.has(b.id));
    const next = locked[0];
    const need = next ? (next.id === "explorer" ? 3 - S.savedPlaces.length + " more place" + (3 - S.savedPlaces.length === 1 ? "" : "s") : "1 more step") : "";
    $("#s-profile").innerHTML = `
      <div class="hdr"><h2>Profile</h2></div>
      <div class="scroll" style="padding-top:6px">
        <div class="prof-head"><div class="avatar">${esc(initials)}</div>
          <div class="grow"><input class="input" id="pName" value="${esc(S.name)}" placeholder="Your name" maxlength="24" style="padding:8px 12px;font-weight:700"><div class="mute small" style="margin-top:4px">${esc(S.role)} · Astana</div></div></div>
        <div class="stats"><div><b>${S.checkins.length}</b><span>Events</span></div><div><b>${S.savedPlaces.length}</b><span>Places</span></div><div><b>${S.friends.length}</b><span>Friends</span></div></div>
        <div class="sec-t" style="margin-top:0">Badges</div>
        <div class="badges">${D.BADGES.map((b) => `<div class="badge ${got.has(b.id) ? "" : "locked"}"><i>${got.has(b.id) ? b.icon : "🔒"}</i><b>${b.name}</b>${got.has(b.id) ? "" : `<small>${b.hint}</small>`}</div>`).join("")}</div>
        ${next ? `<div class="card" style="margin-top:12px"><div class="row sp"><b>Next badge: ${next.name}</b><span class="mute small">${need}</span></div><div class="progress"><i style="width:${Math.round(got.size / D.BADGES.length * 100)}%"></i></div></div>` : '<div class="card" style="margin-top:12px"><b>All badges collected 🎉</b></div>'}
        <div class="sec-t">Interests</div>
        <div>${D.GENRES.map((g) => `<button class="chip ${S.interests.includes(g) ? "on" : ""}" style="margin:0 6px 8px 0" data-act="togInterestProfile" data-v="${g}">${g}</button>`).join("")}</div>
        <div class="sec-t">I am a</div>
        <div class="seg"><button data-act="setRoleProfile" data-v="Tourist" class="${S.role === "Tourist" ? "on" : ""}">Tourist</button><button data-act="setRoleProfile" data-v="Local citizen" class="${S.role === "Local citizen" ? "on" : ""}">Local citizen</button></div>
        <div class="sec-t">Friends</div>
        ${S.friends.map((f) => `<div class="friend"><div class="avatar">${esc(f[0].toUpperCase())}</div><b>${esc(f)}</b></div>`).join("")}
        <div class="row" style="margin-top:8px"><input class="input" id="newFriend" placeholder="Add a friend by name" maxlength="24"><button class="btn sm" data-act="addFriend">Add</button></div>
      </div>`;
  }

  /* ================= AI DAY PLANNER (Task 2) ================= */
  function aiDefaults(from) {
    const day = from === "myday" ? S.dayOffset : 0;
    return { day, from: "10:00", to: "21:00", budget: 8000, interests: S.interests.length ? S.interests.slice() : ["Music", "Tech"], notes: "", plan: null };
  }
  function openAI(from) {
    ui.ai = aiDefaults(from);
    renderAIForm();
  }
  function renderAIForm() {
    const a = ui.ai;
    openSheet(`
      <h3>✨ Plan my day with AI</h3>
      <p class="mute small">Pre-filled from your profile. Change anything, then generate.</p>
      <div class="field"><label>Date</label><select class="input" id="aiDay">${[0, 1, 2, 3, 4, 5, 6].map((d) => `<option value="${d}" ${d === a.day ? "selected" : ""}>${rel(d)} · ${dLabel(d)}</option>`).join("")}</select></div>
      <div class="two"><div class="field"><label>Free from</label><input class="input" type="time" id="aiFrom" value="${a.from}"></div><div class="field"><label>Free until</label><input class="input" type="time" id="aiTo" value="${a.to}"></div></div>
      <div class="field"><label>Budget (KZT)</label><input class="input" type="number" min="0" step="500" id="aiBudget" value="${a.budget}"></div>
      <div class="field"><label>Interests</label><div>${D.GENRES.map((g) => `<button class="chip ${a.interests.includes(g) ? "on" : ""}" style="margin:0 6px 8px 0" data-act="aiInterest" data-v="${g}">${g}</button>`).join("")}</div></div>
      <div class="field"><label>Anything else? (optional)</label><input class="input" id="aiNotes" value="${esc(a.notes)}" placeholder="e.g. indoor only, no museums, free, more food"></div>
      <div class="err" id="aiErr"></div>
      <button class="btn ai block" data-act="aiGenerate">Generate plan</button>`);
  }
  function readAIForm() {
    const a = ui.ai;
    a.day = +$("#aiDay").value; a.from = $("#aiFrom").value || "10:00"; a.to = $("#aiTo").value || "21:00";
    a.budget = Math.max(0, +$("#aiBudget").value || 0); a.notes = $("#aiNotes").value;
  }
  function genPlan(seedAvoid) {
    const a = ui.ai;
    const avoid = new Set([...(S.avoid || []), ...(seedAvoid || [])]);
    a.plan = P.generate({ day: a.day, from: P.toMin(a.from), to: P.toMin(a.to), budget: a.budget, interests: a.interests, notes: a.notes, seed: Math.floor(Math.random() * 1e9), avoid });
  }
  function think(thenFn) {
    const n = D.PLACES.length;
    openSheet(`<div class="think"><div class="spin"></div><b>Qala AI is planning…</b><ul>
      <li>Reading your interests: ${esc(ui.ai.interests.join(", ") || "none")}</li><li>Ranking ${n} places and ${D.EVENTS.filter((e) => e.day === ui.ai.day).length} events for ${rel(ui.ai.day).toLowerCase()}</li>
      <li>Checking time, budget and walking distances</li><li>Writing “why this stop” notes</li></ul></div>`);
    setTimeout(thenFn, 1300);
  }
  function renderPlan() {
    const a = ui.ai, pl = a.plan, t = pl.totals;
    openSheet(`
      <div class="row sp"><h3>AI Plan</h3><span class="mute small">${rel(a.day)} · ${a.from}–${a.to}</span></div>
      <div class="chips-row" style="margin:6px 0 2px"><span class="tag">Budget ${a.budget.toLocaleString("en-US")}</span><span class="tag">${esc(a.interests.join(" · ") || "No interests")}</span></div>
      <div class="ai-note">${esc(pl.summary)}${pl.stops.length ? " · " + km1(t.km) + " km" : ""}<br>Weather: ${pl.weather.temp}°C, ${pl.weather.cond}${pl.nl.indoorOnly ? " · indoor only" : ""}</div>
      ${pl.stops.map((s, i) => `
        <div class="plan-stop ${s.kind}"><div class="n">${i + 1}</div>
          <div class="grow"><b>${P.fmt(s.start)}  ${esc(s.title)}</b><div class="mute small">${s.kind === "event" ? "Event" : "Place"} · ${s.dur >= 60 ? (s.dur / 60).toFixed(1).replace(/\.0$/, "") + " h" : s.dur + " min"} · ${money(s.price)}</div>
          <div class="why">Why: ${esc(s.why)}</div></div>
          <button class="swap" data-act="aiSwap" data-i="${i}">Swap</button></div>`).join("") || '<div class="empty" style="padding:20px">No plan could be built with these limits.</div>'}
      ${pl.stops.length ? `<div class="totals"><div><b>${t.count}</b><span>stops</span></div><div><b>${t.hours.toFixed(1).replace(/\.0$/, "")} h</b><span>activity</span></div><div><b>${t.cost.toLocaleString("en-US")}</b><span>of ${a.budget.toLocaleString("en-US")} KZT</span></div></div>` : ""}
      <div class="row" style="margin-top:16px"><button class="btn sec grow" data-act="aiRegen">Regenerate</button><button class="btn grow" data-act="aiAccept" ${pl.stops.length ? "" : "disabled"}>Accept plan</button></div>
      <button class="btn ghost block" style="margin-top:10px" data-act="aiEdit">Edit inputs</button>`);
  }

  /* ================= ACTIONS (event delegation) ================= */
  function addPlaceToDay(id, day, start, dur) {
    S.myday.push({ uid: uid(), kind: "place", id, day, start, dur });
    if (!S.savedPlaces.includes(id)) S.savedPlaces.push(id);
    S.dayOffset = day; save(); updateBadge(); checkBadges();
  }
  function refreshAfterChange() {
    if (ui.screen === "place") renderPlace(ui.placeId);
    if (ui.screen === "events") renderEvents();
    if (ui.screen === "myday") renderMyDay();
    if (ui.screen === "profile") renderProfile();
    if (ui.selected && ui.screen === "map") selectItem(ui.selected[0] === "p" ? "place" : "event", ui.selected.slice(2));
    updateBadge();
  }

  const A = {
    go: (el) => go(el.dataset.screen),
    back: () => go(ui.prev),
    setRole: (el) => { S.name = ($("#obName").value || "").trim(); S.role = el.dataset.v; save(); renderOnb(); },
    togInterest: (el) => { S.name = ($("#obName").value || "").trim(); const v = el.dataset.v; S.interests = S.interests.includes(v) ? S.interests.filter((x) => x !== v) : [...S.interests, v]; save(); renderOnb(); },
    finishOnb: () => {
      S.name = ($("#obName").value || "").trim();
      if (!S.interests.length) { $("#obErr").textContent = "Pick at least one interest to continue."; return; }
      S.onboarded = true; save(); go("map");
    },
    toggleLayer: (el) => {
      const k = el.dataset.layer; ui.layers[k] = !ui.layers[k]; el.classList.toggle("on", ui.layers[k]);
      if (!map) return;
      const lay = k === "places" ? placeLayer : eventLayer;
      ui.layers[k] ? map.addLayer(lay) : map.removeLayer(lay);
    },
    locate: () => { if (map) { map.flyTo([D.USER_LOC.lat, D.USER_LOC.lng], 14); toast("Demo location: central Astana"); } },
    pickResult: (el) => {
      $("#searchResults").hidden = true; $("#searchInput").value = "";
      selectItem(el.dataset.kind, el.dataset.id);
      if (map) { const k = (el.dataset.kind === "place" ? "p:" : "e:") + el.dataset.id; if (pins[k]) map.flyTo(pins[k].getLatLng(), 15); }
    },
    openPlace: (el) => { ui.placeId = el.dataset.id; renderPlace(ui.placeId); go("place"); },
    gal: (el) => moveGallery(+el.dataset.d),
    navigate: (el) => { const p = place(el.dataset.id); window.open(`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`, "_blank", "noopener"); },
    showOnMap: (el) => { closeSheet(); go("map"); setTimeout(() => { selectItem(el.dataset.kind, el.dataset.id); const pin = pins["p:" + el.dataset.id]; if (map && pin) map.flyTo(pin.getLatLng(), 15); }, 120); },
    addPlace: (el) => {
      const id = el.dataset.id;
      if (inMyDay("place", id)) { toast("Already in My Day"); return; }
      addSheetForPlace(id);
    },
    confirmAddPlace: (el) => {
      const id = el.dataset.id, p = place(id);
      const day = +$("#fDay").value, start = P.toMin($("#fTime").value || "10:00"), dur = +$("#fDur").value;
      if (start < p.open[0] * 60 || start >= p.open[1] * 60) { toast("Closed at that time. " + p.name + " opens " + p.open[0] + ":00–" + p.open[1] + ":00"); return; }
      addPlaceToDay(id, day, start, dur); closeSheet(); refreshAfterChange(); toast("Added to My Day ✓");
    },
    addEvent: (el, ev) => {
      ev && ev.stopPropagation();
      const id = el.dataset.id, e = event(id);
      if (inMyDay("event", id)) { toast("Already in My Day"); return; }
      S.myday.push({ uid: uid(), kind: "event", id, day: e.day, start: P.toMin(e.start), dur: e.dur });
      S.dayOffset = e.day; save(); closeSheet(); refreshAfterChange(); toast("Added to My Day · " + rel(e.day)); checkBadges();
    },
    openEvent: (el, ev) => { ev && ev.stopPropagation(); openEvent(el.dataset.id); },
    checkin: (el) => {
      const id = el.dataset.id;
      if (!S.checkins.includes(id)) { S.checkins.push(id); save(); toast("Checked in ✓"); checkBadges(); } else toast("You already checked in");
      openEvent(id); refreshAfterChange();
    },
    evDay: (el) => { ui.evDay = +el.dataset.v; renderEvents(); },
    evCat: (el) => { ui.evCat = el.dataset.v; renderEvents(); },
    dayShift: (el) => { S.dayOffset = Math.min(6, Math.max(0, S.dayOffset + +el.dataset.d)); save(); renderMyDay(); },
    removeStop: (el, ev) => { ev && ev.stopPropagation(); S.myday = S.myday.filter((i) => i.uid !== el.dataset.uid); save(); refreshAfterChange(); toast("Removed"); },
    editStop: (el) => {
      const it = S.myday.find((i) => i.uid === el.dataset.uid); if (!it) return; const x = info(it);
      openSheet(`<h3>${esc(x.title)}</h3><div class="mute small">${esc(x.sub)}</div>
        <div class="two"><div class="field"><label>Start time</label><input class="input" type="time" id="eTime" value="${P.fmt(it.start)}"></div>
        <div class="field"><label>Duration</label><select class="input" id="eDur">${[30, 45, 60, 90, 120, 150, 180].map((m) => `<option value="${m}" ${m === it.dur ? "selected" : ""}>${m} min</option>`).join("")}</select></div></div>
        <button class="btn block" style="margin-top:18px" data-act="saveStop" data-uid="${it.uid}">Save</button>`);
    },
    saveStop: (el) => {
      const it = S.myday.find((i) => i.uid === el.dataset.uid); if (!it) return;
      it.start = P.toMin($("#eTime").value || P.fmt(it.start)); it.dur = +$("#eDur").value; save(); closeSheet(); renderMyDay(); toast("Updated");
    },
    clearDay: () => { S.myday = S.myday.filter((i) => i.day !== S.dayOffset); save(); renderMyDay(); updateBadge(); toast("Day cleared"); },
    showRoute: () => {
      if (!dayItems(S.dayOffset).length) { toast("Add stops first"); return; }
      go("map"); setTimeout(() => drawRoute(S.dayOffset), 150);
    },
    clearRoute: () => { routeLayer && routeLayer.clearLayers(); $("#mapCard").hidden = true; },
    writeReview: (el) => {
      ui.rate = 5; const id = el.dataset.id;
      openSheet(`<h3>Write a review</h3><div class="mute small">${esc(place(id).name)}</div>
        <div class="field"><label>Your rating</label><div class="stars-pick" id="starPick">${[1, 2, 3, 4, 5].map((n) => `<button data-act="rate" data-v="${n}" class="on" aria-label="${n} stars">★</button>`).join("")}</div></div>
        <div class="field"><label>Comment</label><textarea class="input" id="rvText" rows="3" maxlength="200" placeholder="What did you like?"></textarea></div>
        <button class="btn block" style="margin-top:16px" data-act="sendReview" data-id="${id}">Post review</button>`);
    },
    rate: (el) => { ui.rate = +el.dataset.v; $$("#starPick button").forEach((b, i) => b.classList.toggle("on", i < ui.rate)); },
    sendReview: (el) => {
      const text = ($("#rvText").value || "").trim(); if (!text) { toast("Write a short comment first"); return; }
      const id = el.dataset.id;
      (S.reviews[id] = S.reviews[id] || []).unshift({ who: S.name || "You", rating: ui.rate || 5, text, mine: true });
      save(); closeSheet(); renderPlace(id); toast("Review posted"); checkBadges();
    },
    togInterestProfile: (el) => { const v = el.dataset.v; S.interests = S.interests.includes(v) ? S.interests.filter((x) => x !== v) : [...S.interests, v]; save(); renderProfile(); },
    setRoleProfile: (el) => { S.role = el.dataset.v; save(); renderProfile(); },
    addFriend: () => {
      const v = ($("#newFriend").value || "").trim(); if (!v) { toast("Type a name first"); return; }
      S.friends.push(v); S.friendsAdded++; save(); renderProfile(); toast("Friend added"); checkBadges(); renderProfile();
    },
    resetDemo: () => { if (confirm("Reset all demo data?")) { localStorage.removeItem(KEY); location.reload(); } },

    /* AI */
    openAI: (el) => openAI(el.dataset.from),
    aiInterest: (el) => {
      readAIForm(); const v = el.dataset.v, a = ui.ai;
      a.interests = a.interests.includes(v) ? a.interests.filter((x) => x !== v) : [...a.interests, v]; renderAIForm();
    },
    aiGenerate: () => {
      readAIForm(); const a = ui.ai;
      if (P.toMin(a.to) - P.toMin(a.from) < 90) { $("#aiErr").textContent = "Please leave at least 1.5 hours of free time."; return; }
      think(() => { genPlan(); renderPlan(); });
    },
    aiRegen: () => { const ids = ui.ai.plan.stops.map((s) => s.id); think(() => { genPlan(ids); renderPlan(); }); },
    aiEdit: () => renderAIForm(),
    aiSwap: (el) => {
      const i = +el.dataset.i, pl = ui.ai.plan, old = pl.stops[i];
      const np = P.swap(pl, i, Math.floor(Math.random() * 1e9));
      if (!np) { toast("No alternative fits this time slot"); return; }
      S.avoid = [...new Set([...(S.avoid || []), old.id])].slice(-30); save(); // feedback: user rejected this stop
      ui.ai.plan = np; renderPlan(); toast("Swapped: " + old.title + " → " + np.stops.find((s) => !pl.stops.some((o) => o.id === s.id)).title);
    },
    aiAccept: () => {
      const a = ui.ai, pl = a.plan;
      S.myday = S.myday.filter((i) => !(i.day === a.day && i.ai));
      pl.stops.forEach((s) => {
        if (S.myday.some((i) => i.day === a.day && i.kind === s.kind && i.id === s.id)) return;
        S.myday.push({ uid: uid(), kind: s.kind, id: s.id, day: a.day, start: s.start, dur: s.dur, ai: true });
        if (s.kind === "place" && !S.savedPlaces.includes(s.id)) S.savedPlaces.push(s.id);
      });
      S.acceptedPlan = true; S.dayOffset = a.day; save(); closeSheet(); go("myday");
      toast("Plan saved to My Day"); checkBadges();
    }
  };

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const fn = A[el.dataset.act]; if (fn) fn(el, e);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  $("#backdrop").addEventListener("click", closeSheet);
  $("#searchInput").addEventListener("input", (e) => runSearch(e.target.value));
  document.addEventListener("change", (e) => { if (e.target.id === "pName") { S.name = e.target.value.trim(); save(); renderProfile(); } });

  /* ---------------- boot ---------------- */
  updateBadge();
  go(S.onboarded ? "map" : "onb");
  window.__qala = { S, go, A };
})();
