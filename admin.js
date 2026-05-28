const STORAGE_KEY = "merch-mockup-voter:v1";
const DB_NAME = "merch-mockup-voter";
const DB_STORE = "state";
const DB_VERSION = 1;
const DESIGN_CATALOG = window.DESIGN_CATALOG || [];

let db = null;
let state = {
  designs: [],
  currentIndex: 0,
  round: 0,
};

const els = {
  totalVotes: document.querySelector("#totalVotes"),
  roundCount: document.querySelector("#roundCount"),
  resultsList: document.querySelector("#resultsList"),
  exportResults: document.querySelector("#exportResults"),
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const request = tx.objectStore(DB_STORE).get(key);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function hydrateDesigns(saved) {
  const savedById = new Map((saved?.designs || []).map((design) => [design.id, design]));

  return DESIGN_CATALOG.map((catalogDesign) => {
    const previous = savedById.get(catalogDesign.id);
    return {
      id: catalogDesign.id,
      name: catalogDesign.name,
      votes: previous?.votes || {
        reject: 0,
        like: 0,
        love: 0,
      },
      history: previous?.history || [],
    };
  });
}

function totalVotesFor(design) {
  return design.votes.reject + design.votes.like + design.votes.love;
}

function totalVotes() {
  return state.designs.reduce((sum, design) => sum + totalVotesFor(design), 0);
}

function scoreFor(design) {
  return design.votes.like + design.votes.love * 3 - design.votes.reject;
}

function render() {
  els.totalVotes.textContent = totalVotes();
  els.roundCount.textContent = state.round;

  const sorted = [...state.designs].sort((a, b) => scoreFor(b) - scoreFor(a));
  els.resultsList.replaceChildren(
    ...sorted.map((design) => {
      const row = document.createElement("div");
      row.className = "result-row";

      const text = document.createElement("div");
      text.className = "row-text";

      const name = document.createElement("strong");
      name.textContent = design.name;

      const meta = document.createElement("p");
      meta.textContent = `Score ${scoreFor(design)} - ${totalVotesFor(design)} total votes`;

      const pills = document.createElement("div");
      pills.className = "score-pills";
      ["reject", "like", "love"].forEach((type) => {
        const pill = document.createElement("span");
        pill.className = `pill ${type}`;
        pill.textContent = `${type[0].toUpperCase()} ${design.votes[type]}`;
        pills.append(pill);
      });

      text.append(name, meta);
      row.append(text, pills);
      return row;
    }),
  );
}

function exportResults() {
  const payload = {
    exportedAt: new Date().toISOString(),
    round: state.round,
    totalVotes: totalVotes(),
    designs: state.designs.map(({ id, name, votes, history }) => ({
      id,
      name,
      votes,
      score: scoreFor({ votes }),
      history,
    })),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "merch-voting-results.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function init() {
  db = await openDatabase();
  const saved = await dbGet(STORAGE_KEY);
  state = {
    designs: hydrateDesigns(saved),
    currentIndex: saved?.currentIndex || 0,
    round: saved?.round || 0,
  };
  render();
}

els.exportResults.addEventListener("click", exportResults);

init().catch((error) => {
  console.error("Could not load voting results", error);
  state.designs = hydrateDesigns(null);
  render();
});
