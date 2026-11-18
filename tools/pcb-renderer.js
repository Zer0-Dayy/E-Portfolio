import {
  Box3, DirectionalLight, FrontSide, HemisphereLight, OrthographicCamera,
  Scene, Spherical, Vector3, WebGLRenderer,
} from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SVGRenderer } from "three/addons/renderers/SVGRenderer.js";
import { deinterleaveGeometry } from "three/addons/utils/BufferGeometryUtils.js";

async function loadBoard(payload) {
  const compressed = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"));
  const glb = await new Response(stream).arrayBuffer();
  const { scene } = await new GLTFLoader().parseAsync(glb, "");
  return scene;
}

function markOnBoard(board, marker) {
  const bounds = new Box3();
  for (const name of marker.dataset.pcbNodes.split(" ").filter(Boolean)) {
    const component = board.getObjectByName(name);
    if (component) bounds.expandByObject(component);
  }
  if (!bounds.isEmpty()) {
    const position = bounds.getCenter(new Vector3());
    position.y = bounds.max.y + 0.0015;
    return position;
  }
  // KiCad exports millimeters as meters, with its planar Y direction along glTF Z.
  const [x, z] = marker.dataset.pcbAt.split(" ").map(Number);
  return new Vector3(x / 1000, 0.003, z / 1000);
}

function createRenderer() {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { antialias: true, alpha: true });
  if (context) {
    const renderer = new WebGLRenderer({ canvas, context });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    return renderer;
  }

  const renderer = new SVGRenderer();
  renderer.setPrecision(1);
  renderer.setClearColor(0xe7ebe2);
  renderer.overdraw = 0.18;
  return renderer;
}

async function createPortfolioPcbViewer(host, markers) {
  const renderer = createRenderer();
  const software = renderer instanceof SVGRenderer;
  const payload = software && window.portfolioPcbLightModel
    ? window.portfolioPcbLightModel
    : window.portfolioPcbModel;
  const board = await loadBoard(payload);
  const scene = new Scene();
  scene.add(board);
  board.traverse((node) => {
    if (!node.isMesh) return;
    node.material.metalness = Math.min(node.material.metalness, 0.27);
    node.material.roughness = Math.max(node.material.roughness, 0.57);
    if (software) {
      deinterleaveGeometry(node.geometry);
      node.material.side = FrontSide;
    }
  });

  const fill = new HemisphereLight(0xffffff, 0x858f80, 2.1);
  const key = new DirectionalLight(0xfff7e7, 2.25);
  key.position.set(-0.2, 0.28, 0.25);
  scene.add(fill, key);

  const bounds = new Box3().setFromObject(board);
  const center = bounds.getCenter(new Vector3());
  const size = bounds.getSize(new Vector3());
  const camera = new OrthographicCamera(-0.1, 0.1, 0.1, -0.1, 0.001, 2);
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "PCB in 3D. Arrow keys rotate. Plus and minus zoom.");
  host.append(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minZoom = 0.8;
  controls.maxZoom = 3.7;
  controls.minPolarAngle = 0.03;
  controls.maxPolarAngle = Math.PI - 0.03;
  const originalAngle = new Vector3(0.016, 0.203, 0.105);
  const points = markers.map((marker) => ({ marker, position: markOnBoard(board, marker) }));
  const projected = new Vector3();
  let paintScheduled = false;

  function positionMarkers(width, height) {
    const seen = [];
    const aboveBoard = camera.position.y > center.y + 0.014;
    const order = [...points].sort((a, b) =>
      Number(b.marker.getAttribute("aria-selected") === "true") -
      Number(a.marker.getAttribute("aria-selected") === "true")
    );
    for (const { marker, position } of order) {
      projected.copy(position).project(camera);
      const x = (projected.x + 1) * width / 2;
      const y = (1 - projected.y) * height / 2;
      const tooClose = seen.some(([px, py]) => Math.hypot(x - px, y - py) < 24);
      const visible = aboveBoard && x > 12 && y > 12 && x < width - 12 && y < height - 12 && !tooClose;
      marker.toggleAttribute("data-out-of-view", !visible);
      if (!visible) continue;
      seen.push([x, y]);
      marker.style.setProperty("--projected-x", `${x}px`);
      marker.style.setProperty("--projected-y", `${y}px`);
    }
  }

  function draw() {
    if (paintScheduled) return;
    paintScheduled = true;
    requestAnimationFrame(() => {
      paintScheduled = false;
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (!width || !height) return;
      renderer.render(scene, camera);
      positionMarkers(width, height);
    });
  }

  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    const aspect = width / height;
    const halfHeight = Math.max(size.x / aspect, size.z) * 0.61;
    camera.left = -halfHeight * aspect;
    camera.right = halfHeight * aspect;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    draw();
  }

  function reset() {
    controls.target.copy(center);
    camera.position.copy(center).add(originalAngle);
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }

  function useKeyboard(event) {
    const offset = new Vector3().subVectors(camera.position, controls.target);
    const angle = new Spherical().setFromVector3(offset);
    switch (event.key) {
      case "ArrowLeft": angle.theta -= 0.11; break;
      case "ArrowRight": angle.theta += 0.11; break;
      case "ArrowUp": angle.phi -= 0.11; break;
      case "ArrowDown": angle.phi += 0.11; break;
      case "+":
      case "=": camera.zoom = Math.min(controls.maxZoom, camera.zoom * 1.12); break;
      case "-": camera.zoom = Math.max(controls.minZoom, camera.zoom / 1.12); break;
      default: return;
    }
    event.preventDefault();
    angle.makeSafe();
    camera.position.copy(controls.target).add(offset.setFromSpherical(angle));
    camera.updateProjectionMatrix();
    controls.update();
    draw();
  }

  renderer.domElement.addEventListener("keydown", useKeyboard);
  controls.addEventListener("change", draw);
  new ResizeObserver(resize).observe(host);
  reset();
  return { draw, resize, reset };
}

window.createPortfolioPcbViewer = createPortfolioPcbViewer;
