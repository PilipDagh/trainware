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

const TRAIN_CARS =[
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
        btn.innerText = 'JOIN';
        btn.onclick = () => window.ui.joinLobby(l.id, l.isPrivate);
        div.appendChild(btn);
        list.appendChild(div);
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
socket.on('allDead', () => document.getElementById('all-dead').classList.remove('hidden'));
socket.on('victory', () => document.getElementById('victory').classList.remove('hidden'));

// --- INPUT HANDLING (PC) ---
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
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        socket.emit('aim', Math.atan2(mouseY - cy, mouseX - cx));
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.id === 'gameCanvas') {
        let myPlayer = gameState.players[socket.id];
        if (myPlayer && gameState.train.state === 'STOPPED') {
            let cx = canvas.width / 2; let cy = canvas.height / 2;
            let worldX = (mouseX - cx) + myPlayer.x;
            let worldY = (mouseY - cy) + myPlayer.y;
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
const bindMobileBtn = (id, action) => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('touchstart', (e) => { e.preventDefault(); action(); }, { passive: false });
};

bindMobileBtn('btn-shoot', () => {
    // Dynamic Mine/Shoot logic for mobile button
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
    document.getElementById('inv-bottles').innerText = p.inventory.beerBottles;
    document.getElementById('inv-barrels').innerText = p.inventory.beerBarrels;

    // Dynamic Mine/Shoot Button Text
    let canMine = false;
    if (gameState.train.state === 'STOPPED') {
        for (let ore of gameState.ores) {
            if (Math.hypot(p.x - ore.x, p.y - ore.y) < 100) { canMine = true; break; }
        }
    }
    document.getElementById('btn-shoot').innerText = canMine ? 'MINE' : 'FIRE';
    document.getElementById('pc-action-text').innerText = canMine ? 'Mine' : 'Shoot';

    let depWarning = document.getElementById('departure-warning');
    if (gameState.train.state === 'DEPARTING') {
        depWarning.classList.remove('hidden');
        document.getElementById('dep-timer').innerText = Math.ceil(gameState.train.departureTimer);
    } else {
        depWarning.classList.add('hidden');
    }

    // Drunk CSS Classes
    canvas.className = '';
    if (p.drunk.sips >= 3 && p.drunk.sips < 6) canvas.classList.add('drunk-1');
    else if (p.drunk.sips >= 6 && p.drunk.sips < 9) canvas.classList.add('drunk-2');
    else if (p.drunk.sips >= 9) canvas.classList.add('drunk-3');
}
function drawHumanoid(x, y, color, angle, hasKnife, onHorse, isEnemy, enemyType, name) {
    ctx.save();
    ctx.translate(x, y);
    
    if (name) {
        ctx.fillStyle = 'white'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
        ctx.fillText(name, 0, -30);
    }

    ctx.rotate(angle);

    if (onHorse) {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(-20, -15, 50, 30); 
        ctx.fillRect(20, -10, 20, 20); ctx.fillStyle = '#000'; ctx.fillRect(35, -5, 5, 5); 
    }

    ctx.fillStyle = color; ctx.fillRect(-8, -12, 16, 24); // Body
    ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(10, -14, 5, 0, Math.PI*2); ctx.fill(); // Left Hand
    ctx.beginPath(); ctx.arc(10, 14, 5, 0, Math.PI*2); ctx.fill(); // Right Hand

    if (hasKnife || enemyType === 'knifeman') {
        ctx.fillStyle = '#ccc'; ctx.fillRect(10, 12, 15, 4); 
    } else if (enemyType === 'bombman') {
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(15, 14, 6, 0, Math.PI*2); ctx.fill(); 
    } else {
        ctx.fillStyle = '#333'; ctx.fillRect(10, 12, 16, 4); ctx.fillRect(10, 14, 4, 4); 
    }

    ctx.fillStyle = '#f1c27d'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill(); // Head

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
        }
    }
    ctx.restore();
}

function drawTrain() {
    ctx.save();
    ctx.translate(0, 0); // Train is always at world origin (0,0)

    ctx.fillStyle = '#555';
    ctx.fillRect(110, -5, 10, 10); ctx.fillRect(0, -5, 10, 10);   
    ctx.fillRect(-150, -5, 10, 10); ctx.fillRect(-300, -5, 10, 10); 

    TRAIN_CARS.forEach(car => {
        ctx.save();
        ctx.translate(car.x, car.y);

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

        } else if (car.id.startsWith('pass')) {
            ctx.fillStyle = '#6b4423'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
            ctx.fillStyle = '#87ceeb';
            for(let i=20; i<car.w-20; i+=30) { ctx.fillRect(i, 10, 15, 15); ctx.fillRect(i, car.h - 25, 15, 15); }
        } else if (car.id === 'caboose') {
            ctx.fillStyle = '#8b0000'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#600000'; ctx.fillRect(30, 15, 40, 40);
            ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
        }
        ctx.restore();
    });
    ctx.restore();
}

function draw() {
    if (!gameState || gameState.status === 'LOBBY') {
        requestAnimationFrame(draw); return;
    }

    let myPlayer = gameState.players[socket.id];
    if (!myPlayer) return requestAnimationFrame(draw);

    let camX = myPlayer.x; let camY = myPlayer.y;
    if (myPlayer.dead && myPlayer.spectatingId && gameState.players[myPlayer.spectatingId]) {
        camX = gameState.players[myPlayer.spectatingId].x;
        camY = gameState.players[myPlayer.spectatingId].y;
    }

    let cx = canvas.width / 2; let cy = canvas.height / 2;

    let bgColor = '#2d4c1e'; 
    if (gameState.biome === 'desert') bgColor = '#c2b280';
    if (gameState.biome === 'tundra') bgColor = '#e0e6ed';
    ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cx - camX, cy - camY);

    let pixelDist = gameState.train.distance * 1000;

    // Parallax Mountains
    if (gameState.inMountains) {
        ctx.fillStyle = gameState.biome === 'tundra' ? '#aab' : '#555';
        let mountainOffset = (pixelDist * 0.2) % 400;
        for(let i = -2000; i < 2000; i+= 400) {
            ctx.beginPath();
            ctx.moveTo(i - mountainOffset + camX, -400);
            ctx.lineTo(i + 200 - mountainOffset + camX, -700);
            ctx.lineTo(i + 400 - mountainOffset + camX, -400);
            ctx.fill();
        }
    }

    // Scenery (Trees, Cacti, Snow)
    let sceneryOffset = pixelDist % 600;
    for(let i = -2000; i < 2000; i+= 300) {
        let xPos = i - sceneryOffset + camX;
        [-300, -150, 150, 300].forEach(yOffset => {
            let finalX = xPos + (Math.abs(yOffset) % 100);
            let finalY = yOffset + camY;

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

    // Ground Lines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    let groundOffset = pixelDist % 200;
    for(let i = -2000; i < 2000; i+= 200) {
        for(let j = -1000; j < 1000; j+= 100) {
            ctx.fillRect(i - groundOffset + camX + (j%50), j + camY, 20, 4);
        }
    }

    // ACTUAL TOWNS
    if (gameState.townX !== null) {
        // Dirt Road
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(gameState.townX - 400, -300, 800, 600);
        
        // Saloon
        ctx.fillStyle = '#5d2e0a'; ctx.fillRect(gameState.townX - 150, -250, 120, 100);
        ctx.fillStyle = '#3e1f04'; ctx.fillRect(gameState.townX - 160, -260, 140, 20); // Roof
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.fillText('SALOON', gameState.townX - 90, -220);
        
        // General Store
        ctx.fillStyle = '#6b4423'; ctx.fillRect(gameState.townX + 50, -250, 120, 100);
        ctx.fillStyle = '#3e1f04'; ctx.fillRect(gameState.townX + 40, -260, 140, 20); // Roof
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.fillText('STORE', gameState.townX + 110, -220);

        // Bank
        ctx.fillStyle = '#8b4513'; ctx.fillRect(gameState.townX - 150, 150, 120, 100);
        ctx.fillStyle = '#3e1f04'; ctx.fillRect(gameState.townX - 160, 140, 140, 20); // Roof
        ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.fillText('BANK', gameState.townX - 90, 180);
    }

    // Tracks
    let tieOffset = pixelDist % 40;
    ctx.fillStyle = '#4a3c31'; 
    for(let i = -2000; i < 2000; i+= 40) ctx.fillRect(i - tieOffset + camX, -35, 10, 70);
    ctx.fillStyle = '#777'; 
    ctx.fillRect(-2000 + camX, -25, 4000, 6); ctx.fillRect(-2000 + camX, 19, 4000, 6);

    // Avalanche Rocks
    if (gameState.avalancheRocks && gameState.avalancheRocks.length > 0) {
        ctx.fillStyle = '#444'; ctx.strokeStyle = '#222'; ctx.lineWidth = 2;
        gameState.avalancheRocks.forEach(rock => {
            ctx.beginPath();
            ctx.moveTo(rock.x, rock.y - rock.size); ctx.lineTo(rock.x + rock.size, rock.y);
            ctx.lineTo(rock.x + rock.size/2, rock.y + rock.size); ctx.lineTo(rock.x - rock.size/2, rock.y + rock.size);
            ctx.lineTo(rock.x - rock.size, rock.y); ctx.closePath();
            ctx.fill(); ctx.stroke();
        });
    }

    // Ores
    gameState.ores.forEach(ore => {
        ctx.fillStyle = ore.type === 'gold' ? '#ffd700' : (ore.type === 'silver' ? '#e3e4e5' : '#111');
        ctx.beginPath(); ctx.arc(ore.x, ore.y, 15 + (ore.maxHits * 2), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    });

    // Shop NPC
    if (gameState.shopNPC) {
        ctx.fillStyle = '#00f'; ctx.fillRect(gameState.shopNPC.x - 10, gameState.shopNPC.y - 10, 20, 20);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px monospace'; ctx.fillText('SHOP', gameState.shopNPC.x, gameState.shopNPC.y - 15);
    }

    // Horses
    ctx.fillStyle = '#8b4513';
    gameState.horses.forEach(h => {
        ctx.fillRect(h.x - 15, h.y - 10, 30, 20); ctx.fillRect(h.x + 5, h.y - 15, 15, 15); 
    });

    // Train
    drawTrain();

    // Beer Barrels
    gameState.barrels.forEach(b => {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(b.x - 15, b.y - 20, 30, 40);
        ctx.fillStyle = '#222'; ctx.fillRect(b.x - 15, b.y - 10, 30, 4); ctx.fillRect(b.x - 15, b.y + 6, 30, 4);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace'; ctx.fillText(`${b.sipsLeft}/67`, b.x, b.y - 25);
    });

    // Enemies
    gameState.enemies.forEach(e => {
        let color = e.type === 'gunman' ? '#777' : (e.type === 'knifeman' ? '#8b4513' : '#222');
        drawHumanoid(e.x, e.y, color, e.aimAngle, false, e.hasHorse, true, e.type, null);
    });

    // Players
    for (let id in gameState.players) {
        let p = gameState.players[id];
        if (p.dead) continue;
        drawHumanoid(p.x, p.y, p.color, p.aimAngle, p.hasKnife, p.onHorse, false, null, p.name);
    }

    // Projectiles
    ctx.fillStyle = '#ffcc00';
    gameState.projectiles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    // Bombs
    ctx.fillStyle = '#111';
    gameState.bombs.forEach(b => {
        ctx.beginPath();
        let pulse = Math.sin(b.timer * 15) * 3;
        ctx.arc(b.x, b.y, 12 + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();

    // Movement Emission
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
