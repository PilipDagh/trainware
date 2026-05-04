const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gameState = null;
let keys = { w: false, a: false, s: false, d: false };
let mouseX = 0, mouseY = 0;

// Joystick States
let moveJoystick = { active: false, x: 0, y: 0 };
let aimJoystick = { active: false, x: 0, y: 0 };

const TRAIN_CARS = [
    { id: 'engine', x: 120, w: 160, y: -40, h: 80 },
    { id: 'coal', x: 10, w: 100, y: -35, h: 70 },
    { id: 'pass1', x: -140, w: 140, y: -40, h: 80 },
    { id: 'pass2', x: -290, w: 140, y: -40, h: 80 },
    { id: 'caboose', x: -400, w: 100, y: -35, h: 70 }
];

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// --- LOBBY & SETTINGS ---
function showCreateLobby() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('create-lobby').classList.remove('hidden');
}
function showJoinLobby() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('join-lobby').classList.remove('hidden');
    socket.emit('getLobbies');
}
function showSettings() {
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('settings-menu').classList.remove('hidden');
}
function backToMain() {
    document.querySelectorAll('#menu-container > div').forEach(d => d.classList.add('hidden'));
    document.getElementById('main-menu').classList.remove('hidden');
}
function saveSettings() {
    const settings = {
        hasAutoLock: document.getElementById('autolock-toggle').checked
    };
    socket.emit('updateSettings', settings);
    backToMain();
}
function createLobby() {
    let name = document.getElementById('lobbyName').value;
    let maxPlayers = document.getElementById('maxPlayers').value;
    let password = document.getElementById('lobbyPassword').value;
    socket.emit('createLobby', { name, maxPlayers, password });
}
function joinLobby(roomId, isPrivate) {
    let password = isPrivate ? prompt('Enter Password:') : '';
    let playerName = document.getElementById('playerName').value;
    socket.emit('joinLobby', { roomId, password, playerName });
}
function startGame() { socket.emit('startGame'); }

// --- JOYSTICK LOGIC ---
function setupJoystick(containerId, knobId, onMove) {
    const container = document.getElementById(containerId);
    const knob = document.getElementById(knobId);
    const rect = container.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const handleTouch = (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        let dx = touch.clientX - (rect.left + centerX);
        let dy = touch.clientY - (rect.top + centerY);
        const dist = Math.hypot(dx, dy);
        const maxDist = rect.width / 2;

        if (dist > maxDist) {
            dx *= maxDist / dist;
            dy *= maxDist / dist;
        }

        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        onMove(dx / maxDist, dy / maxDist);
    };

    const resetKnob = () => {
        knob.style.transform = `translate(0, 0)`;
        onMove(0, 0);
    };

    container.addEventListener('touchstart', handleTouch);
    container.addEventListener('touchmove', handleTouch);
    container.addEventListener('touchend', resetKnob);
}

setupJoystick('move-joystick-container', 'move-joystick-knob', (nx, ny) => {
    moveJoystick = { x: nx, y: ny };
});

setupJoystick('aim-joystick-container', 'aim-joystick-knob', (nx, ny) => {
    if (nx !== 0 || ny !== 0) {
        socket.emit('aim', Math.atan2(ny, nx));
    }
});

// --- INPUTS ---
window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (key === 'e') socket.emit('interact');
    if (key === 'r') socket.emit('reload');
    if (key === 'b') socket.emit('placeBarrel');
    if (key === 'f') {
        if (gameState && gameState.players[socket.id]) {
            let p = gameState.players[socket.id];
            socket.emit('throwBomb', { x: p.x + Math.cos(p.aimAngle)*150, y: p.y + Math.sin(p.aimAngle)*150 });
        }
    }
    if (e.key === ' ') socket.emit('stab');
});
window.addEventListener('keyup', (e) => { if (keys.hasOwnProperty(e.key.toLowerCase())) keys[e.key.toLowerCase()] = false; });

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (gameState && gameState.players[socket.id]) {
        let p = gameState.players[socket.id];
        socket.emit('aim', Math.atan2(mouseY - (canvas.height/2 + p.y), mouseX - (canvas.width/2 + p.x)));
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.id === 'gameCanvas') {
        let myPlayer = gameState.players[socket.id];
        if (myPlayer && gameState.train.state === 'STOPPED') {
            let worldX = (mouseX - canvas.width/2) + myPlayer.x;
            let worldY = (mouseY - canvas.height/2) + myPlayer.y;
            for (let ore of gameState.ores) {
                if (Math.hypot(worldX - ore.x, worldY - ore.y) < 100) {
                    socket.emit('mine', ore.id);
                    return;
                }
            }
        }
        socket.emit('shoot');
    }
});

// Mobile Action Bindings
document.getElementById('btn-shoot').onclick = () => socket.emit('shoot');
document.getElementById('btn-interact').onclick = () => socket.emit('interact');
document.getElementById('btn-reload').onclick = () => socket.emit('reload');
document.getElementById('btn-bomb').onclick = () => {
    let p = gameState.players[socket.id];
    socket.emit('throwBomb', { x: p.x + Math.cos(p.aimAngle)*150, y: p.y + Math.sin(p.aimAngle)*150 });
};
document.getElementById('btn-barrel').onclick = () => socket.emit('placeBarrel');
document.getElementById('btn-knife').onclick = () => socket.emit('stab');

// --- SOCKETS ---
socket.on('lobbyList', (lobbies) => {
    let list = document.getElementById('lobby-list');
    list.innerHTML = lobbies.length ? '' : '<p>No lobbies found.</p>';
    lobbies.forEach(l => {
        list.innerHTML += `<div class="lobby-item"><span>${l.name} (${l.players}/${l.maxPlayers})</span><button onclick="joinLobby('${l.id}', ${l.isPrivate})">Join</button></div>`;
    });
});
socket.on('lobbyCreated', (id) => joinLobby(id, false));
socket.on('lobbyUpdate', (room) => {
    document.querySelectorAll('#menu-container > div').forEach(d => d.classList.add('hidden'));
    document.getElementById('in-lobby').classList.remove('hidden');
    document.getElementById('lobby-title').innerText = room.name;
    document.getElementById('lobby-players').innerHTML = Object.values(room.players).map(p => `<li style="color:${p.color}">${p.name}</li>`).join('');
});
socket.on('gameStarted', () => {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    canvas.classList.remove('hidden');
    if (document.getElementById('mobile-toggle').checked || 'ontouchstart' in window) {
        document.getElementById('mobile-controls').classList.remove('hidden');
    }
});
socket.on('state', (s) => { gameState = s; updateUI(); });
socket.on('msg', (m) => {
    let el = document.getElementById('messages');
    el.innerText = m; setTimeout(() => el.innerText = '', 4000);
});
socket.on('openShop', () => { document.getElementById('shop').classList.remove('hidden'); renderShop(); });
socket.on('allDead', () => document.getElementById('all-dead').classList.remove('hidden'));
socket.on('victory', () => document.getElementById('victory').classList.remove('hidden'));

function closeShop() { document.getElementById('shop').classList.add('hidden'); }
function spectateNext() { socket.emit('spectateNext'); }
function voteRestart() { socket.emit('voteRestart'); }

function renderShop() {
    let cont = document.getElementById('shop-items');
    cont.innerHTML = gameState.shop.items.map(i => `<button onclick="socket.emit('buy', '${i.id}')">${i.name} - $${i.cost}</button>`).join('');
}

function updateUI() {
    if (!gameState || !gameState.players[socket.id]) return;
    let p = gameState.players[socket.id];
    document.getElementById('hp').innerText = Math.floor(p.hp);
    document.getElementById('mag').innerText = p.mag;
    document.getElementById('ammo').innerText = p.bullets;
    document.getElementById('money').innerText = p.money;
    document.getElementById('dist').innerText = Math.floor(gameState.train.distance);
    document.getElementById('biome').innerText = gameState.biome.toUpperCase();
    document.getElementById('fuel').innerText = Math.floor(gameState.train.fuel);
    document.getElementById('speed').innerText = Math.floor(gameState.train.speed);
    document.getElementById('inv-gold').innerText = p.inventory.gold;
    document.getElementById('inv-silver').innerText = p.inventory.silver;
    document.getElementById('inv-coal').innerText = p.inventory.coal;

    let dep = document.getElementById('departure-warning');
    if (gameState.train.state === 'DEPARTING') {
        dep.classList.remove('hidden');
        document.getElementById('dep-timer').innerText = Math.ceil(gameState.train.departureTimer);
    } else dep.classList.add('hidden');

    canvas.className = p.drunk.sips >= 3 ? 'drunk-active' : '';
}
function drawHumanoid(x, y, color, angle, hasKnife, onHorse, isEnemy, enemyType, name) {
    ctx.save();
    ctx.translate(x, y);
    if (name) {
        ctx.fillStyle = 'white'; ctx.font = '12px monospace'; ctx.textAlign = 'center';
        ctx.fillText(name, 0, -35);
    }
    ctx.rotate(angle);
    if (onHorse) {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(-20, -15, 50, 30); ctx.fillRect(20, -10, 20, 20);
    }
    ctx.fillStyle = color; ctx.fillRect(-8, -12, 16, 24); // Body
    ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill(); // Head
    
    // Hat
    ctx.fillStyle = isEnemy ? '#333' : '#111';
    ctx.fillRect(-10, -10, 20, 5);

    // Weapon
    ctx.fillStyle = (hasKnife || enemyType === 'knifeman') ? '#ccc' : '#333';
    ctx.fillRect(10, 8, 15, 4);
    ctx.restore();
}

function drawTrain() {
    ctx.fillStyle = '#444';
    // Connectors
    for(let i=-300; i<200; i+=140) ctx.fillRect(i, -5, 20, 10);

    TRAIN_CARS.forEach(car => {
        ctx.save();
        ctx.translate(car.x, car.y);
        if (car.id === 'engine') {
            ctx.fillStyle = '#222'; ctx.fillRect(0, 0, car.w-40, car.h);
            ctx.fillStyle = '#111'; ctx.fillRect(car.w-60, -10, 60, car.h+20);
            ctx.fillStyle = (gameState.train.state === 'STOPPED' || gameState.train.state === 'DEPARTING') ? '#0f0' : '#f00';
            ctx.beginPath(); ctx.arc(120, 40, 12, 0, Math.PI*2); ctx.fill();
        } else if (car.id === 'coal') {
            ctx.fillStyle = '#333'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#ffaa00'; ctx.fillRect(40, 25, 20, 20);
        } else {
            ctx.fillStyle = car.id === 'caboose' ? '#800' : '#5d2e0a';
            ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#87ceeb';
            for(let i=15; i<car.w-15; i+=30) ctx.fillRect(i, 5, 15, 15);
        }
        ctx.restore();
    });
}

function draw() {
    if (!gameState || gameState.status === 'LOBBY') { requestAnimationFrame(draw); return; }

    let myPlayer = gameState.players[socket.id];
    if (!myPlayer) return requestAnimationFrame(draw);

    // Camera follows spectated player or self
    let cam = (myPlayer.dead && myPlayer.spectatingId) ? gameState.players[myPlayer.spectatingId] : myPlayer;
    if (!cam) cam = myPlayer;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. Biome Background
    let bg = '#2d4c1e';
    if (gameState.biome === 'desert') bg = '#c2b280';
    if (gameState.biome === 'tundra') bg = '#e0e6ed';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width/2, canvas.height/2);

    // 2. Parallax Mountains
    if (gameState.inMountains) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        let mOff = (gameState.train.distance * 500) % 800;
        for(let i=-2; i<3; i++) {
            ctx.beginPath();
            ctx.moveTo(i*800 - mOff, -100); ctx.lineTo(i*800 + 400 - mOff, -500); ctx.lineTo(i*800 + 800 - mOff, -100);
            ctx.fill();
        }
    }

    // 3. Scrolling Tracks
    let tOff = (gameState.train.distance * 5000) % 60;
    ctx.fillStyle = '#4a3c31';
    for(let i=-20; i<20; i++) ctx.fillRect(i*60 - tOff, -40, 15, 80);
    ctx.fillStyle = '#777';
    ctx.fillRect(-canvas.width, -30, canvas.width*2, 6);
    ctx.fillRect(-canvas.width, 24, canvas.width*2, 6);

    // 4. World Objects (Ores, Towns, Enemies)
    // These are already scrolled by the server's dx logic
    gameState.ores.forEach(o => {
        ctx.fillStyle = o.type === 'gold' ? 'gold' : (o.type === 'silver' ? 'silver' : '#222');
        ctx.beginPath(); ctx.arc(o.x - cam.x, o.y - cam.y, 15, 0, Math.PI*2); ctx.fill();
    });

    if (gameState.townX !== null) {
        ctx.fillStyle = '#5d2e0a';
        for(let i=-2; i<3; i++) ctx.fillRect((gameState.townX + i*300) - cam.x, 100 - cam.y, 150, 100);
    }

    if (gameState.shopNPC) {
        ctx.fillStyle = 'blue'; ctx.fillRect(gameState.shopNPC.x - cam.x - 10, gameState.shopNPC.y - cam.y - 10, 20, 20);
    }

    gameState.barrels.forEach(b => {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(b.x - cam.x - 15, b.y - cam.y - 20, 30, 40);
    });

    gameState.enemies.forEach(e => {
        drawHumanoid(e.x - cam.x, e.y - cam.y, '#700', e.aimAngle, false, e.hasHorse, true, e.type, null);
    });

    // 5. Static Train (Relative to camera)
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawTrain();
    ctx.restore();

    // 6. Players
    for (let id in gameState.players) {
        let p = gameState.players[id];
        if (!p.dead) drawHumanoid(p.x - cam.x, p.y - cam.y, p.color, p.aimAngle, p.hasKnife, p.onHorse, false, null, p.name);
    }

    // 7. Projectiles
    ctx.fillStyle = 'yellow';
    gameState.projectiles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, 4, 0, Math.PI*2); ctx.fill();
    });

    ctx.restore();

    // Movement Emission
    let dx = 0, dy = 0;
    if (keys.w) dy--; if (keys.s) dy++; if (keys.a) dx--; if (keys.d) dx++;
    if (moveJoystick.x !== 0 || moveJoystick.y !== 0) { dx = moveJoystick.x; dy = moveJoystick.y; }
    if (dx !== 0 || dy !== 0) {
        let mag = Math.hypot(dx, dy);
        socket.emit('move', { dx: dx/mag, dy: dy/mag });
    }

    requestAnimationFrame(draw);
}
draw();
