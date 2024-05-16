import * as THREE from "https://esm.sh/three";
import { OrbitControls } from "https://esm.sh/three/examples/jsm/controls/OrbitControls";
import { fragCode, vertCode } from "./shaders";

// Create a scene
const scene = new THREE.Scene();

// Create a camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 5;

// Create a renderer
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Set background color
const backgroundColor = new THREE.Color(0x3399ee);
renderer.setClearColor(backgroundColor, 1);

// Add orbit controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.maxDistance = 10;
controls.minDistance = 2;
controls.enableDamping = true;

// Add directional light
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(1, 1, 1);
scene.add(light);

// Create a ray marching plane
const geometry = new THREE.PlaneGeometry();
const material = new THREE.ShaderMaterial();
const rayMarchPlane = new THREE.Mesh(geometry, material);

// Get the wdith and height of the near plane
const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
const nearPlaneHeight = nearPlaneWidth / camera.aspect;

// Scale the ray marching plane
rayMarchPlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

// Add uniforms
const uniforms = {
  u_steps: { value: 100 },
  u_maxDis: { value: 10 },
  u_eps: { value: 0.001 },

  u_mousePos: { value: new THREE.Vector2() },
  u_mouseClick: { value: false },
  u_currentPos: { value: new THREE.Vector2(0.5,-0.5) },
  
  u_ratio: { value: window.innerHeight / window.innerWidth }
};
material.uniforms = uniforms;

material.vertexShader = vertCode;
material.fragmentShader = fragCode;

// Add plane to scene
scene.add(rayMarchPlane);

// Needed inside update function
let cameraForwardPos = new THREE.Vector3(0, 0, -1);
const VECTOR3ZERO = new THREE.Vector3(0, 0, 0);

// Render the scene
const animate = () => {
  requestAnimationFrame(animate);

  // Update screen plane position and rotation
  cameraForwardPos = camera.position.clone().add(camera.getWorldDirection(VECTOR3ZERO).multiplyScalar(camera.near));
  rayMarchPlane.position.copy(cameraForwardPos);
  rayMarchPlane.rotation.copy(camera.rotation);

  renderer.render(scene, camera);

  controls.update();
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  const nearPlaneWidth = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * 2;
  const nearPlaneHeight = nearPlaneWidth / camera.aspect;
  rayMarchPlane.scale.set(nearPlaneWidth, nearPlaneHeight, 1);

  renderer.setSize(window.innerWidth, window.innerHeight);

  // Update screen ratio uniform
  uniforms.u_ratio.value = window.innerHeight / window.innerWidth;
});

// Handle mouse move
window.addEventListener('mousemove', (event) => {
  // Update mouse position uniform
  uniforms.u_mousePos.value.x = (event.clientX / window.innerWidth) * 2 - 1;
  uniforms.u_mousePos.value.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

// Handle mouse clicks
window.addEventListener('mousedown', (event) => {
  if (event.button === 0) {
    uniforms.u_mouseClick.value = true;
    uniforms.u_currentPos.value.x = uniforms.u_mousePos.value.x;
    uniforms.u_currentPos.value.y = uniforms.u_mousePos.value.y;
  }
});

window.addEventListener('mouseup', (event) => {
  uniforms.u_mouseClick.value = false;
});