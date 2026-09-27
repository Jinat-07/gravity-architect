// ==========================================
// 1. INITIALIZE PHYSICS WORLD (Cannon.js)
// ==========================================
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); 
world.broadphase = new CANNON.NaiveBroadphase(); 
world.solver.iterations = 10;

// Create physics materials to make things bouncy
const defaultMaterial = new CANNON.Material('default');
const rampMaterial = new CANNON.Material('ramp');

// Tell the physics engine how these materials interact
const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, rampMaterial, {
    friction: 0.1,    // Slippery ramps
    restitution: 0.6  // Bounciness (0 = thud, 1 = super bouncy)
});
world.addContactMaterial(contactMaterial);


// ==========================================
// 2. INITIALIZE VISUAL WORLD (Three.js)
// ==========================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 40); // Pulled further back to give drawing space
camera.lookAt(0, 0, 0);

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

// An invisible plane at Z=0 for our raycaster to intersect with
// This gives the mouse something to "hit" when drawing in empty space
const invisiblePlaneGeo = new THREE.PlaneGeometry(1000, 1000);
const invisiblePlaneMat = new THREE.MeshBasicMaterial({ visible: false });
const dragPlane = new THREE.Mesh(invisiblePlaneGeo, invisiblePlaneMat);
scene.add(dragPlane);

// ==========================================
// 3. CREATE GAME OBJECTS
// ==========================================
const objectsToUpdate = [];

// --- THE BALL ---
const ballRadius = 1;
const ballBody = new CANNON.Body({
    mass: 5, 
    shape: new CANNON.Sphere(ballRadius),
    position: new CANNON.Vec3(-10, 15, 0), // Moved start position to the left
    material: defaultMaterial // Apply bouncy material
});
world.addBody(ballBody);

const ballGeo = new THREE.SphereGeometry(ballRadius, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.3 }); 
const ballMesh = new THREE.Mesh(ballGeo, ballMat);
ballMesh.castShadow = true;
scene.add(ballMesh);
objectsToUpdate.push({ mesh: ballMesh, body: ballBody });

// --- STARTING PLATFORM ---
const startPlatformBody = new CANNON.Body({
    mass: 0, 
    shape: new CANNON.Box(new CANNON.Vec3(4, 0.5, 4)),
    position: new CANNON.Vec3(-10, 5, 0),
    material: defaultMaterial
});
world.addBody(startPlatformBody);

const platGeo = new THREE.BoxGeometry(8, 1, 8); 
const platMat = new THREE.MeshStandardMaterial({ color: 0x7bed9f }); 
const startPlatformMesh = new THREE.Mesh(platGeo, platMat);
startPlatformMesh.position.copy(startPlatformBody.position); 
startPlatformMesh.receiveShadow = true;
scene.add(startPlatformMesh);

// --- TARGET ZONE ---
const targetBody = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(5, 0.5, 5)),
    position: new CANNON.Vec3(15, -10, 0),
    material: defaultMaterial
});
world.addBody(targetBody);

const targetGeo = new THREE.BoxGeometry(10, 1, 10);
const targetMat = new THREE.MeshStandardMaterial({ 
    color: 0x1e90ff, 
    emissive: 0x1e90ff, 
    emissiveIntensity: 0.4
});
const targetMesh = new THREE.Mesh(targetGeo, targetMat);
targetMesh.position.copy(targetBody.position);
targetMesh.receiveShadow = true;
scene.add(targetMesh);

// ==========================================
// 4. PLAYER INTERACTION (DRAWING RAMPS)
// ==========================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDrawing = false;
let startDrawPoint = new THREE.Vector3();

// Convert screen mouse pixels to a 3D coordinate on our dragPlane
function getMouse3DPosition(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dragPlane);
    
    if (intersects.length > 0) {
        return intersects[0].point;
    }
    return null;
}

window.addEventListener('mousedown', (event) => {
    const point = getMouse3DPosition(event);
    if (point) {
        isDrawing = true;
        startDrawPoint.copy(point);
    }
});

window.addEventListener('mouseup', (event) => {
    if (!isDrawing) return;
    isDrawing = false;
    
    const endDrawPoint = getMouse3DPosition(event);
    if (endDrawPoint) {
        createRamp(startDrawPoint, endDrawPoint);
    }
});

function createRamp(startP, endP) {
    // 1. Calculate the distance (length) of the ramp
    const distance = startP.distanceTo(endP);
    if (distance < 1) return; // Prevent creating tiny useless ramps

    // 2. Calculate the exact middle point to position the ramp
    const midX = (startP.x + endP.x) / 2;
    const midY = (startP.y + endP.y) / 2;
    const midZ = 0; // We keep gameplay strictly on the 2D plane (Z=0)

    // 3. Calculate the angle
    const angle = Math.atan2(endP.y - startP.y, endP.x - startP.x);

    const thickness = 0.5;
    const depth = 4;

    // --- Create Physics Body ---
    const rampBody = new CANNON.Body({
        mass: 0, // Static, won't fall
        shape: new CANNON.Box(new CANNON.Vec3(distance / 2, thickness / 2, depth / 2)),
        position: new CANNON.Vec3(midX, midY, midZ),
        material: rampMaterial
    });
    // Rotate the physics body on the Z axis
    rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
    world.addBody(rampBody);

    // --- Create Visual Mesh ---
    const rampGeo = new THREE.BoxGeometry(distance, thickness, depth);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f }); // Yellow ramps
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    
    rampMesh.position.copy(rampBody.position);
    rampMesh.quaternion.copy(rampBody.quaternion);
    rampMesh.receiveShadow = true;
    rampMesh.castShadow = true;
    
    scene.add(rampMesh);
}

// ==========================================
// 5. THE GAME LOOP
// ==========================================
const timeStep = 1 / 60; 

function animate() {
    requestAnimationFrame(animate);
    world.step(timeStep);

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
