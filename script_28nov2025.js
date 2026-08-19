let sections = [];
let currentIndex = 0;
let isTransitioning = false;
let scrollAccumulator = 0;

let lastSwitchTime = 0;          // last time a section switch happened
let lastWheelTime = 0;           // last wheel event timestamp
let lastScrollInputTime = 0;     // time of last meaningful scroll/touch
let interactionLockedUntil = 0;  // dead zone: ignore input until this time

let touchStartY = null;

// Tuning constants (medium strict)
const SCROLL_THRESHOLD = 800;
const SWITCH_COOLDOWN = 1;
const DEAD_ZONE = 500;
const FRESH_SCROLL_GAP = 500;
const SWIPE_THRESHOLD = 200;
const TRANSITION_DURATION = 450;

// NEW: Accumulator expires after 500ms
const ACCUMULATOR_TIMEOUT = 500;

document.addEventListener("DOMContentLoaded", () => {
  const body = document.body;
  const toggle = document.getElementById("themeToggle");

  /* THEME */
  const savedTheme = localStorage.getItem("theme") || "dark";
  body.setAttribute("data-theme", savedTheme);

  toggle?.addEventListener("click", () => {
    const next = body.getAttribute("data-theme") === "light" ? "dark" : "light";
    body.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  });

  const contentArea = document.getElementById("contentArea");
  sections = Array.from(document.querySelectorAll(".section"));
  currentIndex = sections.findIndex(s => s.classList.contains("active"));
  if (currentIndex === -1) currentIndex = 0;

  /* NAV HIGHLIGHT */
  function updateNavHighlight() {
    const btns = document.querySelectorAll(".nav button");
    const id = sections[currentIndex]?.id;
    btns.forEach(btn => btn.classList.toggle("active", btn.dataset.section === id));
  }
  updateNavHighlight();

  /* SCROLLABLE DETECTION */
  function isScrollable(el) {
    const style = window.getComputedStyle(el);
    return (
      (style.overflowY === "auto" || style.overflowY === "scroll") &&
      el.scrollHeight > el.clientHeight
    );
  }

  function findScrollableAncestor(el) {
    while (el && el !== document.body) {
      if (isScrollable(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  /* =========================================================
      WHEEL SCROLL — SINGLE SNAP & ACCUMULATOR TIMEOUT
     ========================================================= */

  contentArea?.addEventListener("wheel", (event) => {
    const now = Date.now();

    // Dead zone: ignore everything
    if (isTransitioning || now < interactionLockedUntil) {
      event.preventDefault();
      return;
    }

    // Cooldown: ignore
    if (now - lastSwitchTime < SWITCH_COOLDOWN) {
      event.preventDefault();
      return;
    }

    const scrollable = findScrollableAncestor(event.target);

    // Allow inner scroll if it can scroll more
    if (scrollable) {
      const { scrollTop, scrollHeight, clientHeight } = scrollable;
      if (event.deltaY > 0 && scrollTop + clientHeight < scrollHeight - 1) return;
      if (event.deltaY < 0 && scrollTop > 1) return;
    }

    // Prevent outer scroll default
    if (!scrollable) event.preventDefault();

    /* NEW: If last scroll input is too old → discard accumulator */
    if (now - lastScrollInputTime > ACCUMULATOR_TIMEOUT) {
      scrollAccumulator = 0;
    }
    lastScrollInputTime = now;

    /* Fresh scroll detection */
    if (now - lastWheelTime > FRESH_SCROLL_GAP) {
      scrollAccumulator = 0;
    }
    lastWheelTime = now;

    scrollAccumulator += event.deltaY;

    /* Check for snap */
    if (scrollAccumulator > SCROLL_THRESHOLD) {
      goToIndex(currentIndex + 1);
    } else if (scrollAccumulator < -SCROLL_THRESHOLD) {
      goToIndex(currentIndex - 1);
    }

  }, { passive: false });


  /* =========================================================
      TOUCH — SINGLE SNAP + DEAD ZONE + ACCUMULATOR EXPIRY
     ========================================================= */

  contentArea?.addEventListener("touchstart", e => {
    const now = Date.now();
    if (isTransitioning || now < interactionLockedUntil) return;
    if (now - lastSwitchTime < SWITCH_COOLDOWN) return;

    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  contentArea?.addEventListener("touchend", e => {
    const now = Date.now();
    if (isTransitioning || now < interactionLockedUntil) return;
    if (!touchStartY) return;
    if (now - lastSwitchTime < SWITCH_COOLDOWN) return;

    const deltaY = touchStartY - e.changedTouches[0].clientY;

    /* Reset accumulator on delayed swipe */
    if (now - lastScrollInputTime > ACCUMULATOR_TIMEOUT) {
      scrollAccumulator = 0;
    }
    lastScrollInputTime = now;

    if (deltaY > SWIPE_THRESHOLD) {
      goToIndex(currentIndex + 1);
    } else if (deltaY < -SWIPE_THRESHOLD) {
      goToIndex(currentIndex - 1);
    }

    touchStartY = null;
  }, { passive: true });


  /* =========================================================
      SECTION SWITCHING
     ========================================================= */

  function goToIndex(newIndex) {
    if (newIndex < 0 || newIndex >= sections.length) return;
    if (newIndex === currentIndex) return;

    const now = Date.now();

    isTransitioning = true;
    lastSwitchTime = now;
    interactionLockedUntil = now + DEAD_ZONE;

    /* Full reset of scroll memory */
    scrollAccumulator = 0;
    lastWheelTime = now;
    lastScrollInputTime = now;
    touchStartY = null;

    sections[currentIndex].classList.remove("active");
    sections[newIndex].classList.add("active");

    currentIndex = newIndex;
    updateNavHighlight();

    setTimeout(() => {
      isTransitioning = false;
      scrollAccumulator = 0;
    }, TRANSITION_DURATION);
  }


  /* NAV BUTTON SUPPORT */
  window.showSection = (id) => {
    const idx = sections.findIndex(s => s.id === id);
    if (idx === -1 || idx === currentIndex) return;

    const now = Date.now();
    if (isTransitioning || now < interactionLockedUntil) return;
    if (now - lastSwitchTime < SWITCH_COOLDOWN) return;

    goToIndex(idx);
  };

});
