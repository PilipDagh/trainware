const socket = io();
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let myId = null;
let lobbyId = null;
let gameState = null;
let keys = {};
let mouse = { x: 0, y: 0, down: false };
let autoLock = false;
let mobileMode = false;

// UI Elements
const mainMenu = document.getElementById('main-menu');
const hud = document.getElementById('hud');
const warningMsg = document.getElementById('warning-msg');

function createLobby() {
    let name = document.getElementById('player-name').value;
    autoLock = document.getElementById('auto-lock').checked;
    mobileMode = document.getElementById('mobile-mode').checked;
    let isTraitor = Math.random() < 0.2; // 20% chance to be traitor on create for testing
    socket.emit('create_lobby', { name, isTraitor });
}

function joinLobby() {
    let name = document.getElementById('player-name').value;
    let lid = document.getElementById('lobby-id').value;
    autoLock = document.getElementById('auto-lock').checked;
    mobileMode = document.getElementById('mobile-mode').checked;
    socket.emit('join_lobby', { lobbyId: lid, name });
}

socket.on('init_game', (data) => {
    myId = data.player.id;
    lobbyId = data.lobbyId;
    mainMenu.style.display = 'none';
    if (mobileMode) document.getElementById('mobile-controls').style.display = 'block';
    
    // Show Role Reveal
    let roleDiv = document.createElement('div');
    roleDiv.style.position = 'absolute'; roleDiv.style.top = '40%'; roleDiv.style.width = '100%';
    roleDiv.style.textAlign = 'center'; roleDiv.style.fontSize = '40px'; roleDiv.style.color = data.player.isTraitor ? 'red' : 'cyan';
    roleDiv.style.fontFamily = 'Sancreek'; roleDiv.style.textShadow = '2px 2px #000';
    roleDiv.innerHTML = `You are: ${data.player.role.name}<br><span style="font-size:20px">${data.player.role.desc}</span>`;
    if (data.player.isTraitor) roleDiv.innerHTML += `<br><b>TRAITOR</b>`;
    document.body.appendChild(roleDiv);
    setTimeout(() => roleDiv.remove(), 4000);
});

socket.on('state_update', (state) => {
    gameState = state;
    updateHUD();
});

socket.on('train_warning', (time) => {
    warningMsg.style.display = 'block';
    warningMsg.innerText = `TRAIN DEPARTING IN ${time} SECONDS`;
    let int = setInterval(() => {
        time--;
        warningMsg.innerText = `TRAIN DEPARTING IN ${time} SECONDS`;
        if (time <= 0) { clearInterval(int); warningMsg.style.display = 'none'; }
    }, 1000);
});

socket.on('trade_update', (trade) => {
    if (trade.active) {
        document.getElementById('trade-countdown').style.display = 'block';
        document.getElementById('trade-countdown').innerText = `Trade in ${trade.timer}...`;
    } else {
        document.getElementById('trade-countdown').style.display = 'none';
    }
    // Update sliders and visuals based on trade object
});

// Input Handling
window.addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'e') socket.emit('interact', 'toggle_train'); // Simplified interaction
    if (e.key.toLowerCase() === 't') socket.emit('interact', 'release_steam');
    if (e.key.toLowerCase() === 'y') socket.emit('interact', 'eat');
    if (e.key.toLowerCase() === 'l') socket.emit('interact', 'toggle_light');
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
window.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('mousedown', e => { mouse.down = true; socket.emit('interact', 'mine'); });
window.addEventListener('mouseup', e => mouse.down = false);

function updateHUD() {
    if (!gameState || !gameState.players[myId]) return;
    let p = gameState.players[myId];
    let t = gameState.train;
    
    document.getElementById('health-display').innerText = `HP: ${Math.floor(p.hp)} / ${p.maxHp}`;
    document.getElementById('ammo-display').innerText = `Ammo: ${p.inventory.ammo}`;
    document.getElementById('money-display').innerText = `Money: $${p.inventory.money}`;
    document.getElementById('role-display').innerText = `Role: ${p.role.name}`;
    
    document.getElementById('distance-display').innerText = `Distance: ${Math.floor(t.distance)} / 3181 km (${gameState.state.biome})`;
    document.getElementById('fuel-display').innerText = `Fuel: ${Math.floor(t.fuel)} / ${t.maxFuel}`;
    document.getElementById('speed-display').innerText = `Speed: ${Math.floor(t.speed)} km/h`;
    document.getElementById('pressure-display').innerText = `Pressure: ${Math.floor(t.pressure)} / 100`;

    if (p.sips >= 3 && p.sips < 11) document.body.classList.add('drunk-mode');
    else document.body.classList.remove('drunk-mode');
}

// Send Input Loop
setInterval(() => {
    if (!gameState || !gameState.players[myId]) return;
    let dx = 0, dy = 0;
    if (keys['w']) dy = -1; if (keys['s']) dy = 1;
    if (keys['a']) dx = -1; if (keys['d']) dx = 1;
    
    // Normalize
    let len = Math.hypot(dx, dy);
    if (len > 0) { dx /= len; dy /= len; }

    // Calculate Aim
    let p = gameState.players[myId];
    let screenX = canvas.width/2;
    let screenY = canvas.height/2;
    let aimAngle = Math.atan2(mouse.y - screenY, mouse.x - screenX);

    if (autoLock) {
        // Find nearest enemy
        let nearest = null; let minDist = 300;
        gameState.world.enemies.forEach(e => {
            let dist = Math.hypot(e.x - p.x, e.y - p.y);
            if (dist < minDist) { minDist = dist; nearest = e; }
        });
        if (nearest) aimAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    }

    socket.emit('input', { dx, dy, dt: 1/30, aimAngle });
}, 1000/30);
// Rendering Loop
function render() {
    requestAnimationFrame(render);
    if (!gameState || !gameState.players[myId]) return;

    let p = gameState.players[myId];
    let t = gameState.train;

    // Camera offset (Center on player)
    let camX = p.x - canvas.width / 2;
    let camY = p.y - canvas.height / 2;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw Background (Parallax based on distance)
    ctx.fillStyle = gameState.state.biome === 'Desert' ? '#d2b48c' : gameState.state.biome === 'Tundra' ? '#e0ffff' : '#228b22';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw Tracks
    ctx.fillStyle = '#3e2723';
    if (gameState.state.bridgeOut) {
        // Draw broken bridge
        ctx.fillRect(-1000, 280, 5000, 40);
        ctx.fillStyle = '#111'; // River
        ctx.fillRect(t.cars[0].x + 300, 0, 400, 1000);
    } else {
        ctx.fillRect(-1000, 280, 5000, 40); // Infinite tracks
    }

    // Draw Train Cars
    t.cars.forEach(car => {
        ctx.fillStyle = car.type === 'Engine' ? '#111' : car.type === 'Coal' ? '#333' : '#8b0000';
        ctx.fillRect(car.x, 250, car.w - 10, 100);
        ctx.fillStyle = '#fff';
        ctx.font = '20px Rye';
        ctx.fillText(car.type, car.x + 20, 300);
    });

    // Draw World Objects (Ores, Enemies, Planks)
    // Offset by train distance to simulate scrolling if off train
    let worldOffsetX = -(t.distance * 100) % 2000; // Simplified local wrapping for visuals

    gameState.world.ores.forEach(ore => {
        ctx.fillStyle = ore.type === 'gold' ? '#ffd700' : ore.type === 'silver' ? '#c0c0c0' : '#000';
        ctx.beginPath(); ctx.arc(ore.x, ore.y, 15, 0, Math.PI*2); ctx.fill();
    });

    gameState.world.planks.forEach(plank => {
        ctx.fillStyle = '#deb887';
        ctx.fillRect(plank.x, plank.y, 30, 10);
    });

    gameState.world.steamClouds.forEach(cloud => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath(); ctx.arc(cloud.x, cloud.y, 60, 0, Math.PI*2); ctx.fill();
    });

    // Draw Players
    Object.values(gameState.players).forEach(player => {
        if (player.isDead) return;
        ctx.fillStyle = player.id === myId ? '#00f' : (player.isTraitor && p.isTraitor) ? '#f00' : '#0f0';
        ctx.beginPath(); ctx.arc(player.x, player.y, 15, 0, Math.PI*2); ctx.fill();
        
        // Draw Aim Line
        ctx.strokeStyle = 'rgba(255,0,0,0.5)';
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.x + Math.cos(player.aimAngle)*50, player.y + Math.sin(player.aimAngle)*50);
        ctx.stroke();

        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(player.name, player.x - 15, player.y - 20);
    });

    ctx.restore();

    // Tunnel of Darkness Effect
    if (gameState.state.tunnelActive) {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = 'destination-out';
        
        // Player Light
        let radius = p.flashlight ? 200 : 100;
        let grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 0, canvas.width/2, canvas.height/2, radius);
        grad.addColorStop(0, 'rgba(0,0,0,1)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(canvas.width/2, canvas.height/2, radius, 0, Math.PI*2); ctx.fill();

        // Engine Headlight
        let engX = t.cars[0].x + 200 - camX;
        let engY = 300 - camY;
        let coneLen = t.headlightUpgraded ? 800 : 400;
        ctx.beginPath();
        ctx.moveTo(engX, engY);
        ctx.lineTo(engX + coneLen, engY - 200);
        ctx.lineTo(engX + coneLen, engY + 200);
        ctx.fill();

        ctx.globalCompositeOperation = 'source-over';
    }
}

// Start Render Loop
render();

// UI Modal Helpers
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function openModal(id) { document.getElementById(id).style.display = 'block'; }

// Trading UI Logic
function confirmTrade() { socket.emit('trade_confirm'); }
function declineTrade() { socket.emit('trade_decline'); closeModal('trade-menu'); }

// Listen for E key near cars to open menus
window.addEventListener('keydown', e => {
    if (e.key.toLowerCase() === 'e' && gameState && gameState.players[myId]) {
        let p = gameState.players[myId];
        if (p.x > 1000 && p.x <= 1200) openModal('gamble-menu'); // Gambling Car
        if (p.x > 1200 && p.x <= 1400) { // Trading Car
            openModal('trade-menu');
            socket.emit('trade_sit', 1); // Auto sit seat 1 for demo
        }
        if (p.x > 1400 && p.x <= 1600 && gameState.storage.count > 0) openModal('storage-menu'); // Storage
    }
});
