/* Qala AI Day Planner (Task 2).
   Pipeline from the slides:  Qala data -> recommendation model (interest match + rating)
   -> route optimizer (time, budget, distance) -> explanation text ("Why this stop?").
   It runs fully in the browser, so it is also the rule-based fallback when no LLM is connected. */

const QalaPlanner = (() => {
  const DATA = (typeof QALA_DATA !== "undefined") ? QALA_DATA : require("./data.js");

  // Demo weather (a real build would call a weather API)
  const WEATHER = { temp: -4, cond: "snow", cold: true };

  const r5 = (m) => Math.ceil(m / 5) * 5;
  const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
  const fmt = (min) => {
    const h = Math.floor(min / 60) % 24, m = Math.round(min % 60);
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  };

  function km(a, b) {
    const R = 6371, rad = (x) => x * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  // walking under 1.8 km, otherwise bus/taxi
  function travelMin(a, b) {
    const d = km(a, b);
    return d <= 1.8 ? Math.round(d / 4.8 * 60) : Math.round(d / 20 * 60 + 6);
  }

  function rng(seed) {
    let t = (seed || 1) >>> 0;
    return () => {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Very small "natural language" layer: understands words like indoor / outdoor / free / "no museum" */
  function parseNotes(text, interests) {
    const t = (text || "").toLowerCase();
    const out = { indoorOnly: /\bindoor/.test(t), outdoorPref: /\boutdoor|\bfresh air|\bwalk/.test(t), freeOnly: /\bfree\b|\bcheap\b/.test(t), exclude: [], interests: interests.slice() };
    const nos = [...t.matchAll(/\b(?:no|without|skip)\s+([a-z]+)/g)].map(m => m[1]);
    out.exclude = nos;
    DATA.GENRES.forEach(g => {
      const w = g.toLowerCase();
      if (t.includes(w) && !nos.includes(w) && !out.interests.includes(g)) out.interests.push(g);
    });
    return out;
  }

  function candidates(opts, nl) {
    const list = [];
    DATA.EVENTS.filter(e => e.day === opts.day).forEach(e => {
      const p = DATA.PLACES.find(x => x.id === e.place);
      const start = toMin(e.start);
      if (start < opts.from || start + e.dur > opts.to) return;
      list.push({ kind: "event", id: e.id, title: e.title, lat: p.lat, lng: p.lng, start, dur: e.dur, price: e.price,
        tags: [e.cat], rating: p.rating, indoor: p.indoor, cat: e.cat, venue: p.name });
    });
    DATA.PLACES.forEach(p => {
      if (p.open[1] * 60 <= opts.from || p.open[0] * 60 >= opts.to) return;
      list.push({ kind: "place", id: p.id, title: p.name, lat: p.lat, lng: p.lng, start: null, dur: p.dur, price: p.price,
        tags: p.tags, rating: p.rating, indoor: p.indoor, cat: p.cat, open: p.open, venue: p.addr });
    });
    return list.filter(c => {
      if (nl.indoorOnly && !c.indoor) return false;
      if (nl.freeOnly && c.price > 0) return false;
      const hay = (c.cat + " " + c.tags.join(" ") + " " + c.title + " " + (c.kind === "event" ? c.venue : "")).toLowerCase();
      if (nl.exclude.some(w => w.length > 2 && hay.includes(w))) return false;
      return true;
    });
  }

  function score(c, nl, rand, avoid) {
    const match = c.tags.filter(t => nl.interests.includes(t)).length;
    let s = match * 3 + (c.rating - 4) * 2;
    if (c.kind === "event") s += 1.2;
    if (WEATHER.cold && c.indoor) s += 1;
    if (nl.outdoorPref && !c.indoor) s += 1.5;
    s -= c.price / 12000;
    if (avoid && avoid.has(c.id)) s -= 2.5;
    return s + rand() * 0.8;
  }

  function why(c, nl, prevWalk, free) {
    const r = [];
    const hit = c.tags.find(t => nl.interests.includes(t));
    if (hit) r.push("matches “" + hit + "”");
    if (c.kind === "place" && c.rating >= 4.7) r.push("top-rated " + (c.cat === "Landmark" ? "landmark" : "spot") + " (" + c.rating.toFixed(1) + ")");
    if (c.kind === "event") r.push("live event at the time you are free");
    if (WEATHER.cold && c.indoor) r.push("indoor, cold-weather friendly");
    if (!c.indoor && nl.outdoorPref) r.push("fresh air, as you asked");
    if (c.price === 0) r.push("free");
    if (prevWalk != null && prevWalk > 0 && prevWalk <= 15) r.push(prevWalk + " min walk from the previous stop");
    if (!r.length) r.push("fits your free time well");
    return r.slice(0, 3).join(", ").replace(/^./, (x) => x.toUpperCase());
  }

  /* Recompute walking time, distance and totals for an ordered list of stops */
  function finalize(stops, startLoc, nl, from, to, budget) {
    let prev = startLoc, dist = 0, cost = 0, hours = 0;
    const out = stops.map((s, i) => {
      const d = km(prev, s), w = travelMin(prev, s);
      const walkFromPrev = i === 0 ? null : w;
      if (i > 0) dist += d;
      cost += s.price; hours += s.dur;
      prev = s;
      return Object.assign({}, s, { end: s.start + s.dur, walk: walkFromPrev, distKm: i === 0 ? 0 : d,
        why: why(s, nl, walkFromPrev) });
    });
    return { stops: out, totals: { count: out.length, hours: hours / 60, km: dist, cost, budget, from, to } };
  }

  function generate(raw) {
    const opts = Object.assign({ day: 0, from: 600, to: 1260, budget: 8000, interests: [], notes: "", seed: Date.now(), avoid: null, userLoc: DATA.USER_LOC }, raw);
    const nl = parseNotes(opts.notes, opts.interests);
    const rand = rng(opts.seed);
    const pool = candidates(opts, nl).map(c => Object.assign(c, { score: score(c, nl, rand, opts.avoid) }));
    pool.sort((a, b) => b.score - a.score);

    // 1) pick up to 2 non-overlapping events (they have fixed times)
    let budgetLeft = opts.budget;
    const chosenEvents = [];
    for (const e of pool.filter(c => c.kind === "event")) {
      if (chosenEvents.length >= 2) break;
      const matches = e.tags.some(t => nl.interests.includes(t));
      if (!matches && chosenEvents.length >= 1) continue;
      if (e.price > budgetLeft) continue;
      if (chosenEvents.some(x => e.start < x.start + x.dur + 30 && x.start < e.start + e.dur + 30)) continue;
      chosenEvents.push(e); budgetLeft -= e.price;
    }
    chosenEvents.sort((a, b) => a.start - b.start);

    // 2) fill the gaps with the best-scoring places that physically fit
    const stops = [], used = new Set(chosenEvents.map(e => e.id));
    let cursor = opts.from, loc = opts.userLoc;
    const MAX = 4;
    const fillGap = (segEnd, nextLoc) => {
      while (stops.length + (chosenEvents.length - stops.filter(s => s.kind === "event").length) < MAX) {
        let best = null;
        for (const p of pool) {
          if (p.kind !== "place" || used.has(p.id) || p.price > budgetLeft) continue;
          const t = travelMin(loc, p);
          const arr = r5(Math.max(cursor + t, p.open[0] * 60));
          const end = arr + p.dur;
          if (end > p.open[1] * 60) continue;
          const back = nextLoc ? travelMin(p, nextLoc) : 0;
          if (end + back > segEnd) continue;
          const val = p.score - t / 25;
          if (!best || val > best.val) best = { p, arr, end, val };
        }
        if (!best) break;
        stops.push(Object.assign({}, best.p, { start: best.arr }));
        used.add(best.p.id); budgetLeft -= best.p.price;
        cursor = best.end; loc = best.p;
      }
    };
    chosenEvents.forEach(ev => {
      fillGap(ev.start, ev);
      stops.push(Object.assign({}, ev));
      cursor = ev.start + ev.dur; loc = ev;
    });
    fillGap(opts.to, null);

    stops.sort((a, b) => a.start - b.start);
    const plan = finalize(stops, opts.userLoc, nl, opts.from, opts.to, opts.budget);
    plan.opts = opts; plan.nl = nl; plan.weather = WEATHER;
    plan.summary = plan.stops.length
      ? "AI picked " + plan.stops.length + " stop" + (plan.stops.length > 1 ? "s" : "") + " that match your interests"
      : "Nothing fits these limits. Try more free hours, a bigger budget or other interests.";
    return plan;
  }

  /* Swap one stop for the best alternative that fits the same time window. */
  function swap(plan, idx, seed) {
    const { opts, nl } = plan;
    const rand = rng(seed || Date.now());
    const cur = plan.stops[idx];
    const prev = plan.stops[idx - 1], next = plan.stops[idx + 1];
    const winStart = prev ? prev.end : opts.from, winEnd = next ? next.start : opts.to;
    const startLoc = prev || opts.userLoc;
    const spent = plan.stops.reduce((a, s) => a + s.price, 0) - cur.price;
    const inPlan = new Set(plan.stops.map(s => s.id));
    const pool = candidates(opts, nl).filter(c => !inPlan.has(c.id) && spent + c.price <= opts.budget);
    let best = null;
    for (const c of pool) {
      const t = travelMin(startLoc, c);
      let arr = c.kind === "event" ? c.start : r5(Math.max(winStart + t, c.open[0] * 60));
      if (c.kind === "event" && arr < winStart + t) continue;
      const end = arr + c.dur;
      if (c.kind === "place" && end > c.open[1] * 60) continue;
      const back = next ? travelMin(c, next) : 0;
      if (end + back > winEnd) continue;
      const val = score(c, nl, rand, null) - t / 25;
      if (!best || val > best.val) best = { c, arr, val };
    }
    if (!best) return null;
    const stops = plan.stops.map((s, i) => i === idx ? Object.assign({}, best.c, { start: best.arr }) : s);
    stops.sort((a, b) => a.start - b.start);
    const np = finalize(stops, opts.userLoc, nl, opts.from, opts.to, opts.budget);
    np.opts = opts; np.nl = nl; np.weather = WEATHER;
    np.summary = plan.summary;
    return np;
  }

  const api = { generate, swap, parseNotes, km, travelMin, toMin, fmt, WEATHER };
  if (typeof module !== "undefined") module.exports = api;
  return api;
})();
