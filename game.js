// =========================================================================
// NAGPUR REAL STREET VIEW DRIVE — 100% REAL PHOTOGRAPHIC COCKPIT ENGINE
// Supports:
//  1) Google Maps Street View (Full Real Nagpur + Strict Accessible Links)
//  2) MapillaryJS v4 (Free Client Token + WebGL Spatial Street Transitions)
//  3) KartaView Public API (Zero Key Instant Street-Level Photo Sequences)
// Plus: Live Leaflet Dark GPS Mini-Map, Rotating Steering Wheel, Engine SFX
// =========================================================================

const STORAGE_KEY = "nagpur_sv_drive_v1";

function loadStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
  } catch (_) {
    return {};
  }
}

const saved = loadStore();

const state = {
  provider: saved.provider || "google", // 'google' | 'mapillary' | 'kartaview'
  googleKey: saved.googleKey || DEFAULT_GOOGLE_MAPS_KEY || "",
  mapillaryToken: saved.mapillaryToken || DEFAULT_MAPILLARY_TOKEN || "",
  started: false,
  lat: NAGPUR_SPOTS[0].lat,
  lng: NAGPUR_SPOTS[0].lng,
  heading: NAGPUR_SPOTS[0].heading,
  speed: 0,
  wheelAngle: 0,
  soundOn: true,
  cash: typeof saved.cash === "number" ? saved.cash : 500,
  completedMissions: new Set(Array.isArray(saved.completed) ? saved.completed : []),
  activeMission: null,
  stepIndex: 0,
  nearbyNpc: null,
  nearTarget: false,
  isStepping: false,
  lastStepTime: 0,
  availableLinks: [], // [{ label, heading, action }]
  currentRoadName: "Nagpur"
};

function saveStore() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        provider: state.provider,
        googleKey: state.googleKey,
        mapillaryToken: state.mapillaryToken,
        cash: state.cash,
        completed: Array.from(state.completedMissions)
      })
    );
  } catch (_) {}
}

const input = { gas: false, brake: false, left: false, right: false };

// -------------------------------------------------------------------------
// 1. PROCEDURAL ENGINE + HORN + TURN CLICK + MISSION AUDIO
// -------------------------------------------------------------------------
const audio = {
  ctx: null,
  osc1: null,
  osc2: null,
  gain: null,
  ready: false,

  init() {
    if (this.ready) {
      if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 240;

    const g = ctx.createGain();
    g.gain.value = 0.0001;

    const o1 = ctx.createOscillator();
    o1.type = "sawtooth";
    o1.frequency.value = 46;

    const o2 = ctx.createOscillator();
    o2.type = "triangle";
    o2.frequency.value = 92;

    o1.connect(filter);
    o2.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    o1.start();
    o2.start();

    this.osc1 = o1;
    this.osc2 = o2;
    this.gain = g;
    this.ready = true;
  },

  update(speedKmh) {
    if (!this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    if (!state.soundOn || !state.started) {
      this.gain.gain.setTargetAtTime(0.0001, now, 0.08);
      return;
    }
    const abs = Math.abs(speedKmh);
    const freq = 42 + abs * 0.55 + ((abs % 25) / 25) * 26;
    this.osc1.frequency.setTargetAtTime(freq, now, 0.06);
    this.osc2.frequency.setTargetAtTime(freq * 2, now, 0.06);
    const vol = Math.min(0.09, 0.025 + (abs / 100) * 0.06);
    this.gain.gain.setTargetAtTime(vol, now, 0.08);
  },

  horn() {
    if (!state.soundOn) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [392, 494].forEach((f) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.08, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(now);
      o.stop(now + 0.32);
    });
  },

  chime() {
    if (!state.soundOn || !this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = now + i * 0.09;
      g.gain.setValueAtTime(0.11, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + 0.34);
    });
  },

  blockedBuzz() {
    if (!state.soundOn || !this.ready || !this.ctx) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.value = 115;
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(now);
    o.stop(now + 0.18);
  }
};

// -------------------------------------------------------------------------
// 2. GEO HELPERS & LEAFLET CRISP DARK GTA MINI-MAP
// -------------------------------------------------------------------------
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const dy = (lat2 - lat1) * 111320;
  const dx = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
  return Math.hypot(dx, dy);
}

function getBearing(lat1, lng1, lat2, lng2) {
  const dy = (lat2 - lat1) * 111320;
  const dx = (lng2 - lng1) * 111320 * Math.cos((lat1 * Math.PI) / 180);
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

function angleDiff(a, b) {
  let d = ((b - a + 540) % 360) - 180;
  return d;
}

const minimap = L.map("minimap", {
  center: [state.lat, state.lng],
  zoom: 16,
  zoomControl: false,
  attributionControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  tap: false
});

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  subdomains: "abcd",
  maxZoom: 19
}).addTo(minimap);

const playerIcon = L.divIcon({
  className: "mini-player-wrap",
  html: `<div id="mini-car-dot" style="width:14px;height:14px;background:#38bdf8;border:2px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 0 10px #38bdf8;"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7]
});
const playerMarker = L.marker([state.lat, state.lng], { icon: playerIcon }).addTo(minimap);

// Add Nagpur NPC dots to mini-map (never clutters main street screen!)
NPCS.forEach((npc) => {
  L.circleMarker([npc.lat, npc.lng], {
    radius: 5,
    color: "#fff",
    weight: 1.5,
    fillColor: "#f97316",
    fillOpacity: 1
  }).addTo(minimap);
});

let miniTargetMarker = null;
let miniRouteLine = L.polyline([], { color: "#38bdf8", weight: 3, dashArray: "5,5" }).addTo(minimap);

function syncMiniMap() {
  playerMarker.setLatLng([state.lat, state.lng]);
  minimap.setView([state.lat, state.lng], 16, { animate: false });
  const dot = document.getElementById("mini-car-dot");
  if (dot) dot.style.transform = `rotate(${state.heading - 45}deg)`;
}

// -------------------------------------------------------------------------
// 3. REAL STREET VIEW PROVIDERS (GOOGLE / MAPILLARY / KARTAVIEW)
// Strict rule: ONLY navigate along real verified street imagery links!
// -------------------------------------------------------------------------

// --- A) GOOGLE STREET VIEW ENGINE ---
const googleEngine = {
  loaded: false,
  pano: null,
  svService: null,

  loadScript(apiKey) {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps && window.google.maps.StreetViewPanorama) {
        this.loaded = true;
        return resolve();
      }
      window.gm_authFailure = () => {
        reject(new Error("Google Maps rejected this API key. Make sure Maps JavaScript API & billing are enabled."));
      };
      const s = document.createElement("script");
      s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      s.async = true;
      s.onload = () => {
        this.loaded = true;
        resolve();
      };
      s.onerror = () => reject(new Error("Failed to load Google Maps JS API."));
      document.head.appendChild(s);
    });
  },

  async start(lat, lng, heading) {
    await this.loadScript(state.googleKey);
    const el = document.getElementById("google-pano");
    el.classList.remove("hidden");

    if (this.pano) {
      await this.teleportToNearest(lat, lng, heading);
      return;
    }
    this.svService = new google.maps.StreetViewService();
    this.pano = new google.maps.StreetViewPanorama(el, {
      position: { lat, lng },
      pov: { heading, pitch: 2 },
      zoom: 1,
      addressControl: false,
      linksControl: false,
      panControl: false,
      zoomControl: false,
      enableCloseButton: false,
      fullscreenControl: false,
      motionTracking: false,
      motionTrackingControl: false,
      showRoadLabels: true,
      clickToGo: true
    });

    this.pano.addListener("position_changed", () => {
      const pos = this.pano.getPosition();
      if (!pos) return;
      state.lat = pos.lat();
      state.lng = pos.lng();
      syncMiniMap();
      checkProximityAndGps();
    });

    this.pano.addListener("pov_changed", () => {
      const pov = this.pano.getPov();
      if (!pov) return;
      state.heading = ((pov.heading % 360) + 360) % 360;
      syncMiniMap();
      renderTurnPills();
    });

    this.pano.addListener("links_changed", () => {
      this.refreshLinks();
    });

    this.pano.addListener("pano_changed", () => {
      const loc = this.pano.getLocation();
      if (loc && loc.shortDescription) {
        state.currentRoadName = loc.shortDescription;
      } else if (loc && loc.description) {
        state.currentRoadName = loc.description;
      }
      document.getElementById("road-name-chip").textContent = `📍 ${state.currentRoadName || "Nagpur Street"}`;
      this.refreshLinks();
    });

    await this.teleportToNearest(lat, lng, heading);
  },

  teleportToNearest(lat, lng, heading) {
    return new Promise((resolve) => {
      if (!this.svService || !this.pano) return resolve(false);
      this.svService.getPanorama(
        {
          location: { lat, lng },
          radius: 180,
          source: google.maps.StreetViewSource.OUTDOOR,
          preference: google.maps.StreetViewPreference.NEAREST
        },
        (data, status) => {
          if (status === "OK" && data && data.location) {
            this.pano.setPano(data.location.pano);
            this.pano.setPov({ heading, pitch: 2 });
            this.pano.setZoom(1);
            state.lat = data.location.latLng.lat();
            state.lng = data.location.latLng.lng();
            state.heading = heading;
            state.currentRoadName = data.location.shortDescription || data.location.description || "Nagpur Road";
            document.getElementById("road-name-chip").textContent = `📍 ${state.currentRoadName}`;
            syncMiniMap();
            this.refreshLinks();
            resolve(true);
          } else {
            showBlockedWarning("🚫 No Street View on that street — staying on mapped road.");
            resolve(false);
          }
        }
      );
    });
  },

  refreshLinks() {
    if (!this.pano) return;
    const links = this.pano.getLinks() || [];
    state.availableLinks = links.map((lnk) => ({
      heading: ((lnk.heading % 360) + 360) % 360,
      label: lnk.description || "Road",
      action: () => this.goToLink(lnk)
    }));
    renderTurnPills();
  },

  goToLink(lnk) {
    if (!this.pano || state.isStepping) return;
    state.isStepping = true;
    const el = document.getElementById("google-pano");
    el.classList.add("motion-rush");
    this.pano.setPov({ heading: lnk.heading, pitch: 2 });
    setTimeout(() => {
      this.pano.setPano(lnk.pano);
      el.classList.remove("motion-rush");
      state.isStepping = false;
      state.lastStepTime = performance.now();
    }, 240);
  },

  stepForward(isReverse) {
    if (!this.pano || state.isStepping) return;
    const links = this.pano.getLinks() || [];
    if (!links.length) {
      showBlockedWarning("🚫 Street View Ends Here — Road Closed");
      state.speed = 0;
      return;
    }

    const targetDir = isReverse ? (state.heading + 180) % 360 : state.heading;
    let best = null;
    let bestDiff = Infinity;
    for (let i = 0; i < links.length; i++) {
      const d = Math.abs(angleDiff(targetDir, links[i].heading));
      if (d < bestDiff) {
        bestDiff = d;
        best = links[i];
      }
    }

    // Strict accessibility check: only drive if an actual Street View street exists ahead (±58°)
    if (best && bestDiff <= 58) {
      state.isStepping = true;
      const el = document.getElementById("google-pano");
      el.classList.add("motion-rush");
      if (!isReverse) {
        this.pano.setPov({ heading: best.heading, pitch: 2 });
      }
      setTimeout(() => {
        this.pano.setPano(best.pano);
        el.classList.remove("motion-rush");
        state.isStepping = false;
        state.lastStepTime = performance.now();
      }, 240);
    } else {
      state.speed = 0;
      showBlockedWarning("🚫 No Street View Ahead — Steer Toward a Green Turn");
    }
  },

  steer(deltaDeg) {
    if (!this.pano) return;
    state.heading = (state.heading + deltaDeg + 360) % 360;
    const pov = this.pano.getPov();
    this.pano.setPov({ heading: state.heading, pitch: pov ? pov.pitch : 2 });
  }
};

// --- B) MAPILLARY FREE STREET IMAGERY ENGINE ---
const mapillaryEngine = {
  loaded: false,
  viewer: null,

  loadLib() {
    return new Promise((resolve, reject) => {
      if (window.mapillary && window.mapillary.Viewer) {
        this.loaded = true;
        return resolve();
      }
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/mapillary-js@4.1.2/dist/mapillary.css";
      document.head.appendChild(css);

      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/mapillary-js@4.1.2/dist/mapillary.min.js";
      s.onload = () => {
        this.loaded = true;
        resolve();
      };
      s.onerror = () => reject(new Error("Failed to load MapillaryJS library."));
      document.head.appendChild(s);
    });
  },

  async findNearestImage(lat, lng) {
    const radii = [0.004, 0.015, 0.045];
    for (let i = 0; i < radii.length; i++) {
      const r = radii[i];
      const bbox = `${lng - r},${lat - r},${lng + r},${lat + r}`;
      const url = `https://graph.mapillary.com/images?access_token=${encodeURIComponent(
        state.mapillaryToken
      )}&fields=id,geometry,compass_angle&bbox=${bbox}&limit=40`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Mapillary rejected this Client Token. Please verify your token.");
      const json = await res.json();
      if (json.data && json.data.length) {
        let best = json.data[0];
        let bestD = Infinity;
        json.data.forEach((img) => {
          if (!img.geometry || !img.geometry.coordinates) return;
          const d = getDistanceMeters(lat, lng, img.geometry.coordinates[1], img.geometry.coordinates[0]);
          if (d < bestD) {
            bestD = d;
            best = img;
          }
        });
        return best;
      }
    }
    return null;
  },

  async start(lat, lng) {
    await this.loadLib();
    const img = await this.findNearestImage(lat, lng);
    if (!img) {
      throw new Error("No Mapillary street images found near this Nagpur spot. Try Google Street View for full Nagpur coverage.");
    }
    const el = document.getElementById("mapillary-pano");
    el.classList.remove("hidden");

    if (this.viewer) {
      await this.viewer.moveTo(img.id);
      return;
    }
    this.viewer = new mapillary.Viewer({
      accessToken: state.mapillaryToken,
      container: "mapillary-pano",
      imageId: img.id,
      component: {
        cover: false,
        direction: false,
        sequence: false,
        zoom: false,
        bearing: false
      }
    });

    this.viewer.on("image", (evt) => {
      const im = evt.image;
      if (!im || !im.lngLat) return;
      state.lat = im.lngLat.lat;
      state.lng = im.lngLat.lng;
      if (typeof im.compassAngle === "number") state.heading = im.compassAngle;
      document.getElementById("road-name-chip").textContent = "📍 Nagpur Mapped Street (Mapillary)";
      syncMiniMap();
      checkProximityAndGps();
      this.refreshLinks();
    });

    this.refreshLinks();
  },

  refreshLinks() {
    state.availableLinks = [
      { heading: state.heading, label: "Next Photo", action: () => this.stepForward(false) },
      { heading: (state.heading - 90 + 360) % 360, label: "Turn Left", action: () => this.tryDir("TurnLeft") },
      { heading: (state.heading + 90) % 360, label: "Turn Right", action: () => this.tryDir("TurnRight") }
    ];
    renderTurnPills();
  },

  async tryDir(dirName) {
    if (!this.viewer || state.isStepping) return;
    state.isStepping = true;
    try {
      const dir = mapillary.NavigationDirection[dirName];
      await this.viewer.moveDir(dir);
    } catch (_) {
      showBlockedWarning("🚫 No Mapped Street in That Direction");
      state.speed = 0;
    } finally {
      state.isStepping = false;
      state.lastStepTime = performance.now();
    }
  },

  async stepForward(isReverse) {
    if (!this.viewer || state.isStepping) return;
    state.isStepping = true;
    try {
      const dir = isReverse ? mapillary.NavigationDirection.Prev : mapillary.NavigationDirection.Next;
      await this.viewer.moveDir(dir);
    } catch (_) {
      try {
        const fb = isReverse ? mapillary.NavigationDirection.StepBackward : mapillary.NavigationDirection.StepForward;
        await this.viewer.moveDir(fb);
      } catch (__) {
        showBlockedWarning("🚫 Street Imagery Ends Here — Road Blocked");
        state.speed = 0;
      }
    } finally {
      state.isStepping = false;
      state.lastStepTime = performance.now();
    }
  },

  async teleportToNearest(lat, lng) {
    try {
      const img = await this.findNearestImage(lat, lng);
      if (img && this.viewer) {
        await this.viewer.moveTo(img.id);
        return true;
      }
      showBlockedWarning("🚫 No Mapillary Street Coverage at that Nagpur spot.");
      return false;
    } catch (_) {
      return false;
    }
  },

  steer(deltaDeg) {
    if (!this.viewer) return;
    state.heading = (state.heading + deltaDeg + 360) % 360;
    try {
      this.viewer.getCenter().then((c) => {
        this.viewer.setCenter([Math.min(0.95, Math.max(0.05, c[0] + deltaDeg * 0.004)), c[1]]);
      });
    } catch (_) {}
  }
};

// --- C) KARTAVIEW ZERO-KEY PUBLIC STREET PHOTO ENGINE ---
const kartaviewEngine = {
  frames: [],
  idx: 0,
  activeBuf: "a",
  panOffset: 0,

  getPhotoUrl(item) {
    const raw = item.fileurlProc || item.fileurlLTh || item.fileurl || item.fileurlTh || "";
    if (!raw) return "";
    return raw.startsWith("http") ? raw : `https://${raw.replace(/^\/+/, "")}`;
  },

  async fetchSequenceNear(lat, lng) {
    const radii = [2500, 8000, 20000];
    for (let rIdx = 0; rIdx < radii.length; rIdx++) {
      const url = `https://api.openstreetcam.org/2.0/photo/?lat=${lat}&lng=${lng}&radius=${radii[rIdx]}&itemsPerPage=30`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const json = await res.json();
      const list = json && json.result && Array.isArray(json.result.data) ? json.result.data : [];
      if (list.length) {
        // Pick photo with a valid sequenceId
        const seed = list.find((p) => p.sequenceId) || list[0];
        if (!seed.sequenceId) return list;

        const seqUrl = `https://api.openstreetcam.org/2.0/photo/?sequenceId=${seed.sequenceId}&itemsPerPage=200`;
        const seqRes = await fetch(seqUrl);
        if (seqRes.ok) {
          const seqJson = await seqRes.json();
          const seqList = seqJson && seqJson.result && Array.isArray(seqJson.result.data) ? seqJson.result.data : [];
          if (seqList.length) {
            seqList.sort((a, b) => Number(a.sequenceIndex || 0) - Number(b.sequenceIndex || 0));
            return seqList;
          }
        }
        return list;
      }
    }
    return [];
  },

  async start(lat, lng) {
    const el = document.getElementById("kartaview-pano");
    el.classList.remove("hidden");

    const seq = await this.fetchSequenceNear(lat, lng);
    if (!seq.length) {
      throw new Error(
        "KartaView public server returned no nearby Nagpur track right now. Switch to Google Street View (best Nagpur coverage) or Mapillary in Setup."
      );
    }
    this.frames = seq;
    this.idx = 0;
    this.showFrame(0, false);
  },

  preloadAhead() {
    for (let k = 1; k <= 4; k++) {
      const f = this.frames[this.idx + k];
      if (f) {
        const u = this.getPhotoUrl(f);
        if (u) {
          const pre = new Image();
          pre.src = u;
        }
      }
    }
  },

  showFrame(newIdx, zoomAnim) {
    const f = this.frames[newIdx];
    if (!f) return;
    this.idx = newIdx;

    const url = this.getPhotoUrl(f);
    const nextBuf = this.activeBuf === "a" ? "b" : "a";
    const curEl = document.getElementById(`kv-img-${this.activeBuf}`);
    const nxtEl = document.getElementById(`kv-img-${nextBuf}`);

    if (zoomAnim) curEl.classList.add("zoom-in");

    nxtEl.onload = () => {
      nxtEl.classList.remove("zoom-in");
      nxtEl.classList.add("active");
      curEl.classList.remove("active", "zoom-in");
      this.activeBuf = nextBuf;
    };
    nxtEl.src = url;

    state.lat = parseFloat(f.matchLat || f.lat || state.lat);
    state.lng = parseFloat(f.matchLng || f.lng || state.lng);
    if (f.heading) state.heading = parseFloat(f.heading) || state.heading;
    document.getElementById("road-name-chip").textContent = `📍 Nagpur Real Dashcam Track (${this.idx + 1}/${this.frames.length})`;
    syncMiniMap();
    checkProximityAndGps();
    this.preloadAhead();

    state.availableLinks = [];
    if (this.idx + 1 < this.frames.length) {
      state.availableLinks.push({ heading: state.heading, label: "Drive Ahead", action: () => this.stepForward(false) });
    }
    if (this.idx - 1 >= 0) {
      state.availableLinks.push({
        heading: (state.heading + 180) % 360,
        label: "Reverse Road",
        action: () => this.stepForward(true)
      });
    }
    renderTurnPills();
  },

  stepForward(isReverse) {
    if (state.isStepping) return;
    const nextIdx = isReverse ? this.idx - 1 : this.idx + 1;
    if (nextIdx < 0 || nextIdx >= this.frames.length) {
      state.speed = 0;
      showBlockedWarning("🚫 Street View Track Ends Here — Use Teleport or Reverse");
      return;
    }
    state.isStepping = true;
    this.showFrame(nextIdx, !isReverse);
    setTimeout(() => {
      state.isStepping = false;
      state.lastStepTime = performance.now();
    }, 260);
  },

  async teleportToNearest(lat, lng) {
    try {
      const seq = await this.fetchSequenceNear(lat, lng);
      if (seq.length) {
        this.frames = seq;
        this.showFrame(0, false);
        return true;
      }
      showBlockedWarning("🚫 No KartaView street photos near that spot.");
      return false;
    } catch (_) {
      return false;
    }
  },

  steer(deltaDeg) {
    this.panOffset = Math.max(-18, Math.min(18, this.panOffset - deltaDeg * 0.2));
    const el = document.getElementById("kartaview-pano");
    el.style.transform = `scale(1.06) translateX(${this.panOffset}px)`;
  }
};

function getActiveEngine() {
  if (state.provider === "google") return googleEngine;
  if (state.provider === "mapillary") return mapillaryEngine;
  return kartaviewEngine;
}

// -------------------------------------------------------------------------
// 4. ACCESSIBLE TURNS HUD, MISSIONS & DIALOGUE
// -------------------------------------------------------------------------
let blockedTimer = null;
function showBlockedWarning(msg) {
  const b = document.getElementById("blocked-banner");
  b.textContent = msg;
  b.classList.remove("hidden");
  audio.blockedBuzz();
  clearTimeout(blockedTimer);
  blockedTimer = setTimeout(() => b.classList.add("hidden"), 1800);
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => t.classList.add("hidden"), 2800);
}

function showMissionBanner(title, sub) {
  const b = document.getElementById("mission-banner");
  document.getElementById("banner-title").textContent = title;
  document.getElementById("banner-sub").textContent = sub;
  b.classList.remove("hidden");
  clearTimeout(showMissionBanner.timer);
  showMissionBanner.timer = setTimeout(() => b.classList.add("hidden"), 3200);
}

function renderTurnPills() {
  const wrap = document.getElementById("turn-pills");
  wrap.innerHTML = "";
  if (!state.availableLinks.length) return;

  state.availableLinks.forEach((lnk) => {
    const rel = angleDiff(state.heading, lnk.heading);
    let arrow = "↑";
    if (rel > 35 && rel < 145) arrow = "↱";
    else if (rel < -35 && rel > -145) arrow = "↰";
    else if (Math.abs(rel) >= 145) arrow = "↶";

    const btn = document.createElement("button");
    btn.className = `turn-pill${Math.abs(rel) <= 40 ? " ahead" : ""}`;
    const shortName = (lnk.label || "Road").slice(0, 18);
    btn.textContent = `${arrow} ${shortName}`;
    btn.onclick = () => lnk.action();
    wrap.appendChild(btn);
  });
}

function updateStatsUI() {
  document.getElementById("hud-cash").textContent = state.cash.toLocaleString("en-IN");
  const done = state.completedMissions.size;
  const rank = done >= 5 ? "Nagpur King 👑" : done >= 3 ? "Sitabuldi Boss" : done >= 1 ? "Street Runner" : "Rookie";
  document.getElementById("hud-rank").textContent = rank;
}

function updateMissionHUD() {
  if (miniTargetMarker) {
    minimap.removeLayer(miniTargetMarker);
    miniTargetMarker = null;
  }

  const titleEl = document.getElementById("hud-mission-title");
  const descEl = document.getElementById("hud-mission-desc");

  if (!state.activeMission) {
    titleEl.textContent = `Free Roam (${state.completedMissions.size}/${Object.keys(MISSIONS).length} Done)`;
    descEl.textContent = "Drive to an orange dot on GPS or Teleport to an NPC.";
    return;
  }

  const step = state.activeMission.steps[state.stepIndex];
  titleEl.textContent = `Mission: ${state.activeMission.title}`;
  descEl.textContent = step.label;

  miniTargetMarker = L.circleMarker([step.lat, step.lng], {
    radius: 6,
    color: "#fff",
    weight: 2,
    fillColor: "#38bdf8",
    fillOpacity: 1
  }).addTo(minimap);
}

function checkProximityAndGps() {
  let targetLat = null;
  let targetLng = null;
  state.nearTarget = false;
  state.nearbyNpc = null;

  if (state.activeMission) {
    const step = state.activeMission.steps[state.stepIndex];
    targetLat = step.lat;
    targetLng = step.lng;
    if (getDistanceMeters(state.lat, state.lng, targetLat, targetLng) < 120) {
      state.nearTarget = true;
    }
  } else {
    let bestD = Infinity;
    NPCS.forEach((npc) => {
      const d = getDistanceMeters(state.lat, state.lng, npc.lat, npc.lng);
      if (d < bestD) {
        bestD = d;
        targetLat = npc.lat;
        targetLng = npc.lng;
      }
    });
  }

  NPCS.forEach((npc) => {
    if (getDistanceMeters(state.lat, state.lng, npc.lat, npc.lng) < 130) {
      state.nearbyNpc = npc;
    }
  });

  const btn = document.getElementById("btn-interact");
  if (state.nearTarget) {
    btn.textContent = "✅ COMPLETE STEP";
    btn.classList.remove("hidden");
  } else if (state.nearbyNpc) {
    btn.textContent = `💬 TALK: ${state.nearbyNpc.name}`;
    btn.classList.remove("hidden");
  } else {
    btn.classList.add("hidden");
  }

  if (targetLat !== null) {
    const dist = getDistanceMeters(state.lat, state.lng, targetLat, targetLng);
    const brg = getBearing(state.lat, state.lng, targetLat, targetLng);
    document.getElementById("hud-gps-arrow").style.transform = `rotate(${brg - state.heading}deg)`;
    document.getElementById("hud-gps-dist").textContent =
      dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`;
    miniRouteLine.setLatLngs([
      [state.lat, state.lng],
      [targetLat, targetLng]
    ]);
  }
}

function handleInteract() {
  if (state.nearTarget && state.activeMission) {
    const step = state.activeMission.steps[state.stepIndex];
    state.stepIndex++;
    if (state.stepIndex >= state.activeMission.steps.length) {
      const reward = state.activeMission.reward;
      state.cash += reward;
      state.completedMissions.add(state.activeMission.id);
      const title = state.activeMission.title;
      state.activeMission = null;
      state.stepIndex = 0;
      saveStore();
      updateStatsUI();
      audio.chime();
      showMissionBanner("MISSION PASSED!", `${title}  +₹${reward.toLocaleString("en-IN")}`);
    } else {
      audio.chime();
      showToast(step.doneText);
    }
    updateMissionHUD();
    checkProximityAndGps();
    return;
  }

  if (state.nearbyNpc) openDialogue(state.nearbyNpc);
}

function openDialogue(npc) {
  state.speed = 0;
  const modal = document.getElementById("dialogue-modal");
  document.getElementById("dlg-avatar").textContent = npc.avatar;
  document.getElementById("dlg-name").textContent = npc.name;
  document.getElementById("dlg-place").textContent = npc.place;

  const actions = document.getElementById("dlg-actions");
  actions.innerHTML = "";

  const nextId = npc.missions.find((id) => !state.completedMissions.has(id));
  const mission = nextId ? MISSIONS[nextId] : null;

  if (!state.activeMission && mission) {
    document.getElementById("dlg-text").textContent =
      `${npc.greeting}\n\n📋 ${mission.title}\n${mission.offerText}\n💰 Reward: ₹${mission.reward.toLocaleString("en-IN")}`;

    const acc = document.createElement("button");
    acc.className = "dlg-btn dlg-primary";
    acc.textContent = `Accept Mission (₹${mission.reward})`;
    acc.onclick = () => {
      state.activeMission = mission;
      state.stepIndex = 0;
      updateMissionHUD();
      checkProximityAndGps();
      modal.classList.add("hidden");
      showToast(`Started: ${mission.title}`);
    };
    actions.appendChild(acc);
  } else if (state.activeMission) {
    document.getElementById("dlg-text").textContent =
      `${npc.greeting}\n\nFinish "${state.activeMission.title}" first, or cancel it to pick a new job.`;
    const cancel = document.createElement("button");
    cancel.className = "dlg-btn dlg-secondary";
    cancel.textContent = "Cancel Mission";
    cancel.onclick = () => {
      state.activeMission = null;
      state.stepIndex = 0;
      updateMissionHUD();
      modal.classList.add("hidden");
    };
    actions.appendChild(cancel);
  } else {
    document.getElementById("dlg-text").textContent =
      `${npc.greeting}\n\nYou completed all my Nagpur runs! Cruise around or replay my job.`;
    const replayM = MISSIONS[npc.missions[0]];
    if (replayM) {
      const rep = document.createElement("button");
      rep.className = "dlg-btn dlg-primary";
      rep.textContent = `Replay: ${replayM.title}`;
      rep.onclick = () => {
        state.activeMission = replayM;
        state.stepIndex = 0;
        updateMissionHUD();
        modal.classList.add("hidden");
      };
      actions.appendChild(rep);
    }
  }

  const close = document.createElement("button");
  close.className = "dlg-btn dlg-secondary";
  close.textContent = "Back to Driving";
  close.onclick = () => modal.classList.add("hidden");
  actions.appendChild(close);

  modal.classList.remove("hidden");
}

// -------------------------------------------------------------------------
// 5. SETUP SCREEN & CONTROLS WIRING
// -------------------------------------------------------------------------
const tabBtns = document.querySelectorAll(".tab-btn");
function selectProviderTab(p) {
  state.provider = p;
  tabBtns.forEach((b) => b.classList.toggle("active", b.dataset.provider === p));
  document.getElementById("panel-google").classList.toggle("hidden", p !== "google");
  document.getElementById("panel-mapillary").classList.toggle("hidden", p !== "mapillary");
  document.getElementById("panel-kartaview").classList.toggle("hidden", p !== "kartaview");
  document.getElementById("setup-error").classList.add("hidden");
}

tabBtns.forEach((btn) => btn.addEventListener("click", () => selectProviderTab(btn.dataset.provider)));
document.getElementById("input-google-key").value = state.googleKey;
document.getElementById("input-mapillary-token").value = state.mapillaryToken;
selectProviderTab(state.provider);

function showSetupError(msg) {
  const el = document.getElementById("setup-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

document.getElementById("btn-launch").addEventListener("click", async () => {
  const launchBtn = document.getElementById("btn-launch");
  document.getElementById("setup-error").classList.add("hidden");

  if (state.provider === "google") {
    const key = document.getElementById("input-google-key").value.trim();
    if (!key) return showSetupError("Please paste your Google Maps API key, or switch to Mapillary / KartaView tab above.");
    state.googleKey = key;
  } else if (state.provider === "mapillary") {
    const tok = document.getElementById("input-mapillary-token").value.trim();
    if (!tok) return showSetupError("Please paste your free Mapillary Client Token (starts with MLY|...).");
    state.mapillaryToken = tok;
  }

  saveStore();
  launchBtn.disabled = true;
  launchBtn.textContent = "⏳ Connecting to Real Nagpur Streets...";

  // Hide all viewer layers first
  ["google-pano", "mapillary-pano", "kartaview-pano"].forEach((id) =>
    document.getElementById(id).classList.add("hidden")
  );

  try {
    audio.init();
    await getActiveEngine().start(state.lat, state.lng, state.heading);
    state.started = true;
    document.getElementById("setup-screen").classList.add("hidden");
    document.getElementById("hud-provider-badge").textContent =
      state.provider === "google" ? "GOOGLE 360°" : state.provider === "mapillary" ? "MAPILLARY" : "KARTAVIEW";
    updateStatsUI();
    updateMissionHUD();
    checkProximityAndGps();
    showToast("🚗 Real Nagpur Street View Ready! Hold GAS to drive.");
  } catch (err) {
    showSetupError(err && err.message ? err.message : "Could not load street imagery.");
  } finally {
    launchBtn.disabled = false;
    launchBtn.textContent = "🚗 ENTER COCKPIT & DRIVE";
  }
});

// Fast Travel Nagpur Dropdown
const spawnSelect = document.getElementById("spawn-select");
spawnSelect.innerHTML = `<option value="">📍 Nagpur Spots</option>`;
NAGPUR_SPOTS.forEach((s, i) => {
  const opt = document.createElement("option");
  opt.value = String(i);
  opt.textContent = s.name;
  spawnSelect.appendChild(opt);
});
spawnSelect.addEventListener("change", async () => {
  const idx = parseInt(spawnSelect.value, 10);
  if (!isNaN(idx) && NAGPUR_SPOTS[idx] && state.started) {
    const spot = NAGPUR_SPOTS[idx];
    state.speed = 0;
    const ok = await getActiveEngine().teleportToNearest(spot.lat, spot.lng, spot.heading);
    if (ok) showToast(`📍 Driving on ${spot.name}`);
  }
  spawnSelect.value = "";
  spawnSelect.blur();
});

document.getElementById("btn-fullscreen").addEventListener("click", () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

document.getElementById("btn-sound").addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  document.getElementById("btn-sound").textContent = state.soundOn ? "🔊" : "🔇";
});

document.getElementById("btn-settings").addEventListener("click", () => {
  state.speed = 0;
  document.getElementById("setup-screen").classList.remove("hidden");
});

document.getElementById("btn-bypass-rotate").addEventListener("click", () => {
  document.body.classList.add("allow-portrait");
});

document.getElementById("btn-interact").addEventListener("click", handleInteract);
document.getElementById("btn-horn").addEventListener("pointerdown", (e) => {
  e.preventDefault();
  audio.horn();
  showToast("📯 Peep! Peep!");
});

function bindHold(id, key) {
  const btn = document.getElementById(id);
  const on = (e) => {
    e.preventDefault();
    input[key] = true;
    btn.classList.add("active");
  };
  const off = (e) => {
    e.preventDefault();
    input[key] = false;
    btn.classList.remove("active");
  };
  btn.addEventListener("pointerdown", on);
  btn.addEventListener("pointerup", off);
  btn.addEventListener("pointerleave", off);
  btn.addEventListener("pointercancel", off);
}

bindHold("btn-gas", "gas");
bindHold("btn-brake", "brake");
bindHold("btn-left", "left");
bindHold("btn-right", "right");

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "w") input.gas = true;
  if (k === "arrowdown" || k === "s") input.brake = true;
  if (k === "arrowleft" || k === "a") input.left = true;
  if (k === "arrowright" || k === "d") input.right = true;
  if (k === "e" || k === "enter") handleInteract();
  if (k === "h") audio.horn();
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();
  if (k === "arrowup" || k === "w") input.gas = false;
  if (k === "arrowdown" || k === "s") input.brake = false;
  if (k === "arrowleft" || k === "a") input.left = false;
  if (k === "arrowright" || k === "d") input.right = false;
});

// -------------------------------------------------------------------------
// 6. MAIN 60 FPS COCKPIT & STREET-NODE DRIVING LOOP
// -------------------------------------------------------------------------
let lastFrame = performance.now();

function loop(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  const modalOpen = !document.getElementById("dialogue-modal").classList.contains("hidden");
  const setupOpen = !document.getElementById("setup-screen").classList.contains("hidden");

  if (state.started && !modalOpen && !setupOpen) {
    const steerDir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    // Smooth Steering Wheel Animation & Camera Pan
    const targetWheel = steerDir * 68;
    state.wheelAngle += (targetWheel - state.wheelAngle) * Math.min(1, dt * 10);
    document.getElementById("steering-wheel").style.transform = `rotate(${state.wheelAngle}deg)`;

    if (steerDir !== 0) {
      getActiveEngine().steer(steerDir * 78 * dt);
    }

    // Speed & Step Pacing along Real Street View Panoramas
    if (input.gas) {
      state.speed = Math.min(72, state.speed + 52 * dt);
    } else if (input.brake) {
      if (state.speed > 2) state.speed = Math.max(0, state.speed - 95 * dt);
      else state.speed = Math.max(-24, state.speed - 36 * dt);
    } else {
      if (state.speed > 0) state.speed = Math.max(0, state.speed - 45 * dt);
      if (state.speed < 0) state.speed = Math.min(0, state.speed + 45 * dt);
    }

    // Advance along real Street View road nodes strictly when speed is active
    const absSpd = Math.abs(state.speed);
    const stepCooldownMs = Math.max(460, 1250 - absSpd * 10);
    if (absSpd >= 12 && !state.isStepping && now - state.lastStepTime >= stepCooldownMs) {
      getActiveEngine().stepForward(state.speed < 0);
    }

    // Instrument Cluster Update
    document.getElementById("hud-speed").textContent = Math.round(absSpd);
    document.getElementById("hud-rpm-bar").style.width = `${Math.min(100, 12 + (absSpd / 75) * 88)}%`;

    let gear = "N";
    if (state.speed < -1) gear = "R";
    else if (absSpd > 56) gear = "4";
    else if (absSpd > 38) gear = "3";
    else if (absSpd > 18) gear = "2";
    else if (absSpd > 1) gear = "1";
    document.getElementById("hud-gear").textContent = gear;

    audio.update(state.speed);
  } else {
    audio.update(0);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
