(function (global) {
  function cloneParticipant(participant) {
    return {
      ...participant,
      links: participant.links ? { ...participant.links } : undefined,
    };
  }

  function canonicalizeName(name, nicknameMap) {
    const trimmed = String(name || "").trim();
    return (nicknameMap && nicknameMap[trimmed]) || trimmed;
  }

  function normalizeFrequency(value) {
    const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, "");
    if (!raw) return "2주1회";
    if (raw.includes("2주") || raw.includes("격주") || raw.includes("biweek")) {
      return "2주1회";
    }
    return "주1회";
  }

  function mergeParticipantsFromSurvey(existingParticipants, surveyData, nicknameMap) {
    const merged = new Map(
      (existingParticipants || []).map((p) => {
        const canonicalName = canonicalizeName(p.name, nicknameMap);
        return [canonicalName, { ...cloneParticipant(p), name: canonicalName }];
      })
    );
    const memberLinks = {};

    for (const participant of existingParticipants || []) {
      const canonicalName = canonicalizeName(participant.name, nicknameMap);
      if (participant.links) {
        memberLinks[canonicalName] = { ...participant.links };
      }
    }

    for (const participant of surveyData || []) {
      const name = canonicalizeName(participant?.name, nicknameMap);
      if (!name) continue;

      const existing = merged.get(name) || { name, freq: "2주1회" };
      const links = { ...(existing.links || {}), ...(participant.links || {}) };
      const next = {
        ...existing,
        name,
        freq: normalizeFrequency(participant.frequency || existing.freq),
      };

      if (Object.keys(links).length > 0) {
        next.links = links;
        memberLinks[name] = { ...links };
      }

      merged.set(name, next);
    }

    return {
      participants: Array.from(merged.values()),
      memberLinks,
    };
  }

  function mergeSurveyProfiles(surveyData, memberLinks, nicknameMap) {
    const merged = new Map();

    for (const participant of surveyData || []) {
      const name = canonicalizeName(participant?.name, nicknameMap);
      if (!name) continue;

      const existing = merged.get(name) || {
        name,
        topic: "",
        platforms: "",
        frequency: "",
        goal: "",
        kpi: "",
        links: {},
      };

      merged.set(name, {
        ...existing,
        name,
        topic: existing.topic || participant.topic || "",
        platforms: existing.platforms || participant.platforms || "",
        frequency: existing.frequency || participant.frequency || "",
        goal: existing.goal || participant.goal || "",
        kpi: existing.kpi || participant.kpi || "",
        links: {
          ...(memberLinks?.[name] || {}),
          ...(existing.links || {}),
          ...(participant.links || {}),
        },
      });
    }

    return Array.from(merged.values());
  }

  const api = {
    canonicalizeName,
    normalizeFrequency,
    mergeParticipantsFromSurvey,
    mergeSurveyProfiles,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  global.DashboardData = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
