const STORAGE_KEY = "merch-mockup-voter:v1";
const DB_NAME = "merch-mockup-voter";
const DB_STORE = "state";
const DB_VERSION = 1;
const DEFAULT_DESIGN_CATALOG = [
  { id: "charcoal_foldover_pants", name: "Charcoal Foldover Pants", image: "./mockups/charcoal_foldover_pants.png" },
  { id: "polkadot_white_tank", name: "Polkadot White Tank", image: "./mockups/polkadot_white_tank.png" },
  { id: "sequin_tank", name: "Sequin Tank", image: "./mockups/sequin_tank.png" },
  { id: "mustangbobiscalling_shirt", name: "Mustang Bob Is Calling Shirt", image: "./mockups/mustangbobiscalling_shirt.png" },
  { id: "asij_patchwork_tank", name: "ASIJ Patchwork Tank", image: "./mockups/asij_patchwork_tank.png" },
  { id: "senior_hoodie", name: "Senior Hoodie", image: "./mockups/senior_hoodie.png" },
  { id: "senior_pants", name: "Senior Pants", image: "./mockups/senior_pants.png" },
  { id: "pov_shirt", name: "POV Shirt", image: "./mockups/pov_shirt.png" },
  { id: "AP_exam_survivor_shirt", name: "AP Exam Survivor Shirt", image: "./mockups/AP_exam_survivor_shirt.png" },
  { id: "athleisure_longsleeve", name: "Athleisure Longsleeve", image: "./mockups/athleisure_longsleeve.png" },
];
let DESIGN_CATALOG = [];

let designs = [];
let currentIndex = 0;
let round = 0;
let dragStart = null;
let db = null;

const els = {
  voteCard: document.querySelector("#voteCard"),
  voteBadge: document.querySelector("#voteBadge"),
  mockupImage: document.querySelector("#mockupImage"),
  designName: document.querySelector("#designName"),
  cardPosition: document.querySelector("#cardPosition"),
  emptyState: document.querySelector("#emptyState"),
  deckWrap: document.querySelector(".deck-wrap"),
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

function dbSet(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function loadCatalog() {
  return new Promise((resolve) => {
    const useCatalog = () => {
      DESIGN_CATALOG = Array.isArray(window.DESIGN_CATALOG) && window.DESIGN_CATALOG.length
        ? window.DESIGN_CATALOG
        : DEFAULT_DESIGN_CATALOG;
    };

    const script = document.createElement("script");
    script.src = `./catalog.js?v=${Date.now()}`;
    script.onload = () => {
      useCatalog();
      resolve();
    };
    script.onerror = () => {
      useCatalog();
      console.error("Could not load catalog.js");
      resolve();
    };
    document.head.append(script);
  });
}

async function loadState() {
  db = await openDatabase();
  let saved = await dbGet(STORAGE_KEY);

  if (!saved) {
    const legacyState = localStorage.getItem(STORAGE_KEY);
    saved = legacyState ? JSON.parse(legacyState) : null;
    if (saved) await dbSet(STORAGE_KEY, saved);
  }

  if (!saved) {
    designs = hydrateDesigns(null);
    return;
  }

  try {
    designs = hydrateDesigns(saved);
    currentIndex = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
    round = Number.isInteger(saved.round) ? saved.round : 0;
  } catch {
    designs = hydrateDesigns(null);
    currentIndex = 0;
    round = 0;
  }
}

function hydrateDesigns(saved) {
  const savedById = new Map((saved?.designs || []).map((design) => [design.id, design]));

  return DESIGN_CATALOG.map((catalogDesign) => {
    const previous = savedById.get(catalogDesign.id);
    return {
      id: catalogDesign.id,
      name: catalogDesign.name,
      image: catalogDesign.image,
      votes: previous?.votes || {
        reject: 0,
        like: 0,
        love: 0,
      },
      history: previous?.history || [],
    };
  });
}

async function saveState() {
  if (!db) return;

  try {
    await dbSet(STORAGE_KEY, {
      designs,
      currentIndex,
      round,
    });
  } catch (error) {
    console.error("Could not save voting state", error);
  }
}

function activeDesign() {
  if (!designs.length) return null;
  currentIndex = ((currentIndex % designs.length) + designs.length) % designs.length;
  return designs[currentIndex];
}

function totalVotesFor(design) {
  return design.votes.reject + design.votes.like + design.votes.love;
}

function totalVotes() {
  return designs.reduce((sum, design) => sum + totalVotesFor(design), 0);
}

function scoreFor(design) {
  return design.votes.like + design.votes.love * 3 - design.votes.reject;
}

async function vote(type) {
  const design = activeDesign();
  if (!design) return;

  design.votes[type] += 1;
  design.history.push({
    type,
    at: new Date().toISOString(),
    round: round + 1,
  });

  currentIndex += 1;
  if (currentIndex >= designs.length) {
    currentIndex = 0;
    round += 1;
  }

  await saveState();
  animateVote(type);
}

function animateVote(type) {
  const transforms = {
    reject: "translate3d(-120vw, 40px, 0) rotate(-18deg)",
    like: "translate3d(120vw, 40px, 0) rotate(18deg)",
    love: "translate3d(0, -120vh, 0) rotate(0deg)",
  };

  flashVote(type);
  els.voteBadge.textContent = type;
  els.voteBadge.className = `vote-badge show ${type}`;
  els.voteCard.style.transform = transforms[type];
  els.voteCard.style.opacity = "0";

  window.setTimeout(() => {
    els.voteCard.style.transition = "none";
    els.voteCard.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
    els.voteCard.style.opacity = "1";
    els.voteBadge.className = "vote-badge";
    render();
    requestAnimationFrame(() => {
      els.voteCard.style.transition = "";
    });
  }, 190);
}

function flashVote(type) {
  els.deckWrap.classList.remove("flash", "flash-reject", "flash-like", "flash-love");
  void els.deckWrap.offsetWidth;
  els.deckWrap.classList.add("flash", `flash-${type}`);

  window.setTimeout(() => {
    els.deckWrap.classList.remove("flash", `flash-${type}`);
  }, 520);
}

function renderCard() {
  const design = activeDesign();
  const hasDesigns = Boolean(design);

  els.emptyState.classList.toggle("hidden", hasDesigns);
  els.voteCard.classList.toggle("hidden", !hasDesigns);

  if (!design) return;

  els.mockupImage.src = design.image;
  els.mockupImage.alt = design.name;
  els.designName.textContent = design.name;
  els.cardPosition.textContent = `${currentIndex + 1} / ${designs.length}`;
}

function renderLists() {
}

function render() {
  renderCard();
  renderLists();
}

function updateDragBadge(deltaX, deltaY) {
  const type = getSwipeIntent(deltaX, deltaY, 70);

  if (!type) {
    els.voteBadge.className = "vote-badge";
    els.voteBadge.textContent = "";
    return;
  }

  els.voteBadge.textContent = type;
  els.voteBadge.className = `vote-badge show ${type}`;
}

function getSwipeIntent(deltaX, deltaY, threshold) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (deltaY < -threshold && absY > absX * 0.85) return "love";
  if (deltaX > threshold && absX > absY * 0.75) return "like";
  if (deltaX < -threshold && absX > absY * 0.75) return "reject";
  return "";
}

function getSwipeResult() {
  if (!dragStart) return "";

  const last = dragStart.points.at(-1) || dragStart;
  const deltaX = last.x - dragStart.x;
  const deltaY = last.y - dragStart.y;
  const directIntent = getSwipeIntent(deltaX, deltaY, 110);

  if (directIntent) return directIntent;

  const farthest = dragStart.points.reduce(
    (max, point) => {
      const moveX = point.x - dragStart.x;
      const moveY = point.y - dragStart.y;
      return {
        right: Math.max(max.right, moveX),
        left: Math.min(max.left, moveX),
        up: Math.min(max.up, moveY),
      };
    },
    { right: 0, left: 0, up: 0 },
  );

  const horizontalReach = Math.max(farthest.right, Math.abs(farthest.left));
  const verticalReach = Math.abs(farthest.up);

  if (verticalReach > 145 && verticalReach > horizontalReach * 0.9) return "love";
  if (farthest.right > 145 && farthest.right > Math.abs(farthest.left) * 1.25) return "like";
  if (Math.abs(farthest.left) > 145 && Math.abs(farthest.left) > farthest.right * 1.25) return "reject";

  return "";
}

function onPointerDown(event) {
  if (!activeDesign() || event.target === els.designName) return;
  event.preventDefault();

  dragStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    points: [{ x: event.clientX, y: event.clientY }],
  };
  els.voteCard.setPointerCapture(event.pointerId);
  els.voteCard.classList.add("dragging");
}

function onPointerMove(event) {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  event.preventDefault();

  const deltaX = event.clientX - dragStart.x;
  const deltaY = event.clientY - dragStart.y;
  const rotation = deltaX / 18;
  dragStart.points.push({ x: event.clientX, y: event.clientY });
  els.voteCard.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotation}deg)`;
  updateDragBadge(deltaX, deltaY);
}

function onPointerUp(event) {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;

  event.preventDefault();
  dragStart.points.push({ x: event.clientX, y: event.clientY });
  const result = getSwipeResult();
  dragStart = null;
  els.voteCard.classList.remove("dragging");

  if (result) {
    vote(result);
    return;
  }

  els.voteCard.style.transform = "translate3d(0, 0, 0) rotate(0deg)";
  els.voteBadge.className = "vote-badge";
}

async function resetVotesForAdmin() {
  designs = designs.map((design) => ({
    ...design,
    votes: {
      reject: 0,
      like: 0,
      love: 0,
    },
    history: [],
  }));
  currentIndex = 0;
  round = 0;
  await saveState();
  render();
}

els.voteCard.addEventListener("pointerdown", onPointerDown);
els.voteCard.addEventListener("pointermove", onPointerMove);
els.voteCard.addEventListener("pointerup", onPointerUp);
els.voteCard.addEventListener("pointercancel", onPointerUp);

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") vote("reject");
  if (event.key === "ArrowRight") vote("like");
  if (event.key === "ArrowUp") vote("love");
});

window.merchVotingAdmin = {
  resetVotes: resetVotesForAdmin,
  results: () => ({
    round,
    totalVotes: totalVotes(),
    designs: designs.map(({ id, name, votes, history }) => ({
      id,
      name,
      votes: { ...votes },
      score: scoreFor({ votes }),
      history: [...history],
    })),
  }),
};

loadCatalog()
  .then(loadState)
  .catch((error) => {
    console.error("Could not load voting state", error);
    designs = hydrateDesigns(null);
  })
  .finally(render);
