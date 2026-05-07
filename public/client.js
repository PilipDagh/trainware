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

// Updated Train Cars (Now includes Kitchen and Gambling cars)
const TRAIN_CARS =[
    { id: 'engine', x: 120, w: 160, y: -40, h: 80 },
    { id: 'coal', x: 10, w: 100, y: -35, h: 70 },
    { id: 'pass1', x: -140, w: 140, y: -40, h: 80 },
    { id: 'pass2', x: -290, w: 140, y: -40, h: 80 },
    { id: 'kitchen', x: -440, w: 140, y: -40, h: 80 },
    { id: 'gambling', x: -590, w: 140, y: -40, h: 80 },
    { id: 'caboose', x: -700, w: 100, y: -35, h: 70 }
];

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

let storageData = { currentTotal: 0, maxCap: 0 };

// --- BULLETPROOF SCREEN MANAGER ---
window.ui = {
    showScreen: (screenId) => {
        document.querySelectorAll('.menu-panel').forEach(s => s.classList.add('hidden'));
        document.getElementById(screenId).classList.remove('hidden');
    },
    showJoin: () => {
        window.ui.showScreen('screen-join');
        socket.emit('getLobbies');
    },
    createLobby: () => {
        const data = {
            name: document.getElementById('lobbyName').value,
            maxPlayers: document.getElementById('maxPlayers').value,
            password: document.getElementById('lobbyPassword').value
        };
        socket.emit('createLobby', data);
        socket.emit('updateLobbySettings', { traitorEnabled: document.getElementById('traitor-toggle').checked });
    },
    joinLobby: (roomId, isPrivate) => {
        const password = isPrivate ? prompt("Enter Lobby Password:") : "";
        if (isPrivate && password === null) return;
        const playerName = document.getElementById('playerName').value || 'Conductor';
        socket.emit('joinLobby', { roomId, password, playerName });
    },
    saveSettings: () => {
        const settings = { hasAutoLock: document.getElementById('autolock-toggle').checked };
        socket.emit('updateSettings', settings);
        window.ui.showScreen('screen-main');
    },
    startGame: () => socket.emit('startGame'),
    closeShop: () => document.getElementById('shop').classList.add('hidden'),
    closeRevive: () => document.getElementById('revive-menu').classList.add('hidden'),
    closeGambling: () => document.getElementById('gambling-menu').classList.add('hidden'),
    closeStorage: () => document.getElementById('storage-menu').classList.add('hidden'),
    updateStorageUI: () => {
        let g = parseInt(document.getElementById('slider-gold').value) || 0;
        let s = parseInt(document.getElementById('slider-silver').value) || 0;
        let c = parseInt(document.getElementById('slider-coal').value) || 0;
        let totalAdding = g + s + c;
        let available = storageData.maxCap - storageData.currentTotal;
        
        let capText = document.getElementById('storage-cap');
        if (totalAdding > available) capText.style.color = '#ff4444';
        else capText.style.color = '#fff';
        
        document.getElementById('val-gold').innerText = g;
        document.getElementById('val-silver').innerText = s;
        document.getElementById('val-coal').innerText = c;
        capText.innerText = `${storageData.currentTotal + totalAdding}/${storageData.maxCap}`;
    },
    depositStorage: () => {
        let g = parseInt(document.getElementById('slider-gold').value) || 0;
        let s = parseInt(document.getElementById('slider-silver').value) || 0;
        let c = parseInt(document.getElementById('slider-coal').value) || 0;
        socket.emit('depositStorage', { gold: g, silver: s, coal: c });
        window.ui.closeStorage();
    },
    spectateNext: () => socket.emit('spectateNext'),
    voteRestart: () => {
        socket.emit('voteRestart');
        document.getElementById('all-dead').classList.add('hidden');
        document.getElementById('victory').classList.add('hidden');
    }
};

// --- SOCKET LISTENERS ---
socket.on('lobbyList', (lobbies) => {
    const list = document.getElementById('lobby-list');
    list.innerHTML = lobbies.length ? '' : '<p style="text-align:center;">No public trains found.</p>';
    lobbies.forEach(l => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `<span>${l.name} (${l.players}/${l.maxPlayers}) ${l.isPrivate ? '🔒' : ''}</span>`;
        const btn = document.createElement('button');
        btn.className = 'menu-btn'; btn.innerText = 'JOIN';
        btn.onclick = () => window.ui.joinLobby(l.id, l.isPrivate);
        div.appendChild(btn); list.appendChild(div);
    });
});

socket.on('lobbyCreated', (roomId) => {
    const playerName = document.getElementById('playerName').value || 'Conductor';
    const password = document.getElementById('lobbyPassword').value;
    socket.emit('joinLobby', { roomId, password, playerName });
});

socket.on('lobbyUpdate', (room) => {
    window.ui.showScreen('screen-lobby');
    document.getElementById('lobby-title').innerText = `TRAIN: ${room.name}`;
    document.getElementById('player-list').innerHTML = Object.values(room.players)
        .map(p => `<li style="color:${p.color}">${p.name}</li>`).join('');
});

socket.on('gameStarted', () => {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    canvas.classList.remove('hidden');
    
    const forceMobile = document.getElementById('mobile-toggle').checked;
    if (forceMobile || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('mobile-controls').classList.remove('hidden');
    }
});

socket.on('roleReveal', (data) => {
    const revealEl = document.getElementById('role-reveal');
    const titleEl = document.getElementById('role-title');
    const descEl = document.getElementById('role-desc');
    
    titleEl.innerText = data.isTraitor ? 'TRAITOR' : data.role.toUpperCase();
    titleEl.style.color = data.isTraitor ? '#ff4444' : '#44ff44';
    descEl.innerText = data.desc;
    
    revealEl.classList.remove('hidden');
    revealEl.style.animation = 'none';
    void revealEl.offsetWidth; 
    revealEl.style.animation = 'fadeInOut 5s forwards';
    setTimeout(() => { revealEl.classList.add('hidden'); }, 5000);
});

socket.on('state', (state) => { gameState = state; updateUI(); });
socket.on('msg', (msg) => {
    const el = document.getElementById('messages');
    el.innerText = msg;
    setTimeout(() => el.innerText = '', 4000);
});

socket.on('openShop', () => {
    document.getElementById('shop').classList.remove('hidden');
    const cont = document.getElementById('shop-items');
    cont.innerHTML = gameState.shop.items.map(i => {
        let stock = i.stock !== undefined ? ` (${i.stock} left)` : '';
        return `<button class="menu-btn" onclick="socket.emit('buy', '${i.id}')">${i.name} - $${i.cost}${stock}</button>`;
    }).join('');
});

socket.on('openStorageMenu', (data) => {
    storageData = data;
    document.getElementById('storage-menu').classList.remove('hidden');
    let p = gameState.players[socket.id];
    document.getElementById('slider-gold').max = p.inventory.gold;
    document.getElementById('slider-silver').max = p.inventory.silver;
    document.getElementById('slider-coal').max = p.inventory.coal;
    document.getElementById('slider-gold').value = 0;
    document.getElementById('slider-silver').value = 0;
    document.getElementById('slider-coal').value = 0;
    window.ui.updateStorageUI();
});

socket.on('openReviveMenu', (deadPlayers) => {
    document.getElementById('revive-menu').classList.remove('hidden');
    const cont = document.getElementById('dead-players-list');
    if (deadPlayers.length === 0) {
        cont.innerHTML = '<p>No dead players to revive.</p>';
    } else {
        cont.innerHTML = deadPlayers.map(p => 
            `<button class="menu-btn" onclick="socket.emit('revivePlayer', '${p.id}'); window.ui.closeRevive();">Revive ${p.name}</button>`
        ).join('');
    }
});

socket.on('openGambling', (type) => {
    document.getElementById('gambling-menu').classList.remove('hidden');
    let title = type === 'horse' ? 'HORSE RACING' : (type === 'roulette' ? 'ROULETTE' : 'POKER');
    document.getElementById('gamble-title').innerText = title;
    const cont = document.getElementById('gamble-options');
    cont.innerHTML = '';
    
    let options = [];
    if (type === 'horse') options =[{l:'Horse 1 (4x)', v:1}, {l:'Horse 2 (4x)', v:2}, {l:'Horse 3 (4x)', v:3}, {l:'Horse 4 (4x)', v:4}];
    else if (type === 'roulette') options =[{l:'Red (2x)', v:'red'}, {l:'Black (2x)', v:'black'}, {l:'Green (14x)', v:'green'}];
    else if (type === 'poker') options =[{l:'Play Hand (3x)', v:'play'}];
        
    options.forEach(opt => {
        cont.innerHTML += `<button class="menu-btn" onclick="socket.emit('placeBet', {amount: 10, choice: '${opt.v}'})">Bet $10 on ${opt.l}</button>`;
    });
});

socket.on('allDead', () => document.getElementById('all-dead').classList.remove('hidden'));
socket.on('victory', (awards) => { 
    document.getElementById('victory').classList.remove('hidden'); 
    document.getElementById('hof-kills').innerText = awards.leadSlinger;
    document.getElementById('hof-drunk').innerText = awards.drunkard;
    document.getElementById('hof-coal').innerText = awards.workhorse;
    document.getElementById('hof-snake').innerText = awards.snake;
});

// --- INPUT HANDLING (PC) ---
window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (key === 'e') socket.emit('interact');
    if (key === 'r') socket.emit('reload');
    if (key === 'b') socket.emit('placeBarrel');
    if (key === 'l') socket.emit('toggleFlashlight');
    if (key === 't') socket.emit('startSteam');
    if (key === 'y') socket.emit('eatMeat');
    if (key === 'f') {
        if (gameState && gameState.players[socket.id]) {
            let p = gameState.players[socket.id];
            socket.emit('throwBomb', { x: p.x + Math.cos(p.aimAngle)*150, y: p.y + Math.sin(p.aimAngle)*150 });
        }
    }
    if (e.key === ' ') socket.emit('stab'); 
});
window.addEventListener('keyup', (e) => { 
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false; 
    if (key === 't') socket.emit('stopSteam');
});

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (gameState && gameState.players[socket.id]) {
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        socket.emit('aim', Math.atan2(mouseY - cy, mouseX - cx));
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.id === 'gameCanvas') {
        let myPlayer = gameState.players[socket.id];
        let clickedOre = false;
        if (myPlayer && gameState.train.state === 'STOPPED') {
            let cx = canvas.width / 2; let cy = canvas.height / 2;
            let worldX = (mouseX - cx) + myPlayer.x;
            let worldY = (mouseY - cy) + myPlayer.y;
            for (let ore of gameState.ores) {
                if (Math.hypot(worldX - ore.x, worldY - ore.y) < 100) {
                    socket.emit('mine', ore.id);
                    clickedOre = true; break;
                }
            }
        }
        if (!clickedOre) socket.emit('shoot');
    }
});

// --- DUAL JOYSTICKS (MOBILE) ---
function setupJoystick(containerId, knobId, onMove) {
    const container = document.getElementById(containerId);
    const knob = document.getElementById(knobId);
    if (!container || !knob) return;
    
    let rect, centerX, centerY;
    
    const handleTouch = (e) => {
        e.preventDefault();
        rect = container.getBoundingClientRect();
        centerX = rect.width / 2; centerY = rect.height / 2;
        
        let touch = Array.from(e.touches).find(t => 
            t.clientX >= rect.left && t.clientX <= rect.right &&
            t.clientY >= rect.top && t.clientY <= rect.bottom
        );
        if (!touch) return;

        let dx = touch.clientX - (rect.left + centerX);
        let dy = touch.clientY - (rect.top + centerY);
        let dist = Math.hypot(dx, dy);
        let maxDist = rect.width / 2;

        if (dist > maxDist) { dx *= maxDist / dist; dy *= maxDist / dist; }
        knob.style.transform = `translate(${dx}px, ${dy}px)`;
        onMove(dx / maxDist, dy / maxDist);
    };

    const resetKnob = (e) => {
        e.preventDefault();
        knob.style.transform = `translate(0px, 0px)`;
        onMove(0, 0);
    };

    container.addEventListener('touchstart', handleTouch, { passive: false });
    container.addEventListener('touchmove', handleTouch, { passive: false });
    container.addEventListener('touchend', resetKnob, { passive: false });
}

setupJoystick('move-joystick-container', 'move-joystick-knob', (nx, ny) => { moveJoystick = { x: nx, y: ny }; });
setupJoystick('aim-joystick-container', 'aim-joystick-knob', (nx, ny) => {
    if (nx !== 0 || ny !== 0) socket.emit('aim', Math.atan2(ny, nx));
});

// Mobile Action Buttons
const bindMobileBtn = (id, action, isHold = false) => {
    const btn = document.getElementById(id);
    if (btn) {
        btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(true); }, { passive: false });
        if (isHold) btn.addEventListener('touchend', (e) => { e.preventDefault(); action(false); }, { passive: false });
    }
};

bindMobileBtn('btn-shoot', () => {
    let myPlayer = gameState.players[socket.id];
    let isMining = false;
    if (myPlayer && gameState.train.state === 'STOPPED') {
        for (let ore of gameState.ores) {
            if (Math.hypot(myPlayer.x - ore.x, myPlayer.y - ore.y) < 100) {
                socket.emit('mine', ore.id);
                isMining = true; break;
            }
        }
    }
    if (!isMining) socket.emit('shoot');
});

bindMobileBtn('btn-interact', () => socket.emit('interact'));
bindMobileBtn('btn-reload', () => socket.emit('reload'));
bindMobileBtn('btn-barrel', () => socket.emit('placeBarrel'));
bindMobileBtn('btn-knife', () => socket.emit('stab')); 
bindMobileBtn('btn-flashlight', () => socket.emit('toggleFlashlight')); 
bindMobileBtn('btn-eat', () => socket.emit('eatMeat')); 
bindMobileBtn('btn-steam', (isDown) => {
    if (isDown) socket.emit('startSteam');
    else socket.emit('stopSteam');
}, true);
bindMobileBtn('btn-bomb', () => {
    if (gameState && gameState.players[socket.id]) {
        let p = gameState.players[socket.id];
        socket.emit('throwBomb', { x: p.x + Math.cos(p.aimAngle)*150, y: p.y + Math.sin(p.aimAngle)*150 });
    }
});
// --- UI UPDATER ---
function updateUI() {
    if (!gameState || !gameState.players[socket.id]) return;
    let p = gameState.players[socket.id];
    
    document.getElementById('death').classList.toggle('hidden', !p.dead);
    document.getElementById('hp').innerText = Math.floor(p.hp);
    document.getElementById('mag').innerText = p.mag;
    document.getElementById('ammo').innerText = p.bullets;
    document.getElementById('money').innerText = p.money;
    document.getElementById('dist').innerText = Math.floor(gameState.train.distance);
    document.getElementById('biome').innerText = gameState.biome.toUpperCase();
    document.getElementById('fuel').innerText = Math.floor(gameState.train.fuel);
    document.getElementById('speed').innerText = Math.floor(gameState.train.speed);
    document.getElementById('cold').innerText = Math.floor(p.coldMeter);
    
    document.getElementById('inv-gold').innerText = p.inventory.gold;
    document.getElementById('inv-silver').innerText = p.inventory.silver;
    document.getElementById('inv-coal').innerText = p.inventory.coal;
    document.getElementById('inv-skins').innerText = p.inventory.skins;
    document.getElementById('inv-planks').innerText = p.inventory.planks;
    document.getElementById('inv-bottles').innerText = p.inventory.beerBottles;
    document.getElementById('inv-barrels').innerText = p.inventory.beerBarrels;
    document.getElementById('inv-watches').innerText = p.inventory.watches;
    document.getElementById('inv-rawmeat').innerText = p.inventory.rawMeat;
    document.getElementById('inv-cookedmeat').innerText = p.inventory.cookedMeat;

    let canMine = false; let canBreak = false;
    if (gameState.train.state === 'STOPPED') {
        for (let ore of gameState.ores) { if (Math.hypot(p.x - ore.x, p.y - ore.y) < 100) { canMine = true; break; } }
        if (gameState.crates) { for (let crate of gameState.crates) { if (Math.hypot(p.x - crate.x, p.y - crate.y) < 60) { canBreak = true; break; } } }
    }
    
    let btnShoot = document.getElementById('btn-shoot');
    if (btnShoot) btnShoot.innerText = canMine ? 'MINE' : 'FIRE';
    document.getElementById('pc-action-text').innerText = canMine ? 'Mine' : 'Shoot';
    
    let btnKnife = document.getElementById('btn-knife');
    if (btnKnife) btnKnife.innerText = canBreak ? 'BREAK' : 'KNIFE';

    let depWarning = document.getElementById('departure-warning');
    if (gameState.train.state === 'DEPARTING') {
        depWarning.classList.remove('hidden');
        document.getElementById('dep-timer').innerText = Math.ceil(gameState.train.departureTimer);
    } else { depWarning.classList.add('hidden'); }

    let bridgeUI = document.getElementById('bridge-ui');
    if (!gameState.train.bridgeFixed) {
        bridgeUI.classList.remove('hidden');
        document.getElementById('bridge-planks').innerText = `${gameState.train.planksDeposited}/${gameState.train.planksNeeded}`;
    } else { bridgeUI.classList.add('hidden'); }

    let gambleTimer = document.getElementById('gamble-timer');
    if (gameState.gambling.active) gambleTimer.innerText = `Time left: ${Math.ceil(gameState.gambling.timer)}s`;

    canvas.className = '';
    if (p.drunk.sips >= 3 && p.drunk.sips < 6) canvas.classList.add('drunk-1');
    else if (p.drunk.sips >= 6 && p.drunk.sips < 9) canvas.classList.add('drunk-2');
    else if (p.drunk.sips >= 9) canvas.classList.add('drunk-3');
}

// --- RENDER ENGINE ---
function drawHumanoid(x, y, color, angle, hasKnife, onHorse, isEnemy, enemyType, name) {
    ctx.save(); ctx.translate(x, y);
    
    if (name) {
        ctx.fillStyle = 'white'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
        ctx.fillText(name, 0, -30);
    }

    ctx.rotate(angle);

    if (onHorse) {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(-20, -15, 50, 30); 
        ctx.fillRect(20, -10, 20, 20); ctx.fillStyle = '#000'; ctx.fillRect(35, -5, 5, 5); 
    }

    ctx.fillStyle = color; ctx.fillRect(-8, -12, 16, 24); 
    ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(10, -14, 5, 0, Math.PI*2); ctx.fill(); 
    ctx.beginPath(); ctx.arc(10, 14, 5, 0, Math.PI*2); ctx.fill(); 

    if (hasKnife || enemyType === 'knifeman') {
        ctx.fillStyle = '#ccc'; ctx.fillRect(10, 12, 15, 4); 
    } else if (enemyType === 'bombman') {
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(15, 14, 6, 0, Math.PI*2); ctx.fill(); 
    } else {
        ctx.fillStyle = '#333'; ctx.fillRect(10, 12, 16, 4); ctx.fillRect(10, 14, 4, 4); 
    }

    ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill(); 

    if (!isEnemy) {
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(2, 0, 11, -Math.PI/2, Math.PI/2); ctx.fill();
        ctx.fillStyle = color; ctx.fillRect(-8, -9, 10, 18);
        ctx.fillStyle = '#ffd700'; ctx.fillRect(-2, -4, 4, 8);
    } else {
        if (enemyType === 'gunman') {
            ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
        } else if (enemyType === 'knifeman') {
            ctx.fillStyle = '#800'; ctx.fillRect(-8, -8, 16, 16);
        } else if (enemyType === 'bombman') {
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        } else if (enemyType === 'marshal') {
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#ffd700'; ctx.fillRect(-2, -2, 4, 4); // Gold Star for Marshals
        }
    }
    ctx.restore();
}

function drawTrain() {
    ctx.save(); ctx.translate(0, 0); 

    ctx.fillStyle = '#555';
    ctx.fillRect(110, -5, 10, 10); ctx.fillRect(0, -5, 10, 10);   
    ctx.fillRect(-150, -5, 10, 10); ctx.fillRect(-300, -5, 10, 10); 
    ctx.fillRect(-450, -5, 10, 10); ctx.fillRect(-600, -5, 10, 10); 
    
    for (let i = 0; i < gameState.train.storageCars; i++) {
        ctx.fillRect(-710 - (i * 110), -5, 10, 10);
    }

    TRAIN_CARS.forEach(car => {
        ctx.save(); ctx.translate(car.x, car.y);

        if (car.id === 'engine') {
            ctx.fillStyle = '#222'; ctx.fillRect(0, 10, 100, 60);
            ctx.fillStyle = '#111'; ctx.fillRect(100, 0, 60, 80);
            ctx.fillStyle = '#000'; ctx.fillRect(95, -5, 70, 90);
            ctx.fillStyle = '#444'; ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-30, 40); ctx.lineTo(0, 70); ctx.fill();
            ctx.fillStyle = '#111'; ctx.fillRect(10, 30, 20, 20);
            
            ctx.fillStyle = (gameState.train.state === 'STOPPED' || gameState.train.state === 'DEPARTING') && gameState.train.buttonCooldown <= 0 ? '#0f0' : '#f00';
            ctx.beginPath(); ctx.arc(120, 40, 12, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

        } else if (car.id === 'coal') {
            ctx.fillStyle = '#333'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#0a0a0a';
            for(let i=10; i<car.w-10; i+=15) for(let j=10; j<car.h-10; j+=15) ctx.fillRect(i, j, 12, 12);
            
            ctx.fillStyle = '#ffaa00'; ctx.fillRect(40, 25, 20, 20);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.fillText('DUMP', 38, 40);

            ctx.fillStyle = '#888'; ctx.beginPath(); ctx.arc(50, 35, 8, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#f00'; ctx.fillRect(48, 25, 4, 10);
            ctx.fillStyle = '#fff'; ctx.fillText('VALVE', 38, 20);

        } else if (car.id.startsWith('pass')) {
            ctx.fillStyle = '#6b4423'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
            ctx.fillStyle = '#87ceeb';
            for(let i=20; i<car.w-20; i+=30) { ctx.fillRect(i, 10, 15, 15); ctx.fillRect(i, car.h - 25, 15, 15); }
        } else if (car.id === 'kitchen') {
            ctx.fillStyle = '#6b4423'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
            
            ctx.fillStyle = '#111'; ctx.fillRect(50, 20, 40, 40);
            ctx.fillStyle = '#ff4444'; ctx.beginPath(); ctx.arc(70, 40, 10, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText('STOVE', 55, 15);

        } else if (car.id === 'gambling') {
            ctx.fillStyle = '#6b4423'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
            
            ctx.fillStyle = '#006400'; ctx.fillRect(10, 20, 30, 40); 
            ctx.fillStyle = '#fff'; ctx.font = '8px monospace'; ctx.fillText('ROUL', 12, 45);
            
            ctx.fillStyle = '#8b4513'; ctx.fillRect(55, 20, 30, 40); 
            ctx.fillStyle = '#fff'; ctx.fillText('RACE', 57, 45);
            
            ctx.fillStyle = '#000080'; ctx.fillRect(100, 20, 30, 40); 
            ctx.fillStyle = '#fff'; ctx.fillText('POKER', 102, 45);

        } else if (car.id === 'caboose') {
            ctx.fillStyle = '#8b0000'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#600000'; ctx.fillRect(30, 15, 40, 40);
            ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
        }
        ctx.restore();
    });

    for (let i = 0; i < gameState.train.storageCars; i++) {
        ctx.save();
        let sx = -810 - (i * 110);
        ctx.translate(sx, -35);
        ctx.fillStyle = '#5c4033'; ctx.fillRect(0, 0, 100, 70); 
        ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, 110, 80); 
        
        if (i === 0) {
            ctx.fillStyle = '#ffd700'; ctx.fillRect(40, 25, 20, 20);
            ctx.fillStyle = '#000'; ctx.font = 'bold 10px monospace'; ctx.fillText('STORE', 37, 40);
        }
        ctx.restore();
    }
    ctx.restore();
}

function draw() {
    if (!gameState || gameState.status === 'LOBBY') { requestAnimationFrame(draw); return; }

    let myPlayer = gameState.players[socket.id];
    if (!myPlayer) return requestAnimationFrame(draw);

    let camX = myPlayer.x; let camY = myPlayer.y;
    if (myPlayer.dead && myPlayer.spectatingId && gameState.players[myPlayer.spectatingId]) {
        camX = gameState.players[myPlayer.spectatingId].x; camY = gameState.players[myPlayer.spectatingId].y;
    }

    let cx = canvas.width / 2; let cy = canvas.height / 2;

    let bgColor = '#2d4c1e'; 
    if (gameState.biome === 'desert') bgColor = '#c2b280';
    if (gameState.biome === 'tundra') bgColor = '#e0e6ed';
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save(); ctx.translate(cx - camX, cy - camY);

    let pixelDist = gameState.train.distance * 1000;

    if (gameState.inMountains) {
        ctx.fillStyle = gameState.biome === 'tundra' ? '#aab' : '#555';
        let mountainOffset = (pixelDist * 0.2) % 400;
        for(let i = -2000; i < 2000; i+= 400) {
            ctx.beginPath(); ctx.moveTo(i - mountainOffset + camX, -400);
            ctx.lineTo(i + 200 - mountainOffset + camX, -700); ctx.lineTo(i + 400 - mountainOffset + camX, -400); ctx.fill();
        }
    }

    let sceneryOffset = pixelDist % 600;
    for(let i = -2000; i < 2000; i+= 300) {
        let xPos = i - sceneryOffset + camX;[-300, -150, 150, 300].forEach(yOffset => {
            let finalX = xPos + (Math.abs(yOffset) % 100); let finalY = yOffset + camY;
            if (gameState.biome === 'forest') {
                ctx.fillStyle = '#3e2723'; ctx.fillRect(finalX - 5, finalY, 10, 20);
                ctx.fillStyle = '#1b5e20'; ctx.beginPath(); ctx.moveTo(finalX, finalY - 40); ctx.lineTo(finalX - 20, finalY + 5); ctx.lineTo(finalX + 20, finalY + 5); ctx.fill();
            } else if (gameState.biome === 'desert') {
                ctx.fillStyle = '#2e7d32'; ctx.fillRect(finalX - 6, finalY - 30, 12, 40); 
                ctx.fillRect(finalX - 15, finalY - 15, 10, 8); ctx.fillRect(finalX + 5, finalY - 20, 10, 8);  
            } else if (gameState.biome === 'tundra') {
                ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(finalX, finalY, 25, 0, Math.PI, true); ctx.fill();
            }
        });
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    let groundOffset = pixelDist % 200;
    for(let i = -2000; i < 2000; i+= 200) {
        for(let j = -1000; j < 1000; j+= 100) ctx.fillRect(i - groundOffset + camX + (j%50), j + camY, 20, 4);
    }

    if (gameState.townX !== null) {
        ctx.fillStyle = '#8b5a2b'; ctx.fillRect(gameState.townX - 400, -300, 800, 600);
        ctx.fillStyle = '#5d2e0a'; ctx.fillRect(gameState.townX - 150, -250, 120, 100);
        ctx.fillStyle = '#3e1f04'; ctx.fillRect(gameState.townX - 160, -260, 140, 20); 
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.fillText('SALOON', gameState.townX - 90, -220);
        ctx.fillStyle = '#6b4423'; ctx.fillRect(gameState.townX + 50, -250, 120, 100);
        ctx.fillStyle = '#3e1f04'; ctx.fillRect(gameState.townX + 40, -260, 140, 20); 
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.fillText('STORE', gameState.townX + 110, -220);
        ctx.fillStyle = '#8b4513'; ctx.fillRect(gameState.townX - 150, 150, 120, 100);
        ctx.fillStyle = '#3e1f04'; ctx.fillRect(gameState.townX - 160, 140, 140, 20); 
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.fillText('BANK', gameState.townX - 90, 180);
    }

    let tieOffset = pixelDist % 40;
    ctx.fillStyle = '#4a3c31'; 
    for(let i = -2000; i < 2000; i+= 40) {
        if (!gameState.train.bridgeFixed && (i - tieOffset + camX) > 280 && (i - tieOffset + camX) < 450) continue;
        ctx.fillRect(i - tieOffset + camX, -35, 10, 70);
    }
    
    if (!gameState.train.bridgeFixed) {
        ctx.fillStyle = '#777'; 
        ctx.fillRect(-2000 + camX, -25, 2280, 6); ctx.fillRect(-2000 + camX, 19, 2280, 6); 
        ctx.fillRect(450 + camX, -25, 1550, 6); ctx.fillRect(450 + camX, 19, 1550, 6); 
        ctx.fillStyle = '#1e90ff'; ctx.fillRect(280 + camX, -1000 + camY, 170, 2000); 
        ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'; ctx.fillRect(280 + camX, -50, 40, 100); 
        ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText('DEPOSIT PLANKS', 280 + camX, -60);
    } else {
        ctx.fillStyle = '#777'; ctx.fillRect(-2000 + camX, -25, 4000, 6); ctx.fillRect(-2000 + camX, 19, 4000, 6);
    }

    if (gameState.avalancheRocks && gameState.avalancheRocks.length > 0) {
        ctx.fillStyle = '#444'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        gameState.avalancheRocks.forEach(rock => {
            ctx.beginPath(); ctx.moveTo(rock.x, rock.y - rock.size); ctx.lineTo(rock.x + rock.size, rock.y);
            ctx.lineTo(rock.x + rock.size/2, rock.y + rock.size); ctx.lineTo(rock.x - rock.size/2, rock.y + rock.size);
            ctx.lineTo(rock.x - rock.size, rock.y); ctx.closePath(); ctx.fill(); ctx.stroke();
        });
    }

    gameState.ores.forEach(ore => {
        ctx.fillStyle = ore.type === 'gold' ? '#ffd700' : (ore.type === 'silver' ? '#e3e4e5' : '#111');
        ctx.beginPath(); ctx.arc(ore.x, ore.y, 15 + (ore.maxHits * 2), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    });

    if (gameState.crates) {
        gameState.crates.forEach(c => {
            ctx.fillStyle = '#8b5a2b'; ctx.fillRect(c.x - 15, c.y - 15, 30, 30);
            ctx.strokeStyle = '#3e1f04'; ctx.lineWidth = 2; ctx.strokeRect(c.x - 15, c.y - 15, 30, 30);
            ctx.beginPath(); ctx.moveTo(c.x - 15, c.y - 15); ctx.lineTo(c.x + 15, c.y + 15);
            ctx.moveTo(c.x + 15, c.y - 15); ctx.lineTo(c.x - 15, c.y + 15); ctx.stroke();
        });
    }

    if (gameState.animals) {
        gameState.animals.forEach(a => {
            ctx.fillStyle = '#8b5a2b'; ctx.beginPath(); ctx.arc(a.x, a.y, 12, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(a.x + 8, a.y - 4, 2, 0, Math.PI * 2); ctx.fill(); 
        });
    }

    if (gameState.planks) {
        gameState.planks.forEach(p => {
            ctx.fillStyle = '#d2b48c'; ctx.fillRect(p.x - 15, p.y - 5, 30, 10);
            ctx.strokeStyle = '#8b5a2b'; ctx.strokeRect(p.x - 15, p.y - 5, 30, 10);
        });
    }

    if (gameState.hawks) {
        gameState.hawks.forEach(h => {
            ctx.fillStyle = '#5c4033'; ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x - 15, h.y - 10); ctx.lineTo(h.x - 15, h.y + 10); ctx.fill();
        });
    }

    if (gameState.snakes) {
        gameState.snakes.forEach(s => {
            ctx.strokeStyle = '#2e8b57'; ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - 10, s.y + 5); ctx.lineTo(s.x - 20, s.y - 5); ctx.stroke();
        });
    }

    if (gameState.mailPoles) {
        gameState.mailPoles.forEach(m => {
            ctx.fillStyle = '#555'; ctx.fillRect(m.x - 5, m.y - 40, 10, 80); 
            ctx.fillStyle = '#d2b48c'; ctx.fillRect(m.x - 15, m.y - 20, 20, 30); 
            ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText('$', m.x - 5, m.y);
        });
    }

    if (gameState.shopNPC) {
        ctx.fillStyle = '#00f'; ctx.fillRect(gameState.shopNPC.x - 10, gameState.shopNPC.y - 10, 20, 20);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.fillText('SHOP', gameState.shopNPC.x, gameState.shopNPC.y - 15);
    }

    ctx.fillStyle = '#8b4513';
    gameState.horses.forEach(h => {
        ctx.fillRect(h.x - 15, h.y - 10, 30, 20); ctx.fillRect(h.x + 5, h.y - 15, 15, 15); 
    });

    drawTrain();

    gameState.barrels.forEach(b => {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(b.x - 15, b.y - 20, 30, 40);
        ctx.fillStyle = '#222'; ctx.fillRect(b.x - 15, b.y - 10, 30, 4); ctx.fillRect(b.x - 15, b.y + 6, 30, 4);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.fillText(`${b.sipsLeft}/67`, b.x, b.y - 25);
    });

    let allHostiles =[...gameState.enemies, ...gameState.chasers, ...gameState.marshals];
    allHostiles.forEach(e => {
        let color = e.type === 'gunman' ? '#777' : (e.type === 'knifeman' ? '#8b4513' : (e.type === 'marshal' ? '#111' : '#222'));
        drawHumanoid(e.x, e.y, color, e.aimAngle, false, e.hasHorse, true, e.type, null);
    });

    for (let id in gameState.players) {
        let p = gameState.players[id];
        if (p.dead) continue;
        drawHumanoid(p.x, p.y, p.color, p.aimAngle, p.hasKnife, p.onHorse, false, null, p.name);
    }

    gameState.projectiles.forEach(p => {
        ctx.fillStyle = p.isTraitor ? '#ff0000' : '#ffcc00'; 
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    ctx.fillStyle = '#111';
    gameState.bombs.forEach(b => {
        ctx.beginPath();
        let pulse = Math.sin(b.timer * 15) * 3;
        ctx.arc(b.x, b.y, 12 + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    if (gameState.train.steamActive) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath(); ctx.arc(60, 0, 120, 0, Math.PI * 2); ctx.fill();
    }

    if (gameState.tunnel && gameState.tunnel.active) {
        ctx.fillStyle = 'black';
        ctx.fillRect(-5000 + camX, -5000 + camY, 10000, 10000); 
        
        ctx.globalCompositeOperation = 'destination-out';
        
        let grad = ctx.createRadialGradient(280, 0, 10, 280, 0, gameState.train.headlightUpgraded ? 800 : 400);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.moveTo(280, 0); ctx.arc(280, 0, gameState.train.headlightUpgraded ? 800 : 400, -Math.PI/4, Math.PI/4); ctx.fill();

        for (let id in gameState.players) {
            let p = gameState.players[id];
            if (p.dead) continue;
            
            let pGrad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 100);
            pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
            pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = pGrad;
            ctx.beginPath(); ctx.arc(p.x, p.y, 100, 0, Math.PI * 2); ctx.fill();

            if (p.hasFlashlight && p.flashlightOn) {
                let fGrad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 300);
                fGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                fGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = fGrad;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.arc(p.x, p.y, 300, p.aimAngle - 0.3, p.aimAngle + 0.3); ctx.fill();
            }
        }
        ctx.globalCompositeOperation = 'source-over'; 
    }

    ctx.restore();

    let dx = 0, dy = 0;
    if (keys.w) dy -= 1; if (keys.s) dy += 1; if (keys.a) dx -= 1; if (keys.d) dx += 1;
    if (moveJoystick.x !== 0 || moveJoystick.y !== 0) { dx = moveJoystick.x; dy = moveJoystick.y; }
    
    if (dx !== 0 || dy !== 0) {
        let len = Math.hypot(dx, dy);
        socket.emit('move', { dx: dx / len, dy: dy / len });
    }

    requestAnimationFrame(draw);
}

draw();
