// ==========================================
// 1. INITIALIZE PHYSICS WORLD (Cannon.js)
// ==========================================
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); // Earth gravity pulling down on the Y axis
world.broadphase = new CANNON.NaiveBroadphase(); // Helps physics run faster
world.solver.iterations = 10;

// ==========================================
// 2. INITIALIZE VISUAL WORLD (Three.js)
// ==========================================
const scene = new THREE.Scene();

// Setup Camera: Field of view, aspect ratio, near/far clipping
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Position the camera back and slightly up so we can see the action
camera.position.set(0, 10, 20); 
camera.lookAt(0, 0, 0);

// Setup WebGL Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; // We want cool shadows later
document.body.appendChild(renderer.domElement);

// Add some lights so we can see things
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // Soft global light
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// ==========================================
// 3. THE GAME LOOP
// ==========================================
const timeStep = 1 / 60; // 60 frames per second

function animate() {
    requestAnimationFrame(animate);

    // Step the physics engine forward in time
    world.step(timeStep);

    // Render the visual scene through the camera
    renderer.render(scene, camera);
}

// Start the loop
animate();

// Handle window resizing gracefully
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

console.log("Engine initialized. Ready for objects.");
