// ==========================================
// 1. INITIALIZE PHYSICS WORLD (Cannon.js)
// ==========================================
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); 
world.broadphase = new CANNON.NaiveBroadphase(); 
world.solver.iterations = 10;

const defaultMaterial = new CANNON.Material('default');
const rampMaterial = new CANNON.Material('ramp');
const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, rampMaterial, {
    friction: 0.1,    
    restitution: 0.6  
});
world.addContactMaterial(contactMaterial);

// ==========================================
// 2. INITIALIZE VISUAL WORLD (Three.js)
// ==========================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 40); 
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
const startPosition = new CANNON.Vec3(-10, 15, 0);

const ballBody = new CANNON.Body({
    mass: 0, // Starts at 0 so it floats until 'Drop' is pressed
    shape: new CANNON.Sphere(ballRadius),
    position: startPosition.clone(), 
    material: defaultMaterial 
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
const targetMat = new THREE.MeshStandardMaterial({ color: 0x1e90ff, emissive: 0x1e90ff, emissiveIntensity: 0.4 });
const targetMesh = new THREE.Mesh(targetGeo, targetMat);
targetMesh.position.copy(targetBody.position);
targetMesh.receiveShadow = true;
scene.add(targetMesh);

// ==========================================
// 4. PLAYER INTERACTION & RAMPS
// ==========================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDrawing = false;
let startDrawPoint = new THREE.Vector3();
const drawnRamps = []; // Array to store user-created ramps

function getMouse3DPosition(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dragPlane);
    return intersects.length > 0 ? intersects[0].point : null;
}

window.addEventListener('mousedown', (event) => {
    // Prevent drawing if clicking UI buttons
    if(event.target.tagName === 'BUTTON') return; 

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
    if (endDrawPoint) createRamp(startDrawPoint, endDrawPoint);
});

function createRamp(startP, endP) {
    const distance = startP.distanceTo(endP);
    if (distance < 1) return; 

    const midX = (startP.x + endP.x) / 2;
    const midY = (startP.y + endP.y) / 2;
    const midZ = 0; 
    const angle = Math.atan2(endP.y - startP.y, endP.x - startP.x);

    const rampBody = new CANNON.Body({
        mass: 0, 
        shape: new CANNON.Box(new CANNON.Vec3(distance / 2, 0.25, 2)),
        position: new CANNON.Vec3(midX, midY, midZ),
        material: rampMaterial
    });
    rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
    world.addBody(rampBody);

    const rampGeo = new THREE.BoxGeometry(distance, 0.5, 4);
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f }); 
    const rampMesh = new THREE.Mesh(rampGeo, rampMat);
    rampMesh.position.copy(rampBody.position);
    rampMesh.quaternion.copy(rampBody.quaternion);
    rampMesh.receiveShadow = true;
    rampMesh.castShadow = true;
    scene.add(rampMesh);

    // Save so we can delete them later
    drawnRamps.push({ body: rampBody, mesh: rampMesh });
}

// ==========================================
// 5. UI CONTROLS & GAME STATE
// ==========================================
document.getElementById('btn-drop').addEventListener('click', () => {
    // Turn on gravity for the ball
    ballBody.mass = 5;
    ballBody.updateMassProperties();
    ballBody.wakeUp(); // Tell physics engine to start calculating it
});

document.getElementById('btn-reset').addEventListener('click', () => {
    // 1. Reset the ball
    ballBody.mass = 0;
    ballBody.updateMassProperties();
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.position.copy(startPosition);
    ballBody.quaternion.set(0, 0, 0, 1);

    // 2. Delete all drawn ramps
    drawnRamps.forEach(ramp => {
        world.removeBody(ramp.body);
        scene.remove(ramp.mesh);
    });
    drawnRamps.length = 0; // Clear the array
});

// ==========================================
// 6. THE GAME LOOP
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
