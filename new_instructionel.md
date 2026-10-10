# Traffic Signal Map: Restyle Guide (Current → Target)

**Goal:** make the map in *Image 1* (current) look and behave like *Image 2* (target), and fix the basemap greyscale/dark filter that is not being applied.

> I can't see your source code, so everything below is written for **Leaflet** (the most likely stack given the `+ / –` zoom control and HTML-style markers). Section 11 has notes for **MapLibre/Mapbox** and **React-Leaflet**. Step 0 tells you how to confirm which one you use.

---

## 0. First, confirm your stack (2 minutes)

Open `package.json` (or the `<script>` tags) and look for:

| You see | Library | Use |
|---|---|---|
| `leaflet`, `react-leaflet` | Leaflet | Follow this guide as written |
| `maplibre-gl`, `mapbox-gl`, `react-map-gl` | MapLibre / Mapbox | Section 3B + Section 11 |
| `@react-google-maps/api`, `google.maps` | Google Maps | Section 3C |

Then open the app in Chrome → DevTools → Elements, and inspect the map. If you see `.leaflet-container`, `.leaflet-tile-pane`, `.leaflet-marker-icon`, it is Leaflet.

---

## 1. What is different between the two screenshots

| # | Area | Image 1 (current) | Image 2 (target) |
|---|---|---|---|
| 1 | **Basemap** | Light, washed-out grey; almost no roads, rivers or buildings | Dark map with rivers, roads, flyovers, neighbourhood names, tan highways |
| 2 | **Zoom** | Zoomed out far (≈ zoom 11–12), so everything is crammed into one corner | City-level (≈ zoom 13.5–14), signals spread across the screen |
| 3 | **Marker overlap** | Markers and `% DENS` pills pile on top of each other and hide each other | Markers readable; overlapping pills are hidden/collapsed |
| 4 | **Halos** | Big translucent circles drawn *over* neighbouring markers | Halos sit *under* all markers, only on heavy / gridlock signals |
| 5 | **Top-left bar** | Missing | `SIGNALS: ALL · HEAVY >75% · RED LIGHTS · GREEN WAVES` filter chips |
| 6 | **Top-right** | Missing | `AMBULANCE DEMO` button and `Corridors (3)` button |
| 7 | **Legend** | Collapsed, chevron up | Expanded, with phase colours + density colours + thresholds |
| 8 | **Zoom buttons** | Present | Same position, restyled (dark, rounded) |
| 9 | **Basemap filter** | Not applied properly (grey overlay on a bare light map) | Inverted/dark CSS filter on **tiles only** |

The rest of this document fixes them in that order of importance: **basemap (3) → zoom (4) → markers (5–6) → clutter (7) → UI chrome (8–9) → filters (10).**

---

## 2. Marker anatomy (reference, so the rest makes sense)

From the legend in Image 2:

```
        ┌──────────── halo (translucent circle, ONLY if density > 65%) ────────────┐
        │     ┌── outer ring colour  = ROAD DENSITY class                          │
        │     │   ┌── inner core colour = TRAFFIC LIGHT PHASE                      │
        │     │   │      text = seconds remaining in that phase                    │
        │    (( 33s ))                                                             │
        │   ┌──────────┐                                                           │
        │   │ 74% DENS │  ← pill, text + border colour = ROAD DENSITY class        │
        │   └──────────┘                                                           │
        └──────────────────────────────────────────────────────────────────────────┘
```

| Part | Meaning | Colours |
|---|---|---|
| Inner core | Light phase | Green = Go · Amber = Clear · Red = Stop |
| Outer ring + pill | Road density | Green `<45%` · Amber `45–65%` · Orange `65–80%` · Red `>80%` |
| Halo | Congestion hint | Orange for Heavy, Red for Gridlock; none below 65% |

> **Rounding note:** in Image 1 an "80% DENS" pill is red even though the legend says Heavy is 65–80. That means your code is classifying on the raw value (e.g. 80.4) but displaying a rounded one. That is fine; just keep classifying on the **raw** number and only round for display.

---

## 3. THE GREYSCALE / DARK BASEMAP FIX (the part that is not working)

### 3.0 What the target look actually is

Image 2 is **not** a pure greyscale map. It is a **standard OpenStreetMap light tile run through a CSS "invert + hue-rotate" filter**. That trick turns the light map dark while keeping colours roughly right: yellow/orange main roads become tan, water becomes a dark grey-blue, parks become dark green, and white minor streets become dark grey lines.

The filter must be applied to **the tile layer only**, never to the whole map container, otherwise your markers, halos and popups get inverted too (red becomes cyan, etc.).

### 3.1 Why your filter is probably not applying

Work through this list in order. Most people hit #1, #2 or #4.

| # | Cause | How to check | Fix |
|---|---|---|---|
| 1 | **Selector doesn't match** because of scoped CSS (Vue `scoped`, CSS Modules, Svelte, Next.js module CSS). Leaflet creates its DOM at runtime, so scoped styles never reach it. | DevTools → click `.leaflet-tile-pane` → look at the Styles pane. Is your rule listed at all? | Use `:global(.leaflet-tile-pane)` (CSS Modules/Svelte), `::v-deep` / `:deep()` (Vue), or move the rule to a **global** stylesheet. |
| 2 | **Filter put on the wrong element** (`#map`, `.leaflet-container`, or a wrapper). Either it grays out everything including markers, or a parent `filter` makes `position: fixed` children (legend, top bar) misbehave. | Look for `filter:` on any ancestor of the markers. | Remove it from ancestors; apply to `.leaflet-tile-pane` only. |
| 3 | **Tailwind `grayscale` class on a wrapper**, or a purged/absent utility. | Does the class exist in the generated CSS? | Don't use utility classes for this. Write the rule in plain CSS (below). |
| 4 | **Overlay div with a grey background** or `opacity` laid over the map (what Image 1 looks like: markers are still vivid but the base is a flat grey haze). | Hide siblings of `#map` one by one in DevTools. | Delete the overlay. Do the darkening with the tile-pane filter, not an overlay. |
| 5 | **`backdrop-filter: grayscale(1)`** on an overlay. It also affects markers underneath and gives inconsistent results. | Search code for `backdrop-filter`. | Remove it. |
| 6 | **Different tile layer is actually being used** (a vector style, or a "light" provider with very low detail at your zoom). | Network tab → filter by `png` / `pbf`; look at tile URLs. | Use the tile URL in 3.2. |
| 7 | **Specificity/order**: another rule sets `filter: none` after yours, or Leaflet's CSS loads after yours. | Computed tab → `filter`. Crossed-out rule = lost the cascade. | Raise specificity (`.map-shell .leaflet-tile-pane`) and load your CSS **after** `leaflet.css`. |
| 8 | **Leaflet CSS not imported**, so panes are mispositioned and nothing behaves. | Tiles appear in a long vertical strip. | `import 'leaflet/dist/leaflet.css'` |
| 9 | Applying the filter to **each tile** (`className` option) and getting visible seams while zooming. | Thin light lines between tiles during zoom animation. | Put the filter on `.leaflet-tile-pane` instead. |

### 3.2 The recommended solution (Leaflet)

**JavaScript: tile layer (plain OSM tiles, no styling baked in):**

```js
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const map = L.map('map', {
  zoomControl: false,   // we add it ourselves at bottom-right
  zoomSnap: 0.5,        // allows 13.5, which is handy for fitting
  zoomDelta: 0.5,
});

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);
```

**CSS: the actual darkening (global stylesheet, loaded after `leaflet.css`):**

```css
:root {
  /* Matches Image 2. Tweak the 4 numbers to taste (see 3.3). */
  --tile-filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.8);
}

/* ONLY the tile pane. Markers, halos, popups live in other panes and stay untouched. */
.leaflet-tile-pane {
  filter: var(--tile-filter);
}

/* Prevents a white flash while tiles load */
.leaflet-container {
  background: #0b0c0f;
}
```

That's the whole fix for the "dark map". Reload with a hard refresh (Ctrl/Cmd + Shift + R).

> **Production note:** `tile.openstreetmap.org` is fine for development, but OSM's tile usage policy discourages heavy production use. For a real deployment, use a provider that serves the same *OSM Standard* style (MapTiler, Stadia, Thunderforest, or your own tile server) and keep the same CSS filter. Keep the attribution.

### 3.3 Tuning the look

| You want | Change |
|---|---|
| Darker | `brightness(0.9)` → `0.75` |
| Land blacker / more contrast | `contrast(0.9)` → `1.05` |
| Less colourful (more greyscale) | `saturate(0.8)` → `0.4` |
| Roads brighter | raise `contrast`, or raise `brightness` slightly |

### 3.4 True greyscale variant (optional toggle)

If what you really want is a **monochrome** map (no colour at all), use this instead:

```css
.map-shell[data-basemap="grey"] .leaflet-tile-pane {
  filter: grayscale(1) invert(1) brightness(0.8) contrast(1.15);
}
```

Toggle in JS:

```js
document.querySelector('.map-shell').dataset.basemap = 'grey'; // or 'dark'
```

Order matters in `filter:`; filters apply left to right. `grayscale` first, then `invert`, gives a clean dark monochrome.

### 3.5 Alternative A: natively dark tiles (no filter)

Simplest, but roads will be grey instead of tan/green, so it will **not** match Image 2 exactly:

```js
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  subdomains: 'abcd',
  maxZoom: 20,
  attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
}).addTo(map);
```

If you do this, **remove** the `.leaflet-tile-pane { filter: ... }` rule, otherwise it will turn the dark tiles light.

### 3.6 Section 3B: MapLibre / Mapbox GL

Vector maps have no tile `<img>` elements; the whole thing is one `<canvas>`. Two options:

**Option 1: use a dark style (preferred):**

```js
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  center: [72.83, 21.19],
  zoom: 13.5,
});
```

**Option 2: filter the canvas only:**

```css
.maplibregl-canvas { filter: invert(1) hue-rotate(180deg) brightness(0.9) contrast(0.9) saturate(0.8); }
```

This only works if your style is a **light** style, and only the canvas is filtered. HTML markers (`maplibregl.Marker`) are separate DOM nodes and stay unaffected. If your markers are drawn as map layers (symbol/circle layers) they **will** be inverted, so use Option 1.

### 3.7 Section 3C: Google Maps

Use a dark `styles` array or a Cloud-based Map ID with a dark style. CSS filters on Google's canvas are unreliable. Starter:

```js
new google.maps.Map(el, {
  center: { lat: 21.19, lng: 72.83 },
  zoom: 14,
  disableDefaultUI: true,
  styles: [
    { elementType: 'geometry', stylers: [{ color: '#14161a' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#8a9099' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#14161a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#272b36' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2a2e35' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#6b5d4a' }] },
  ],
});
```

---

## 4. Fix the zoom and framing (why Image 1 looks cramped)

Image 1 is simply zoomed out too far, so the 18 signals share a small corner and everything overlaps. Don't hard-code a zoom; **fit to the data**, with a cap so a single marker doesn't zoom to street level:

```js
const bounds = L.latLngBounds(signals.map(s => [s.lat, s.lng]));
map.fitBounds(bounds, {
  paddingTopLeft: [40, 110],      // clears the top filter bar
  paddingBottomRight: [40, 40],
  maxZoom: 14,
});
```

Also set limits so people can't zoom out into the "empty grey" state of Image 1:

```js
map.setMinZoom(11);
map.setMaxBounds(bounds.pad(1.5));   // optional: stop panning off into nowhere
```

---

## 5. Build the marker exactly like Image 2

### 5.1 Markup (one HTML string per signal)

```js
function markerHTML(s) {
  return `
    <div class="sig p-${s.phase} d-${densClass(s.dens)}">
      <div class="sig__ring"><div class="sig__core">${s.remaining}s</div></div>
      <div class="sig__pill">${Math.round(s.dens)}% DENS</div>
    </div>`;
}

const densClass = d => d < 45 ? 'free' : d <= 65 ? 'mod' : d <= 80 ? 'heavy' : 'grid';

const icon = L.divIcon({
  className: 'sig-icon',        // IMPORTANT: replaces Leaflet's default white square
  html: markerHTML(s),
  iconSize: [44, 44],           // size of the ring only (pill overflows below it)
  iconAnchor: [22, 22],         // centre of the ring sits exactly on the lat/lng
});
```

> **Common bug:** forgetting `className` leaves Leaflet's default `leaflet-div-icon` (white box with border) behind your marker.

### 5.2 CSS

```css
:root {
  --phase-green: #5fd068;
  --phase-amber: #f5a623;
  --phase-red:   #e5534b;

  --d-free:  #22c55e;
  --d-mod:   #eab308;
  --d-heavy: #f97316;
  --d-grid:  #ef4444;

  --font-ui:   'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
}

/* phase → core colour */
.p-green { --phase: var(--phase-green); }
.p-amber { --phase: var(--phase-amber); }
.p-red   { --phase: var(--phase-red);   }

/* density → ring + pill colour */
.d-free  { --ring: var(--d-free);  }
.d-mod   { --ring: var(--d-mod);   }
.d-heavy { --ring: var(--d-heavy); }
.d-grid  { --ring: var(--d-grid);  }

.sig-icon { background: none; border: 0; }

.sig {
  position: relative;
  width: 44px;
  height: 44px;
  transform: scale(var(--sig-scale, 1));   /* scaled by zoom, see section 6 */
  transform-origin: 50% 50%;
}

.sig__ring {
  position: absolute; inset: 0;
  border-radius: 50%;
  background: rgba(10, 11, 14, 0.85);
  border: 3px solid var(--ring);
  box-shadow:
    0 0 0 2px rgba(0, 0, 0, 0.35),
    0 0 12px color-mix(in srgb, var(--ring) 55%, transparent);
}

.sig__core {
  position: absolute; inset: 4px;
  border-radius: 50%;
  display: grid; place-items: center;
  background: var(--phase);
  border: 2px solid color-mix(in srgb, var(--phase) 60%, #000);
  color: #0b0c0f;
  font: 700 12px/1 var(--font-mono);
}

.sig__pill {
  position: absolute;
  left: 50%; top: 48px;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(10, 11, 14, 0.94);
  border: 1px solid color-mix(in srgb, var(--ring) 55%, transparent);
  color: var(--ring);
  font: 700 11px/1 var(--font-mono);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.sig__pill.is-collapsed { display: none; }
.sig.is-hidden          { display: none; }

/* Hovered marker always wins: shows its pill and jumps to the front */
.sig:hover .sig__pill        { display: block !important; }
.leaflet-marker-icon:hover   { z-index: 9999 !important; }
```

> `color-mix()` works in all current evergreen browsers. If you must support very old ones, replace those lines with fixed `rgba()` values.

Load fonts (optional, matches the screenshot's look):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
```

### 5.3 Updating the countdown without flicker

Do **not** rebuild the `divIcon` every second (it flashes and kills hover). Keep a reference to the element and change the text/classes:

```js
function paint(s) {
  const root = s.marker.getElement().querySelector('.sig');
  root.className = `sig p-${s.phase} d-${densClass(s.dens)}` + (s.visible ? '' : ' is-hidden');
  root.querySelector('.sig__core').textContent = `${s.remaining}s`;
  root.querySelector('.sig__pill').textContent = `${Math.round(s.dens)}% DENS`;
}
```

Run **one** timer for all signals:

```js
const CYCLE = { green: 40, amber: 4, red: 35 };           // seconds, replace with real data
const NEXT  = { green: 'amber', amber: 'red', red: 'green' };

setInterval(() => {
  let phaseChanged = false;
  signals.forEach(s => {
    s.remaining -= 1;
    if (s.remaining <= 0) { s.phase = NEXT[s.phase]; s.remaining = CYCLE[s.phase]; phaseChanged = true; }
    paint(s);
  });
  if (phaseChanged && activeFilter !== 'all') applyFilter(); // phase-based filters need re-evaluation
}, 1000);
```

If you get real-time data from an API, replace the local countdown with the API's value and just call `paint(s)`.

---

## 6. Halos: draw them *under* the markers

In Image 1 the halos sit on top of other markers (they're inside the marker element). In Image 2 they are behind everything. Fix: draw them as separate Leaflet layers in a **custom pane** that sits below the marker pane.

```js
// Pane z-indexes in Leaflet: tiles 200, overlays 400, shadows 500, markers 600, tooltips 650, popups 700
map.createPane('halos').style.zIndex = 450;
```

```css
.leaflet-halos-pane { pointer-events: none; }
```

```js
function haloStyle(s) {
  const c = densClass(s.dens);
  if (c !== 'heavy' && c !== 'grid') return null;            // no halo below 65%
  const col = c === 'grid' ? '#ef4444' : '#f97316';
  return {
    radius: 26 + (s.dens - 65) * 1.4,                        // px, grows with density
    style: { color: col, weight: 1, opacity: 0.35, fillColor: col, fillOpacity: 0.14 },
  };
}

function paintHalo(s) {
  const h = haloStyle(s);
  if (!h || !s.visible) { s.halo.setStyle({ opacity: 0, fillOpacity: 0 }); return; }
  s.halo.setRadius(h.radius);
  s.halo.setStyle(h.style);
}

// creation
s.halo = L.circleMarker([s.lat, s.lng], { pane: 'halos', interactive: false, radius: 0 }).addTo(map);
```

`circleMarker` uses a **pixel** radius, so halos keep a constant on-screen size regardless of zoom, which is what Image 2 shows.

---

## 7. Stop the markers hiding each other (declutter)

Image 1's biggest usability problem. Use four layered techniques.

### 7.1 Z-order by severity (worst on top)

```js
L.marker([s.lat, s.lng], { icon, zIndexOffset: Math.round(s.dens * 10) + (s.phase === 'red' ? 500 : 0) });
```

### 7.2 Scale markers with zoom

```js
function applyZoomScale() {
  const z = map.getZoom();
  const scale = z <= 11 ? 0.6 : z <= 12 ? 0.75 : z <= 13 ? 0.9 : 1;
  map.getContainer().style.setProperty('--sig-scale', scale);
  map.getContainer().classList.toggle('labels-off', z < 12);
}
map.on('zoomend', applyZoomScale);
```

```css
/* At far-out zooms, only show pills for the problem junctions */
.labels-off .sig:not(.d-heavy):not(.d-grid) .sig__pill { display: none; }
```

### 7.3 Collision detection for the pills

Greedy algorithm: go from most congested to least; keep a pill only if it doesn't overlap an already-kept pill or any other marker's ring. Collapsed pills still appear on hover (CSS above).

```js
const overlap = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);

function declutter() {
  const visible = signals.filter(s => s.visible);
  const rings = visible.map(s => ({
    id: s.id,
    r: s.marker.getElement().querySelector('.sig__ring').getBoundingClientRect(),
  }));
  const placed = [];

  [...visible].sort((a, b) => b.dens - a.dens).forEach(s => {
    const pill = s.marker.getElement().querySelector('.sig__pill');
    pill.classList.remove('is-collapsed');
    const r = pill.getBoundingClientRect();
    if (!r.width) return;                                      // hidden by labels-off
    const hitsRing = rings.some(o => o.id !== s.id && overlap(r, o.r));
    const hitsPill = placed.some(p => overlap(r, p));
    if (hitsRing || hitsPill) pill.classList.add('is-collapsed');
    else placed.push(r);
  });
}

let rafId;
const scheduleDeclutter = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(declutter); };

map.on('zoomend', scheduleDeclutter);
window.addEventListener('resize', scheduleDeclutter);
```

Call `scheduleDeclutter()` once after the initial render and after every filter change.

### 7.4 (Optional) Clustering at very low zoom

If you ever show hundreds of signals, add `leaflet.markercluster` for `zoom < 12`. For ~20 signals the steps above are enough.

---

## 8. UI chrome: top bar, buttons, legend, zoom

### 8.1 Layout rule that avoids the filter bug

Put the HUD elements as **siblings** of the map, not inside it and not inside a filtered ancestor:

```html
<div class="map-shell" data-basemap="dark">
  <div id="map"></div>

  <div class="hud hud-tl panel">...filters...</div>
  <div class="hud hud-tr">...buttons...</div>
  <div class="hud hud-bl panel" id="legend">...legend...</div>
</div>
```

```css
html, body { height: 100%; margin: 0; background: #0b0c0f; font-family: var(--font-ui); }
.map-shell { position: relative; height: 100%; }
#map       { position: absolute; inset: 0; isolation: isolate; }  /* own stacking context */

:root {
  --panel: rgba(10, 11, 14, 0.92);
  --panel-border: rgba(255, 255, 255, 0.09);
  --text: #e8eaed;
  --muted: #9aa0a6;
}

.hud    { position: absolute; z-index: 10; }
.hud-tl { top: 12px; left: 12px; }
.hud-tr { top: 12px; right: 12px; display: flex; gap: 10px; }
.hud-bl { left: 12px; bottom: 12px; }

.panel {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 16px;
  backdrop-filter: blur(8px);
  color: var(--text);
}
```

### 8.2 Top-left filter bar

```html
<div class="hud hud-tl panel filters" role="toolbar" aria-label="Signal filters">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/></svg>
  <span class="filters__label">Signals:</span>
  <button class="chip is-active" data-filter="all">All</button>
  <button class="chip" data-filter="heavy">Heavy &gt;75%</button>
  <button class="chip" data-filter="red">Red lights</button>
  <button class="chip" data-filter="green">Green waves</button>
</div>
```

```css
.filters { display: flex; align-items: center; gap: 8px; padding: 10px 12px; }
.filters__label { font: 600 13px var(--font-mono); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }

.chip {
  font: 600 13px var(--font-mono);
  letter-spacing: .1em; text-transform: uppercase;
  color: var(--muted);
  background: rgba(255,255,255,.04);
  border: 1px solid var(--panel-border);
  border-radius: 999px;
  padding: 9px 16px;
  cursor: pointer;
}
.chip:hover     { color: var(--text); }
.chip.is-active { background: #fff; color: #0b0c0f; border-color: #fff; }
```

### 8.3 Top-right buttons

```html
<div class="hud hud-tr">
  <button class="btn btn--ambulance" id="ambulanceBtn">🚑 Ambulance demo</button>
  <button class="btn panel" id="corridorsBtn">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>
    Corridors <span class="badge">3</span>
  </button>
</div>
```

```css
.btn {
  display: inline-flex; align-items: center; gap: 10px;
  padding: 12px 18px; border-radius: 16px; cursor: pointer;
  color: var(--text); font: 600 16px var(--font-ui);
}
.btn--ambulance {
  background: rgba(60, 14, 16, .92);
  border: 1px solid rgba(239, 68, 68, .55);
  color: #ff8a8a;
  font: 700 14px var(--font-mono); letter-spacing: .12em; text-transform: uppercase;
}
.badge { background: rgba(255,255,255,.12); border-radius: 8px; padding: 2px 8px; font-size: 14px; }
```

Wire them up however your feature needs (ambulance demo = highlight a route and force greens along it; corridors = toggle a polyline layer). The count `3` should come from your corridor list length.

### 8.4 Legend (expanded by default)

```html
<section class="hud hud-bl panel legend" id="legend" aria-label="Colour coding legend">
  <button class="legend__head" id="legendToggle" aria-expanded="true">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4aa3ff" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>
    <span>Color coding legend</span>
    <svg class="legend__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
  </button>

  <div class="legend__body">
    <h4>Inner core = traffic light phase</h4>
    <ul class="legend__row">
      <li><i style="background:var(--phase-green)"></i>Green (Go)</li>
      <li><i style="background:var(--phase-amber)"></i>Amber (Clear)</li>
      <li><i style="background:var(--phase-red)"></i>Red (Stop)</li>
    </ul>

    <h4>Outer ring &amp; pill = road density</h4>
    <ul class="legend__grid">
      <li><i style="background:var(--d-free)"></i>Free Flow (&lt;45%)</li>
      <li><i style="background:var(--d-mod)"></i>Moderate (45–65%)</li>
      <li><i style="background:var(--d-heavy)"></i>Heavy (65–80%)</li>
      <li><i style="background:var(--d-grid)"></i>Gridlock (&gt;80%)</li>
    </ul>
  </div>
</section>
```

```css
.legend { width: min(330px, calc(100vw - 24px)); overflow: hidden; }
.legend__head {
  all: unset; box-sizing: border-box; width: 100%; cursor: pointer;
  display: flex; align-items: center; gap: 12px; padding: 16px 18px;
  font: 600 14px var(--font-mono); letter-spacing: .12em; text-transform: uppercase; color: var(--text);
}
.legend__head span { flex: 1; }
.legend__chev { transition: transform .2s; }
.legend.is-collapsed .legend__chev { transform: rotate(180deg); }
.legend.is-collapsed .legend__body { display: none; }

.legend__body { padding: 4px 18px 16px; border-top: 1px solid var(--panel-border); }
.legend h4 { margin: 14px 0 8px; font: 500 12px var(--font-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
.legend ul { list-style: none; margin: 0; padding: 0; font: 500 14px var(--font-mono); }
.legend li { display: flex; align-items: center; gap: 8px; }
.legend i  { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
.legend__row  { display: flex; gap: 14px; flex-wrap: wrap; }
.legend__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 14px; }
```

```js
document.getElementById('legendToggle').addEventListener('click', e => {
  const legend = document.getElementById('legend');
  const collapsed = legend.classList.toggle('is-collapsed');
  e.currentTarget.setAttribute('aria-expanded', String(!collapsed));
});
// On phones start collapsed:
if (window.matchMedia('(max-width: 640px)').matches) document.getElementById('legend').classList.add('is-collapsed');
```

> The legend's colours **must** use the same CSS variables as the markers (`--d-free`, `--phase-green`, …) so they can never drift apart.

### 8.5 Zoom buttons (same spot, dark theme)

```css
.leaflet-control-zoom {
  background: var(--panel);
  border: 1px solid var(--panel-border) !important;
  border-radius: 14px; overflow: hidden;
}
.leaflet-control-zoom a {
  background: transparent; color: #fff; border: 0;
  width: 44px; height: 44px; line-height: 44px; font-size: 22px;
}
.leaflet-control-zoom a:first-child { border-bottom: 1px solid var(--panel-border); }
.leaflet-control-zoom a:hover       { background: rgba(255,255,255,.08); }

/* Keep attribution legal but quiet */
.leaflet-control-attribution { background: rgba(10,11,14,.6) !important; color: var(--muted) !important; }
.leaflet-control-attribution a { color: #c5cad1 !important; }
```

---

## 9. Filter logic (the four chips)

| Chip | Rule | Notes |
|---|---|---|
| All | `true` | Default |
| Heavy >75% | `dens > 75` | Uses raw density |
| Red lights | `phase === 'red'` | Re-evaluate each time a phase flips (done in the timer) |
| Green waves | `phase === 'green'` | If you have real "green wave" data (signals synced along a corridor), replace this with `s.inGreenWave` |

```js
const FILTERS = {
  all:   () => true,
  heavy: s => s.dens > 75,
  red:   s => s.phase === 'red',
  green: s => s.phase === 'green',
};
let activeFilter = 'all';

function applyFilter() {
  signals.forEach(s => { s.visible = FILTERS[activeFilter](s); paint(s); paintHalo(s); });
  scheduleDeclutter();
}

document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  activeFilter = btn.dataset.filter;
  applyFilter();
}));
```

---

## 10. Complete working reference (single file)

Save as `index.html` and open in a browser to compare against Image 2. Replace the `DATA` array with your API data. Coordinates are approximate placeholders around Surat.

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Signal map</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root {
    --panel: rgba(10,11,14,.92); --panel-border: rgba(255,255,255,.09);
    --text:#e8eaed; --muted:#9aa0a6;
    --phase-green:#5fd068; --phase-amber:#f5a623; --phase-red:#e5534b;
    --d-free:#22c55e; --d-mod:#eab308; --d-heavy:#f97316; --d-grid:#ef4444;
    --font-ui:'Inter',system-ui,sans-serif;
    --font-mono:'JetBrains Mono',ui-monospace,Menlo,monospace;
    --tile-filter: invert(1) hue-rotate(180deg) brightness(.9) contrast(.9) saturate(.8);
  }
  html,body{height:100%;margin:0;background:#0b0c0f;font-family:var(--font-ui)}
  .map-shell{position:relative;height:100%}
  #map{position:absolute;inset:0;isolation:isolate;background:#0b0c0f}

  /* ---- BASEMAP: tiles only ---- */
  .leaflet-tile-pane{filter:var(--tile-filter)}
  .map-shell[data-basemap="grey"] .leaflet-tile-pane{filter:grayscale(1) invert(1) brightness(.8) contrast(1.15)}
  .leaflet-halos-pane{pointer-events:none}

  /* ---- markers ---- */
  .p-green{--phase:var(--phase-green)} .p-amber{--phase:var(--phase-amber)} .p-red{--phase:var(--phase-red)}
  .d-free{--ring:var(--d-free)} .d-mod{--ring:var(--d-mod)} .d-heavy{--ring:var(--d-heavy)} .d-grid{--ring:var(--d-grid)}
  .sig-icon{background:none;border:0}
  .sig{position:relative;width:44px;height:44px;transform:scale(var(--sig-scale,1));transform-origin:50% 50%}
  .sig__ring{position:absolute;inset:0;border-radius:50%;background:rgba(10,11,14,.85);border:3px solid var(--ring);
    box-shadow:0 0 0 2px rgba(0,0,0,.35),0 0 12px color-mix(in srgb,var(--ring) 55%,transparent)}
  .sig__core{position:absolute;inset:4px;border-radius:50%;display:grid;place-items:center;background:var(--phase);
    border:2px solid color-mix(in srgb,var(--phase) 60%,#000);color:#0b0c0f;font:700 12px/1 var(--font-mono)}
  .sig__pill{position:absolute;left:50%;top:48px;transform:translateX(-50%);white-space:nowrap;padding:4px 8px;border-radius:6px;
    background:rgba(10,11,14,.94);border:1px solid color-mix(in srgb,var(--ring) 55%,transparent);color:var(--ring);
    font:700 11px/1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase}
  .sig__pill.is-collapsed{display:none}
  .sig.is-hidden{display:none}
  .sig:hover .sig__pill{display:block!important}
  .leaflet-marker-icon:hover{z-index:9999!important}
  .labels-off .sig:not(.d-heavy):not(.d-grid) .sig__pill{display:none}

  /* ---- HUD ---- */
  .hud{position:absolute;z-index:10}
  .hud-tl{top:12px;left:12px} .hud-tr{top:12px;right:12px;display:flex;gap:10px} .hud-bl{left:12px;bottom:12px}
  .panel{background:var(--panel);border:1px solid var(--panel-border);border-radius:16px;backdrop-filter:blur(8px);color:var(--text)}
  .filters{display:flex;align-items:center;gap:8px;padding:10px 12px;flex-wrap:wrap;max-width:calc(100vw - 24px)}
  .filters__label{font:600 13px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .chip{font:600 13px var(--font-mono);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
    background:rgba(255,255,255,.04);border:1px solid var(--panel-border);border-radius:999px;padding:9px 16px;cursor:pointer}
  .chip:hover{color:var(--text)} .chip.is-active{background:#fff;color:#0b0c0f;border-color:#fff}
  .btn{display:inline-flex;align-items:center;gap:10px;padding:12px 18px;border-radius:16px;cursor:pointer;color:var(--text);font:600 16px var(--font-ui)}
  .btn--ambulance{background:rgba(60,14,16,.92);border:1px solid rgba(239,68,68,.55);color:#ff8a8a;font:700 14px var(--font-mono);letter-spacing:.12em;text-transform:uppercase}
  .badge{background:rgba(255,255,255,.12);border-radius:8px;padding:2px 8px;font-size:14px}

  .legend{width:min(330px,calc(100vw - 24px));overflow:hidden}
  .legend__head{all:unset;box-sizing:border-box;width:100%;cursor:pointer;display:flex;align-items:center;gap:12px;padding:16px 18px;
    font:600 14px var(--font-mono);letter-spacing:.12em;text-transform:uppercase;color:var(--text)}
  .legend__head span{flex:1} .legend__chev{transition:transform .2s}
  .legend.is-collapsed .legend__chev{transform:rotate(180deg)} .legend.is-collapsed .legend__body{display:none}
  .legend__body{padding:4px 18px 16px;border-top:1px solid var(--panel-border)}
  .legend h4{margin:14px 0 8px;font:500 12px var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
  .legend ul{list-style:none;margin:0;padding:0;font:500 14px var(--font-mono)}
  .legend li{display:flex;align-items:center;gap:8px} .legend i{width:11px;height:11px;border-radius:50%;display:inline-block}
  .legend__row{display:flex;gap:14px;flex-wrap:wrap} .legend__grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px}

  .leaflet-control-zoom{background:var(--panel);border:1px solid var(--panel-border)!important;border-radius:14px;overflow:hidden}
  .leaflet-control-zoom a{background:transparent;color:#fff;border:0;width:44px;height:44px;line-height:44px;font-size:22px}
  .leaflet-control-zoom a:first-child{border-bottom:1px solid var(--panel-border)}
  .leaflet-control-zoom a:hover{background:rgba(255,255,255,.08)}
  .leaflet-control-attribution{background:rgba(10,11,14,.6)!important;color:var(--muted)!important}
  .leaflet-control-attribution a{color:#c5cad1!important}
</style>
</head>
<body>
<div class="map-shell" data-basemap="dark">
  <div id="map"></div>

  <div class="hud hud-tl panel filters" role="toolbar" aria-label="Signal filters">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5h18l-7 8v6l-4-2v-4L3 5z"/></svg>
    <span class="filters__label">Signals:</span>
    <button class="chip is-active" data-filter="all">All</button>
    <button class="chip" data-filter="heavy">Heavy &gt;75%</button>
    <button class="chip" data-filter="red">Red lights</button>
    <button class="chip" data-filter="green">Green waves</button>
  </div>

  <div class="hud hud-tr">
    <button class="btn btn--ambulance" id="ambulanceBtn">🚑 Ambulance demo</button>
    <button class="btn panel" id="corridorsBtn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>
      Corridors <span class="badge">3</span>
    </button>
  </div>

  <section class="hud hud-bl panel legend" id="legend" aria-label="Colour coding legend">
    <button class="legend__head" id="legendToggle" aria-expanded="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4aa3ff" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v5h1"/></svg>
      <span>Color coding legend</span>
      <svg class="legend__chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="legend__body">
      <h4>Inner core = traffic light phase</h4>
      <ul class="legend__row">
        <li><i style="background:var(--phase-green)"></i>Green (Go)</li>
        <li><i style="background:var(--phase-amber)"></i>Amber (Clear)</li>
        <li><i style="background:var(--phase-red)"></i>Red (Stop)</li>
      </ul>
      <h4>Outer ring &amp; pill = road density</h4>
      <ul class="legend__grid">
        <li><i style="background:var(--d-free)"></i>Free Flow (&lt;45%)</li>
        <li><i style="background:var(--d-mod)"></i>Moderate (45–65%)</li>
        <li><i style="background:var(--d-heavy)"></i>Heavy (65–80%)</li>
        <li><i style="background:var(--d-grid)"></i>Gridlock (&gt;80%)</li>
      </ul>
    </div>
  </section>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
/* ---------- DATA: replace with your API ---------- */
// [id, lat, lng, density%, phase, secondsRemaining]
const DATA = [
  ['s01',21.2161,72.8252,48,'green',21], ['s02',21.2210,72.8808,59,'green',14],
  ['s03',21.2135,72.8676,61,'green',11], ['s04',21.2105,72.8574,79,'red',48],
  ['s05',21.1964,72.7744,32,'green',14], ['s06',21.1939,72.7949,52,'green',4],
  ['s07',21.2022,72.8398,71,'green',9],  ['s08',21.1983,72.8374,74,'red',33],
  ['s09',21.1903,72.8450,61,'green',17], ['s10',21.1878,72.8402,78,'green',19],
  ['s11',21.1815,72.8650,84,'amber',4],  ['s12',21.1822,72.8100,56,'green',34],
  ['s13',21.1790,72.8190,76,'green',46], ['s14',21.1713,72.8390,54,'green',12],
  ['s15',21.1692,72.8308,88,'green',8],  ['s16',21.1626,72.8118,68,'green',28],
  ['s17',21.1661,72.7866,22,'red',17],   ['s18',21.1512,72.8210,29,'green',21],
];

const CYCLE = { green: 40, amber: 4, red: 35 };
const NEXT  = { green: 'amber', amber: 'red', red: 'green' };
const densClass = d => d < 45 ? 'free' : d <= 65 ? 'mod' : d <= 80 ? 'heavy' : 'grid';

const signals = DATA.map(([id, lat, lng, dens, phase, remaining]) =>
  ({ id, lat, lng, dens, phase, remaining, visible: true }));

/* ---------- MAP ---------- */
const map = L.map('map', { zoomControl: false, zoomSnap: 0.5, zoomDelta: 0.5 });
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);
map.createPane('halos').style.zIndex = 450;

const bounds = L.latLngBounds(signals.map(s => [s.lat, s.lng]));
map.fitBounds(bounds, { paddingTopLeft: [40, 110], paddingBottomRight: [40, 40], maxZoom: 14 });
map.setMinZoom(11);

/* ---------- MARKERS ---------- */
function markerHTML(s) {
  return `<div class="sig p-${s.phase} d-${densClass(s.dens)}">
    <div class="sig__ring"><div class="sig__core">${s.remaining}s</div></div>
    <div class="sig__pill">${Math.round(s.dens)}% DENS</div></div>`;
}
function haloSpec(s) {
  const c = densClass(s.dens);
  if (c !== 'heavy' && c !== 'grid') return null;
  const col = c === 'grid' ? '#ef4444' : '#f97316';
  return { radius: 26 + (s.dens - 65) * 1.4,
           style: { color: col, weight: 1, opacity: .35, fillColor: col, fillOpacity: .14 } };
}
function paintHalo(s) {
  const h = haloSpec(s);
  if (!h || !s.visible) { s.halo.setStyle({ opacity: 0, fillOpacity: 0 }); return; }
  s.halo.setRadius(h.radius); s.halo.setStyle(h.style);
}
function paint(s) {
  const root = s.marker.getElement().querySelector('.sig');
  root.className = `sig p-${s.phase} d-${densClass(s.dens)}` + (s.visible ? '' : ' is-hidden');
  root.querySelector('.sig__core').textContent = `${s.remaining}s`;
  root.querySelector('.sig__pill').textContent = `${Math.round(s.dens)}% DENS`;
}

signals.forEach(s => {
  s.halo = L.circleMarker([s.lat, s.lng], { pane: 'halos', interactive: false, radius: 0 }).addTo(map);
  s.marker = L.marker([s.lat, s.lng], {
    icon: L.divIcon({ className: 'sig-icon', html: markerHTML(s), iconSize: [44, 44], iconAnchor: [22, 22] }),
    zIndexOffset: Math.round(s.dens * 10) + (s.phase === 'red' ? 500 : 0),
  }).addTo(map);
  paintHalo(s);
});

/* ---------- ZOOM SCALE + DECLUTTER ---------- */
function applyZoomScale() {
  const z = map.getZoom();
  const scale = z <= 11 ? .6 : z <= 12 ? .75 : z <= 13 ? .9 : 1;
  const c = map.getContainer();
  c.style.setProperty('--sig-scale', scale);
  c.classList.toggle('labels-off', z < 12);
}
const overlap = (a, b) => !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
function declutter() {
  const vis = signals.filter(s => s.visible);
  const rings = vis.map(s => ({ id: s.id, r: s.marker.getElement().querySelector('.sig__ring').getBoundingClientRect() }));
  const placed = [];
  [...vis].sort((a, b) => b.dens - a.dens).forEach(s => {
    const pill = s.marker.getElement().querySelector('.sig__pill');
    pill.classList.remove('is-collapsed');
    const r = pill.getBoundingClientRect();
    if (!r.width) return;
    if (rings.some(o => o.id !== s.id && overlap(r, o.r)) || placed.some(p => overlap(r, p))) pill.classList.add('is-collapsed');
    else placed.push(r);
  });
}
let raf; const scheduleDeclutter = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(declutter); };
map.on('zoomend', () => { applyZoomScale(); scheduleDeclutter(); });
window.addEventListener('resize', scheduleDeclutter);
applyZoomScale(); scheduleDeclutter();

/* ---------- FILTERS ---------- */
const FILTERS = { all: () => true, heavy: s => s.dens > 75, red: s => s.phase === 'red', green: s => s.phase === 'green' };
let activeFilter = 'all';
function applyFilter() {
  signals.forEach(s => { s.visible = FILTERS[activeFilter](s); paint(s); paintHalo(s); });
  scheduleDeclutter();
}
document.querySelectorAll('.chip').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  activeFilter = btn.dataset.filter;
  applyFilter();
}));

/* ---------- COUNTDOWN (one timer) ---------- */
setInterval(() => {
  let changed = false;
  signals.forEach(s => {
    s.remaining -= 1;
    if (s.remaining <= 0) { s.phase = NEXT[s.phase]; s.remaining = CYCLE[s.phase]; changed = true; }
    paint(s);
  });
  if (changed && activeFilter !== 'all') applyFilter();
}, 1000);

/* ---------- LEGEND ---------- */
document.getElementById('legendToggle').addEventListener('click', e => {
  const collapsed = document.getElementById('legend').classList.toggle('is-collapsed');
  e.currentTarget.setAttribute('aria-expanded', String(!collapsed));
});
if (matchMedia('(max-width:640px)').matches) document.getElementById('legend').classList.add('is-collapsed');

/* ---------- STUBS ---------- */
document.getElementById('ambulanceBtn').addEventListener('click', () => console.log('TODO: ambulance demo'));
document.getElementById('corridorsBtn').addEventListener('click', () => console.log('TODO: toggle corridors layer'));
</script>
</body>
</html>
```

---

## 11. Porting notes

### React-Leaflet

* Import `leaflet/dist/leaflet.css` once at the app root, **and put your own global CSS after it**.
* Keep the tile filter in a **global** CSS file (not a CSS Module) or use `:global(.leaflet-tile-pane)`.
* Render markers with `<Marker icon={L.divIcon({ className: 'sig-icon', html, iconSize:[44,44], iconAnchor:[22,22] })} />`. Memoise the icon with `useMemo`, keyed on **phase + density class only**, or you will rebuild it every second. For the per-second countdown, hold a `ref` to the marker and update `.sig__core` text directly as in section 5.3.
* Use `<Pane name="halos" style={{ zIndex: 450 }}>` containing `<CircleMarker>` for the halos.
* Use `useMap()` inside a child component for `fitBounds`, `zoomend` listeners and the declutter pass.
* Render the HUD (filters, buttons, legend) as siblings **outside** `<MapContainer>`, inside a `position: relative` wrapper.

### MapLibre / Mapbox GL

* Basemap: Section 3.6.
* Markers: `new maplibregl.Marker({ element })` with the same `.sig` markup. `element` is a plain DOM node; build it once and update text/classes in place.
* Halos: a `circle` layer **below** your marker layer, with `circle-pitch-alignment: 'viewport'`, or simply an absolutely positioned div inside the marker element with `z-index: -1` (works because the marker wrappers each have their own stacking context).
* Collision: `maplibregl.Marker` has no built-in collision, so use the same `declutter()`; for symbol layers, set `text-allow-overlap: false`.

---

## 12. Acceptance checklist (compare against Image 2)

- [ ] Basemap is dark; rivers, flyovers and neighbourhood names are visible
- [ ] Markers are **not** colour-inverted (red stays red)
- [ ] Legend, top bar and buttons are **not** darkened/inverted by the filter
- [ ] First load fits all signals on screen at roughly zoom 13.5–14
- [ ] Every ring colour matches its pill colour (same density class)
- [ ] Halos only on 65%+ signals and always **behind** all markers
- [ ] No two `% DENS` pills overlap; hovering a marker reveals its pill
- [ ] Filter chips: All / Heavy >75% / Red lights / Green waves change what is shown
- [ ] Countdown ticks every second with no flicker, phase changes recolour the core
- [ ] Legend opens/closes, chevron rotates, collapsed by default on phones
- [ ] Zoom `+ / –` bottom-right, dark rounded style
- [ ] OSM / CARTO attribution still visible

## 13. Quick troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Whole page/markers are inverted | Filter on `#map` or `.leaflet-container` | Move it to `.leaflet-tile-pane` |
| Map is dark but pale tiles flash during pan | Container background is white | `.leaflet-container { background:#0b0c0f }` |
| Dark tiles from CARTO turned **light** | Filter still applied on top of already-dark tiles | Remove the filter (section 3.5) |
| Filter rule appears crossed out in DevTools | Specificity / load order | Load after `leaflet.css`; use `.map-shell .leaflet-tile-pane` |
| Rule doesn't show in DevTools at all | Scoped / module CSS | Use `:global()` / `:deep()` / global file |
| White square behind each marker | Missing `className` on `divIcon` | Add `className: 'sig-icon'` |
| Marker centre is offset from the real location | Wrong `iconAnchor` | `iconAnchor: [22, 22]` for a 44px ring |
| Marker text jitters / flashes each second | Rebuilding icons every tick | Update DOM text in place (5.3) |
| Pills still overlap | `declutter()` never called | Call after render, zoom, resize, filter |
| `color-mix` not applied | Very old browser | Replace with `rgba()` constants |
| Legend or top bar shifts when the page scrolls | A parent has `filter`/`transform` | Remove the ancestor filter; keep HUD as siblings |