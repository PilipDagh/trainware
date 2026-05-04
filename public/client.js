const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gameState = null;
let keys = { w: false, a: false, s: false, d: false };
let mouseX = 0, mouseY = 0;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// --- LOBBY & SETTINGS SYSTEM ---
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
    document.getElementById('create-lobby').classList.add('hidden');
    document.getElementById('join-lobby').classList.add('hidden');
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
}

function createLobby() {
    let name = document.getElementById('lobbyName').value;
    let maxPlayers = document.getElementById('maxPlayers').value;
    let password = document.getElementById('lobbyPassword').value;
    socket.emit('createLobby', { name, maxPlayers, password });
}

function joinLobby(roomId, requiresPassword) {
    let password = '';
    if (requiresPassword) {
        password = prompt('Enter Lobby Password:');
        if (password === null) return;
    }
    let playerName = document.getElementById('playerName').value || 'Conductor';
    socket.emit('joinLobby', { roomId, password, playerName });
}

function startGame() {
    socket.emit('startGame');
}

socket.on('lobbyList', (lobbies) => {
    let list = document.getElementById('lobby-list');
    list.innerHTML = '';
    if (lobbies.length === 0) list.innerHTML = '<p>No public lobbies available.</p>';
    lobbies.forEach(l => {
        let div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <span>${l.name} (${l.players}/${l.maxPlayers}) ${l.isPrivate ? '🔒' : ''}</span>
            <button onclick="joinLobby('${l.id}', ${l.isPrivate})">Join</button>
        `;
        list.appendChild(div);
    });
});

socket.on('lobbyCreated', (roomId) => {
    let playerName = document.getElementById('playerName').value || 'Conductor';
    let password = document.getElementById('lobbyPassword').value;
    socket.emit('joinLobby', { roomId, password, playerName });
});

socket.on('lobbyUpdate', (room) => {
    document.getElementById('create-lobby').classList.add('hidden');
    document.getElementById('join-lobby').classList.add('hidden');
    document.getElementById('settings-menu').classList.add('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('in-lobby').classList.remove('hidden');
    
    document.getElementById('lobby-title').innerText = `Lobby: ${room.name}`;
    let ul = document.getElementById('lobby-players');
    ul.innerHTML = '';
    for (let id in room.players) {
        let li = document.createElement('li');
        li.innerText = room.players[id].name;
        li.style.color = room.players[id].color;
        ul.appendChild(li);
    }
});

socket.on('gameStarted', () => {
    document.getElementById('menu-container').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    canvas.classList.remove('hidden');
    
    let forceMobile = document.getElementById('mobile-toggle').checked;
    if (forceMobile || 'ontouchstart' in window || navigator.maxTouchPoints > 0) {
        document.getElementById('mobile-controls').classList.remove('hidden');
    }
});

// --- INPUT HANDLING ---
window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (key === 'e') socket.emit('interact');
    if (key === 'r') socket.emit('reload');
    if (key === 'b') socket.emit('placeBarrel');
    if (key === 'f') {
        if (gameState && gameState.players[socket.id]) {
            let p = gameState.players[socket.id];
            let worldX = p.x + Math.cos(p.aimAngle) * 150;
            let worldY = p.y + Math.sin(p.aimAngle) * 150;
            socket.emit('throwBomb', { x: worldX, y: worldY });
        }
    }
    if (e.key === ' ') socket.emit('stab');
});

window.addEventListener('keyup', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    if (gameState && gameState.players[socket.id]) {
        let p = gameState.players[socket.id];
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        // Aiming is relative to the player's position on screen
        socket.emit('aim', Math.atan2(mouseY - (cy + p.y), mouseX - (cx + p.x)));
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.id === 'gameCanvas') {
        let cx = canvas.width / 2; let cy = canvas.height / 2;
        let clickedOre = false;
        if (gameState && gameState.train.state === 'STOPPED') {
            let myPlayer = gameState.players[socket.id];
            if (myPlayer) {
                // Convert mouse click to world coordinates
                let worldX = (mouseX - cx) + myPlayer.x;
                let worldY = (mouseY - cy) + myPlayer.y;
                for (let ore of gameState.ores) {
                    if (Math.hypot(worldX - ore.x, worldY - ore.y) < 60) {
                        socket.emit('mine', ore.id);
                        clickedOre = true; break;
                    }
                }
            }
        }
        if (!clickedOre) socket.emit('shoot');
    }
});

// --- MOBILE CONTROLS ---
const bindBtn = (id, key) => {
    let btn = document.getElementById(id);
    if(!btn) return;
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; }, { passive: false });
};
bindBtn('btn-w', 'w'); bindBtn('btn-a', 'a'); bindBtn('btn-s', 's'); bindBtn('btn-d', 'd');

document.getElementById('btn-shoot')?.addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('shoot'); }, { passive: false });
document.getElementById('btn-interact')?.addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('interact'); }, { passive: false });
document.getElementById('btn-reload')?.addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('reload'); }, { passive: false });
document.getElementById('btn-barrel')?.addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('placeBarrel'); }, { passive: false });
document.getElementById('btn-bomb')?.addEventListener('touchstart', (e) => { 
    e.preventDefault(); 
    if(gameState && gameState.players[socket.id]) {
        let p = gameState.players[socket.id];
        let bx = p.x + Math.cos(p.aimAngle) * 150;
        let by = p.y + Math.sin(p.aimAngle) * 150;
        socket.emit('throwBomb', {x: bx, y: by});
    }
}, { passive: false });
document.getElementById('btn-knife')?.addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('stab'); }, { passive: false });

// --- UI UPDATES ---
socket.on('state', (state) => {
    gameState = state;
    updateUI();
});

socket.on('msg', (msg) => {
    let el = document.getElementById('messages');
    el.innerText = msg;
    setTimeout(() => el.innerText = '', 4000);
});

socket.on('openShop', () => { document.getElementById('shop').classList.remove('hidden'); renderShop(); });
socket.on('allDead', () => { document.getElementById('all-dead').classList.remove('hidden'); });
socket.on('victory', () => { document.getElementById('victory').classList.remove('hidden'); });

function closeShop() { document.getElementById('shop').classList.add('hidden'); }
function spectateNext() { socket.emit('spectateNext'); }
function voteRestart() { 
    socket.emit('voteRestart'); 
    document.getElementById('all-dead').classList.add('hidden');
    document.getElementById('victory').classList.add('hidden');
}

function renderShop() {
    let container = document.getElementById('shop-items');
    container.innerHTML = '';
    gameState.shop.items.forEach(item => {
        let btn = document.createElement('button');
        let stockText = item.stock !== undefined ? ` (${item.stock} left)` : '';
        btn.innerText = `${item.name} - $${item.cost}${stockText}`;
        btn.onclick = () => socket.emit('buy', item.id);
        container.appendChild(btn);
    });
}

function updateUI() {
    if (!gameState || !gameState.players[socket.id]) return;
    let p = gameState.players[socket.id];
    
    if (p.dead) document.getElementById('death').classList.remove('hidden');
    else document.getElementById('death').classList.add('hidden');

    document.getElementById('hp').innerText = Math.floor(p.hp);
    document.getElementById('mag').innerText = p.mag;
    document.getElementById('ammo').innerText = p.bullets;
    document.getElementById('bombs').innerText = p.bombs;
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

    let depWarning = document.getElementById('departure-warning');
    if (gameState.train.state === 'DEPARTING') {
        depWarning.classList.remove('hidden');
        document.getElementById('dep-timer').innerText = Math.ceil(gameState.train.departureTimer);
    } else {
        depWarning.classList.add('hidden');
    }

    canvas.className = '';
    if (!document.getElementById('game-ui').classList.contains('hidden')) {
        canvas.classList.remove('hidden');
    }
    if (p.drunk.sips >= 3 && p.drunk.sips < 6) canvas.classList.add('drunk-1');
    else if (p.drunk.sips >= 6 && p.drunk.sips < 9) canvas.classList.add('drunk-2');
    else if (p.drunk.sips >= 9) canvas.classList.add('drunk-3');
}
function drawHumanoid(x, y, color, angle, hasKnife, onHorse, isEnemy, enemyType, name) {
    ctx.save();
    ctx.translate(x, y);
    
    if (name) {
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(name, 0, -30);
        ctx.restore();
    }

    ctx.rotate(angle);

    if (onHorse) {
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(-20, -15, 50, 30); 
        ctx.fillRect(20, -10, 20, 20); 
        ctx.fillStyle = '#000';
        ctx.fillRect(35, -5, 5, 5); 
    }

    ctx.fillStyle = color;
    ctx.fillRect(-8, -12, 16, 24);

    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(10, -14, 5, 0, Math.PI*2); ctx.fill(); 
    ctx.beginPath(); ctx.arc(10, 14, 5, 0, Math.PI*2); ctx.fill(); 

    if (hasKnife || enemyType === 'knifeman') {
        ctx.fillStyle = '#ccc';
        ctx.fillRect(10, 12, 15, 4); 
    } else if (enemyType === 'bombman') {
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(15, 14, 6, 0, Math.PI*2); ctx.fill(); 
    } else {
        ctx.fillStyle = '#333';
        ctx.fillRect(10, 12, 16, 4); 
        ctx.fillRect(10, 14, 4, 4); 
    }

    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();

    if (!isEnemy) {
        ctx.fillStyle = '#111'; 
        ctx.beginPath(); ctx.arc(2, 0, 11, -Math.PI/2, Math.PI/2); ctx.fill();
        ctx.fillStyle = color; 
        ctx.fillRect(-8, -9, 10, 18);
        ctx.fillStyle = '#ffd700'; 
        ctx.fillRect(-2, -4, 4, 8);
    } else {
        if (enemyType === 'gunman') {
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
        } else if (enemyType === 'knifeman') {
            ctx.fillStyle = '#800';
            ctx.fillRect(-8, -8, 16, 16);
        } else if (enemyType === 'bombman') {
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        }
    }
    ctx.restore();
}

function drawTrain() {
    // This function now draws the train at a static position (0,0)
    ctx.save();
    ctx.translate(0, 0); // Centered on the world origin

    ctx.fillStyle = '#555';
    ctx.fillRect(110, -5, 10, 10); 
    ctx.fillRect(0, -5, 10, 10);   
    ctx.fillRect(-150, -5, 10, 10); 
    ctx.fillRect(-300, -5, 10, 10); 

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
            for(let i=10; i<car.w-10; i+=15) {
                for(let j=10; j<car.h-10; j+=15) {
                    ctx.fillRect(i, j, 12, 12);
                }
            }
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(40, 25, 20, 20);
            ctx.fillStyle = '#fff'; ctx.font = '10px monospace'; ctx.fillText('DUMP', 38, 40);

        } else if (car.id.startsWith('pass')) {
            ctx.fillStyle = '#6b4423'; ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#222'; ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
            ctx.fillStyle = '#87ceeb';
            for(let i=20; i<car.w-20; i+=30) {
                ctx.fillRect(i, 10, 15, 15); ctx.fillRect(i, car.h - 25, 15, 15);
            }
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
    if (!gameState || gameState.status !== 'PLAYING' && gameState.status !== 'VOTING') {
        requestAnimationFrame(draw);
        return;
    }

    let myPlayer = gameState.players[socket.id];
    if (!myPlayer) return requestAnimationFrame(draw);

    let camX = 0; let camY = 0;
    if (myPlayer.dead && myPlayer.spectatingId && gameState.players[myPlayer.spectatingId]) {
        camX = gameState.players[myPlayer.spectatingId].x;
        camY = gameState.players[myPlayer.spectatingId].y;
    } else {
        camX = myPlayer.x;
        camY = myPlayer.y;
    }

    let cx = canvas.width / 2;
    let cy = canvas.height / 2;

    let bgColor = '#2d4c1e'; 
    if (gameState.biome === 'desert') bgColor = '#c2b280';
    if (gameState.biome === 'tundra') bgColor = '#e0e6ed';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // The camera is now static, centered on the train's world position (0,0)
    ctx.translate(cx, cy);

    let pixelDist = gameState.train.distance * 1000;

    if (gameState.inMountains) {
        ctx.fillStyle = gameState.biome === 'tundra' ? '#aab' : '#555';
        let mountainOffset = (pixelDist * 0.2) % 400;
        for(let i = -2000; i < 2000; i+= 400) {
            ctx.beginPath();
            ctx.moveTo(i - mountainOffset, -400);
            ctx.lineTo(i + 200 - mountainOffset, -700);
            ctx.lineTo(i + 400 - mountainOffset, -400);
            ctx.fill();
        }
    }

    let sceneryOffset = pixelDist % 600;
    for(let i = -2000; i < 2000; i+= 300) {
        let xPos = i - sceneryOffset;[-300, -150, 150, 300].forEach(yOffset => {
            let finalX = xPos + (Math.abs(yOffset) % 100);
            let finalY = yOffset;

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

    let tieOffset = pixelDist % 40;
    ctx.fillStyle = '#4a3c31'; 
    for(let i = -2000; i < 2000; i+= 40) {
        ctx.fillRect(i - tieOffset, -35, 10, 70);
    }
    ctx.fillStyle = '#777'; 
    ctx.fillRect(-2000, -25, 4000, 6);
    ctx.fillRect(-2000, 19, 4000, 6);

    // Draw town buildings if in a town
    if (gameState.townX !== null) {
        ctx.fillStyle = '#a0522d';
        for (let i = -5; i < 5; i++) {
            ctx.fillRect(gameState.townX + i * 150 - 50, 100, 100, 100);
            ctx.fillRect(gameState.townX + i * 150 - 50, -200, 100, 100);
        }
    }

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

    gameState.ores.forEach(ore => {
        ctx.fillStyle = ore.type === 'gold' ? '#ffd700' : (ore.type === 'silver' ? '#e3e4e5' : '#111');
        ctx.beginPath(); ctx.arc(ore.x, ore.y, 15 + (ore.maxHits * 2), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    });

    if (gameState.shopNPC) {
        ctx.fillStyle = '#00f';
        ctx.fillRect(gameState.shopNPC.x - 10, gameState.shopNPC.y - 10, 20, 20);
        ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText('SHOP', gameState.shopNPC.x - 12, gameState.shopNPC.y - 15);
    }

    ctx.fillStyle = '#8b4513';
    gameState.horses.forEach(h => {
        ctx.fillRect(h.x - 15, h.y - 10, 30, 20); ctx.fillRect(h.x + 5, h.y - 15, 15, 15); 
    });

    drawTrain();

    gameState.barrels.forEach(b => {
        ctx.fillStyle = '#8b4513'; ctx.fillRect(b.x - 15, b.y - 20, 30, 40);
        ctx.fillStyle = '#222'; ctx.fillRect(b.x - 15, b.y - 10, 30, 4);
        ctx.fillRect(b.x - 15, b.y + 6, 30, 4);
        ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
        ctx.fillText(`${b.sipsLeft}/67`, b.x - 14, b.y - 25);
    });

    gameState.enemies.forEach(e => {
        let color = e.type === 'gunman' ? '#777' : (e.type === 'knifeman' ? '#8b4513' : '#222');
        drawHumanoid(e.x, e.y, color, e.aimAngle, false, e.hasHorse, true, e.type, null);
    });

    for (let id in gameState.players) {
        let p = gameState.players[id];
        if (p.dead) continue;
        drawHumanoid(p.x, p.y, p.color, p.aimAngle, p.hasKnife, p.onHorse, false, null, p.name);
    }

    ctx.fillStyle = '#ffcc00';
    gameState.projectiles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    ctx.fillStyle = '#111';
    gameState.bombs.forEach(b => {
        ctx.beginPath();
        let pulse = Math.sin(b.timer * 15) * 3;
        ctx.arc(b.x, b.y, 12 + pulse, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
    });

    ctx.restore();

    let dx = 0, dy = 0;
    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;
    if (dx !== 0 || dy !== 0) {
        let len = Math.hypot(dx, dy);
        socket.emit('move', { dx: dx / len, dy: dy / len });
    }

    requestAnimationFrame(draw);
}

draw();
