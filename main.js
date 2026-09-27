// ==========================================
// 1. INITIALIZE PHYSICS WORLD (Cannon.js)
// ==========================================
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); 
world.broadphase = new CANNON.NaiveBroadphase(); 
world.solver.iterations = 10;

// ==========================================
// 2. INITIALIZE VISUAL WORLD (Three.js)
// ==========================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// Pulled the camera further back and up to see the whole level
camera.position.set(0, 15, 30); 
camera.lookAt(0, 5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; 
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

// ==========================================
// 3. CREATE GAME OBJECTS
// ==========================================
// A helper array to keep track of objects that need to move
const objectsToUpdate = [];

// --- THE BALL ---
const ballRadius = 1;
// Physics
const ballBody = new CANNON.Body({
    mass: 5, // Mass > 0 makes it dynamic (affected by gravity)
    shape: new CANNON.Sphere(ballRadius),
    position: new CANNON.Vec3(0, 20, 0) // Drop from high up
});
world.addBody(ballBody);

// Visual
const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.3 }); // Bright red
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
scene.add(ballMesh);

// Link them together
objectsToUpdate.push({ mesh: ballMesh, body: ballBody });


// --- STARTING PLATFORM ---
// Note: Cannon.js uses half-extents for boxes (width/2, height/2, depth/2)
const startPlatformBody = new CANNON.Body({
    mass: 0, // Mass 0 makes it static (unmoving)
    shape: new CANNON.Box(new CANNON.Vec3(4, 0.5, 4)),
    position: new CANNON.Vec3(0, 12, 0)
});
world.addBody(startPlatformBody);

const platGeo = new THREE.BoxGeometry(8, 1, 8); // Full dimensions for Three.js
const platMat = new THREE.MeshStandardMaterial({ color: 0x7bed9f }); // Soft green
const startPlatformMesh = new THREE.Mesh(platGeo, platMat);
startPlatformMesh.position.copy(startPlatformBody.position); // Set visual to match physics
startPlatformMesh.receiveShadow = true;
scene.add(startPlatformMesh);


// --- TARGET ZONE ---
const targetBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(5, 0.5, 5)),
    position: new CANNON.Vec3(15, -5, 0) // Placed down and to the right
});
world.addBody(targetBody);

const targetGeo = new THREE.BoxGeometry(10, 1, 10);
const targetMat = new THREE.MeshStandardMaterial({ 
    color: 0x1e90ff, // Bright blue
    emissive: 0x1e90ff, // Makes it glow slightly
    emissiveIntensity: 0.4
});
const targetMesh = new THREE.Mesh(targetGeo, targetMat);
targetMesh.position.copy(targetBody.position);
targetMesh.receiveShadow = true;
scene.add(targetMesh);


// ==========================================
// 4. THE GAME LOOP
// ==========================================
const timeStep = 1 / 60; 

function animate() {
    requestAnimationFrame(animate);

    world.step(timeStep);

    // Sync visual meshes with their physics bodies
    objectsToUpdate.forEach(obj => {
        obj.mesh.position.copy(obj.body.position);
        obj.mesh.quaternion.copy(obj.body.quaternion);
    });

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
