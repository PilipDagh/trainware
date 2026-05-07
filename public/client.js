// public/client.js
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- STATE ---
let gameState = null;
let myId = null;
let myRole = null;
let settings = { mobile: /Mobi|Android/i.test(navigator.userAgent), autoLock: false };

// --- INPUT STATE ---
const keys = { w: false, a: false, s: false, d: false, t: false };
let mouseAngle = 0;
let isShooting = false;
let lastShootTime = 0;

// --- UI FUNCTIONS ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showNotification(msg) {
    const container = document.getElementById('notifications');
    const div = document.createElement('div');
    div.className = 'notif';
    div.innerText = msg;
    container.appendChild(div);
    setTimeout(() => { if(div.parentNode) div.parentNode.removeChild(div); }, 4000);
}

function saveSettings() {
    settings.mobile = document.getElementById('set-mobile').checked;
    settings.autoLock = document.getElementById('set-autolock').checked;
    showScreen('screen-main');
}

// --- LOBBY NETWORKING ---
function createLobby() {
    const name = document.getElementById('lobby-name').value;
    const max = document.getElementById('lobby-max').value;
    const pass = document.getElementById('lobby-pass').value;
    const traitor = document.getElementById('lobby-traitor').checked;
    const pName = document.getElementById('player-name').value;
    if(!pName) return alert("Enter a name!");
    socket.emit('create_lobby', { name, maxPlayers: max, password: pass, enableTraitor: traitor, playerName: pName });
}

function openJoinMenu() {
    socket.emit('get_lobbies');
    showScreen('screen-join');
}

socket.on('lobby_list', (list) => {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';
    if(list.length === 0) container.innerHTML = '<p>No public trains available.</p>';
    list.forEach(l => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `<span><b>${l.name}</b> (${l.players}/${l.max}) ${l.hasPassword ? '🔒' : ''}</span>
                         <button onclick="joinLobby('${l.id}')">JOIN</button>`;
        container.appendChild(div);
    });
});

function joinLobby(id) {
    const pass = document.getElementById('join-pass').value;
    const pName = document.getElementById('player-name').value;
    if(!pName) return alert("Enter a name!");
    socket.emit('join_lobby', { lobbyId: id, password: pass, playerName: pName });
}

socket.on('error_msg', (msg) => alert(msg));

socket.on('lobby_update', (lobby) => {
    showScreen('screen-waiting');
    document.getElementById('waiting-title').innerText = `TRAIN: ${lobby.name}`;
    const pList = document.getElementById('waiting-players');
    pList.innerHTML = Object.values(lobby.players).map(p => `<span style="color:${p.color}; display:block;">■ ${p.name}</span>`).join('');
    
    if (Object.keys(lobby.players)[0] === socket.id) {
        document.getElementById('btn-depart').style.display = 'block';
    }
});

function startGame() { socket.emit('start_game'); }

socket.on('game_started', (lobby) => {
    showScreen(null);
    myId = socket.id;
    const me = lobby.players[myId];
    myRole = me.role;
    
    const intro = document.getElementById('intro-screen');
    const rName = document.getElementById('role-name');
    intro.classList.add('active');
    
    if (me.isTraitor) {
        rName.innerText = 'TRAITOR';
        rName.style.color = '#ff3333';
        rName.style.textShadow = '0 0 20px red';
        document.getElementById('role-buff').innerText = 'Kill all non-traitors. AI ignores you. Friendly fire is ON.';
    } else {
        rName.innerText = myRole;
        rName.style.color = '#d4af37';
        rName.style.textShadow = '0 0 20px gold';
        const buffs = {
            'Sharpshooter': '+20% Damage', 'Engineer': '-15% Fuel burn rate', 'Prospector': 'Mine ores 25% faster',
            'Medic': 'Bandages heal +30 extra HP', 'Trapper': 'Animal skins sell for $3 instead of $1', 
            'Soldier': 'Starts with 64 ammo', 'Blacksmith': 'Knife deals 80 damage', 'Normal': 'No special buffs. Good luck.'
        };
        document.getElementById('role-buff').innerText = buffs[myRole];
    }
    
    setTimeout(() => {
        intro.classList.remove('active');
        document.getElementById('game-ui').style.display = 'block';
        if (settings.mobile) {
            document.querySelectorAll('.joystick-base, .action-btn').forEach(el => el.style.display = 'flex');
            document.getElementById('controls-hint').style.display = 'none';
            initJoysticks();
            initMobileButtons();
        }
        requestAnimationFrame(gameLoop);
    }, 5000);
});

socket.on('game_state', (state) => { 
    gameState = state; 
    updateHUD(); 
});

socket.on('departure_warning', () => {
    const warn = document.getElementById('departure-warning');
    warn.style.display = 'block';
    let t = 8;
    document.getElementById('dep-time').innerText = t;
    const int = setInterval(() => {
        t--; 
        document.getElementById('dep-time').innerText = t;
        if (t <= 0) { clearInterval(int); warn.style.display = 'none'; }
    }, 1000);
});

socket.on('notification', (msg) => showNotification(msg));
socket.on('open_shop', () => { document.getElementById('modal-shop').style.display = 'block'; });
socket.on('horse_result', (winner) => showNotification(`Horse ${winner} won the race!`));

socket.on('victory', (stats) => {
    document.getElementById('game-ui').style.display = 'none';
    showScreen('screen-victory');
    const getTop = (obj) => Object.keys(obj).length ? Object.keys(obj).reduce((a, b) => obj[a] > obj[b] ? a : b) : 'None';
    
    document.getElementById('victory-stats').innerHTML = `
        <p>🔫 <b>Lead-Slinger</b> (Most Kills): <span style="color:gold">${getTop(stats.kills)}</span></p>
        <p>🍺 <b>Drunkard</b> (Most Beer): <span style="color:gold">${getTop(stats.beerSips)}</span></p>
        <p>⛏️ <b>Workhorse</b> (Most Coal): <span style="color:gold">${getTop(stats.coalMined)}</span></p>
        <p>🐍 <b>The Snake</b> (Traitor Status): <span style="color:${stats.traitorWon ? 'red' : 'lime'}">${stats.traitorWon ? 'ESCAPED & WON' : 'DEAD'}</span></p>
    `;
});

// --- INTERACTION LOGIC ---
function buyItem(item) { socket.emit('buy_item', item); }

function updateGambleUI() {
    const game = document.getElementById('gamble-game').value;
    const opts = document.getElementById('gamble-choice');
    opts.innerHTML = '';
    if (game === 'Roulette') {
        opts.innerHTML = '<option value="Red">Red (2x)</option><option value="Black">Black (2x)</option><option value="Green">Green (14x)</option>';
    } else if (game === 'Horse') {
        opts.innerHTML = '<option value="1">Horse 1 (4x)</option><option value="2">Horse 2 (4x)</option><option value="3">Horse 3 (4x)</option><option value="4">Horse 4 (4x)</option>';
    }
}

function placeBet() {
    const game = document.getElementById('gamble-game').value;
    const choice = document.getElementById('gamble-choice').value;
    const bet = parseInt(document.getElementById('gamble-bet').value);
    socket.emit('gamble', { game, choice: game === 'Horse' ? parseInt(choice) : choice, bet });
}

// --- RENDERING ---
function updateHUD() {
    if (!gameState || !gameState.players[myId]) return;
    const me = gameState.players[myId];
    document.getElementById('hp-bar').innerText = `HP: ${Math.floor(me.hp)}`;
    document.getElementById('ammo-bar').innerText = `Ammo: ${me.inventory.ammo}`;
    document.getElementById('money-bar').innerText = `$: ${me.inventory.money}`;
    document.getElementById('meat-bar').innerText = `Meat: ${me.inventory.meat}/7 | Cooked: ${me.inventory.cookedMeat}`;
    document.getElementById('inv-bar').innerText = `Bandages: ${me.inventory.bandages} | Beer: ${me.inventory.beer}`;
    
    document.getElementById('train-stats').innerHTML = `
        Speed: ${Math.floor(gameState.train.speed * 10)} km/h<br>
        Coal: ${Math.floor(gameState.train.coal)}/1003<br>
        Pressure: ${Math.floor(gameState.train.pressure)}/100<br>
        Dist: ${Math.floor(gameState.train.distance)}/3181km
    `;
}

function drawTrain(camX, camY) {
    ctx.save();
    ctx.translate(-camX, -camY);
    
    // Train Cars
    const cars =[
        { x: 0, w: 300, color: '#2a2a2a', name: 'ENGINE' },
        { x: -300, w: 300, color: '#111', name: 'COAL CAR' },
        { x: -600, w: 300, color: '#4e342e', name: 'PASSENGER' },
        { x: -900, w: 300, color: '#4e342e', name: 'PASSENGER' },
        { x: -1200, w: 300, color: '#5d4037', name: 'KITCHEN' },
        { x: -1500, w: 300, color: '#3e2723', name: 'GAMBLING' },
        { x: -1800, w: 300, color: '#8d6e63', name: 'CABOOSE' }
    ];

    cars.forEach(car => {
        // Track
        ctx.fillStyle = '#555';
        ctx.fillRect(car.x - 10, -110, car.w + 20, 220);
        ctx.fillStyle = '#222';
        for(let i=0; i<car.w; i+=40) ctx.fillRect(car.x + i, -120, 10, 240);

        // Car Body
        ctx.fillStyle = car.color;
        ctx.fillRect(car.x + 10, -100, car.w - 20, 200);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 4;
        ctx.strokeRect(car.x + 10, -100, car.w - 20, 200);
        
        // Roof detail
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(car.x + 20, -90, car.w - 40, 180);

        // Text
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(car.name, car.x + 150, 10);
    });

    // Steam Valve Fog
    if (gameState.train.fogActive) {
        const gradient = ctx.createRadialGradient(150, 0, 10, 150, 0, 200);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(150, 0, 200, 0, Math.PI * 2);
        ctx.fill();
    }

    // Bridge Out Event
    if (gameState.world.event === 'BRIDGE') {
        ctx.fillStyle = '#1a5276'; // River
        ctx.fillRect(350, -1500, 300, 3000);
        
        ctx.fillStyle = 'rgba(139, 69, 19, 0.4)'; // Broken tracks base
        ctx.fillRect(350, -110, 300, 220);
        
        // Deposited Planks
        ctx.fillStyle = '#8b4513';
        const pRatio = gameState.train.planksDeposited / gameState.world.planksRequired;
        ctx.fillRect(350, -110, 300 * pRatio, 220);

        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(`FIX BRIDGE: ${gameState.train.planksDeposited}/${gameState.world.planksRequired} Planks`, 500, -130);
    }

    ctx.restore();
}

function drawPlayer(p, camX, camY) {
    if (p.isDead) return;
    ctx.save();
    ctx.translate(p.x - camX, p.y - camY);
    ctx.rotate(p.angle);

    // Body
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();

    // Hands holding weapon
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath(); ctx.arc(14, 12, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(14, -12, 6, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    // Gun barrel
    ctx.fillStyle = '#333';
    ctx.fillRect(16, 8, 15, 4);

    // Conductor Hat (Rotated with player)
    ctx.fillStyle = '#111';
    ctx.fillRect(-8, -14, 16, 28); // Base
    ctx.fillRect(2, -18, 6, 36);  // Brim

    // Gold Badge
    ctx.fillStyle = 'gold';
    ctx.beginPath(); ctx.arc(-2, 0, 4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // Name Tag (Not rotated)
    ctx.save();
    ctx.translate(p.x - camX, p.y - camY);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = "black";
    ctx.shadowBlur = 4;
    ctx.fillText(p.name, 0, -30);
    
    // HP Bar
    ctx.fillStyle = 'red'; ctx.fillRect(-15, -25, 30, 4);
    ctx.fillStyle = 'lime'; ctx.fillRect(-15, -25, 30 * (p.hp/100), 4);
    ctx.restore();
}

function drawWorld(camX, camY) {
    ctx.save();
    ctx.translate(-camX, -camY);

    gameState.world.objects.forEach(obj => {
        if (obj.type === 'Tree') { 
            ctx.fillStyle = '#2e7d32'; 
            ctx.beginPath(); ctx.arc(obj.x, obj.y, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#1b5e20'; 
            ctx.beginPath(); ctx.arc(obj.x, obj.y, 15, 0, Math.PI*2); ctx.fill();
        }
        else if (obj.type === 'Ore') { 
            ctx.fillStyle = '#7f8c8d'; 
            ctx.beginPath(); ctx.moveTo(obj.x, obj.y-15); ctx.lineTo(obj.x+15, obj.y+10); ctx.lineTo(obj.x-15, obj.y+10); ctx.fill(); 
        }
        else if (obj.type === 'Plank') { 
            ctx.fillStyle = '#d35400'; ctx.fillRect(obj.x-15, obj.y-5, 30, 10); 
            ctx.strokeStyle = '#000'; ctx.strokeRect(obj.x-15, obj.y-5, 30, 10);
        }
        else if (obj.type === 'Shop') { 
            ctx.fillStyle = '#f1c40f'; ctx.fillRect(obj.x-30, obj.y-30, 60, 60); 
            ctx.fillStyle='black'; ctx.font='bold 16px Arial'; ctx.fillText('SHOP', obj.x-22, obj.y+5); 
        }
    });

    gameState.world.enemies.forEach(en => {
        if (en.type === 'Animal') { 
            ctx.fillStyle = '#8d6e63'; ctx.fillRect(en.x-12, en.y-12, 24, 24); 
        }
        else if (en.type === 'Snake') { 
            ctx.fillStyle = '#4caf50'; 
            ctx.beginPath(); ctx.arc(en.x, en.y, 8, 0, Math.PI*2); ctx.fill();
        }
        else if (en.type === 'Hawk') { 
            ctx.fillStyle = '#3e2723'; 
            ctx.beginPath(); ctx.moveTo(en.x+15, en.y); ctx.lineTo(en.x-10, en.y-15); ctx.lineTo(en.x-10, en.y+15); ctx.fill(); 
        }
        else if (en.type === 'Marshal') { 
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(en.x, en.y, 18, 0, Math.PI*2); ctx.fill(); 
            ctx.fillStyle='gold'; ctx.font='20px Arial'; ctx.fillText('★', en.x-10, en.y+7); 
        }
        
        // Enemy HP
        ctx.fillStyle = 'red'; ctx.fillRect(en.x-10, en.y-25, 20, 3);
        ctx.fillStyle = 'lime'; ctx.fillRect(en.x-10, en.y-25, 20 * (en.hp/(en.type==='Marshal'?331:50)), 3);
    });

    gameState.world.bullets.forEach(b => {
        ctx.fillStyle = b.isTraitor ? '#ff3333' : '#ffff00';
        ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.shadowColor = b.isTraitor ? "red" : "yellow";
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    ctx.restore();
}

function applyDrunkEffect(level) {
    if (level >= 3) {
        const intensity = Math.min(level, 10);
        const time = Date.now() * 0.002;
        const waveX = Math.sin(time) * intensity * 2;
        const waveY = Math.cos(time) * intensity * 2;
        ctx.translate(waveX, waveY);
        
        // Rainbow overlay
        ctx.fillStyle = `hsla(${(time * 50) % 360}, 100%, 50%, 0.1)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

function gameLoop() {
    if (!gameState || !gameState.players[myId]) return requestAnimationFrame(gameLoop);
    const me = gameState.players[myId];

    if (me.isDead) {
        ctx.fillStyle = 'rgba(100, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white'; ctx.font = '50px Arial'; ctx.textAlign = 'center';
        ctx.fillText("YOU DIED", canvas.width/2, canvas.height/2);
        return requestAnimationFrame(gameLoop);
    }

    const camX = me.x - canvas.width / 2;
    const camY = me.y - canvas.height / 2;

    // Biome Background
    const dist = gameState.train.distance;
    if (dist < 636 || (dist > 1908 && dist < 2544)) {
        ctx.fillStyle = '#3e5f36'; // Forest
    } else if ((dist >= 636 && dist <= 1272) || dist >= 2544) {
        ctx.fillStyle = '#c2b280'; // Desert
    } else {
        ctx.fillStyle = '#e0e0e0'; // Tundra
    }
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    applyDrunkEffect(me.drunkLevel);

    drawWorld(camX, camY);
    drawTrain(camX, camY);
    
    // Draw other players first, then me
    Object.values(gameState.players).forEach(p => { if(p.id !== myId) drawPlayer(p, camX, camY); });
    drawPlayer(me, camX, camY);

    ctx.restore();

    // Tunnel of Darkness
    if (gameState.world.event === 'TUNNEL') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        // Engine Headlight
        if (gameState.train.state === 'MOVING') {
            const hX = 300 - camX; const hY = 0 - camY;
            ctx.moveTo(hX, hY);
            ctx.arc(hX, hY, 600, -Math.PI/6, Math.PI/6);
            ctx.fill();
        }
        // Player Flashlight
        const radius = me.inventory.flashlights > 0 ? 300 : 100;
        ctx.arc(canvas.width/2, canvas.height/2, radius, 0, Math.PI*2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    handleInput();
    requestAnimationFrame(gameLoop);
}

// --- INPUT HANDLING ---
window.addEventListener('keydown', (e) => {
    if(document.activeElement.tagName === 'INPUT') return;
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
    
    if (k === 'e') {
        socket.emit('interact');
        if (gameState) {
            const me = gameState.players[myId];
            if (me.x > -1500 && me.x < -1200) document.getElementById('modal-gamble').style.display = 'block';
        }
    }
    if (k === 'y') socket.emit('eat_meat');
    if (k === 'b') socket.emit('drink_beer');
    if (k === 't') socket.emit('steam_valve', true);
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
    if (k === 't') socket.emit('steam_valve', false);
});

window.addEventListener('mousemove', (e) => {
    if(settings.mobile) return;
    const dx = e.clientX - canvas.width / 2;
    const dy = e.clientY - canvas.height / 2;
    mouseAngle = Math.atan2(dy, dx);
});

window.addEventListener('mousedown', (e) => { if(e.target.tagName === 'CANVAS') isShooting = true; });
window.addEventListener('mouseup', () => isShooting = false);

// --- MOBILE DUAL JOYSTICKS ---
let joyLeft = { active: false, dx: 0, dy: 0, id: null };
let joyRight = { active: false, angle: 0, shooting: false, id: null };

function initJoysticks() {
    const baseL = document.getElementById('joy-left');
    const stickL = document.getElementById('stick-left');
    const baseR = document.getElementById('joy-right');
    const stickR = document.getElementById('stick-right');

    const handleTouch = (e, base, stick, joyObj, isRight) => {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            const t = e.changedTouches[i];
            if (e.type === 'touchstart' && !joyObj.active) {
                const rect = base.getBoundingClientRect();
                if (t.clientX >= rect.left && t.clientX <= rect.right && t.clientY >= rect.top && t.clientY <= rect.bottom) {
                    joyObj.active = true; joyObj.id = t.identifier;
                }
            }
            if (joyObj.active && t.identifier === joyObj.id) {
                if (e.type === 'touchend' || e.type === 'touchcancel') {
                    joyObj.active = false; joyObj.id = null;
                    stick.style.transform = `translate(0px, 0px)`;
                    if (isRight) joyObj.shooting = false;
                    else { joyObj.dx = 0; joyObj.dy = 0; }
                } else if (e.type === 'touchmove') {
                    const rect = base.getBoundingClientRect();
                    const cx = rect.left + rect.width / 2;
                    const cy = rect.top + rect.height / 2;
                    let dx = t.clientX - cx; let dy = t.clientY - cy;
                    const dist = Math.hypot(dx, dy);
                    const maxDist = rect.width / 2;
                    if (dist > maxDist) { dx = (dx/dist)*maxDist; dy = (dy/dist)*maxDist; }
                    stick.style.transform = `translate(${dx}px, ${dy}px)`;
                    
                    if (isRight) {
                        joyObj.angle = Math.atan2(dy, dx);
                        joyObj.shooting = dist > maxDist * 0.5;
                    } else {
                        joyObj.dx = dx / maxDist; joyObj.dy = dy / maxDist;
                    }
                }
            }
        }
    };
    ['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(evt => {
        baseL.addEventListener(evt, (e) => handleTouch(e, baseL, stickL, joyLeft, false), {passive: false});
        baseR.addEventListener(evt, (e) => handleTouch(e, baseR, stickR, joyRight, true), {passive: false});
    });
}

function initMobileButtons() {
    document.getElementById('btn-interact').addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('interact'); });
    document.getElementById('btn-eat').addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('eat_meat'); });
    document.getElementById('btn-drink').addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('drink_beer'); });
    
    const btnSteam = document.getElementById('btn-steam');
    btnSteam.addEventListener('touchstart', (e) => { e.preventDefault(); socket.emit('steam_valve', true); });
    btnSteam.addEventListener('touchend', (e) => { e.preventDefault(); socket.emit('steam_valve', false); });
}

function handleInput() {
    let dx = 0, dy = 0;
    let angle = mouseAngle;
    let shoot = isShooting;

    if (settings.mobile) {
        dx = joyLeft.dx; dy = joyLeft.dy;
        if (joyRight.shooting) { angle = joyRight.angle; shoot = true; }
    } else {
        if (keys.w) dy = -1; if (keys.s) dy = 1;
        if (keys.a) dx = -1; if (keys.d) dx = 1;
        if (dx !== 0 && dy !== 0) { const norm = Math.SQRT1_2; dx *= norm; dy *= norm; }
    }

    if (settings.autoLock && shoot && gameState) {
        const me = gameState.players[myId];
        let target = null; let minDist = 400;
        gameState.world.enemies.forEach(en => {
            let d = Math.hypot(en.x - me.x, en.y - me.y);
            if (d < minDist) { minDist = d; target = en; }
        });
        if (target) angle = Math.atan2(target.y - me.y, target.x - me.x);
    }

    // Fire rate limiting (5 rounds per second max)
    const now = Date.now();
    if (shoot && now - lastShootTime > 200) {
        lastShootTime = now;
    } else {
        shoot = false;
    }

    socket.emit('player_input', { dx, dy, angle, shoot });
}
