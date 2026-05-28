const STORAGE_KEY = "merch-mockup-voter:v1";
const DB_NAME = "merch-mockup-voter";
const DB_STORE = "state";
const DB_VERSION = 1;
const DESIGN_CATALOG = window.DESIGN_CATALOG || [];

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
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  let type = "";

  if (deltaY < -70 && absY > absX * 0.8) type = "love";
  if (deltaX > 70 && absX >= absY) type = "like";
  if (deltaX < -70 && absX >= absY) type = "reject";

  if (!type) {
    els.voteBadge.className = "vote-badge";
    els.voteBadge.textContent = "";
    return;
  }

  els.voteBadge.textContent = type;
  els.voteBadge.className = `vote-badge show ${type}`;
}

function onPointerDown(event) {
  if (!activeDesign() || event.target === els.designName) return;
  dragStart = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
  };
  els.voteCard.setPointerCapture(event.pointerId);
  els.voteCard.classList.add("dragging");
}

function onPointerMove(event) {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;

  const deltaX = event.clientX - dragStart.x;
  const deltaY = event.clientY - dragStart.y;
  const rotation = deltaX / 18;
  els.voteCard.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${rotation}deg)`;
  updateDragBadge(deltaX, deltaY);
}

function onPointerUp(event) {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;

  const deltaX = event.clientX - dragStart.x;
  const deltaY = event.clientY - dragStart.y;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  dragStart = null;
  els.voteCard.classList.remove("dragging");

  if (deltaY < -110 && absY > absX * 0.8) {
    vote("love");
    return;
  }

  if (deltaX > 110 && absX >= absY) {
    vote("like");
    return;
  }

  if (deltaX < -110 && absX >= absY) {
    vote("reject");
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

loadState()
  .catch((error) => {
    console.error("Could not load voting state", error);
    designs = hydrateDesigns(null);
  })
  .finally(render);
