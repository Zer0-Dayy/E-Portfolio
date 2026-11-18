function setUpTabs(group) {
  const tabList = group.querySelector("[data-tab-list]");
  const tabs = [...tabList.querySelectorAll("[role=tab]")];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
  const playButton = group.querySelector("[data-flow-play]");
  const playLabel = playButton?.querySelector("[data-play-label]");
  const status = group.querySelector("[data-flow-status]");
  const lastIndex = tabs.length - 1;
  let selectedIndex = 0;
  let playback = null;

  function updatePlayButton() {
    const playing = playback !== null;
    playButton.classList.toggle("is-playing", playing);
    if (playing) {
      playLabel.textContent = "Pause";
    } else {
      playLabel.textContent = selectedIndex === lastIndex ? "Replay steps" : "Play steps";
    }
  }

  function selectTab(index, announce = false) {
    selectedIndex = index;
    for (const [position, tab] of tabs.entries()) {
      const selected = position === index;
      tab.tabIndex = selected ? 0 : -1;
      tab.setAttribute("aria-selected", String(selected));
      panels[position].hidden = !selected;
      if (playButton) tab.classList.toggle("is-passed", position < index);
    }

    if (playButton) {
      tabList.style.setProperty("--flow-fill", (100 * index / tabs.length) + "%");
      status.textContent = announce ? "Step " + (index + 1) + " of " + tabs.length + ". " + tabs[index].textContent : "";
      updatePlayButton();
    }

    group.dispatchEvent(new CustomEvent("tabchange", { detail: index }));
  }

  function stopPlayback() {
    if (playback === null) return;
    window.clearTimeout(playback);
    playback = null;
    updatePlayButton();
  }

  for (const [index, tab] of tabs.entries()) {
    panels[index].setAttribute("role", "tabpanel");
    panels[index].tabIndex = 0;
    tab.addEventListener("click", () => {
      stopPlayback();
      selectTab(index);
    });
  }

  tabList.addEventListener("keydown", (event) => {
    let nextIndex;
    switch (event.key) {
      case "ArrowLeft": nextIndex = (selectedIndex + lastIndex) % tabs.length; break;
      case "ArrowRight": nextIndex = (selectedIndex + 1) % tabs.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = lastIndex; break;
      default: return;
    }
    event.preventDefault();
    stopPlayback();
    selectTab(nextIndex);
    if (tabs[nextIndex].hasAttribute("data-out-of-view")) {
      group.querySelector("[data-board-select]")?.focus();
    } else {
      tabs[nextIndex].focus();
    }
  });

  // Only the two process diagrams have timed playback.
  if (playButton) {
    tabList.style.setProperty("--step-count", tabs.length);
    tabList.addEventListener("focusin", stopPlayback);
    window.addEventListener("hashchange", stopPlayback);
    window.addEventListener("pagehide", stopPlayback);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) stopPlayback();
    });

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(([entry]) => {
        if (!entry.isIntersecting) stopPlayback();
      });
      observer.observe(group);
    }

    function queueNextStep() {
      const words = panels[selectedIndex].textContent.trim().split(/\s+/).length;
      const readingTime = Math.min(10500, Math.max(4400, 900 + words * 250));
      playback = window.setTimeout(() => {
        selectTab(selectedIndex + 1, true);
        if (selectedIndex === lastIndex) stopPlayback();
        else queueNextStep();
      }, readingTime);
      updatePlayButton();
    }

    playButton.addEventListener("click", () => {
      if (playback !== null) {
        stopPlayback();
        return;
      }
      selectTab(selectedIndex === lastIndex ? 0 : selectedIndex, true);
      queueNextStep();
    });
    playButton.hidden = false;
  }

  selectTab(0);
  tabList.hidden = false;
  group.dataset.ready = "";
}

function setUpPhotoWalkthrough(walkthrough) {
  const flow = walkthrough.querySelector("[data-tabs]");
  const parts = flow.querySelectorAll("[data-part]");
  const probe = walkthrough.querySelector("[data-locker-probe]");
  flow.addEventListener("tabchange", ({ detail }) => {
    const { part, x, y } = parts[detail].dataset;
    if (probe.textContent === part) return;
    probe.style.left = x;
    probe.style.top = y;
    const label = document.createElement("span");
    label.textContent = part;
    probe.replaceChildren(label);
    probe.hidden = false;
  });
}

document.querySelectorAll(".locker-walkthrough").forEach(setUpPhotoWalkthrough);
document.querySelectorAll("[data-tabs]").forEach(setUpTabs);

function setUpProjectIndex(nav) {
  const links = [...nav.querySelectorAll(".project-index-links a")];
  const sections = links.map(link => document.getElementById(link.hash.slice(1)));
  const picker = nav.querySelector(".project-picker");
  const select = picker.querySelector("select");
  for (const link of links) select.add(new Option(link.querySelector("strong").textContent, link.hash));
  picker.hidden = false;
  select.addEventListener("change", () => {
    if (location.hash !== select.value) {
      location.hash = select.value;
    } else {
      const section = document.getElementById(select.value.slice(1));
      section.focus({ preventScroll: true });
      section.scrollIntoView();
    }
  });

  let pending = false;
  let current = -1;
  function markCurrent() {
    pending = false;
    if (!nav.getClientRects().length) return;
    const threshold = nav.getBoundingClientRect().bottom + Math.min(85, window.innerHeight * 0.12);
    let active = 0;
    for (let i = 1; i < sections.length; i++) {
      if (sections[i].getBoundingClientRect().top <= threshold) active = i;
    }
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) active = sections.length - 1;
    if (active === current) return;
    current = active;
    for (const [i, link] of links.entries()) {
      if (i === active) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    }
    select.value = links[active].hash;
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(markCurrent);
  }
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  window.addEventListener("hashchange", schedule);
  window.addEventListener("pageshow", schedule);
  schedule();
}

document.querySelectorAll(".project-nav").forEach(setUpProjectIndex);

for (const button of document.querySelectorAll("[data-print-cv]")) {
  button.hidden = false;
  button.addEventListener("click", () => window.print());
}
