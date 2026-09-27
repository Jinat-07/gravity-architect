// ==========================================
// 1. INITIALIZE PHYSICS WORLD
// ==========================================
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0); 
world.broadphase = new CANNON.NaiveBroadphase(); 
world.solver.iterations = 10;

const defaultMaterial = new CANNON.Material('default');
const rampMaterial = new CANNON.Material('ramp');
const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, rampMaterial, { friction: 0.1, restitution: 0.6 });
world.addContactMaterial(contactMaterial);

// ==========================================
// 2. INITIALIZE VISUAL WORLD
// ==========================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 40); 
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true; 
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
scene.add(directionalLight);

const invisiblePlaneGeo = new THREE.PlaneGeometry(1000, 1000);
const invisiblePlaneMat = new THREE.MeshBasicMaterial({ visible: false });
const dragPlane = new THREE.Mesh(invisiblePlaneGeo, invisiblePlaneMat);
scene.add(dragPlane);

// ==========================================
// 3. GAME OBJECTS & LEVEL SYSTEM
// ==========================================
const objectsToUpdate = [];
let gameOver = false;
let currentLevel = 0;

// Level Coordinates: { startPlatform, targetZone }
const levelConfigs = [
    { start: { x: -10, y: 5 }, target: { x: 10, y: -10 } },   // L1: Standard
    { start: { x: -15, y: 10 }, target: { x: 15, y: -5 } },   // L2: Wider gap
    { start: { x: -10, y: -5 }, target: { x: 15, y: 10 } },   // L3: Build upwards
    { start: { x: 0, y: 15 }, target: { x: 0, y: -15 } },     // L4: Straight down drop
    { start: { x: 15, y: 10 }, target: { x: -15, y: -5 } }    // L5: Right to Left
];

const startPosition = new CANNON.Vec3(0, 0, 0);

// Create Ball
const ballRadius = 1;
const ballBody = new CANNON.Body({ type: CANNON.Body.STATIC, mass: 0, shape: new CANNON.Sphere(ballRadius), material: defaultMaterial });
world.addBody(ballBody);
const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(ballRadius, 32, 32), new THREE.MeshStandardMaterial({ color: 0xff4757, roughness: 0.3 }));
ballMesh.castShadow = true;
scene.add(ballMesh);
objectsToUpdate.push({ mesh: ballMesh, body: ballBody });

// Create Start Platform
const startPlatformBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(4, 0.5, 4)), material: defaultMaterial });
world.addBody(startPlatformBody);
const startPlatformMesh = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 8), new THREE.MeshStandardMaterial({ color: 0x7bed9f }));
startPlatformMesh.receiveShadow = true;
scene.add(startPlatformMesh);

// Create Target Zone
const targetBody = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(5, 0.5, 5)), material: defaultMaterial });
world.addBody(targetBody);
const targetMesh = new THREE.Mesh(new THREE.BoxGeometry(10, 1, 10), new THREE.MeshStandardMaterial({ color: 0x1e90ff, emissive: 0x1e90ff, emissiveIntensity: 0.4 }));
targetMesh.receiveShadow = true;
scene.add(targetMesh);

// Load Level Function
function loadLevel(index) {
    currentLevel = parseInt(index);
    let config;
    
    if (currentLevel < levelConfigs.length) {
        config = levelConfigs[currentLevel];
    } else {
        // Procedural Random Level if player beats Level 5
        config = {
            start: { x: -15 + Math.random() * 10, y: 5 + Math.random() * 10 },
            target: { x: 5 + Math.random() * 10, y: -15 + Math.random() * 20 }
        };
        // Ensure new option exists in dropdown
        const select = document.getElementById('level-select');
        if(!select.querySelector(`option[value="${currentLevel}"]`)){
            const opt = document.createElement('option');
            opt.value = currentLevel;
            opt.innerText = `Level ${currentLevel + 1} (Random)`;
            select.appendChild(opt);
        }
    }

    startPlatformBody.position.set(config.start.x, config.start.y, 0);
    startPlatformMesh.position.copy(startPlatformBody.position);
    
    targetBody.position.set(config.target.x, config.target.y, 0);
    targetMesh.position.copy(targetBody.position);
    
    startPosition.set(config.start.x, config.start.y + 10, 0);
    
    document.getElementById('level-select').value = currentLevel;
    resetLevel();
}

ballBody.addEventListener("collide", function(e) {
    if (gameOver) return;
    if (e.body === targetBody) {
        gameOver = true;
        showModal("Level Cleared! 🎯", true);
    }
});

// ==========================================
// 4. PLAYER INTERACTION (MOUSE & TOUCH)
// ==========================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let isDrawing = false;
let startDrawPoint = new THREE.Vector3();
const drawnRamps = []; 

function getPointer3DPosition(event) {
    let clientX, clientY;
    if (event.changedTouches) {
        clientX = event.changedTouches[0].clientX;
        clientY = event.changedTouches[0].clientY;
    } else {
        clientX = event.clientX;
        clientY = event.clientY;
    }
    mouse.x = (clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(dragPlane);
    return intersects.length > 0 ? intersects[0].point : null;
}

function startDrawing(event) {
    if(event.target.tagName === 'BUTTON' || event.target.tagName === 'SELECT' || gameOver) return; 
    const point = getPointer3DPosition(event);
    if (point) {
        isDrawing = true;
        startDrawPoint.copy(point);
    }
}

function endDrawing(event) {
    if (!isDrawing || gameOver) return;
    isDrawing = false;
    const endDrawPoint = getPointer3DPosition(event);
    if (endDrawPoint) createRamp(startDrawPoint, endDrawPoint);
}

// Bind both Mouse and Touch events
window.addEventListener('mousedown', startDrawing);
window.addEventListener('touchstart', startDrawing, { passive: false });
window.addEventListener('mouseup', endDrawing);
window.addEventListener('touchend', endDrawing);

function createRamp(startP, endP) {
    const distance = startP.distanceTo(endP);
    if (distance < 1) return; 

    const midX = (startP.x + endP.x) / 2;
    const midY = (startP.y + endP.y) / 2;
    const angle = Math.atan2(endP.y - startP.y, endP.x - startP.x);

    const rampBody = new CANNON.Body({
        mass: 0, shape: new CANNON.Box(new CANNON.Vec3(distance / 2, 0.25, 2)),
        position: new CANNON.Vec3(midX, midY, 0), material: rampMaterial
    });
    rampBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 0, 1), angle);
    world.addBody(rampBody);

    const rampMesh = new THREE.Mesh(new THREE.BoxGeometry(distance, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0xf1c40f }));
    rampMesh.position.copy(rampBody.position);
    rampMesh.quaternion.copy(rampBody.quaternion);
    rampMesh.receiveShadow = true; rampMesh.castShadow = true;
    scene.add(rampMesh);

    drawnRamps.push({ body: rampBody, mesh: rampMesh });
}

// ==========================================
// 5. UI CONTROLS & GAME STATE
// ==========================================
const btnDrop = document.getElementById('btn-drop');
const btnReset = document.getElementById('btn-reset');
const modal = document.getElementById('message-modal');
const modalTitle = document.getElementById('message-title');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnNextLevel = document.getElementById('btn-next-level');
const levelSelect = document.getElementById('level-select');

function showModal(message, isWin = false) {
    modalTitle.innerText = message;
    modal.classList.remove('hidden');
    if(isWin) {
        btnNextLevel.classList.remove('hidden');
    } else {
        btnNextLevel.classList.add('hidden');
    }
}

btnDrop.addEventListener('click', () => {
    if (gameOver) return;
    ballBody.type = CANNON.Body.DYNAMIC;
    ballBody.mass = 5;
    ballBody.updateMassProperties();
    ballBody.wakeUp();
});

function resetLevel() {
    gameOver = false;
    ballBody.type = CANNON.Body.STATIC;
    ballBody.mass = 0;
    ballBody.updateMassProperties();
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    ballBody.position.copy(startPosition);
    ballBody.quaternion.set(0, 0, 0, 1);

    drawnRamps.forEach(ramp => { world.removeBody(ramp.body); scene.remove(ramp.mesh); });
    drawnRamps.length = 0; 
    modal.classList.add('hidden');
}

btnReset.addEventListener('click', resetLevel);
btnPlayAgain.addEventListener('click', resetLevel);
btnNextLevel.addEventListener('click', () => { loadLevel(currentLevel + 1); });
levelSelect.addEventListener('change', (e) => { loadLevel(e.target.value); });

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

    if (!gameOver && ballBody.position.y < -25) {
        gameOver = true;
        showModal("Fell into the abyss! 🌌", false);
    }

    renderer.render(scene, camera);
}

// Initialize the first level to start the game
loadLevel(0);
animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
