/* Horaires des bourses, convertis en heure de Paris (Europe/Paris). */
(function (root) {
  const PARIS = "Europe/Paris";

  const MARKETS = [
    {
      id: "asx",
      code: "SYD",
      name: "Sydney",
      fullName: "Australian Securities Exchange",
      timeZone: "Australia/Sydney",
      volume: 4.5,
      color: "#e2b657",
      sessions: [{ start: [10, 0], end: [16, 0], kind: "regular", label: "Séance" }],
    },
    {
      id: "tse",
      code: "TYO",
      name: "Tokyo",
      fullName: "Tokyo Stock Exchange",
      timeZone: "Asia/Tokyo",
      volume: 30,
      color: "#ff6b81",
      sessions: [
        { start: [9, 0], end: [11, 30], kind: "regular", label: "Séance du matin" },
        { start: [12, 30], end: [15, 0], kind: "regular", label: "Séance de l'après-midi" },
      ],
    },
    {
      id: "sse",
      code: "SHA",
      name: "Shanghai",
      fullName: "Shanghai Stock Exchange",
      timeZone: "Asia/Shanghai",
      volume: 80,
      color: "#ff5cab",
      sessions: [
        { start: [9, 30], end: [11, 30], kind: "regular", label: "Séance du matin" },
        { start: [13, 0], end: [15, 0], kind: "regular", label: "Séance de l'après-midi" },
      ],
    },
    {
      id: "hkex",
      code: "HK",
      name: "Hong Kong",
      fullName: "Hong Kong Exchanges",
      timeZone: "Asia/Hong_Kong",
      volume: 20,
      color: "#ff8f4a",
      sessions: [
        { start: [9, 30], end: [12, 0], kind: "regular", label: "Séance du matin" },
        { start: [13, 0], end: [16, 0], kind: "regular", label: "Séance de l'après-midi" },
      ],
    },
    {
      id: "sgx",
      code: "SGX",
      name: "Singapour",
      fullName: "Singapore Exchange",
      timeZone: "Asia/Singapore",
      volume: 1.2,
      color: "#3ddec8",
      sessions: [
        { start: [9, 0], end: [12, 0], kind: "regular", label: "Séance du matin" },
        { start: [13, 0], end: [17, 0], kind: "regular", label: "Séance de l'après-midi" },
      ],
    },
    {
      id: "moex",
      code: "MOW",
      name: "Moscou",
      fullName: "Moscow Exchange",
      timeZone: "Europe/Moscow",
      volume: 1.5,
      color: "#c79bff",
      sessions: [{ start: [9, 50], end: [18, 50], kind: "regular", label: "Séance principale" }],
    },
    {
      id: "par",
      code: "PAR",
      name: "Paris",
      fullName: "Euronext Paris",
      timeZone: "Europe/Paris",
      volume: 8,
      color: "#9aa8ff",
      sessions: [{ start: [9, 0], end: [17, 30], kind: "regular", label: "Séance" }],
    },
    {
      id: "xetra",
      code: "FRA",
      name: "Francfort",
      fullName: "Xetra · Francfort",
      timeZone: "Europe/Berlin",
      volume: 10,
      color: "#e0b48a",
      sessions: [{ start: [9, 0], end: [17, 30], kind: "regular", label: "Séance" }],
    },
    {
      id: "lse",
      code: "LDN",
      name: "Londres",
      fullName: "London Stock Exchange",
      timeZone: "Europe/London",
      volume: 15,
      color: "#6eb6ff",
      sessions: [{ start: [8, 0], end: [16, 30], kind: "regular", label: "Séance" }],
    },
    {
      id: "nasdaq",
      code: "NDQ",
      name: "NASDAQ",
      fullName: "NASDAQ · New York",
      timeZone: "America/New_York",
      volume: 140,
      color: "#3ad7ff",
      sessions: [
        { start: [4, 0], end: [9, 30], kind: "extended", label: "Pré-marché" },
        { start: [9, 30], end: [16, 0], kind: "regular", label: "Séance" },
      ],
    },
    {
      id: "nyse",
      code: "NYSE",
      name: "NYSE",
      fullName: "New York Stock Exchange",
      timeZone: "America/New_York",
      volume: 170,
      color: "#5ee6a0",
      sessions: [{ start: [9, 30], end: [16, 0], kind: "regular", label: "Séance" }],
    },
  ];

  /*
   * Volumes réels. Le script `scripts/fetch-market-data.mjs` produit data.json :
   * pour chaque place, le volume en dollars échangé sur un ETF de référence coté
   * aux États-Unis. C'est un proxy d'activité homogène en USD, pas le turnover
   * officiel de la bourse — l'interface le dit explicitement.
   *
   * Tant que data.json n'est pas chargé (premier rendu, hors-ligne, échec réseau),
   * les volumes indicatifs de MARKETS servent de repli et restent étiquetés comme tels.
   */
  let ACTIVE_MARKETS = MARKETS;

  function applyMarketData(payload) {
    const table = (payload && payload.markets) || {};
    ACTIVE_MARKETS = MARKETS.map((market) => {
      const row = table[market.id];
      const usable = row && Number.isFinite(row.dollarVolume) && row.dollarVolume > 0;
      if (!usable) {
        return {
          ...market,
          volume: null,
          volumeUsd: null,
          volumeKind: "unavailable",
          volumeSource: null,
          volumeSymbol: null,
          volumeSession: null,
          dayChangePct: null,
        };
      }
      return {
        ...market,
        volume: row.dollarVolume / 1e9,
        volumeUsd: row.dollarVolume,
        volumeKind: "real",
        volumeSource: row.instrument || null,
        volumeSymbol: row.symbol || null,
        volumeSession: row.sessionDate || null,
        dayChangePct: Number.isFinite(row.dayChangePct) ? row.dayChangePct : null,
      };
    });
    return {
      sessionDate: payload ? payload.sessionDate : null,
      fetchedAt: payload ? payload.fetchedAt : null,
      markets: ACTIVE_MARKETS,
    };
  }

  function resetMarketData() {
    ACTIVE_MARKETS = MARKETS.map((market) => ({
      ...market,
      volumeUsd: null,
      volumeKind: "indicative",
      volumeSource: null,
      volumeSymbol: null,
      volumeSession: null,
      dayChangePct: null,
    }));
    return ACTIVE_MARKETS;
  }

  resetMarketData();

  function getZonedParts(date, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    const bag = {};
    for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
    let hour = Number(bag.hour);
    if (hour === 24) hour = 0;
    return {
      year: Number(bag.year),
      month: Number(bag.month),
      day: Number(bag.day),
      hour,
      minute: Number(bag.minute),
      second: Number(bag.second),
      weekday: bag.weekday,
    };
  }

  function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    let utc = desired;
    for (let i = 0; i < 4; i += 1) {
      const parts = getZonedParts(new Date(utc), timeZone);
      const got = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
      const diff = got - desired;
      if (diff === 0) return new Date(utc);
      utc -= diff;
    }
    return new Date(utc);
  }

  function addDays(year, month, day, delta) {
    const date = new Date(Date.UTC(year, month - 1, day + delta));
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    };
  }

  function weekdayIndex(year, month, day, timeZone) {
    const noon = zonedTimeToUtc(year, month, day, 12, 0, timeZone);
    const name = getZonedParts(noon, timeZone).weekday;
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[name];
  }

  function zoneWindow(date, timeZone) {
    const parts = getZonedParts(date, timeZone);
    const start = zonedTimeToUtc(parts.year, parts.month, parts.day, 0, 0, timeZone);
    const next = addDays(parts.year, parts.month, parts.day, 1);
    const end = zonedTimeToUtc(next.year, next.month, next.day, 0, 0, timeZone);
    return { start, end, year: parts.year, month: parts.month, day: parts.day };
  }

  function parisWindow(date) {
    return zoneWindow(date, PARIS);
  }

  function fmtMin(mins) {
    const rounded = Math.round(mins);
    const hour = Math.floor(rounded / 60) % 24;
    const minute = ((rounded % 60) + 60) % 60;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }

  function formatVolume(volume) {
    if (!Number.isFinite(volume)) return "n/d";
    const compact = Math.abs(volume) >= 1
      ? new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(volume)
      : new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(volume);
    return `${compact} Md$`;
  }

  /** Formate un montant en dollars avec l'unité la plus lisible. */
  function formatUsd(amount) {
    if (!Number.isFinite(amount)) return "n/d";
    const abs = Math.abs(amount);
    if (abs >= 1e9) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount / 1e9)} Md$`;
    if (abs >= 1e6) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(amount / 1e6)} M$`;
    if (abs >= 1e3) return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount / 1e3)} k$`;
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} $`;
  }

  function seasonInfo(date, timeZone = PARIS) {
    const parts = getZonedParts(date, timeZone);
    const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offsetMin = Math.round((asUtc - date.getTime()) / 60000);
    const summer = offsetMin >= 120;
    const sign = offsetMin >= 0 ? "+" : "";
    return {
      summer,
      offsetMin,
      name: summer ? "Heure d'été" : "Heure d'hiver",
      abbr: summer ? "CEST" : "CET",
      utc: `UTC${sign}${offsetMin / 60}`,
    };
  }

  function zoneMessage(userZone) {
    if (userZone === PARIS) {
      return "Vous êtes à Paris. Les cadrans suivent votre heure.";
    }
    return `Les cadrans sont en heure de Paris. Votre appareil est réglé sur ${userZone}.`;
  }

  function userZone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  function layoutRings(markets) {
    const usable = markets.filter((market) => Number.isFinite(market.volume) && market.volume > 0);
    const logs = usable.map((market) => Math.log(market.volume));
    const lo = logs.length ? Math.min(...logs) : 0;
    const hi = logs.length ? Math.max(...logs) : 1;
    const gap = 8;
    let cursor = 88;
    const placed = markets
      .slice()
      .sort((a, b) => {
        const av = Number.isFinite(a.volume) && a.volume > 0 ? a.volume : -Infinity;
        const bv = Number.isFinite(b.volume) && b.volume > 0 ? b.volume : -Infinity;
        return av - bv;
      })
      .map((market) => {
        const known = Number.isFinite(market.volume) && market.volume > 0;
        const weight = !known ? 0 : (hi === lo ? 1 : (Math.log(market.volume) - lo) / (hi - lo));
        // Plancher à 8 px : en dessous, l'étiquette du code devient illisible
        // quand plusieurs anneaux fins se suivent près du centre.
        const stroke = 8 + weight * 18;
        const radius = cursor + stroke / 2;
        cursor += stroke + gap;
        return { ...market, weight, stroke, radius };
      });
    return { rings: placed, outerEdge: cursor - gap };
  }

  function sessionsOnZoneDay(market, date, timeZone) {
    const window = zoneWindow(date, timeZone);
    const seen = new Set();
    const sessions = [];
    for (let delta = -1; delta <= 1; delta += 1) {
      const local = addDays(window.year, window.month, window.day, delta);
      if (weekdayIndex(local.year, local.month, local.day, market.timeZone) % 6 === 0) continue;
      for (const session of market.sessions) {
        const open = zonedTimeToUtc(
          local.year,
          local.month,
          local.day,
          session.start[0],
          session.start[1],
          market.timeZone,
        );
        let close = zonedTimeToUtc(
          local.year,
          local.month,
          local.day,
          session.end[0],
          session.end[1],
          market.timeZone,
        );
        if (close <= open) {
          const next = addDays(local.year, local.month, local.day, 1);
          close = zonedTimeToUtc(next.year, next.month, next.day, session.end[0], session.end[1], market.timeZone);
        }
        const key = `${open.getTime()}|${session.kind}|${session.label}`;
        if (seen.has(key)) continue;
        const clipStart = Math.max(open.getTime(), window.start.getTime());
        const clipEnd = Math.min(close.getTime(), window.end.getTime());
        if (clipEnd - clipStart < 60 * 1000) continue;
        seen.add(key);
        sessions.push({
          startMin: (clipStart - window.start.getTime()) / 60000,
          endMin: (clipEnd - window.start.getTime()) / 60000,
          kind: session.kind,
          label: session.label,
          openUtc: open.getTime(),
          closeUtc: close.getTime(),
        });
      }
    }
    sessions.sort((a, b) => a.startMin - b.startMin);
    return sessions;
  }

  function splitDial(startMin, endMin) {
    const segments = [];
    const morningEnd = Math.min(720, endMin);
    const morningStart = Math.max(0, startMin);
    if (morningEnd - morningStart > 0.4) {
      segments.push({ dial: "am", start: morningStart, end: morningEnd });
    }
    const eveningEnd = Math.min(1440, endMin);
    const eveningStart = Math.max(720, startMin);
    if (eveningEnd - eveningStart > 0.4) {
      segments.push({ dial: "pm", start: eveningStart - 720, end: eveningEnd - 720 });
    }
    return segments;
  }

  function formatSessions(sessions) {
    if (!sessions.length) return "Aucune séance aujourd'hui";
    return sessions
      .map((session) => {
        const range = `${fmtMin(session.startMin)}–${fmtMin(session.endMin)}`;
        return session.kind === "extended" ? `${session.label} ${range}` : range;
      })
      .join(" · ");
  }

  function localWeekday(date, timeZone) {
    const parts = getZonedParts(date, timeZone);
    return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[parts.weekday];
  }

  function buildModel(date, refZone = PARIS) {
    const laid = layoutRings(ACTIVE_MARKETS);
    const rings = laid.rings.map((market) => {
      const sessions = sessionsOnZoneDay(market, date, refZone);
      const weekend = localWeekday(date, market.timeZone) % 6 === 0;
      return {
        ...market,
        sessions,
        hoursLabel: formatSessions(sessions),
        closedLabel: weekend ? "Week-end" : "Fermé",
      };
    });
    return { rings, outerEdge: laid.outerEdge, season: seasonInfo(date, refZone), window: zoneWindow(date, refZone), refZone };
  }

  function parisDateKey(date, timeZone = PARIS) {
    const parts = getZonedParts(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  function formatParisDate(date, timeZone = PARIS) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function formatClock(date, timeZone, withSeconds) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      second: withSeconds ? "2-digit" : undefined,
      hourCycle: "h23",
    }).format(date);
  }

  function pointOnDial(cx, cy, radius, dialMinutes) {
    const angle = (dialMinutes / 720) * Math.PI * 2 - Math.PI / 2;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  }

  function arcPath(cx, cy, radius, startMin, endMin) {
    const span = endMin - startMin;
    if (span <= 0.4) return "";
    const start = pointOnDial(cx, cy, radius, startMin);
    if (span >= 719) {
      const mid = pointOnDial(cx, cy, radius, startMin + 360);
      return `M ${start[0]} ${start[1]} A ${radius} ${radius} 0 1 1 ${mid[0]} ${mid[1]} A ${radius} ${radius} 0 1 1 ${start[0]} ${start[1]}`;
    }
    const end = pointOnDial(cx, cy, radius, endMin);
    const large = span > 360 ? 1 : 0;
    return `M ${start[0]} ${start[1]} A ${radius} ${radius} 0 ${large} 1 ${end[0]} ${end[1]}`;
  }

  function nyNote(refZone = PARIS) {
    const winter = buildModel(new Date("2026-01-15T12:00:00Z"), refZone).rings.find((ring) => ring.id === "nyse");
    const summer = buildModel(new Date("2026-07-15T12:00:00Z"), refZone).rings.find((ring) => ring.id === "nyse");
    const march = buildModel(new Date("2026-03-12T12:00:00Z"), refZone).rings.find((ring) => ring.id === "nyse");
    const one = (ring) => formatSessions(ring.sessions.filter((session) => session.kind === "regular"));
    return `New York ouvre à ${one(winter).slice(0, 5)} en hiver et en été, et à ${one(march).slice(0, 5)} du 9 au 29 mars, quand les États-Unis sont déjà passés à l'heure d'été.`;
  }

  function rangesOf(date, id) {
    const ring = buildModel(date).rings.find((item) => item.id === id);
    return ring.sessions.map((session) => `${fmtMin(session.startMin)}-${fmtMin(session.endMin)}:${session.kind}`).join(",");
  }

  function selfTest() {
    const lines = [];
    let ok = true;
    // Le self-test valide le modèle de référence (volumes indicatifs), pas les
    // données chargées depuis data.json : on isole donc l'état courant.
    const savedMarkets = ACTIVE_MARKETS;
    resetMarketData();
    function check(name, cond) {
      if (!cond) ok = false;
      lines.push(`${cond ? "OK" : "FAIL"}  ${name}`);
    }

    const winter = new Date("2026-01-15T12:00:00Z");
    const summer = new Date("2026-07-15T10:00:00Z");
    const march = new Date("2026-03-12T12:00:00Z");
    const today = new Date("2026-10-22T12:00:00Z");
    const saturday = new Date("2026-10-24T12:00:00Z");

    check("hiver NYSE 15:30-22:00", rangesOf(winter, "nyse") === "15:30-22:00:regular");
    check("été NYSE 15:30-22:00", rangesOf(summer, "nyse") === "15:30-22:00:regular");
    check("mars NYSE 14:30-21:00", rangesOf(march, "nyse") === "14:30-21:00:regular");
    check("22 oct NYSE 15:30-22:00", rangesOf(today, "nyse") === "15:30-22:00:regular");
    check(
      "hiver NASDAQ pré-marché puis séance",
      rangesOf(winter, "nasdaq") === "10:00-15:30:extended,15:30-22:00:regular",
    );
    check(
      "mars NASDAQ 09:00-14:30 puis 14:30-21:00",
      rangesOf(march, "nasdaq") === "09:00-14:30:extended,14:30-21:00:regular",
    );
    check("hiver Hong Kong 02:30", rangesOf(winter, "hkex") === "02:30-05:00:regular,06:00-09:00:regular");
    check("été Hong Kong 03:30", rangesOf(summer, "hkex") === "03:30-06:00:regular,07:00-10:00:regular");
    check("hiver Shanghai 02:30", rangesOf(winter, "sse") === "02:30-04:30:regular,06:00-08:00:regular");
    check("été Shanghai 03:30", rangesOf(summer, "sse") === "03:30-05:30:regular,07:00-09:00:regular");
    check("hiver Tokyo 01:00", rangesOf(winter, "tse") === "01:00-03:30:regular,04:30-07:00:regular");
    check("été Tokyo 02:00", rangesOf(summer, "tse") === "02:00-04:30:regular,05:30-08:00:regular");
    check("hiver Sydney 00:00-06:00", rangesOf(winter, "asx") === "00:00-06:00:regular");
    check("été Sydney 02:00-08:00", rangesOf(summer, "asx") === "02:00-08:00:regular");
    check("22 oct Sydney 01:00-07:00", rangesOf(today, "asx") === "01:00-07:00:regular");
    check("hiver Londres 09:00-17:30", rangesOf(winter, "lse") === "09:00-17:30:regular");
    check("été Londres 09:00-17:30", rangesOf(summer, "lse") === "09:00-17:30:regular");
    check("hiver Paris 09:00-17:30", rangesOf(winter, "par") === "09:00-17:30:regular");
    check("hiver Singapour", rangesOf(winter, "sgx") === "02:00-05:00:regular,06:00-10:00:regular");
    check("hiver Moscou 07:50-16:50", rangesOf(winter, "moex") === "07:50-16:50:regular");
    check("samedi Londres fermé", rangesOf(saturday, "lse") === "");
    check("Londres coupe les deux cadrans", splitDial(9 * 60, 17 * 60 + 30).length === 2);

    const nyWinter = zonedTimeToUtc(2026, 1, 15, 9, 30, "America/New_York");
    check("9:30 EST = 14:30 UTC", nyWinter.toISOString() === "2026-01-15T14:30:00.000Z");
    const parisWinter = getZonedParts(nyWinter, PARIS);
    check("9:30 EST = 15:30 Paris", parisWinter.hour === 15 && parisWinter.minute === 30);

    const nyMarch = zonedTimeToUtc(2026, 3, 12, 9, 30, "America/New_York");
    check("9:30 EDT en mars = 13:30 UTC", nyMarch.toISOString() === "2026-03-12T13:30:00.000Z");
    const parisMarch = getZonedParts(nyMarch, PARIS);
    check("9:30 EDT en mars = 14:30 Paris", parisMarch.hour === 14 && parisMarch.minute === 30);

    const model = buildModel(winter);
    const byVolume = model.rings.slice().sort((a, b) => a.radius - b.radius);
    check("Singapour est l'anneau intérieur", byVolume[0].id === "sgx");
    check("NYSE est l'anneau extérieur", byVolume[byVolume.length - 1].id === "nyse");
    check("NYSE plus épais que Sydney", model.rings.find((r) => r.id === "nyse").stroke > model.rings.find((r) => r.id === "asx").stroke);
    check("les anneaux ne se chevauchent pas", byVolume.every((ring, index) => {
      if (index === 0) return true;
      const prev = byVolume[index - 1];
      return ring.radius - ring.stroke / 2 >= prev.radius + prev.stroke / 2 - 0.01;
    }));
    check("message Paris", zoneMessage(PARIS).includes("Vous êtes à Paris"));
    check("message autre fuseau", zoneMessage("Asia/Tokyo").includes("heure de Paris"));
    check("saison hiver", seasonInfo(winter).name === "Heure d'hiver");
    check("saison été", seasonInfo(summer).name === "Heure d'été");
    check("note New York", nyNote().includes("14:30") && nyNote().includes("15:30"));

    ACTIVE_MARKETS = savedMarkets;
    return { ok, lines };
  }

  const api = {
    PARIS,
    MARKETS,
    getZonedParts,
    zonedTimeToUtc,
    buildModel,
    applyMarketData,
    resetMarketData,
    splitDial,
    fmtMin,
    formatVolume,
    formatUsd,
    formatSessions,
    seasonInfo,
    zoneMessage,
    userZone,
    parisDateKey,
    formatParisDate,
    formatClock,
    pointOnDial,
    arcPath,
    nyNote,
    selfTest,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.MarketTime = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
