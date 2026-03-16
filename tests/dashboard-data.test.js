const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canonicalizeName,
  normalizeFrequency,
  mergeParticipantsFromSurvey,
  mergeSurveyProfiles,
} = require("../web/dashboard-data.js");

test("canonicalizeName maps aliases through nickname map", () => {
  assert.equal(canonicalizeName("소진", { 소진: "김소진" }), "김소진");
  assert.equal(canonicalizeName("김소진", { 소진: "김소진" }), "김소진");
});

test("normalizeFrequency maps weekly and biweekly inputs", () => {
  assert.equal(normalizeFrequency("주1회"), "주1회");
  assert.equal(normalizeFrequency("2주 1회"), "2주1회");
  assert.equal(normalizeFrequency("격주"), "2주1회");
  assert.equal(normalizeFrequency(""), "2주1회");
});

test("mergeParticipantsFromSurvey adds new survey participants", () => {
  const result = mergeParticipantsFromSurvey(
    [{ name: "기존", freq: "주1회" }],
    [{ name: "신규", frequency: "주1회", links: { LinkedIn: "https://example.com/new" } }]
  );

  assert.deepEqual(
    result.participants.map((p) => ({ name: p.name, freq: p.freq })).sort((a, b) => a.name.localeCompare(b.name)),
    [
      { name: "기존", freq: "주1회" },
      { name: "신규", freq: "주1회" },
    ]
  );
  assert.equal(result.memberLinks["신규"].LinkedIn, "https://example.com/new");
});

test("mergeParticipantsFromSurvey updates frequency and merges links for existing members", () => {
  const result = mergeParticipantsFromSurvey(
    [{ name: "기존", freq: "주1회", links: { Blog: "https://example.com/blog" } }],
    [{ name: "기존", frequency: "격주", links: { LinkedIn: "https://example.com/in" } }]
  );

  assert.equal(result.participants.length, 1);
  assert.equal(result.participants[0].freq, "2주1회");
  assert.deepEqual(result.participants[0].links, {
    Blog: "https://example.com/blog",
    LinkedIn: "https://example.com/in",
  });
  assert.deepEqual(result.memberLinks["기존"], {
    Blog: "https://example.com/blog",
    LinkedIn: "https://example.com/in",
  });
});

test("mergeParticipantsFromSurvey ignores blank survey names", () => {
  const result = mergeParticipantsFromSurvey([], [{ name: "   ", frequency: "주1회" }]);

  assert.deepEqual(result.participants, []);
  assert.deepEqual(result.memberLinks, {});
});

test("mergeParticipantsFromSurvey merges alias and real name into one participant", () => {
  const result = mergeParticipantsFromSurvey(
    [{ name: "김소진", freq: "주1회" }],
    [{ name: "소진", frequency: "주1회", links: { Instagram: "https://example.com/sojin" } }],
    { 소진: "김소진" }
  );

  assert.equal(result.participants.length, 1);
  assert.equal(result.participants[0].name, "김소진");
  assert.deepEqual(result.memberLinks["김소진"], {
    Instagram: "https://example.com/sojin",
  });
});

test("mergeSurveyProfiles merges alias and real name cards into one profile", () => {
  const result = mergeSurveyProfiles(
    [
      { name: "김소진", topic: "A", platforms: "LinkedIn", frequency: "주1회", kpi: "1", links: { LinkedIn: "https://example.com/in" } },
      { name: "소진", topic: "B", platforms: "Instagram", frequency: "주1회", kpi: "2", links: { Instagram: "https://example.com/ig" } },
    ],
    {},
    { 소진: "김소진" }
  );

  assert.equal(result.length, 1);
  assert.equal(result[0].name, "김소진");
  assert.deepEqual(result[0].links, {
    LinkedIn: "https://example.com/in",
    Instagram: "https://example.com/ig",
  });
});
