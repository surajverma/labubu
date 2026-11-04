import * as THREE from 'three';
import { APP, TUNABLES } from './config';

// Milestone 1 placeholder scene: proves Vite + Three.js + Capacitor wiring.
const root = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, TUNABLES.maxPixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
root.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#fff4ec');
const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1, 6);
scene.add(new THREE.HemisphereLight('#ffffff', '#f0c8b0', 1.4));
const key = new THREE.DirectionalLight('#ffffff', 2);
key.position.set(3, 4, 5);
scene.add(key);
const blob = new THREE.Mesh(
  new THREE.SphereGeometry(1, 48, 32),
  new THREE.MeshPhysicalMaterial({ color: '#ff9a7a', roughness: 0.35, clearcoat: 1 }),
);
scene.add(blob);
const label = document.createElement('div');
label.textContent = `${APP.name} v${APP.version}`;
label.style.cssText = 'position:fixed;bottom:24px;width:100%;text-align:center;font:600 18px system-ui;color:#7a4a3a';
root.appendChild(label);

renderer.setAnimationLoop((t) => {
  blob.position.y = Math.sin(t / 600) * 0.1;
  blob.rotation.y = t / 2000;
  renderer.render(scene, camera);
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
