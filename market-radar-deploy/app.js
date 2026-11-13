(function () {
  const T = window.MarketTime;
  const CX = 360;
  const CY = 360;
  const NS = "http://www.w3.org/2000/svg";
  const PREVIEW = {
    winter: new Date("2026-01-15T12:00:00Z"),
    summer: new Date("2026-07-15T10:00:00Z"),
  };

  const dialAm = document.getElementById("dial-am");
  const dialPm = document.getElementById("dial-pm");
  const legend = document.getElementById("legend");
  const detail = document.getElementById("detail");
  const tooltip = document.getElementById("tooltip");
  const zoneNote = document.getElementById("zone-note");
  const clockEl = document.getElementById("clock");
  const dateLine = document.getElementById("date-line");
  const seasonEl = document.getElementById("season");
  const modeNote = document.getElementById("mode-note");
  const openCount = document.getElementById("open-count");

  let mode = "live";
  let builtKey = "";
  let model = null;
  let viewDate = new Date();
  let hoverId = null;
  let pinId = null;
  let pinJustClicked = 0; // verrou anti-dé-pin immédiat après un clic de pin

  /** Dé-pin manuel (survol graphique ou clic sur le fond). */
  function unpin() {
    pinId = null;
    hoverId = null;
    syncHover(new Date());
  }

  // État du relevé réel : "pending" tant que data.json n'a pas répondu.
  let dataset = { kind: "pending", sessionDate: null, fetchedAt: null, error: null };

  const userZone = T.userZone();
  let refZone = userZone;

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  }

  function viewMoment(now) {
    return mode === "live" ? now : PREVIEW[mode];
  }

  function statusOf(ring, now) {
    if (mode !== "live") return { code: "preview", text: "Aperçu" };
    const hits = ring.sessions.filter((session) => now >= session.openUtc && now < session.closeUtc);
    if (hits.some((session) => session.kind === "regular")) return { code: "open", text: "Ouvert" };
    if (hits.some((session) => session.kind === "extended")) return { code: "pre", text: "Pré-marché" };
    return { code: "closed", text: ring.closedLabel };
  }

  function activeId() {
    return pinId || hoverId;
  }

  function ringById(id) {
    return model.rings.find((ring) => ring.id === id);
  }

  /** Libellé de volume affiché dans la légende. */
  function volumeLabel(ring) {
    if (ring.volumeKind === "unavailable") return "volume indisponible";
    const suffix = ring.volumeKind === "real" ? "réel" : "indicatif";
    return `${T.formatVolume(ring.volume)} · ${suffix}`;
  }

  /** Détail du volume pour l'encart latéral et le tooltip. */
  function volumeLine(ring) {
    if (ring.volumeKind === "unavailable") {
      return "Volume indisponible : aucun ETF de référence n'est coté pour cette place.";
    }
    if (ring.volumeKind === "real") {
      const change = Number.isFinite(ring.dayChangePct)
        ? ` · ${ring.dayChangePct > 0 ? "+" : ""}${ring.dayChangePct} %`
        : "";
      return `Volume ${T.formatVolume(ring.volume)} sur ${ring.volumeSymbol} (${ring.volumeSource})${change}`;
    }
    return `Volume indicatif ${T.formatVolume(ring.volume)}`;
  }

  function drawDial(svg, dial) {
    svg.replaceChildren();
    const labelR = Math.min(336, model.outerEdge + 30);
    const tickOuter = labelR - 16;
    const tickInner = model.outerEdge + 6;

    svg.append(el("circle", { cx: CX, cy: CY, r: 348, class: "face" }));
    for (const radius of [140, 200, 260]) {
      if (radius < model.outerEdge) svg.append(el("circle", { cx: CX, cy: CY, r: radius, class: "grid" }));
    }
    svg.append(el("line", { x1: CX, y1: 28, x2: CX, y2: 692, class: "cross" }));
    svg.append(el("line", { x1: 28, y1: CY, x2: 692, y2: CY, class: "cross" }));

    const top = T.pointOnDial(CX, CY, 70, 0);
    const rim = T.pointOnDial(CX, CY, 344, 0);
    svg.append(el("line", { x1: top[0], y1: top[1], x2: rim[0], y2: rim[1], class: "noon-mark" }));

    for (let hour = 0; hour < 12; hour += 1) {
      const major = hour % 3 === 0;
      const angle = (hour / 12) * Math.PI * 2 - Math.PI / 2;
      const inner = major ? tickInner : tickOuter - 6;
      svg.append(el("line", {
        x1: CX + Math.cos(angle) * inner,
        y1: CY + Math.sin(angle) * inner,
        x2: CX + Math.cos(angle) * tickOuter,
        y2: CY + Math.sin(angle) * tickOuter,
        class: major ? "tick major" : "tick",
      }));
      const [x, y] = T.pointOnDial(CX, CY, labelR, hour * 60);
      const text = el("text", {
        x,
        y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: major ? "hour-label major" : "hour-label",
      });
      text.textContent = dial === "am"
        ? (hour === 0 ? "12" : String(hour))
        : (hour === 0 ? "12" : String(hour + 12));
      svg.append(text);
    }

    for (const ring of model.rings) {
      const track = el("circle", {
        cx: CX,
        cy: CY,
        r: ring.radius,
        class: ring.volumeKind === "unavailable" ? "ring-track is-unavailable" : "ring-track",
        "data-market": ring.id,
        stroke: ring.color,
        "stroke-width": ring.stroke,
      });
      track.style.setProperty("--volume-weight", ring.weight.toFixed(3));
      track.style.setProperty("--glow", ring.color);
      svg.append(track);

      for (const session of ring.sessions) {
        for (const segment of T.splitDial(session.startMin, session.endMin)) {
          if (segment.dial !== dial) continue;
          const path = el("path", {
            d: T.arcPath(CX, CY, ring.radius, segment.start, segment.end),
            class: `arc is-${session.kind}`,
            "data-market": ring.id,
            "data-open": String(session.openUtc),
            "data-close": String(session.closeUtc),
            "data-kind": session.kind,
            stroke: ring.color,
            "stroke-width": ring.stroke,
          });
          path.style.setProperty("--volume-weight", ring.weight.toFixed(3));
          path.style.setProperty("--glow", ring.color);
          svg.append(path);
        }
      }
    }

    for (const ring of model.rings) {
      const pieces = ring.sessions.flatMap((session) => (
        session.kind === "regular"
          ? T.splitDial(session.startMin, session.endMin).filter((segment) => segment.dial === dial)
          : []
      ));
      if (!pieces.length) continue;
      // Sous 8 px d'épaisseur, l'étiquette du code chevaucherait ses voisines :
      // la légende et le survol prennent le relais.
      if (ring.stroke < 8) continue;
      const piece = pieces.reduce((best, segment) => (
        segment.end - segment.start > best.end - best.start ? segment : best
      ));
      const [x, y] = T.pointOnDial(CX, CY, ring.radius, (piece.start + piece.end) / 2);
      const text = el("text", {
        x,
        y,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "ring-label",
        fill: ring.color,
      });
      text.textContent = ring.code;
      svg.append(text);
    }

    svg.append(el("circle", { cx: CX, cy: CY, r: 62, class: "hub" }));
    const kicker = el("text", { x: CX, y: CY - 8, class: "hub-kicker", id: `kicker-${dial}` });
    kicker.textContent = dial === "am" ? "MATIN" : "APRÈS-MIDI";
    const main = el("text", { x: CX, y: CY + 16, class: "hub-main", id: `main-${dial}` });
    main.textContent = dial === "am" ? "00–12" : "12–24";
    svg.append(kicker, main);

    const hand = el("g", { id: `hand-${dial}`, class: "hand", visibility: "hidden" });
    hand.append(el("line", { x1: CX, y1: CY, x2: CX, y2: CY - 80 }));
    hand.append(el("circle", { cx: CX, cy: CY, r: 4 }));
    svg.append(hand);
  }

  function renderLegend() {
    const rings = model.rings.slice().sort((a, b) => {
      const startA = a.sessions[0] ? a.sessions[0].startMin : 9999;
      const startB = b.sessions[0] ? b.sessions[0].startMin : 9999;
      return startA - startB || b.volume - a.volume;
    });
    legend.replaceChildren();
    for (const ring of rings) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.id = ring.id;
      button.style.setProperty("--c", ring.color);
      button.style.setProperty("--volume-weight", ring.weight.toFixed(3));
      button.innerHTML = `
        <span class="swatch" aria-hidden="true"></span>
        <span>
          <span class="name">${ring.name} <small>${ring.fullName}</small></span>
          <span class="hours js-hours">${ring.hoursLabel}</span>
          <span class="volume">${volumeLabel(ring)}</span>
        </span>
        <span class="side-col">
          <span class="local js-local">--:--</span>
          <span class="status js-status closed">—</span>
        </span>`;
      item.append(button);
      legend.append(item);
    }
  }

  function render(now) {
    viewDate = viewMoment(now);
    model = T.buildModel(viewDate, refZone);
    drawDial(dialAm, "am");
    drawDial(dialPm, "pm");
    renderLegend();
    const season = model.season;
    if (mode === "live") {
      modeNote.textContent = "Séances d'aujourd'hui. Les places ouvertes s'illuminent.";
    } else if (mode === "winter") {
      modeNote.textContent = `Aperçu du ${T.formatParisDate(viewDate, refZone)}, ${season.name}. Ce n'est pas l'état en direct.`;
    } else {
      modeNote.textContent = `Aperçu du ${T.formatParisDate(viewDate, refZone)}, ${season.name}. Ce n'est pas l'état en direct.`;
    }
    syncHover(now);
  }

  function paintCenters(now) {
    const moment = mode === "live" ? now : viewDate;
    const parts = T.getZonedParts(moment, refZone);
    const minutes = parts.hour * 60 + parts.minute + parts.second / 60;
    const activeDial = parts.hour < 12 ? "am" : "pm";
    const selected = activeId();
    const ring = selected ? ringById(selected) : null;

    for (const dial of ["am", "pm"]) {
      const kicker = document.getElementById(`kicker-${dial}`);
      const main = document.getElementById(`main-${dial}`);
      const segments = ring
        ? ring.sessions.flatMap((session) => T.splitDial(session.startMin, session.endMin).filter((segment) => segment.dial === dial))
        : [];
      if (ring && segments.length) {
        kicker.textContent = ring.code;
        main.textContent = segments
          .map((segment) => `${T.fmtMin(dial === "am" ? segment.start : segment.start + 720)}`)
          .slice(0, 1)
          .join("");
        const first = segments[0];
        const absStart = dial === "am" ? first.start : first.start + 720;
        const absEnd = dial === "am" ? first.end : first.end + 720;
        main.textContent = `${T.fmtMin(absStart)}–${T.fmtMin(absEnd)}`;
      } else if (!selected && dial === activeDial) {
        kicker.textContent = dial === "am" ? "MATIN" : "APRÈS-MIDI";
        main.textContent = T.formatClock(moment, refZone, false);
      } else {
        kicker.textContent = dial === "am" ? "MATIN" : "APRÈS-MIDI";
        main.textContent = dial === "am" ? "00–12" : "12–24";
      }
    }

    for (const dial of ["am", "pm"]) {
      const hand = document.getElementById(`hand-${dial}`);
      const show = dial === activeDial;
      hand.setAttribute("visibility", show ? "visible" : "hidden");
      if (!show) continue;
      const dialMin = activeDial === "am" ? minutes : minutes - 720;
      const start = T.pointOnDial(CX, CY, 74, dialMin);
      const end = T.pointOnDial(CX, CY, model.outerEdge + 2, dialMin);
      const line = hand.querySelector("line");
      line.setAttribute("x1", start[0]);
      line.setAttribute("y1", start[1]);
      line.setAttribute("x2", end[0]);
      line.setAttribute("y2", end[1]);
    }
  }

  function detailHtml(ring, now) {
    const status = statusOf(ring, now);
    const local = T.formatClock(now, ring.timeZone, false);
    return `
      <p><strong style="color:${ring.color}">${ring.name}</strong> · ${ring.fullName}</p>
      <p>${status.text} · heure locale ${local}</p>
      <p>${refZone === T.PARIS ? "Paris" : "Votre heure"} · ${ring.hoursLabel}</p>
      <p>${volumeLine(ring)}</p>`;
  }

  function syncHover(now) {
    const selected = activeId();
    document.querySelectorAll("[data-market]").forEach((node) => {
      node.classList.toggle("is-dim", Boolean(selected) && node.dataset.market !== selected);
    });
    document.querySelectorAll("#legend button").forEach((button) => {
      button.classList.toggle("is-on", button.dataset.id === selected);
    });
    if (!selected) {
      detail.innerHTML = "Survolez un anneau pour voir la séance, l'heure locale et le volume.";
    } else {
      detail.innerHTML = detailHtml(ringById(selected), now);
    }
    paintCenters(now);
  }

  function placeTooltip(event, ring, now) {
    const status = statusOf(ring, now);
    tooltip.hidden = false;
    tooltip.innerHTML = `
      <strong>${ring.name}</strong>
      <p>${ring.fullName}</p>
      <p>${status.text} · ${T.formatClock(now, ring.timeZone, false)} heure locale</p>
      <p>${ring.hoursLabel} ${refZone === T.PARIS ? "heure de Paris" : "heure locale"}</p>
      <p>${volumeLine(ring)}</p>`;
    const margin = 14;
    const rect = tooltip.getBoundingClientRect();
    let x = event.clientX + margin;
    let y = event.clientY + margin;
    if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - margin;
    if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - margin;
    tooltip.style.left = `${Math.max(8, x)}px`;
    tooltip.style.top = `${Math.max(8, y)}px`;
  }

  function updateLive(now) {
    const parts = T.getZonedParts(now, refZone);
    const stamp = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}:${String(parts.second).padStart(2, "0")}`;
    clockEl.textContent = T.formatClock(now, refZone, true);
    clockEl.dateTime = stamp;
    dateLine.textContent = T.formatParisDate(now, refZone);
    const season = T.seasonInfo(now, refZone);
    seasonEl.textContent = `${season.name} · ${season.abbr} · ${season.utc}`;

    let open = 0;
    document.querySelectorAll("#legend button").forEach((button) => {
      const ring = ringById(button.dataset.id);
      const status = statusOf(ring, now);
      button.querySelector(".js-local").textContent = T.formatClock(now, ring.timeZone, false);
      const pill = button.querySelector(".js-status");
      pill.textContent = status.text;
      pill.className = `status js-status ${status.code}`;
      if (status.code === "open" || status.code === "pre") open += 1;
    });
    const glowMoment = mode === "live" ? now : viewDate;
    document.querySelectorAll(".arc").forEach((path) => {
      const on = glowMoment >= Number(path.dataset.open) && glowMoment < Number(path.dataset.close);
      path.classList.toggle("is-live", on);
    });
    openCount.textContent = mode === "live"
      ? (open ? `${open} place${open > 1 ? "s" : ""} en séance` : "Aucune séance en cours")
      : "";
    if (activeId()) detail.innerHTML = detailHtml(ringById(activeId()), now);
    paintCenters(now);
  }

  function tick() {
    const now = new Date();
    const key = `${mode}|${refZone}|${T.parisDateKey(viewMoment(now), refZone)}`;
    if (key !== builtKey) {
      builtKey = key;
      render(now);
    }
    updateLive(now);
  }

  function marketFromEvent(event) {
    const node = event.target.closest("[data-market]");
    return node ? node.dataset.market : null;
  }

  document.querySelector(".dials").addEventListener("pointerover", (event) => {
    const id = marketFromEvent(event);
    if (!id) return;
    // Survol d'un anneau alors qu'une place est épinglée : dé-pin et revoir toutes les places.
    // On ignore le survol qui suit immédiatement un clic (même geste).
    if (pinId && Date.now() - pinJustClicked > 300) {
      unpin();
      return;
    }
    hoverId = id;
    syncHover(new Date());
  });

  document.querySelector(".dials").addEventListener("pointerout", (event) => {
    const id = marketFromEvent(event);
    if (!id) return;
    const next = event.relatedTarget && event.relatedTarget.closest("[data-market]");
    if (next && next.dataset.market === id) return;
    if (hoverId === id) hoverId = null;
    tooltip.hidden = true;
    syncHover(new Date());
  });

  document.querySelector(".dials").addEventListener("pointermove", (event) => {
    const id = marketFromEvent(event);
    if (!id) return;
    placeTooltip(event, ringById(id), new Date());
  });

  legend.addEventListener("pointerover", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    hoverId = button.dataset.id;
    syncHover(new Date());
  });

  legend.addEventListener("pointerout", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (event.relatedTarget && button.contains(event.relatedTarget)) return;
    hoverId = null;
    syncHover(new Date());
  });

  legend.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const nextPin = pinId === button.dataset.id ? null : button.dataset.id;
    pinId = nextPin;
    hoverId = null;
    syncHover(new Date());
  });

  document.querySelector(".dials").addEventListener("click", (event) => {
    const id = marketFromEvent(event);
    if (id) {
      const nextPin = pinId === id ? null : id;
      pinId = nextPin;
      hoverId = null;
      pinJustClicked = Date.now();
    } else if (pinId) {
      // Clic sur le fond du cadran : dé-piner et revoir toutes les places
      unpin();
    }
    syncHover(new Date());
  });

  document.querySelector(".modes").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    mode = button.dataset.mode;
    document.body.dataset.mode = mode;
    document.querySelectorAll(".modes button").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    builtKey = "";
    tick();
  });

  function zoneWord() {
    return refZone === T.PARIS ? "heure de Paris" : "heure locale";
  }

  function updateZoneNote() {
    if (refZone === T.PARIS) {
      zoneNote.textContent = userZone === T.PARIS
        ? "Vous êtes à Paris. Les cadrans suivent votre heure."
        : `Cadrans en heure de Paris. Votre appareil est réglé sur ${userZone}.`;
      zoneNote.classList.toggle("is-away", userZone !== T.PARIS);
    } else {
      zoneNote.textContent = `Cadrans à votre heure locale · ${refZone}. Bouton Paris pour la référence française.`;
      zoneNote.classList.remove("is-away");
    }
  }

  function applyZone() {
    document.getElementById("clock-kicker").textContent = refZone === T.PARIS ? "Heure de Paris" : "Heure locale";
    document.title = refZone === T.PARIS ? "Bourses mondiales — heure de Paris" : "Bourses mondiales — heure locale";
    document.getElementById("ny-note").textContent = T.nyNote(refZone);
    updateZoneNote();
    const word = zoneWord();
    document.querySelector(".dials").setAttribute("aria-label", `Deux cadrans, ${word}`);
    dialAm.setAttribute("aria-label", `Cadran du matin, de minuit à midi, ${word}`);
    dialPm.setAttribute("aria-label", `Cadran de l'après-midi, de midi à minuit, ${word}`);
    builtKey = "";
    tick();
  }

  document.querySelector(".zones").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    refZone = button.dataset.zone === "paris" ? T.PARIS : userZone;
    document.querySelectorAll(".zones button").forEach((item) => {
      item.setAttribute("aria-pressed", String(item === button));
    });
    applyZone();
  });

  if (new URLSearchParams(location.search).has("selftest")) {
    const pre = document.createElement("pre");
    pre.id = "selftest";
    const result = T.selfTest();
    pre.textContent = `${result.ok ? "PASS" : "FAIL"}\n${result.lines.join("\n")}`;
    document.body.prepend(pre);
  }

  function updateDataNote() {
    const note = document.getElementById("volume-note");
    if (!note) return;
    if (dataset.kind === "real") {
      const when = dataset.fetchedAt ? new Date(dataset.fetchedAt) : null;
      const stamp = when
        ? when.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })
        : "—";
      const missing = model
        ? model.rings.filter((ring) => ring.volumeKind === "unavailable").map((ring) => ring.name)
        : [];
      note.textContent =
        `Volumes réels : dollars échangés sur un ETF de référence de chaque place, ` +
        `séance du ${dataset.sessionDate} (relevé le ${stamp}, source Yahoo Finance). ` +
        `C'est un proxy d'activité en USD, pas le turnover officiel de la bourse.` +
        (missing.length ? ` Sans donnée : ${missing.join(", ")}.` : "");
      note.className = "data-note is-real";
    } else if (dataset.kind === "fallback") {
      note.textContent =
        `Volumes indicatifs : le relevé réel n'a pas pu être chargé (${dataset.error || "erreur inconnue"}). ` +
        `Lancez « node scripts/fetch-market-data.mjs », puis servez le dossier en HTTP.`;
      note.className = "data-note is-fallback";
    } else {
      note.textContent = "Chargement du relevé de volumes…";
      note.className = "data-note";
    }
  }

  async function loadMarketData() {
    try {
      const response = await fetch("data.json", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload || !payload.markets) throw new Error("format data.json inattendu");
      const info = T.applyMarketData(payload);
      dataset = {
        kind: "real",
        sessionDate: info.sessionDate,
        fetchedAt: info.fetchedAt,
        error: null,
      };
    } catch (error) {
      T.resetMarketData();
      dataset = { kind: "fallback", sessionDate: null, fetchedAt: null, error: error.message };
    }
    builtKey = "";
    updateDataNote();
    tick();
  }

  applyZone();
  updateDataNote();
  loadMarketData();
  setInterval(tick, 1000);
})();
