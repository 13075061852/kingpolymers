import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Presentation model only. No engineering calculations use this illustrative assembly.
function helicalFlight(length, pitch, radius) {
  const positions = [],
    indices = [];
  const steps = Math.ceil((length / pitch) * 96);
  const section = [
    [0.31, -0.085],
    [radius - 0.08, -0.085],
    [radius - 0.025, -0.06],
    [radius, -0.018],
    [radius, 0.018],
    [radius - 0.025, 0.06],
    [radius - 0.08, 0.085],
    [0.31, 0.085],
  ];
  for (let i = 0; i <= steps; i++) {
    const y = length * (i / steps - 0.5),
      a = (((i / steps) * length) / pitch) * Math.PI * 2;
    for (const [r, dy] of section) positions.push(Math.cos(a) * r, y + dy, Math.sin(a) * r);
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < section.length; j++) {
      const a = i * section.length + j,
        b = i * section.length + ((j + 1) % section.length);
      indices.push(a, b, a + section.length, b, b + section.length, a + section.length);
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
function glowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(222,253,255,1)');
  g.addColorStop(0.045, 'rgba(160,246,255,1)');
  g.addColorStop(0.12, 'rgba(0,157,255,.8)');
  g.addColorStop(0.33, 'rgba(0,89,255,.16)');
  g.addColorStop(1, 'rgba(0,55,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  const ray = c.createLinearGradient(0, 0, 128, 0);
  ray.addColorStop(0, 'rgba(0,100,255,0)');
  ray.addColorStop(0.48, 'rgba(69,197,255,.5)');
  ray.addColorStop(0.5, 'rgba(225,255,255,1)');
  ray.addColorStop(0.52, 'rgba(69,197,255,.5)');
  ray.addColorStop(1, 'rgba(0,100,255,0)');
  c.fillStyle = ray;
  c.fillRect(0, 63.5, 128, 1);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function consolidate(parent) {
  parent.updateMatrixWorld(true);
  const batches = new Map(),
    originals = new Set();
  parent.traverse((o) => {
    if (o.isMesh) {
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      if (g.index) g.setIndex(g.index.clone());
      const list = batches.get(o.material) || [];
      list.push(g);
      batches.set(o.material, list);
      originals.add(o.geometry);
    }
  });
  parent.clear();
  for (const [material, geometries] of batches) {
    const flattened = geometries.map((g) => {
      const plain = g.index ? g.toNonIndexed() : g;
      plain.deleteAttribute('uv');
      return plain;
    });
    const merged = mergeGeometries(flattened);
    parent.add(new THREE.Mesh(merged, material));
    for (const g of new Set([...geometries, ...flattened])) g.dispose();
  }
  for (const g of originals) g.dispose();
}
export function createScene(host, { onState = () => {} } = {}) {
  const mobile = host.clientWidth < 600;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });
  let ratio = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5);
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.domElement.setAttribute('role', 'img');
  renderer.domElement.setAttribute('aria-label', '可旋转双螺杆立体示意');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const room = new RoomEnvironment();
  room.traverse((object) => {
    if (object.material?.color && !object.material.emissive?.getHex())
      object.material.color.set(0x172130);
  });
  // Wide studio strips create readable reflections instead of a flat grey surface.
  const stripMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(2, 2.4, 3) });
  for (const [x, y, z, w, h] of [
    [-4, 2, 2, 2, 9],
    [3, 3, 2, 0.8, 8],
    [0, 5, -2, 6, 1],
  ]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), stripMaterial);
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    room.add(panel);
  }
  const generator = new THREE.PMREMGenerator(renderer),
    environment = generator.fromScene(room, 0.035);
  scene.environment = environment.texture;
  room.dispose();
  stripMaterial.dispose();
  generator.dispose();
  scene.add(new THREE.HemisphereLight(0xd7e7ff, 0x030b1a, 0.75));
  const key = new THREE.DirectionalLight(0xe5f2ff, 4.5);
  key.position.set(-3, 6, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x1079ff, 5.5);
  rim.position.set(2, -2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 2);
  fill.position.set(4, 0, 4);
  scene.add(fill);
  const blueSpot = new THREE.PointLight(0x0088ff, 24, 8, 2);
  blueSpot.position.set(1, -1, 2);
  scene.add(blueSpot);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);
  camera.position.set(0, 0, 26);
  camera.lookAt(0, 0, 0);
  const chrome = new THREE.MeshStandardMaterial({
    color: 0x77899f,
    metalness: 1,
    roughness: 0.19,
    envMapIntensity: 1.15,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x354457,
    metalness: 1,
    roughness: 0.24,
    envMapIntensity: 1.9,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x050b13,
    metalness: 0.85,
    roughness: 0.29,
  });
  const brushed = new THREE.MeshStandardMaterial({
    color: 0xa7b9ce,
    metalness: 1,
    roughness: 0.32,
    envMapIntensity: 1.5,
  });
  const electric = new THREE.MeshBasicMaterial({ color: 0x38bdff, toneMapped: false });
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x168dff,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const faintLine = lineMaterial.clone();
  faintLine.opacity = 0.18;
  const rotor = new THREE.Group();
  const allMaterials = new Set([chrome, steel, dark, brushed, electric, lineMaterial, faintLine]);
  function cylinder(radius, height, y, material = chrome, parent = rotor) {
    const bevel = Math.min(0.045, height * 0.15);
    const profile = [
      [radius * 0.94, -height / 2],
      [radius, -height / 2 + bevel],
      [radius, height / 2 - bevel],
      [radius * 0.94, height / 2],
    ].map(([r, h]) => new THREE.Vector2(r, h));
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(profile, 64), material);
    mesh.position.y = y;
    parent.add(mesh);
    // Lathe caps keep both exposed ends solid.
    const caps = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.94, radius * 0.94, height * 0.998, 48),
      material,
    );
    caps.position.y = y;
    parent.add(caps);
    return mesh;
  }
  function torus(radius, tube, y, material = chrome, parent = rotor, arc = Math.PI * 2) {
    const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 96, arc), material);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = y;
    parent.add(mesh);
    return mesh;
  }
  function flange(y, radius = 0.93) {
    cylinder(radius, 0.2, y, brushed);
    cylinder(radius * 0.78, 0.27, y, steel);
    cylinder(radius * 0.65, 0.34, y, chrome);
    cylinder(radius * 0.49, 0.39, y, dark);
    cylinder(radius * 0.37, 0.44, y, chrome);
    torus(radius - 0.025, 0.026, y + 0.09, chrome);
    torus(radius - 0.025, 0.022, y - 0.09, chrome);
    const boltGeometry = new THREE.CylinderGeometry(0.067, 0.067, 0.035, 6);
    const insetGeometry = new THREE.CylinderGeometry(0.098, 0.098, 0.015, 16);
    for (const side of [-1, 1])
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const inset = new THREE.Mesh(insetGeometry, dark);
        inset.position.set(
          Math.cos(a) * radius * 0.84,
          y + side * 0.11,
          Math.sin(a) * radius * 0.84,
        );
        rotor.add(inset);
        const bolt = new THREE.Mesh(boltGeometry, steel);
        bolt.position.copy(inset.position);
        bolt.position.y += side * 0.008;
        rotor.add(bolt);
      }
  }
  cylinder(0.27, 12.6, 0, steel);
  cylinder(0.4, 0.65, 5.72, chrome);
  flange(6.12, 0.78);
  cylinder(0.32, 0.25, 6.32, dark);
  cylinder(0.42, 0.22, 5.22, steel);
  for (const [y, length, pitch, radius] of [
    [3.8, 2.6, 1.2, 0.8],
    [-0.3, 2.9, 1.05, 0.84],
    [-3.65, 1.6, 0.9, 0.73],
  ]) {
    cylinder(0.32, length, y, steel);
    for (const phase of [0, Math.PI]) {
      const blade = new THREE.Mesh(helicalFlight(length, pitch, radius), chrome);
      blade.position.y = y;
      blade.rotation.y = phase;
      rotor.add(blade);
    }
  }
  flange(1.9, 0.85);
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group();
    group.position.y = 1.35 - i * 0.22;
    group.rotation.y = i * 0.65;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.18, 48), brushed);
    disc.scale.x = 0.7;
    group.add(disc);
    rotor.add(group);
  }
  flange(-2.08, 0.97);
  cylinder(0.48, 0.4, -2.5, steel);
  torus(0.49, 0.025, -2.55, chrome);
  for (const y of [-4.64, -4.85, -5.05]) cylinder(0.6, 0.16, y, chrome);
  cylinder(0.43, 0.62, -5.46, steel);
  flange(-5.97, 0.68);
  cylinder(0.34, 0.25, -6.2, dark);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    const groove = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.53, 0.08), chrome);
    groove.position.set(Math.sin(a) * 0.435, -5.47, Math.cos(a) * 0.435);
    groove.rotation.y = a;
    rotor.add(groove);
  }
  consolidate(rotor);
  const rig = new THREE.Group();
  rig.rotation.set(0.6, 0, 0.63);
  rig.position.set(0.1, -0.15, 0);
  rig.scale.set(1.23, 1.2, 1.23);
  rig.add(rotor);
  scene.add(rig);
  const rings = [];
  const texture = glowTexture();
  const spriteMaterial = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  allMaterials.add(spriteMaterial);
  function flare(parent, x, y, z, size) {
    const s = new THREE.Sprite(spriteMaterial);
    s.position.set(x, y, z);
    s.scale.set(size, size, 1);
    parent.add(s);
    return s;
  }
  for (const [j, y] of [2.0, -1.95, -4.6].entries()) {
    const orbit = new THREE.Group();
    orbit.position.y = y;
    rig.add(orbit);
    torus(1.1, 0.014, 0, electric, orbit, Math.PI * 1.6);
    torus(1.18, 0.007, 0.045, electric, orbit, Math.PI * 0.8);
    for (const [r, offset, mat] of [
      [1.3, 0, lineMaterial],
      [1.48, 0.06, faintLine],
      [1.1, -0.16, faintLine],
    ]) {
      const points = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * r, offset, Math.sin(a) * r));
      }
      orbit.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), mat));
    }
    const tickPoints = [];
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      for (const r of [1.33, i % 4 === 0 ? 1.44 : 1.38])
        tickPoints.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    orbit.add(
      new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tickPoints), lineMaterial),
    );
    flare(orbit, 1.09, 0.02, 0, 1.6);
    flare(orbit, -1.09, 0.02, 0, 1.0);
    orbit.rotation.y = j * 1.5;
    rings.push(orbit);
  }
  const scan = new THREE.Group();
  rig.add(scan);
  torus(0.92, 0.011, 0, electric, scan);
  flare(scan, 0.72, 0, 0.54, 0.8);
  const particles = new THREE.BufferGeometry(),
    coords = [];
  for (let i = 0; i < 100; i++) {
    const a = i * 2.3999,
      r = 1.3 + (i % 7) * 0.24;
    coords.push(Math.cos(a) * r, (i / 100 - 0.5) * 13, Math.sin(a) * r);
  }
  particles.setAttribute('position', new THREE.Float32BufferAttribute(coords, 3));
  const particleMaterial = new THREE.PointsMaterial({
    color: 0x44b9ff,
    size: 0.023,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  allMaterials.add(particleMaterial);
  rig.add(new THREE.Points(particles, particleMaterial));
  let presented = false;
  let auto = true,
    visible = true,
    disposed = false,
    contextLost = false,
    frame = 0,
    last = 0,
    time = 0,
    angle = 0.3,
    targetY = 0,
    targetX = 0.6,
    pointer = null,
    frames = 0,
    slowFrames = 0,
    frameAverage = 16.7;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const diagnostics = { frames: 0, frameMs: 0, pixelRatio: ratio, drawCalls: 0, triangles: 0 };
  function request() {
    if (!disposed && !contextLost && visible && !document.hidden && !frame)
      frame = requestAnimationFrame(draw);
  }
  function draw(now) {
    frame = 0;
    const elapsed = last ? Math.min(now - last, 100) : 16.7;
    last = now;
    const dt = Math.min(elapsed / 1000, 0.05);
    if (auto && !media.matches) {
      time += dt;
      angle += dt * 0.3;
    }
    rotor.rotation.y = angle;
    const easing = media.matches ? 1 : 1 - Math.exp(-dt * 9);
    rig.rotation.x += (targetX - rig.rotation.x) * easing;
    rig.rotation.y += (targetY - rig.rotation.y) * easing;
    rig.position.y = -0.15 + Math.sin(time * 0.6) * 0.045;
    rings.forEach((ring, i) => {
      ring.rotation.y = time * (i % 2 ? -0.22 : 0.28) + i * 1.5;
    });
    scan.position.y = ((time * 0.55) % 11.8) - 5.9;
    rim.position.x = 2 + Math.sin(time * 0.45) * 3;
    renderer.render(scene, camera);
    if (!presented) {
      presented = true;
      onState('ready');
    }
    frames++;
    // Only lower resolution after sustained slow frames; avoid resize oscillation.
    frameAverage = frameAverage * 0.96 + elapsed * 0.04;
    if (auto && !media.matches && frames > 120 && frameAverage > 24) slowFrames++;
    else slowFrames = Math.max(0, slowFrames - 1);
    if (slowFrames > 100 && ratio > 0.8) {
      ratio = Math.max(0.8, ratio - 0.2);
      renderer.setPixelRatio(ratio);
      slowFrames = 0;
    }
    if (frames % 60 === 0) {
      Object.assign(diagnostics, {
        frames,
        frameMs: Math.round(frameAverage * 10) / 10,
        pixelRatio: ratio,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
      });
      host.dataset.renderStats = JSON.stringify(diagnostics);
    }
    if (
      (auto && !media.matches) ||
      Math.abs(rig.rotation.x - targetX) + Math.abs(rig.rotation.y - targetY) > 0.001
    )
      request();
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    // Fit the complete diagonal assembly, including the flange ends.
    const distance = Math.max(
      23.8,
      8.5 / camera.aspect / (2 * Math.tan(THREE.MathUtils.degToRad(16))),
    );
    camera.position.z = distance;
    camera.updateProjectionMatrix();
    request();
  });
  resize.observe(host);
  function suspend() {
    cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) request();
    else suspend();
  });
  observer.observe(host);
  const wake = () => {
    if (document.hidden) suspend();
    else request();
  };
  document.addEventListener('visibilitychange', wake);
  media.addEventListener('change', request);
  function down(e) {
    if (e.button !== 0) return;
    pointer = { x: e.clientX, y: e.clientY };
    host.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (!pointer) return;
    targetY += (e.clientX - pointer.x) * 0.004;
    targetX = THREE.MathUtils.clamp(targetX + (e.clientY - pointer.y) * 0.004, -0.65, 0.85);
    pointer = { x: e.clientX, y: e.clientY };
    request();
  }
  const up = () => {
    pointer = null;
  };
  host.addEventListener('pointerdown', down);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('lostpointercapture', up);
  const lost = (e) => {
    e.preventDefault();
    contextLost = true;
    suspend();
    onState('fallback');
  };
  const restored = () => {
    contextLost = false;
    presented = false;
    request();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.addEventListener('webglcontextrestored', restored);
  request();
  return {
    capture() {
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL('image/png');
    },
    setAuto(value) {
      auto = value;
      last = 0;
      request();
    },
    rotate(delta) {
      targetY += delta;
      request();
    },
    reset() {
      targetY = 0;
      targetX = 0.6;
      angle = 0.3;
      request();
    },
    dispose() {
      disposed = true;
      suspend();
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', wake);
      media.removeEventListener('change', request);
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
      host.removeEventListener('lostpointercapture', up);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.domElement.removeEventListener('webglcontextrestored', restored);
      const geometries = new Set();
      scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
      });
      for (const g of geometries) g.dispose();
      for (const m of allMaterials) m.dispose();
      texture.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete host.dataset.renderStats;
    },
  };
}
