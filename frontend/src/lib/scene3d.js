import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Lightweight illustrative geometry. Engineering calculations keep using the 2D domain model.
function flight(length, pitch, direction) {
  const positions = [],
    indices = [],
    steps = Math.max(32, Math.ceil((length / pitch) * 64));
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps) * length - length / 2,
      a = (((i / steps) * length) / pitch) * Math.PI * 2 * direction;
    for (const [r, dx] of [
      [0.23, -0.045],
      [0.56, -0.045],
      [0.56, 0.045],
      [0.23, 0.045],
    ])
      positions.push(x + dx, Math.cos(a) * r, Math.sin(a) * r);
  }
  for (let i = 0; i < steps; i++)
    for (let j = 0; j < 4; j++) {
      const a = i * 4 + j,
        b = i * 4 + ((j + 1) % 4);
      indices.push(a, b, a + 4, b, b + 4, a + 4);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function createScene(host, { hero = false, model = {}, onState = () => {} }) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = hero ? 1.05 : 1.0;
  renderer.domElement.setAttribute(
    'aria-label',
    hero ? '可旋转双螺杆立体示意' : '可旋转元件立体示意',
  );
  renderer.domElement.setAttribute('role', 'img');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer),
    room = new RoomEnvironment();
  const env = pmrem.fromScene(room, 0.04);
  scene.environment = env.texture;
  room.dispose();
  pmrem.dispose();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, hero ? 3 : 2.2, hero ? 17 : 3.2);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.HemisphereLight(0xeafaff, 0x314658, 2));
  const light = new THREE.DirectionalLight(0xffffff, 3);
  light.position.set(-3, 5, 4);
  scene.add(light);
  const metal = new THREE.MeshStandardMaterial({
    color: hero ? 0x8daabb : 0x8ba7b8,
    metalness: 0.78,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const accent = new THREE.MeshStandardMaterial({
    color: 0x258f9b,
    metalness: 0.65,
    roughness: 0.3,
  });
  const group = new THREE.Group();
  scene.add(group);
  function cylinder(parent, length, radius = 0.24, x = 0, material = metal) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 40), material);
    mesh.rotation.z = Math.PI / 2;
    mesh.position.x = x;
    parent.add(mesh);
    return mesh;
  }
  function segment(parent, type, length, x, pitch = 0.9, direction = 1, discs = 5, angle = 45) {
    cylinder(parent, length, 0.24, x);
    if (/^KB|^KS/.test(type)) {
      for (let i = 0; i < discs; i++) {
        const disc = cylinder(
          parent,
          (length / discs) * 0.86,
          0.54,
          x - length / 2 + ((i + 0.5) * length) / discs,
          accent,
        );
        disc.scale.x = 0.72;
        disc.rotation.x = (i * angle * Math.PI) / 180;
      }
    } else if (type.toLowerCase() === 'spacer') {
      cylinder(parent, length, 0.48, x);
    } else {
      const geometry = flight(length, pitch, direction);
      const lobes = Math.min(3, Math.max(1, Number(model.lobes) || 2));
      for (let lobe = 0; lobe < lobes; lobe++) {
        const mesh = new THREE.Mesh(geometry, metal);
        mesh.position.x = x;
        mesh.rotation.x = (lobe * Math.PI * 2) / lobes;
        parent.add(mesh);
      }
    }
  }
  if (hero) {
    for (const z of [-0.62, 0.62]) {
      const shaft = new THREE.Group();
      shaft.position.z = z;
      group.add(shaft);
      cylinder(shaft, 12.1, 0.22);
      segment(shaft, 'GFA', 3.3, -3.75);
      segment(shaft, 'KB', 1.4, -1.35);
      segment(shaft, 'GFA', 2.2, 0.45);
      segment(shaft, 'KB', 1.1, 2.15);
      segment(shaft, 'GFA', 2.5, 4.05);
    }
  } else {
    const length = THREE.MathUtils.clamp((Number(model.length) || 60) / 35, 0.65, 3.8);
    segment(
      group,
      model.type || 'GFA',
      length,
      0,
      THREE.MathUtils.clamp((Number(model.pitch) || 50) / 35, 0.3, 2),
      ['LI', 'L'].includes(model.direction) ? -1 : 1,
      Math.min(24, Math.max(1, Number(model.discs) || 5)),
      Number(model.angle) || 45,
    );
  }
  const base = { x: hero ? 0.35 : -0.2, y: hero ? -0.18 : -0.32, z: hero ? -0.22 : -0.24 };
  let targetX = base.x,
    targetY = base.y,
    auto = hero,
    visible = true,
    disposed = false,
    frame = 0,
    last = 0,
    pointer = null;
  group.rotation.set(base.x, base.y, base.z);
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  function request() {
    if (!frame && !disposed && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function draw(time) {
    frame = 0;
    const dt = Math.min((time - last) / 1000 || 0.016, 0.05);
    last = time;
    if (auto && !media.matches) targetX += dt * 0.1;
    const ease = media.matches ? 1 : 1 - Math.exp(-dt * 12);
    group.rotation.x += (targetX - group.rotation.x) * ease;
    group.rotation.y += (targetY - group.rotation.y) * ease;
    renderer.render(scene, camera);
    if (
      (auto && !media.matches) ||
      Math.abs(targetX - group.rotation.x) + Math.abs(targetY - group.rotation.y) > 0.001
    )
      request();
  }
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    if (!hero) {
      const length = THREE.MathUtils.clamp((Number(model.length) || 60) / 35, 0.65, 3.8);
      const distance =
        (Math.max(1.25, (length + 0.3) / camera.aspect) / Math.tan((Math.PI * 32) / 360)) * 0.7;
      camera.position.set(0, distance * 0.18, distance);
      camera.lookAt(0, 0, 0);
    }
    camera.updateProjectionMatrix();
    request();
  });
  resize.observe(host);
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (!visible) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else request();
  });
  observer.observe(host);
  const wake = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else request();
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
    targetY += (e.clientX - pointer.x) * 0.006;
    targetX += (e.clientY - pointer.y) * 0.006;
    pointer = { x: e.clientX, y: e.clientY };
    request();
  }
  function up() {
    pointer = null;
  }
  host.addEventListener('pointerdown', down);
  host.addEventListener('pointermove', move);
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  host.addEventListener('lostpointercapture', up);
  const lost = (e) => {
    e.preventDefault();
    cancelAnimationFrame(frame);
    frame = 0;
    visible = false;
    onState('fallback');
  };
  const restored = () => {
    visible = true;
    onState('ready');
    request();
  };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  renderer.domElement.addEventListener('webglcontextrestored', restored);
  request();
  return {
    setAuto(value) {
      auto = value;
      request();
    },
    rotate(delta) {
      targetY += delta;
      request();
    },
    reset() {
      targetX = base.x;
      targetY = base.y;
      request();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      observer.disconnect();
      document.removeEventListener('visibilitychange', wake);
      media.removeEventListener('change', request);
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
      host.removeEventListener('lostpointercapture', up);
      scene.traverse((o) => o.geometry?.dispose());
      metal.dispose();
      accent.dispose();
      env.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
