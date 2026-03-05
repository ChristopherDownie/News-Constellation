import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createNoise3D } from 'simplex-noise';
import { generateGraph, NodeType } from './graph';
import type { GraphData } from './graph';

// --- Configuration ---
const CONFIG = {
  backgroundColor: 0x070b19, // Dark sleek navy/black
  edgeOpacity: 0.4,
  edgeColor: 0x4488ff, // Bright glowing blue
  dustCount: 15000,
  dustOpacity: 0.4,
  dustColor: 0x7777ff, // Muted grey dust
  driftSpeed: 0.0002,
  driftAmplitude: 2.0,
  dustSwirlSpeed: 0.0005,
  edgeSegments: 10,   // For curved strings
  edgeHangAmount: 0.15, // How much the string hangs down
  springStiffness: 0.05, // How strongly strings pull on nodes
  damping: 0.85, // Friction to prevent chaotic bouncing
  baseReturnStrength: 0.08, // Pulls towards their noise-disordered home
  pulseSpeed: 0.002,
  pulseAmplitude: 0.4
};

// --- Global State ---
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let controls: OrbitControls;
let graphData: GraphData;

let nodeMesh: THREE.InstancedMesh;
let edgesLine: THREE.LineSegments;
let dustPoints: THREE.Points;

const noise3D = createNoise3D();
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let hoveredNodeId: number | null = null;
let selectedNodeId: number | null = null;
const tooltipEl = document.getElementById('tooltip') as HTMLDivElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchResultsEl = document.getElementById('search-results') as HTMLUListElement;
let searchTerm: string = '';

let audioListener: THREE.AudioListener;
let targetMasterVolume = 0.3; // matches new default
let unmutedVolume = 0.3; // Store volume before muting
let currentMasterVolume = 0.0;
let isAudioActive = false;
let isMuted = false;

// Fly-to Animation State
let isFlying = false;
let targetCameraPos = new THREE.Vector3();
let targetControlsCenter = new THREE.Vector3();

const dummy = new THREE.Object3D();
const color = new THREE.Color();

init();
animate(0);

function init() {
  const canvas = document.getElementById('glcanvas') as HTMLCanvasElement;

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.backgroundColor);

  // Camera
  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.set(200, 150, 300);

  // Audio Setup
  audioListener = new THREE.AudioListener();
  camera.add(audioListener);

  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.5;

  // Enable keyboard panning/orbiting
  controls.listenToKeyEvents(window);
  // Optional: Set keys for panning instead of orbiting, if desired.
  // By default, arrow keys orbit. We can allow the user to easily move around.
  controls.keyPanSpeed = 14.0;

  // Generate Data
  graphData = generateGraph();

  createNodes();
  createEdges();
  createDust();

  // Events
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('dblclick', onDoubleClick);

  // Search
  searchInput.addEventListener('input', (e) => {
    searchTerm = (e.target as HTMLInputElement).value.trim().toLowerCase();
    updateSearchResults();
  });

  // Hide search results if clicked outside
  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target as Node) && !searchResultsEl.contains(e.target as Node)) {
      searchResultsEl.classList.add('hidden');
    }
  });

  searchInput.addEventListener('focus', () => {
    if (searchTerm.length > 0) {
      updateSearchResults();
    }
  });

  // Landing Page Enter Button
  const enterBtn = document.getElementById('enter-btn');
  const landingPage = document.getElementById('landing-page');
  const appContainer = document.getElementById('app');

  const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
  const muteBtn = document.getElementById('mute-btn') as HTMLButtonElement;

  if (volumeSlider && muteBtn) {
    targetMasterVolume = parseFloat(volumeSlider.value);
    unmutedVolume = targetMasterVolume;

    volumeSlider.addEventListener('input', (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      if (isMuted && val > 0) {
        // Unmute if slider is moved
        isMuted = false;
        muteBtn.innerText = 'MUTE';
        muteBtn.classList.remove('muted');
      }
      targetMasterVolume = val;
      unmutedVolume = val;
    });

    muteBtn.addEventListener('click', () => {
      isMuted = !isMuted;
      if (isMuted) {
        // Mute
        targetMasterVolume = 0;
        volumeSlider.value = '0';
        muteBtn.innerText = 'UNMUTE';
        muteBtn.classList.add('muted');
      } else {
        // Unmute
        targetMasterVolume = unmutedVolume > 0 ? unmutedVolume : 0.3;
        volumeSlider.value = targetMasterVolume.toString();
        muteBtn.innerText = 'MUTE';
        muteBtn.classList.remove('muted');
      }
    });
  }

  if (enterBtn && landingPage && appContainer) {
    enterBtn.addEventListener('click', () => {
      // Browser requires user interaction to resume audio context
      if (audioListener.context.state === 'suspended') {
        audioListener.context.resume();
      }
      isAudioActive = true;

      landingPage.classList.add('hidden');
      appContainer.classList.remove('hidden');
    });
  }
}

function createNodes() {
  const geometry = new THREE.SphereGeometry(1, 16, 16);
  // Unlit material for crisp nodes
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff });

  nodeMesh = new THREE.InstancedMesh(geometry, material, graphData.nodes.length);

  for (let i = 0; i < graphData.nodes.length; i++) {
    const node = graphData.nodes[i];

    dummy.position.copy(node.position);
    dummy.scale.set(node.size, node.size, node.size);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);
    nodeMesh.setColorAt(i, node.color);

    // If it's a Satellite Hub, attach procedural positional audio
    if (node.type === NodeType.Satellite) {
      setupPositionalMurmur(node.position);
    }
  }

  nodeMesh.instanceMatrix.needsUpdate = true;
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;

  scene.add(nodeMesh);
}

function setupPositionalMurmur(position: THREE.Vector3) {
  // Wait until we have an AudioContext from listener
  if (!audioListener.context) return;
  const ctx = audioListener.context;

  // Create a 2-second looping white/brown noise buffer for murmur
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    // Simple lowpass filter for brown noise (muffled speech sound)
    data[i] = (lastOut + (0.02 * white)) / 1.02;
    lastOut = data[i];
    // Modulate amplitude to sound like speech cadence
    data[i] *= (Math.sin(i * 0.0001) * 0.5 + 0.5) * (Math.sin(i * 0.0005) * 0.8 + 0.2);
  }

  const positionalAudio = new THREE.PositionalAudio(audioListener);
  positionalAudio.setBuffer(buffer);
  positionalAudio.setRefDistance(50); // Increased so it sounds fuller from further
  positionalAudio.setMaxDistance(300);
  positionalAudio.setRolloffFactor(0.5); // Softer drop-off curve
  positionalAudio.setLoop(true);
  positionalAudio.setVolume(1.5);

  // Create an invisible object to hold audio
  const audioObj = new THREE.Object3D();
  audioObj.position.copy(position);
  audioObj.add(positionalAudio);
  scene.add(audioObj);

  // Start playing (will be silent until context resumes)
  positionalAudio.play();
}

function createEdges() {
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: CONFIG.edgeColor,
    transparent: true,
    opacity: CONFIG.edgeOpacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending // Soft overlapping lines
  });

  const numSegments = CONFIG.edgeSegments;
  const edgePositions = new Float32Array(graphData.edges.length * numSegments * 6);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));

  edgesLine = new THREE.LineSegments(geometry, edgeMaterial);
  scene.add(edgesLine);
}

function createDust() {
  const dustGeo = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(CONFIG.dustCount * 3);

  let pIdx = 0;
  // Distribute dust mostly around hubs
  const hubs = graphData.nodes.filter(n => n.type === NodeType.Central || n.type === NodeType.Satellite);

  for (let i = 0; i < CONFIG.dustCount; i++) {
    // Pick a random hub to cluster around, or completely random 20% of time
    let origin = new THREE.Vector3(0, 0, 0);
    let spread = 200;

    if (Math.random() > 0.2 && hubs.length > 0) {
      const hub = hubs[Math.floor(Math.random() * hubs.length)];
      origin.copy(hub.position);
      spread = 80;
    }

    // Random point in sphere
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = Math.cbrt(Math.random()) * spread;

    dustPositions[pIdx++] = origin.x + r * Math.sin(phi) * Math.cos(theta);
    dustPositions[pIdx++] = origin.y + r * Math.sin(phi) * Math.sin(theta);
    dustPositions[pIdx++] = origin.z + r * Math.cos(phi);
  }

  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));

  // Use circular points for dust
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.beginPath();
  ctx.arc(8, 8, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);

  const dustMat = new THREE.PointsMaterial({
    size: 1.5,
    color: CONFIG.dustColor,
    map: texture,
    transparent: true,
    opacity: CONFIG.dustOpacity,
    alphaTest: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  dustPoints = new THREE.Points(dustGeo, dustMat);
  scene.add(dustPoints);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onPointerMove(event: PointerEvent) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Tooltip positioning
  if (hoveredNodeId !== null) {
    tooltipEl.style.transform = `translate(${event.clientX + 15}px, ${event.clientY + 15}px)`;
  }
}

function updatePhysics(time: number) {
  let needsEdgeUpdate = false;

  // Update node positions with drift
  for (let i = 0; i < graphData.nodes.length; i++) {
    const node = graphData.nodes[i];
    if (node.type === NodeType.Central) continue; // Keep central steady

    // Simplex noise based drift offset target
    const nx = noise3D(node.basePosition.x * 0.01, node.basePosition.y * 0.01, time * CONFIG.driftSpeed);
    const ny = noise3D(node.basePosition.y * 0.01, node.basePosition.z * 0.01, time * CONFIG.driftSpeed + 100);
    const nz = noise3D(node.basePosition.z * 0.01, node.basePosition.x * 0.01, time * CONFIG.driftSpeed + 200);

    const targetX = node.basePosition.x + nx * CONFIG.driftAmplitude * 2.5; // Amplify slightly for visibility
    const targetY = node.basePosition.y + ny * CONFIG.driftAmplitude * 2.5;
    const targetZ = node.basePosition.z + nz * CONFIG.driftAmplitude * 2.5;

    // 1. Soft force pulling towards the noise-displaced "home" position
    node.velocity.x += (targetX - node.position.x) * CONFIG.baseReturnStrength;
    node.velocity.y += (targetY - node.position.y) * CONFIG.baseReturnStrength;
    node.velocity.z += (targetZ - node.position.z) * CONFIG.baseReturnStrength;

    // 2. Spring force from connected strings
    for (let j = 0; j < node.connections.length; j++) {
      const otherNode = graphData.nodes[node.connections[j]];

      const dx = otherNode.position.x - node.position.x;
      const dy = otherNode.position.y - node.position.y;
      const dz = otherNode.position.z - node.position.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const baseX = otherNode.basePosition.x - node.basePosition.x;
      const baseY = otherNode.basePosition.y - node.basePosition.y;
      const baseZ = otherNode.basePosition.z - node.basePosition.z;
      const originalDist = Math.sqrt(baseX * baseX + baseY * baseY + baseZ * baseZ);

      // Hooke's Law: pull/push based on string stretch from rest length
      if (dist > 0) {
        const stretch = dist - originalDist;
        const force = stretch * CONFIG.springStiffness;
        node.velocity.x += (dx / dist) * force;
        node.velocity.y += (dy / dist) * force;
        node.velocity.z += (dz / dist) * force;
      }
    }

    // Apply damping and apply velocity to position
    node.velocity.multiplyScalar(CONFIG.damping);
    node.position.add(node.velocity);

    // Dynamic scale pulsing
    const pulse = Math.sin(time * CONFIG.pulseSpeed + node.id) * CONFIG.pulseAmplitude;
    const dynamicSize = Math.max(0.1, node.size + pulse);

    // Update instance matrix
    dummy.position.copy(node.position);
    let scaleMultiplier = (i === hoveredNodeId) ? 1.5 : 1.0;
    dummy.scale.setScalar(dynamicSize * scaleMultiplier);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);

    // Update color based on hover, pulse intensity, and search
    let isMatched = true;
    if (searchTerm.length > 0) {
      if (!node.text.toLowerCase().includes(searchTerm)) {
        isMatched = false;
      }
    }

    if (!isMatched) {
      color.setHex(0x111122); // Dimmed out non-matches
    } else if (i === hoveredNodeId) {
      color.setHex(0xffffff); // Highlight bright white
    } else {
      color.copy(node.color);
      // Intensify color as it gets larger (pulse > 0)
      if (pulse > 0) {
        color.lerp(new THREE.Color(0xffffff), pulse / CONFIG.pulseAmplitude * 0.5);
      }
    }
    nodeMesh.setColorAt(i, color);

    needsEdgeUpdate = true;
  }

  nodeMesh.instanceMatrix.needsUpdate = true;
  if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;

  // Update edges geometry if nodes moved
  if (needsEdgeUpdate) {
    const positions = edgesLine.geometry.attributes.position.array as Float32Array;
    const numSegments = CONFIG.edgeSegments;

    for (let i = 0; i < graphData.edges.length; i++) {
      const edge = graphData.edges[i];
      const source = graphData.nodes[edge.source];
      const target = graphData.nodes[edge.target];

      const p0x = source.position.x, p0y = source.position.y, p0z = source.position.z;
      const p2x = target.position.x, p2y = target.position.y, p2z = target.position.z;

      // Control point for quadratic bezier that acts as gravity drop
      const dist = Math.sqrt((p2x - p0x) ** 2 + (p2y - p0y) ** 2 + (p2z - p0z) ** 2);

      // Calculate original distance (string's normal rest length)
      const b0x = source.basePosition.x, b0y = source.basePosition.y, b0z = source.basePosition.z;
      const b2x = target.basePosition.x, b2y = target.basePosition.y, b2z = target.basePosition.z;
      const restDist = Math.sqrt((b2x - b0x) ** 2 + (b2y - b0y) ** 2 + (b2z - b0z) ** 2);

      let actualHang = 0;
      if (dist < restDist) {
        // String is slack. The sag forms a curve similar to a catenary.
        // Sag approximates to half the side of a right triangle formed by hypotenuse (L) and base (D).
        actualHang = 0.5 * Math.sqrt(restDist * restDist - dist * dist);
      }

      // We can also allow a tiny bit of fundamental gravity drag if desired, 
      // but pure slack calculation is more highly realistic for taut strings.

      const p1x = (p0x + p2x) * 0.5;
      const p1y = (p0y + p2y) * 0.5 - actualHang;
      const p1z = (p0z + p2z) * 0.5;

      for (let s = 0; s < numSegments; s++) {
        const tA = s / numSegments;
        const tB = (s + 1) / numSegments;

        const mtA = 1 - tA, mtA2 = mtA * mtA, tA2 = tA * tA;
        const ax = mtA2 * p0x + 2 * mtA * tA * p1x + tA2 * p2x;
        const ay = mtA2 * p0y + 2 * mtA * tA * p1y + tA2 * p2y;
        const az = mtA2 * p0z + 2 * mtA * tA * p1z + tA2 * p2z;

        const mtB = 1 - tB, mtB2 = mtB * mtB, tB2 = tB * tB;
        const bx = mtB2 * p0x + 2 * mtB * tB * p1x + tB2 * p2x;
        const by = mtB2 * p0y + 2 * mtB * tB * p1y + tB2 * p2y;
        const bz = mtB2 * p0z + 2 * mtB * tB * p1z + tB2 * p2z;

        const idx = (i * numSegments + s) * 6;
        positions[idx] = ax;
        positions[idx + 1] = ay;
        positions[idx + 2] = az;
        positions[idx + 3] = bx;
        positions[idx + 4] = by;
        positions[idx + 5] = bz;
      }
    }
    edgesLine.geometry.attributes.position.needsUpdate = true;
  }

  // Soft swirl for dust
  if (dustPoints) {
    dustPoints.rotation.y = time * CONFIG.dustSwirlSpeed;
    dustPoints.rotation.x = Math.sin(time * CONFIG.dustSwirlSpeed * 0.5) * 0.05;
  }

  // Edge breathing effect
  const edgeMat = edgesLine.material as THREE.LineBasicMaterial;
  edgeMat.opacity = CONFIG.edgeOpacity + Math.sin(time * 0.001) * 0.05;
}

function updateInteraction() {
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(nodeMesh);

  if (intersects.length > 0) {
    const instanceId = intersects[0].instanceId;
    if (instanceId !== undefined && instanceId !== hoveredNodeId) {
      hoveredNodeId = instanceId;
      const node = graphData.nodes[hoveredNodeId];

      document.body.style.cursor = 'pointer';

      // Update tooltip
      tooltipEl.classList.remove('hidden');
      const typeStr = node.type === NodeType.Central ? 'Central Hub' :
        (node.type === NodeType.Satellite ? 'Satellite Hub' : 'Node');
      tooltipEl.innerHTML = `<strong>${typeStr}</strong><br/>ID: ${node.id}<br/>Connections: ${node.connections.length}`;
    }
  } else {
    if (hoveredNodeId !== null) {
      hoveredNodeId = null;
      document.body.style.cursor = 'default';
      tooltipEl.classList.add('hidden');
    }
  }
}

function flyToNode(nodeId: number) {
  selectedNodeId = nodeId;
  const node = graphData.nodes[selectedNodeId];

  // Trigger Speech Synthesis
  window.speechSynthesis.cancel(); // Cancel any current speech
  const utterance = new SpeechSynthesisUtterance(node.text);
  utterance.rate = 0.9;
  utterance.pitch = node.type === NodeType.Central ? 0.8 : 1.0;
  window.speechSynthesis.speak(utterance);

  // Calculate Fly-to Target (offset slightly so we don't end up INSIDE the node)
  targetControlsCenter.copy(node.position);
  const offset = new THREE.Vector3(0, 0, node.size * 5 + 10);
  targetCameraPos.copy(node.position).add(offset);

  isFlying = true;
}

function updateSearchResults() {
  searchResultsEl.innerHTML = '';
  if (searchTerm.length === 0) {
    searchResultsEl.classList.add('hidden');
    return;
  }

  const matches = graphData.nodes.filter(n => n.text.toLowerCase().includes(searchTerm));

  if (matches.length > 0) {
    searchResultsEl.classList.remove('hidden');
    // Limit to 20 results to avoid massive DOM
    matches.slice(0, 20).forEach(node => {
      const li = document.createElement('li');
      li.innerText = node.text;
      li.addEventListener('click', () => {
        flyToNode(node.id);
        searchResultsEl.classList.add('hidden');
        searchInput.value = node.text;
        searchTerm = node.text.toLowerCase();
      });
      searchResultsEl.appendChild(li);
    });
  } else {
    searchResultsEl.classList.add('hidden');
  }
}

function onDoubleClick() {
  if (hoveredNodeId !== null) {
    flyToNode(hoveredNodeId);
  }
}

function animate(time: number) {
  requestAnimationFrame(animate);

  updatePhysics(time);
  updateInteraction();

  if (audioListener) {
    if (isAudioActive) {
      if (Math.abs(currentMasterVolume - targetMasterVolume) > 0.001) {
        currentMasterVolume += (targetMasterVolume - currentMasterVolume) * 0.005; // Much slower fade lerp (approx 3-5 seconds depending on framerate)
      } else {
        currentMasterVolume = targetMasterVolume;
      }
    } else {
      currentMasterVolume = 0.0;
    }
    audioListener.setMasterVolume(currentMasterVolume);
  }

  if (isFlying) {
    // Lerp camera and controls target for smooth flight
    camera.position.lerp(targetCameraPos, 0.05);
    controls.target.lerp(targetControlsCenter, 0.05);

    // Stop flying if close enough
    if (camera.position.distanceToSquared(targetCameraPos) < 1.0) {
      isFlying = false;
    }
  }

  controls.update(); // only needed if damping or autoRotate is enabled
  renderer.render(scene, camera);
}
