// public/client.js
const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// --- STATE ---
let gameState = null;
let myId = null;
let myRole = null;
let settings = { mobile: /Mobi|Android/i.test(navigator.userAgent), autoLock: false };

// --- UI FUNCTIONS ---
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    if (id) document.getElementById(id).classList.add('active');
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
    socket.emit('create_lobby', { name, maxPlayers: max, password: pass, enableTraitor: traitor, playerName: pName });
}

function openJoinMenu() {
    socket.emit('get_lobbies');
    showScreen('screen-join');
}

socket.on('lobby_list', (list) => {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';
    list.forEach(l => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `<span>${l.name} (${l.players}/${l.max}) ${l.hasPassword ? '🔒' : ''}</span>
                         <button onclick="joinLobby('${l.id}')">JOIN</button>`;
        container.appendChild(div);
    });
});

function joinLobby(id) {
    const pass = document.getElementById('join-pass').value;
    const pName = document.getElementById('player-name').value;
    socket.emit('join_lobby', { lobbyId: id, password: pass, playerName: pName });
}

socket.on('lobby_update', (lobby) => {
    showScreen('screen-waiting');
    document.getElementById('waiting-title').innerText = lobby.name;
    const pList = document.getElementById('waiting-players');
    pList.innerHTML = Object.values(lobby.players).map(p => `<p style="color:${p.color}">${p.name}</p>`).join('');
    
    // Host is the first player
    if (Object.keys(lobby.players)[0] === socket.id) {
        document.getElementById('btn-depart').style.display = 'block';
    }
});

function startGame() { socket.emit('start_game'); }

socket.on('game_started', (lobby) => {
    showScreen(null); // Hide menus
    myId = socket.id;
    const me = lobby.players[myId];
    myRole = me.role;
    
    // Among Us Intro
    const intro = document.getElementById('intro-screen');
    const rName = document.getElementById('role-name');
    intro.classList.add('active');
    rName.innerText = me.isTraitor ? 'TRAITOR' : myRole;
    rName.style.color = me.isTraitor ? 'red' : '#d4af37';
    
    const buffs = {
        'Sharpshooter': '+20% Damage', 'Engineer': '-15% Fuel burn', 'Prospector': 'Mine 25% faster',
        'Medic': 'Bandages heal +30 HP', 'Trapper': 'Skins sell for $3', 'Soldier': 'Starts with 64 ammo',
        'Blacksmith': 'Knife deals 80 dmg', 'Normal': 'No buffs'
    };
    document.getElementById('role-buff').innerText = me.isTraitor ? 'Kill all non-traitors. AI ignores you.' : buffs[myRole];
    
    setTimeout(() => {
        intro.classList.remove('active');
        document.getElementById('game-ui').style.display = 'block';
        if (settings.mobile) {
            document.getElementById('joy-left').style.display = 'block';
            document.getElementById('joy-right').style.display = 'block';
            initJoysticks();
        }
        requestAnimationFrame(gameLoop);
    }, 5000);
});

socket.on('game_state', (state) => { gameState = state; updateHUD(); });

socket.on('departure_warning', () => {
    const warn = document.getElementById('departure-warning');
    warn.style.display = 'block';
    let t = 8;
    const int = setInterval(() => {
        t--; document.getElementById('dep-time').innerText = t;
        if (t <= 0) { clearInterval(int); warn.style.display = 'none'; }
    }, 1000);
});

socket.on('victory', (stats) => {
    document.getElementById('game-ui').style.display = 'none';
    showScreen('screen-victory');
    const getTop = (obj) => Object.keys(obj).length ? Object.keys(obj).reduce((a, b) => obj[a] > obj[b] ? a : b) : 'None';
    document.getElementById('victory-stats').innerHTML = `
        <p>Lead-Slinger (Kills): ${getTop(stats.kills)}</p>
        <p>Drunkard (Beer): ${getTop(stats.beerSips)}</p>
        <p>Workhorse (Coal): ${getTop(stats.coalMined)}</p>
        <p>The Snake (Traitor): ${stats.traitorWon ? 'Escaped' : 'Dead'}</p>
    `;
});
// Append to public/client.js

function updateHUD() {
    if (!gameState || !gameState.players[myId]) return;
    const me = gameState.players[myId];
    document.getElementById('hp-bar').innerText = `HP: ${Math.floor(me.hp)}`;
    document.getElementById('ammo-bar').innerText = `Ammo: ${me.inventory.ammo}`;
    document.getElementById('money-bar').innerText = `$: ${me.inventory.money}`;
    document.getElementById('meat-bar').innerText = `Meat: ${me.inventory.meat} | Cooked: ${me.inventory.cookedMeat} (Press Y to eat)`;
    document.getElementById('train-stats').innerText = `Speed: ${Math.floor(gameState.train.speed)} | Coal: ${Math.floor(gameState.train.coal)} | Dist: ${Math.floor(gameState.train.distance)}/3181km`;
}

function drawTrain(camX, camY) {
    ctx.save();
    ctx.translate(-camX, -camY);
    
    // Train Cars (Engine to Caboose)
    const cars =[
        { x: 0, w: 300, color: '#222', name: 'Engine' },
        { x: -300, w: 300, color: '#111', name: 'Coal' },
        { x: -600, w: 300, color: '#4e342e', name: 'Pass 1' },
        { x: -900, w: 300, color: '#4e342e', name: 'Pass 2' },
        { x: -1200, w: 300, color: '#5d4037', name: 'Kitchen' },
        { x: -1500, w: 300, color: '#3e2723', name: 'Gambling' },
        { x: -1800, w: 300, color: '#8d6e63', name: 'Caboose' }
    ];

    cars.forEach(car => {
        ctx.fillStyle = car.color;
        ctx.fillRect(car.x, -100, car.w, 200);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(car.x, -100, car.w, 200);
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.fillText(car.name, car.x + 100, 0);
    });

    // Draw Bridge Out Event
    if (gameState.world.event === 'BRIDGE') {
        ctx.fillStyle = '#1a5276'; // River
        ctx.fillRect(350, -1000, 200, 2000);
        ctx.fillStyle = 'rgba(139, 69, 19, 0.5)'; // Broken tracks
        ctx.fillRect(350, -20, 200, 40);
        ctx.fillStyle = 'white';
        ctx.fillText(`Planks: ${gameState.train.planksDeposited}/${gameState.world.planksRequired}`, 100, -120);
    }

    ctx.restore();
}

function drawPlayer(p, camX, camY) {
    if (p.isDead) return;
    ctx.save();
    ctx.translate(p.x - camX, p.y - camY);

    // Body
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, Math.PI * 2); ctx.fill();

    // Hands
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath(); ctx.arc(12, 10, 5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(-12, 10, 5, 0, Math.PI*2); ctx.fill();

    // Conductor Hat
    ctx.fillStyle = '#111';
    ctx.fillRect(-12, -22, 24, 12); // Base
    ctx.fillRect(-16, -10, 32, 4);  // Brim

    // Gold Badge
    ctx.fillStyle = 'gold';
    ctx.beginPath(); ctx.arc(0, -16, 3, 0, Math.PI * 2); ctx.fill();

    // Name Tag
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, 0, -30);

    ctx.restore();
}

function drawWorld(camX, camY) {
    ctx.save();
    ctx.translate(-camX, -camY);

    // Objects (Trees, Ores, Planks)
    gameState.world.objects.forEach(obj => {
        if (obj.type === 'Tree') { ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(obj.x, obj.y, 20, 0, Math.PI*2); ctx.fill(); }
        else if (obj.type === 'Ore') { ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.arc(obj.x, obj.y, 15, 0, Math.PI*2); ctx.fill(); }
        else if (obj.type === 'Plank') { ctx.fillStyle = '#d35400'; ctx.fillRect(obj.x-10, obj.y-5, 20, 10); }
        else if (obj.type === 'Shop') { ctx.fillStyle = '#f1c40f'; ctx.fillRect(obj.x-20, obj.y-20, 40, 40); ctx.fillStyle='black'; ctx.fillText('SHOP', obj.x-18, obj.y+5); }
    });

    // Enemies
    gameState.world.enemies.forEach(en => {
        if (en.type === 'Animal') { ctx.fillStyle = '#8d6e63'; ctx.fillRect(en.x-10, en.y-10, 20, 20); }
        else if (en.type === 'Snake') { ctx.fillStyle = '#4caf50'; ctx.fillRect(en.x-5, en.y-5, 10, 10); }
        else if (en.type === 'Hawk') { ctx.fillStyle = '#5d4037'; ctx.beginPath(); ctx.moveTo(en.x, en.y-10); ctx.lineTo(en.x-10, en.y+10); ctx.lineTo(en.x+10, en.y+10); ctx.fill(); }
        else if (en.type === 'Marshal') { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(en.x, en.y, 18, 0, Math.PI*2); ctx.fill(); ctx.fillStyle='gold'; ctx.fillText('★', en.x-6, en.y+5); }
    });

    // Bullets
    gameState.world.bullets.forEach(b => {
        ctx.fillStyle = b.isTraitor ? 'red' : 'yellow';
        ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI*2); ctx.fill();
    });

    ctx.restore();
}

function gameLoop() {
    if (!gameState || !gameState.players[myId]) return requestAnimationFrame(gameLoop);
    const me = gameState.players[myId];

    // Camera follows player
    const camX = me.x - canvas.width / 2;
    const camY = me.y - canvas.height / 2;

    // Biome Background
    const dist = gameState.train.distance;
    if (dist < 636 || dist > 2544) ctx.fillStyle = '#3e5f36'; // Forest
    else if (dist < 1272 || dist > 1908) ctx.fillStyle = '#c2b280'; // Desert
    else ctx.fillStyle = '#e0e0e0'; // Tundra
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawWorld(camX, camY);
    drawTrain(camX, camY);
    Object.values(gameState.players).forEach(p => drawPlayer(p, camX, camY));

    // Tunnel of Darkness
    if (gameState.world.event === 'TUNNEL') {
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(canvas.width/2, canvas.height/2, 150, 0, Math.PI*2); // Flashlight
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
    }

    handleInput();
    requestAnimationFrame(gameLoop);
}
// Append to public/client.js

// --- INPUT HANDLING ---
const keys = { w: false, a: false, s: false, d: false };
let mouseAngle = 0;
let isShooting = false;

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
    if (k === 'e') socket.emit('interact');
    if (k === 'y') socket.emit('eat_meat');
    
    // Open Gambling UI if in Gambling Car (-1500 to -1200)
    if (k === 'e' && gameState) {
        const me = gameState.players[myId];
        if (me.x > -1500 && me.x < -1200) {
            document.getElementById('modal-gamble').style.display = 'block';
        }
    }
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
});

window.addEventListener('mousemove', (e) => {
    const dx = e.clientX - canvas.width / 2;
    const dy = e.clientY - canvas.height / 2;
    mouseAngle = Math.atan2(dy, dx);
});

window.addEventListener('mousedown', () => isShooting = true);
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
                        joyObj.shooting = dist > maxDist * 0.5; // Shoot if pushed halfway
                    } else {
                        joyObj.dx = dx / maxDist; joyObj.dy = dy / maxDist;
                    }
                }
            }
        }
    };['touchstart', 'touchmove', 'touchend', 'touchcancel'].forEach(evt => {
        baseL.addEventListener(evt, (e) => handleTouch(e, baseL, stickL, joyLeft, false), {passive: false});
        baseR.addEventListener(evt, (e) => handleTouch(e, baseR, stickR, joyRight, true), {passive: false});
    });
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
        // Normalize diagonal speed
        if (dx !== 0 && dy !== 0) { const norm = Math.SQRT1_2; dx *= norm; dy *= norm; }
    }

    // Auto-Lock (Heat-Sync) Logic
    if (settings.autoLock && shoot && gameState) {
        const me = gameState.players[myId];
        let target = null; let minDist = 300;
        gameState.world.enemies.forEach(en => {
            let d = Math.hypot(en.x - me.x, en.y - me.y);
            if (d < minDist) { minDist = d; target = en; }
        });
        if (target) angle = Math.atan2(target.y - me.y, target.x - me.x);
    }

    socket.emit('player_input', { dx, dy, angle, shoot });
    isShooting = false; // Reset for single fire rate handled by server tick
}

// --- GAMBLING UI LOGIC ---
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

socket.on('horse_result', (winner) => {
    alert(`Horse ${winner} won the race!`);
});
