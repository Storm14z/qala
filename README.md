# Qala — Smart City Guide & Event Hub (clickable prototype)

> **One app. One map. Everything happening.**
> Interface prototype + AI Day Planner for the **ICT Endterm** (Astana IT University).
> Team: Daulet, Amir, Aliakhmet.

A fully clickable, mobile-style web prototype of the Qala app described in the endterm presentation.
No build step, no backend: plain HTML + CSS + JavaScript, so it runs on **GitHub Pages**.

## Task 1 — Interface prototype (6 screens)

| # | Screen | What works |
|---|--------|-----------|
| 1 | **Onboarding** | Name, role (Tourist / Local citizen), interests (at least one required) |
| 2 | **Home Map** | Real interactive map of Astana (Leaflet + OpenStreetMap), place and event pins, search, Places/Events layer toggles, bottom info card, “Suggested for you” |
| 3 | **Place Card** | Photo gallery slider, rating, reviews (write your own), events at this place, Navigate (opens Google Maps), **+ My Day** |
| 4 | **Events Timeline** | 7-day date strip, category filters, event details, **+ My Day**, **Check in** |
| 5 | **My Day** | Day-by-day itinerary, edit time/duration, remove, conflict warnings, walking times, totals, **route on the map**, **Plan my day with AI** |
| 6 | **Profile** | Stats, 6 badges that unlock from real actions, editable interests/role, friends |

Bottom navigation (Map · Events · My Day · Profile) is available on every main screen.
Everything is saved in the browser (`localStorage`); use **Reset demo data** to start again.

### User flows from the slides
- **Discover:** Home Map → Place Card → “+ My Day”
- **Events:** Events Timeline → Event details → “+ My Day”
- **Retention:** Check in at an event → Badge earned → Profile

## Task 2 — AI Day Planner

Entry points: **Plan my day with AI** (My Day) and **✨ Suggested for you** (Home Map).

1. User sets date, free hours, budget, interests (pre-filled from the profile) and optional free text, e.g. *“indoor only, no museums, more food”*.
2. `js/planner.js` builds a time-ordered route:
   - **Recommendation model:** scores every place and event by interest match, rating, weather (demo: −4 °C, snow → indoor bonus) and price.
   - **Route optimizer:** fixes events at their real times, fills the gaps with places that fit opening hours, budget and walking distance, with no time conflicts.
   - **Explanation text:** every stop gets a short *“Why this stop”* reason.
3. User keeps control: **Swap** a stop, **Regenerate**, or **Accept plan** (saves all stops to My Day).
4. **Feedback loop:** swapped-away stops are remembered and ranked lower next time.

The planner runs locally in the browser, which is also the **rule-based fallback** from the presentation (“a simple rule-based plan is used if AI is unavailable”).
To use a real LLM, send the same inputs and candidate list from `planner.js` to your own backend endpoint (never put an API key in a GitHub Pages site).

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a repository and upload all files from this folder (keep the structure).
2. **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)` → Save.**
3. After about a minute the prototype is live at `https://<username>.github.io/<repository>/`. Add this link to the LMS submission.

## Project structure

```
index.html        app shell
css/style.css     dark UI, phone frame
js/data.js        14 places, 16 events, reviews, badges (mirrors the ERD)
js/planner.js     AI Day Planner engine
js/app.js         screens, navigation, map, state
```

## Notes
- The map needs internet (Leaflet from unpkg, tiles from CARTO/OpenStreetMap).
- Places, events, prices and coordinates are demo data; coordinates are approximate.
- Events are generated relative to *today*, so the timeline is never empty.
- Inspired by the entities in our ERD: Place, Event, Review, User_Genre, MyDay Item, Attendance.

---

### Кратко по-русски
1. Загрузите все файлы папки в репозиторий GitHub. 2. `Settings → Pages → Deploy from a branch → main / root`. 3. Ссылка вида `https://<ник>.github.io/<репозиторий>/` и есть ссылка на прототип для сдачи в LMS. Скриншоты экранов сделайте с открытой страницы.
