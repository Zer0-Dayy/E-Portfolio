(() => {
  const explorer = document.querySelector("[data-board-explorer]");
  if (!explorer) return;

  const markers = [...explorer.querySelectorAll(".board-marker")];
  const controls = explorer.querySelector("[data-board-toolbar]");
  const chooser = explorer.querySelector("[data-board-chooser]");
  const select = chooser.querySelector("select");
  const mode = explorer.querySelector("[data-board-mode]");
  const reset = explorer.querySelector("[data-board-reset]");
  const instructions = explorer.querySelector("[data-board-instructions]");
  const imageFrame = explorer.querySelector("[data-board-image]");
  const image = imageFrame.querySelector("img");
  const canvasHost = imageFrame.querySelector("[data-board-canvas]");
  const message = explorer.querySelector("[data-board-message]");
  let viewer = null;
  let in3D = false;

  const groups = [
    ["Controller", 0, 1],
    ["Sensor inputs", 1, 8],
    ["Power, outputs, and service", 8, markers.length],
  ];
  for (const [name, first, end] of groups) {
    const section = document.createElement("optgroup");
    section.label = name;
    for (const marker of markers.slice(first, end)) {
      section.append(new Option(marker.getAttribute("aria-label"), marker.id));
    }
    select.append(section);
  }
  select.value = markers.find((marker) => marker.getAttribute("aria-selected") === "true").id;
  chooser.hidden = false;
  controls.hidden = false;

  explorer.addEventListener("tabchange", (event) => {
    select.value = markers[event.detail].id;
    if (in3D) viewer?.draw();
  });
  select.addEventListener("change", () => document.getElementById(select.value).click());

  function changeView(enabled) {
    in3D = enabled;
    image.hidden = enabled;
    canvasHost.hidden = !enabled;
    reset.hidden = !enabled;
    mode.setAttribute("aria-pressed", String(enabled));
    mode.textContent = "3D view";
    instructions.textContent = enabled ? "Drag or use arrow keys to rotate. Pinch, scroll, or use + and − to zoom." : "Select a marker or choose a component below";
    if (enabled) {
      viewer?.resize();
    } else {
      for (const marker of markers) {
        marker.style.removeProperty("--projected-x");
        marker.style.removeProperty("--projected-y");
        marker.removeAttribute("data-out-of-view");
      }
    }
  }

  mode.addEventListener("click", async () => {
    if (in3D) {
      changeView(false);
      return;
    }
    message.hidden = true;
    if (viewer) {
      changeView(true);
      return;
    }
    if (mode.getAttribute("aria-busy") === "true") return;
    mode.setAttribute("aria-busy", "true");
    mode.textContent = "Loading 3D…";
    try {
      viewer = await window.createPortfolioPcbViewer(canvasHost, markers);
      changeView(true);
    } catch (error) {
      changeView(false);
      message.textContent = "3D preview is unavailable on this device. The top view and component details are available.";
      message.hidden = false;
    } finally {
      mode.removeAttribute("aria-busy");
    }
  });

  reset.addEventListener("click", () => viewer?.reset());
})();
