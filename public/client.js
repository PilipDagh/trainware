// client.js - PART 1: Networking, Input, and UI Management

const socket = io();

// === DOM ELEMENTS ===
const uiLobby = document.getElementById('lobby-ui');
const uiGame = document.getElementById('game-ui');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Modals & Prompts
const roleReveal = document.getElementById('role-reveal');
const roleTitle = document.getElementById('role-title');
const roleBuffs = document.getElementById('role-buffs');
const departureWarning = document.getElementById('departure-warning');
const departTimer = document.getElementById('depart-timer');
const eventWarning = document.getElementById('event-warning');
const interactionPrompt = document.getElementById('interaction-prompt');

// HUD
const hudDist = document.getElementById('hud-dist');
const hudSpeed = document.getElementById('hud-speed');
const hudBiome = document.getElementById('hud-biome');
const hudMoney = document.getElementById('hud-money');
const hudAmmo = document.getElementById('hud-ammo');
const hudHp = document.getElementById('hud-hp');
const hudCold = document.getElementById('hud-cold');
const hudFuel = document.getElementById('hud-fuel');
const hudPressure = document.getElementById('hud-pressure');

// Inventory
const invGold = document.getElementById('inv-gold');
const invSilver = document.getElementById('inv-silver');
const invCoal = document.getElementById('inv-coal');
const invRaw = document.getElementById('inv-raw');
const invCooked = document.getElementById('inv-cooked');
const invSkins = document.getElementById('inv-skins');
const invWatches = document.getElementById('inv-watches');

// Menus
const shopMenu = document.getElementById('shop-menu');
const gamblingMenu = document.getElementById('gambling-menu');
const storageMenu = document.getElementById('storage-menu');
const reviveMenu = document.getElementById('revive-menu');
const mobileControls = document.getElementById('mobile-controls');

// === GAME STATE ===
let gameState = null;
let myId = null;
let currentRoom = null;
let isMobile = false;

// Visual Effects & Interpolation
let particles =[];
let screenShake = 0;
let camera = { x: 0, y: 0 };
let wavyTime = 0; // For drunk effect

// Input State
const keys = { w: false, a: false, s: false, d: false, e: false, l: false, t: false, y: false };
const mouse = { x: 0, y: 0, down: false };
const joysticks = {
    left: { active: false, dx: 0, dy: 0, originX: 0, originY: 0, touchId: null },
    right: { active: false, dx: 0, dy: 0, originX: 0, originY: 0, touchId: null }
};

// === RESIZE HANDLER ===
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// === LOBBY LOGIC ===
document.getElementById('btn-create').onclick = () => {
    socket.emit('create_lobby');
};

document.getElementById('btn-join').onclick = () => {
    const room = document.getElementById('room-input').value.trim();
    const user = document.getElementById('username-input').value.trim() || 'Drifter';
    isMobile = document.getElementById('mobile-toggle').checked;
    const autoLockOn = document.getElementById('lockon-toggle').checked;
    if (room) {
        currentRoom = room;
        socket.emit('join_lobby', room, user, { autoLockOn });
    }
};

document.getElementById('btn-start').onclick = () => {
    if (currentRoom) socket.emit('start_game', currentRoom);
};

socket.on('lobby_created', (roomId) => {
    document.getElementById('room-input').value = roomId;
    currentRoom = roomId;
    const user = document.getElementById('username-input').value.trim() || 'Drifter';
    isMobile = document.getElementById('mobile-toggle').checked;
    const autoLockOn = document.getElementById('lockon-toggle').checked;
    socket.emit('join_lobby', roomId, user, { autoLockOn });
});

socket.on('lobby_update', (players) => {
    const list = document.getElementById('lobby-players');
    list.innerHTML = `<strong>Players (${players.length}):</strong><br>` + players.map(p => p.name).join('<br>');
    if (players.length > 0 && players[0].id === socket.id) {
        document.getElementById('btn-start').classList.remove('hidden');
    }
});

socket.on('game_started', (roomData) => {
    uiLobby.classList.remove('active');
    uiLobby.classList.add('hidden');
    uiGame.classList.remove('hidden');
    uiGame.classList.add('active');
    if (isMobile) mobileControls.classList.remove('hidden');
    
    myId = socket.id;
    gameState = roomData;
    
    const me = gameState.players[myId];
    roleTitle.innerText = `YOU ARE THE ${me.role.toUpperCase()}`;
    
    // Set buff descriptions based on role
    const buffs = {
        'Conductor': 'The leader of the train. No special buffs.',
        'Sharpshooter': '+20% bullet damage.',
        'Engineer': '-15% train fuel consumption.',
        'Prospector': 'Mines ores 25% faster.',
        'Medic': 'Bandages heal 80 HP instead of 50.',
        'Trapper': 'Animal skins sell for $3 instead of $1.',
        'Soldier': 'Starts with 62 max ammo.',
        'Blacksmith': 'Knife deals 80 damage instead of 56.',
        'Stoker': 'Coal gives 10% more fuel, train accelerates 20% faster.',
        'Traitor': 'KILL EVERYONE. Enemies ignore you. Bullets are red.'
    };
    roleBuffs.innerText = buffs[me.role] || '';
    
    roleReveal.classList.remove('hidden');
    setTimeout(() => roleReveal.classList.add('hidden'), 4000);
});

// === SERVER EVENT RECEIVERS ===
socket.on('state', (state) => {
    gameState = state;
    updateHUD();
});

socket.on('player_died', (id) => {
    if (id === myId) {
        showEventWarning("YOU DIED! Spectating...", 3000, "#ff0000");
    }
});

socket.on('train_departing', () => {
    departureWarning.classList.remove('hidden');
});

socket.on('whistle_pulled', () => {
    particles.push({ type: 'text', text: 'TOOT!', x: 10, y: -40, vx: -50, vy: -20, life: 2, maxLife: 2, color: '#fff' });
});

socket.on('avalanche_warning', () => showEventWarning("AVALANCHE INCOMING! STOP THE TRAIN!", 800, "#ff0000"));
socket.on('avalanche_hit', () => { screenShake = 20; showEventWarning("AVALANCHE HIT!", 1500, "#ff0000"); });
socket.on('raid_alert', () => showEventWarning("TRAIN RAID! DEFEND YOURSELVES!", 2000, "#ff5500"));

socket.on('gamble_result', (res) => {
    document.getElementById('gamble-result').innerText = res.win ? `You WON $${res.payout}!` : "You lost.";
    document.getElementById('gamble-result').style.color = res.win ? "#00ff00" : "#ff0000";
});

socket.on('victory', (stats) => {
    uiGame.classList.add('hidden');
    document.getElementById('victory-screen').classList.remove('hidden');
    // Calculate Hall of Fame
    let bestKiller = {id: null, val: -1}, bestDrinker = {id: null, val: -1}, bestMiner = {id: null, val: -1};
    for(let id in stats.kills) if(stats.kills[id] > bestKiller.val) { bestKiller.val = stats.kills[id]; bestKiller.id = id; }
    for(let id in stats.sips) if(stats.sips[id] > bestDrinker.val) { bestDrinker.val = stats.sips[id]; bestDrinker.id = id; }
    for(let id in stats.coalMined) if(stats.coalMined[id] > bestMiner.val) { bestMiner.val = stats.coalMined[id]; bestMiner.id = id; }

    let listHtml = `
        <p><strong>Lead-Slinger:</strong> ${bestKiller.id ? bestKiller.val + " kills" : "Nobody"}</p>
        <p><strong>Drunkard:</strong> ${bestDrinker.id ? bestDrinker.val + " sips" : "Nobody"}</p>
        <p><strong>Workhorse:</strong> ${bestMiner.id ? bestMiner.val + " coal" : "Nobody"}</p>
    `;
    document.getElementById('awards-list').innerHTML = listHtml;
});

// === INPUT LISTENERS (KEYBOARD & MOUSE) ===
window.addEventListener('keydown', (e) => {
    let k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
    
    // Single fire interactions
    if (k === 'e') tryInteract();
    if (k === 'y') socket.emit('interact', currentRoom, { action: 'eat' });
    if (k === 't') socket.emit('interact', currentRoom, { action: 'valve_start' });
});

window.addEventListener('keyup', (e) => {
    let k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
    if (k === 't') socket.emit('interact', currentRoom, { action: 'valve_stop' });
});

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mousedown', (e) => { mouse.down = true; });
window.addEventListener('mouseup', (e) => { mouse.down = false; });

// === MOBILE TOUCH CONTROLS ===
const joyLeft = document.getElementById('joy-left');
const joyRight = document.getElementById('joy-right');
const knobLeft = document.getElementById('joy-left-knob');
const knobRight = document.getElementById('joy-right-knob');

function handleTouchStart(e, joyName, knobElem) {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = knobElem.parentElement.getBoundingClientRect();
    const joy = joysticks[joyName];
    joy.active = true;
    joy.touchId = touch.identifier;
    joy.originX = rect.left + rect.width / 2;
    joy.originY = rect.top + rect.height / 2;
    updateJoystick(touch, joy, knobElem);
}

function handleTouchMove(e, joyName, knobElem) {
    e.preventDefault();
    const joy = joysticks[joyName];
    if (!joy.active) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joy.touchId) {
            updateJoystick(e.changedTouches[i], joy, knobElem);
            break;
        }
    }
}

function handleTouchEnd(e, joyName, knobElem) {
    e.preventDefault();
    const joy = joysticks[joyName];
    for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === joy.touchId) {
            joy.active = false;
            joy.touchId = null;
            joy.dx = 0; joy.dy = 0;
            knobElem.style.transform = `translate(0px, 0px)`;
            if(joyName === 'right') mouse.down = false; // Stop shooting
            break;
        }
    }
}

function updateJoystick(touch, joy, knobElem) {
    let dx = touch.clientX - joy.originX;
    let dy = touch.clientY - joy.originY;
    let dist = Math.hypot(dx, dy);
    let maxDist = 30; // Max knob movement radius
    if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }
    joy.dx = dx / maxDist;
    joy.dy = dy / maxDist;
    knobElem.style.transform = `translate(${dx}px, ${dy}px)`;

    if(joy === joysticks.right && dist > 10) {
        // Map right joystick to aim and shoot
        mouse.down = true;
        mouse.aimAngle = Math.atan2(joy.dy, joy.dx);
    } else if (joy === joysticks.right) {
        mouse.down = false;
    }
}

joyLeft.addEventListener('touchstart', (e) => handleTouchStart(e, 'left', knobLeft), {passive: false});
joyLeft.addEventListener('touchmove', (e) => handleTouchMove(e, 'left', knobLeft), {passive: false});
joyLeft.addEventListener('touchend', (e) => handleTouchEnd(e, 'left', knobLeft));

joyRight.addEventListener('touchstart', (e) => handleTouchStart(e, 'right', knobRight), {passive: false});
joyRight.addEventListener('touchmove', (e) => handleTouchMove(e, 'right', knobRight), {passive: false});
joyRight.addEventListener('touchend', (e) => handleTouchEnd(e, 'right', knobRight));

// Mobile Action Buttons
document.getElementById('btn-eat').ontouchstart = () => socket.emit('interact', currentRoom, { action: 'eat' });
document.getElementById('btn-interact').ontouchstart = tryInteract;
document.getElementById('btn-light').ontouchstart = () => { keys.l = !keys.l; }; // Toggle light
document.getElementById('btn-steam').ontouchstart = () => socket.emit('interact', currentRoom, { action: 'valve_start' });
document.getElementById('btn-steam').ontouchend = () => socket.emit('interact', currentRoom, { action: 'valve_stop' });
document.getElementById('btn-knife').ontouchstart = () => socket.emit('input', currentRoom, { type: 'knife' });

// === INPUT TICK LOOP (30Hz) ===
setInterval(() => {
    if (!gameState || !myId || !gameState.players[myId] || !gameState.players[myId].alive) return;
    
    // Movement
    let dx = 0, dy = 0;
    if (isMobile && joysticks.left.active) {
        dx = joysticks.left.dx;
        dy = joysticks.left.dy;
    } else {
        if (keys.w) dy -= 1;
        if (keys.s) dy += 1;
        if (keys.a) dx -= 1;
        if (keys.d) dx += 1;
        let mag = Math.hypot(dx, dy);
        if (mag > 0) { dx /= mag; dy /= mag; }
    }
    
    if (dx !== 0 || dy !== 0) {
        socket.emit('input', currentRoom, { type: 'move', dx, dy });
    }

    // Shooting
    if (mouse.down) {
        const me = gameState.players[myId];
        let angle = 0;
        if (isMobile) {
            angle = mouse.aimAngle;
        } else {
            // Screen center is player
            let screenX = canvas.width / 2;
            let screenY = canvas.height / 2;
            angle = Math.atan2(mouse.y - screenY, mouse.x - screenX);
        }
        socket.emit('input', currentRoom, { type: 'shoot', angle: angle });
        mouse.down = false; // Requires clicking/tapping again unless holding (semi-auto feel)
    }

}, 1000 / 30);

// === INTERACTION LOGIC & UI UPDATES ===
function tryInteract() {
    if (!gameState || !myId) return;
    const me = gameState.players[myId];
    
    // Determine what we are close to
    let distToEngine = getDistance(me.x, me.y, 0, 0);
    let distToWhistle = getDistance(me.x, me.y, 10, 0);
    let distToCoal = getDistance(me.x, me.y, 200, 0);
    let distToShop = getDistance(me.x, me.y, 600, -120);
    let distToStove = getDistance(me.x, me.y, 800, 0);
    let distToGamble = getDistance(me.x, me.y, 1000, 0);
    let distToStorage = getDistance(me.x, me.y, 1300, 0); // Assuming 1st storage car

    if (distToEngine < 50) socket.emit('interact', currentRoom, { action: 'train_button' });
    else if (distToWhistle < 30) socket.emit('interact', currentRoom, { action: 'whistle' });
    else if (distToCoal < 50 && me.inventory.coal > 0) socket.emit('interact', currentRoom, { action: 'dump_coal' });
    else if (distToStove < 50) socket.emit('interact', currentRoom, { action: 'cook_start' });
    else if (distToShop < 100 && gameState.world.isInTown) openShop();
    else if (distToGamble < 100) gamblingMenu.classList.remove('hidden');
    else if (distToStorage < 100 && gameState.train.storageCars > 0) openStorage();
    else {
        // Generic mine / open / hit
        socket.emit('interact', currentRoom, { action: 'mine' });
        // Check revives
        if (me.hasReviveKit) openReviveMenu();
    }
}

function updateHUD() {
    if (!gameState || !myId) return;
    const me = gameState.players[myId];
    if (!me) return;

    hudDist.innerText = Math.floor(gameState.train.distance);
    hudSpeed.innerText = Math.floor(gameState.train.speed);
    hudBiome.innerText = gameState.world.biome.toUpperCase();
    hudMoney.innerText = me.money;
    hudAmmo.innerText = me.ammo;
    hudHp.innerText = Math.floor(me.hp);
    hudCold.innerText = Math.floor(me.cold);
    hudFuel.innerText = Math.floor(gameState.train.fuel);
    hudPressure.innerText = Math.floor(gameState.train.pressure);

    invGold.innerText = me.inventory.gold;
    invSilver.innerText = me.inventory.silver;
    invCoal.innerText = me.inventory.coal;
    invRaw.innerText = me.inventory.rawMeat;
    invCooked.innerText = me.inventory.cookedMeat;
    invSkins.innerText = me.inventory.skins;
    invWatches.innerText = me.inventory.watches;

    // Departure timer
    if (gameState.train.departureCountdown > 0) {
        departureWarning.classList.remove('hidden');
        departTimer.innerText = Math.ceil(gameState.train.departureCountdown);
    } else {
        departureWarning.classList.add('hidden');
    }

    // Interaction Prompt Proximity Check
    let showPrompt = false;
    let proxChecks =[
        { d: getDistance(me.x, me.y, 0, 0), lim: 50, text: "Train Controls" },
        { d: getDistance(me.x, me.y, 10, 0), lim: 30, text: "Whistle" },
        { d: getDistance(me.x, me.y, 200, 0), lim: 50, text: me.inventory.coal > 0 ? "Dump Coal" : "Valve (Hold T)" },
        { d: getDistance(me.x, me.y, 600, -120), lim: 100, text: gameState.world.isInTown ? "Town Shop" : null },
        { d: getDistance(me.x, me.y, 800, 0), lim: 50, text: "Stove (Cook Meat)" },
        { d: getDistance(me.x, me.y, 1000, 0), lim: 100, text: "Gambling Tables" },
        { d: getDistance(me.x, me.y, 1300, 0), lim: 100, text: gameState.train.storageCars > 0 ? "Storage Car" : null }
    ];
    
    gameState.entities.forEach(e => {
        if (e.type === 'ore' || e.type === 'crate') {
            if (getDistance(me.x, me.y, e.x, e.y) < 40) proxChecks.push({d: 0, lim: 1, text: "Mine / Break"});
        }
    });

    for (let c of proxChecks) {
        if (c.text && c.d < c.lim) { showPrompt = true; interactionPrompt.innerText = `Press [E] to Interact (${c.text})`; break; }
    }
    showPrompt ? interactionPrompt.classList.remove('hidden') : interactionPrompt.classList.add('hidden');

    // Dead / Gameover logic
    let living = Object.values(gameState.players).filter(p => p.alive).length;
    if (living === 0 && gameState.status === 'gameover') {
        document.getElementById('gameover-screen').classList.remove('hidden');
        document.getElementById('restart-votes').innerText = `Votes to Restart: ${gameState.votesToRestart ? gameState.votesToRestart.length : 0}`;
    }
}

// === MENU & MODAL FUNCTIONS ===
function showEventWarning(text, duration, color) {
    eventWarning.innerText = text;
    eventWarning.style.color = color;
    eventWarning.classList.remove('hidden');
    setTimeout(() => eventWarning.classList.add('hidden'), duration);
}

function getDistance(x1, y1, x2, y2) {
    return Math.hypot(x2 - x1, y2 - y1);
}

// Gambling Menu Logic
let currentGambleTab = 'roulette';
window.switchGambleTab = function(tab) {
    currentGambleTab = tab;
    document.getElementById('roulette-color').style.display = tab === 'roulette' ? 'inline-block' : 'none';
};
document.getElementById('btn-place-bet').onclick = () => {
    let amt = parseInt(document.getElementById('gamble-amount').value);
    let bet = document.getElementById('roulette-color').value;
    socket.emit('interact', currentRoom, { action: 'gamble', game: currentGambleTab, amount: amt, bet: bet });
};

// Storage Menu Logic
function openStorage() {
    storageMenu.classList.remove('hidden');
    const me = gameState.players[myId];
    const s = gameState.train.storage;
    document.getElementById('storage-space').innerText = s.capacity - (s.gold + s.silver + s.coal);
    
    let sg = document.getElementById('slide-gold'); sg.max = me.inventory.gold; sg.value = 0;
    let ss = document.getElementById('slide-silver'); ss.max = me.inventory.silver; ss.value = 0;
    let sc = document.getElementById('slide-coal'); sc.max = me.inventory.coal; sc.value = 0;

    sg.oninput = () => document.getElementById('val-gold').innerText = sg.value;
    ss.oninput = () => document.getElementById('val-silver').innerText = ss.value;
    sc.oninput = () => document.getElementById('val-coal').innerText = sc.value;
}
document.getElementById('btn-deposit-storage').onclick = () => {
    socket.emit('interact', currentRoom, {
        action: 'storage_deposit',
        gold: parseInt(document.getElementById('slide-gold').value),
        silver: parseInt(document.getElementById('slide-silver').value),
        coal: parseInt(document.getElementById('slide-coal').value)
    });
    storageMenu.classList.add('hidden');
};

// Shop Menu Logic
function openShop() {
    shopMenu.classList.remove('hidden');
    const items =[
        { id: 'fuelTank', name: 'Fuel Tank Upgrade (+200)', cost: 7 },
        { id: 'regen', name: 'HP Regen Upgrade', cost: 8 },
        { id: 'bombs', name: 'Bomb (AoE)', cost: 5 },
        { id: 'bandages', name: 'Bandage (+50 HP)', cost: 2 },
        { id: 'warmClothes', name: 'Warm Clothes (Tundra)', cost: 11 },
        { id: 'knife', name: 'Combat Knife', cost: 5 },
        { id: 'ammoPack', name: 'Ammo Pack (6 bullets)', cost: 4 },
        { id: 'trainSpeed', name: 'Train Speed (+11%)', cost: 15 },
        { id: 'flashlight', name: 'Flashlight', cost: 11 },
        { id: 'globalHeadlight', name: 'Headlight Upgrade', cost: 15 },
        { id: 'storageCar', name: 'Storage Car', cost: 41 },
        { id: 'beerBarrel', name: 'Beer Barrel', cost: 11 },
        { id: 'reviveKit', name: 'Revive Kit', cost: 21 }
    ];
    let html = `<button style="grid-column: span 2; background: #3a5c3a;" onclick="socket.emit('interact', '${currentRoom}', {action:'sell_all'})">SELL ALL ORES & SKINS</button>`;
    items.forEach(i => {
        html += `
            <div class="shop-item">
                <p><strong>${i.name}</strong></p>
                <p>$${i.cost}</p>
                <button onclick="socket.emit('interact', '${currentRoom}', {action: 'buy', item: '${i.id}'})">Buy</button>
            </div>
        `;
    });
    document.getElementById('shop-items').innerHTML = html;
}

// Revive Logic
function openReviveMenu() {
    let deadPlayers = Object.values(gameState.players).filter(p => !p.alive);
    if (deadPlayers.length === 0) return alert("Nobody is dead!");
    
    let html = '';
    deadPlayers.forEach(p => {
        html += `<button onclick="socket.emit('interact', '${currentRoom}', {action: 'revive', targetId: '${p.id}'}); document.getElementById('revive-menu').classList.add('hidden');">${p.name}</button>`;
    });
    document.getElementById('dead-players-list').innerHTML = html;
    reviveMenu.classList.remove('hidden');
}

// Game Over Vote
document.getElementById('btn-vote-restart').onclick = () => socket.emit('vote_restart', currentRoom);
socket.on('lobby_reset', () => location.reload());
// client.js - PART 2: Rendering Loop & Visual Effects

// === RENDERING CONSTANTS ===
const CAR_WIDTH = 200;
const CAR_HEIGHT = 120;
const TRACK_WIDTH = 140;

// === RENDER LOOP (60 FPS) ===
function draw() {
    requestAnimationFrame(draw);

    if (!gameState || !myId || !gameState.players[myId]) {
        ctx.fillStyle = '#1a1512';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const me = gameState.players[myId];
    const train = gameState.train;
    const world = gameState.world;

    // Camera Lerping (Smooth follow)
    let targetCamX = me.x - canvas.width / 2;
    let targetCamY = me.y - canvas.height / 2;
    camera.x += (targetCamX - camera.x) * 0.1;
    camera.y += (targetCamY - camera.y) * 0.1;

    // Wavy Rainbow Beer Effect
    ctx.save();
    if (me.sips >= 3) {
        wavyTime += 0.05;
        let intensity = Math.floor(me.sips / 3);
        // Rainbow shifting and saturation boost
        ctx.filter = `hue-rotate(${wavyTime * 50}deg) saturate(${1 + intensity * 0.5})`;
        // Wavy translation
        let shiftX = Math.sin(wavyTime) * 10 * intensity;
        let shiftY = Math.cos(wavyTime * 10 * intensity;
        ctx.translate(shiftX, shiftY);
    } else {
        ctx.filter = 'none';
    }

    // Screen Shake
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        screenShake *= 0.9;
        if (screenShake < 0.5) screenShake = 0;
    }

    // Clear Canvas
    let bgColors = { 'forest': '#3d5c3d', 'desert': '#c2b280', 'tundra': '#e0e6ed' };
    ctx.fillStyle = bgColors[world.biome] || '#3d5c3d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // 1. Draw Environment (Tracks & Scrolling Background)
    drawEnvironment(world.biome, train.distance);

    // 2. Draw Train
    drawTrain(train);

    // 3. Draw Entities (Ores, Crates, Animals, Enemies, Rocks)
    gameState.entities.forEach(e => drawEntity(e));

    // 4. Draw Projectiles
    gameState.projectiles.forEach(p => {
        ctx.fillStyle = p.isTraitor ? '#ff0000' : '#ffff00';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.isTraitor ? '#ff0000' : '#ffff00';
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // 5. Draw Players
    Object.values(gameState.players).forEach(p => {
        if (!p.alive) return;
        drawPlayer(p, p.id === myId);
    });

    // 6. Draw Steam Fog
    if (train.fogActive) {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.8)';
        ctx.beginPath();
        ctx.arc(200, 0, 150, 0, Math.PI * 2); // Coal car valve location
        ctx.fill();
    }

    // 7. Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * (1/60);
        p.y += p.vy * (1/60);
        p.life -= (1/60);
        
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        if (p.type === 'text') {
            ctx.fillStyle = p.color;
            ctx.font = '20px Courier';
            ctx.fillText(p.text, p.x, p.y);
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // 8. Tunnel of Darkness Overlay
    if (world.tunnelActive) {
        drawTunnelLighting(me, train);
    }

    ctx.restore(); // Restore camera translation
    ctx.restore(); // Restore wavy/shake filters
}

// === DRAWING HELPERS ===

function drawEnvironment(biome, distance) {
    // Scrolling ties to distance modulo for infinite repeating effect
    let offset = (distance * 100) % 1000;
    
    // Draw Tracks
    ctx.fillStyle = '#222'; // Gravel
    ctx.fillRect(camera.x, -TRACK_WIDTH/2 - 10, canvas.width, TRACK_WIDTH + 20);
    
    ctx.fillStyle = '#4a2e15'; // Wooden ties
    for (let i = -100; i < canvas.width + 100; i += 40) {
        let xPos = camera.x + ((i - offset) % 40);
        ctx.fillRect(xPos, -TRACK_WIDTH/2, 10, TRACK_WIDTH);
    }

    ctx.fillStyle = '#888'; // Rails
    ctx.fillRect(camera.x, -TRACK_WIDTH/2 + 10, canvas.width, 6);
    ctx.fillRect(camera.x, TRACK_WIDTH/2 - 16, canvas.width, 6);

    // Scenery Props (Trees, Cacti, Snowdrifts)
    let propColor = biome === 'forest' ? '#1b4d1b' : (biome === 'desert' ? '#a38a41' : '#ffffff');
    for (let i = 0; i < 20; i++) {
        // Deterministic pseudo-random positions based on distance sector
        let pX = camera.x + (((i * 373 + offset * 2) % (canvas.width + 200)) - 100);
        let pY = (i % 2 === 0 ? 1 : -1) * (150 + (i * 17 % 200));
        ctx.fillStyle = propColor;
        ctx.beginPath();
        ctx.arc(pX, camera.y + pY, biome === 'forest' ? 30 : 20, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawTrain(train) {
    const cars =[
        { name: 'Engine', color: '#111', offset: -100 },
        { name: 'Coal Car', color: '#2a2a2a', offset: 100 },
        { name: 'Pass 1', color: '#5c3a21', offset: 300 },
        { name: 'Pass 2', color: '#5c3a21', offset: 500 },
        { name: 'Kitchen', color: '#8b4513', offset: 700 },
        { name: 'Gambling', color: '#6b0000', offset: 900 },
        { name: 'Caboose', color: '#802020', offset: 1100 }
    ];

    for (let i = 0; i < train.storageCars; i++) {
        cars.push({ name: `Storage ${i+1}`, color: '#444', offset: 1300 + (i * 200) });
    }

    cars.forEach(car => {
        // Draw Car Body
        ctx.fillStyle = car.color;
        ctx.fillRect(car.offset, -CAR_HEIGHT/2, CAR_WIDTH, CAR_HEIGHT);
        
        // Roof detailing
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(car.offset + 10, -CAR_HEIGHT/2 + 10, CAR_WIDTH - 20, CAR_HEIGHT - 20);

        // Connections
        if (car.offset !== -100) {
            ctx.fillStyle = '#333';
            ctx.fillRect(car.offset - 20, -10, 20, 20);
        }

        // Specific Car Details
        if (car.name === 'Engine') {
            ctx.fillStyle = '#ffaa00'; // Headlight visual bulb
            ctx.beginPath(); ctx.arc(-100, 0, 15, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#222'; // Smokestack
            ctx.beginPath(); ctx.arc(-60, 0, 25, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = train.speed === 0 ? '#00ff00' : '#ff0000'; // Start/Stop Button
            ctx.fillRect(-10, -10, 20, 20);
            ctx.fillStyle = '#888'; // Whistle
            ctx.fillRect(5, -5, 10, 10);
        }
        if (car.name === 'Coal Car') {
            ctx.fillStyle = '#111'; // Coal pile
            ctx.fillRect(car.offset + 20, -40, 100, 80);
            ctx.fillStyle = '#ff4444'; // Valve
            ctx.beginPath(); ctx.arc(car.offset + 100, 0, 15, 0, Math.PI*2); ctx.fill();
        }
        if (car.name === 'Kitchen') {
            ctx.fillStyle = '#444'; // Stove
            ctx.fillRect(car.offset + 80, -30, 40, 60);
        }
        if (car.name === 'Gambling') {
            ctx.fillStyle = '#006600'; // Tables
            ctx.beginPath(); ctx.arc(car.offset + 50, 0, 30, 0, Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.arc(car.offset + 150, 0, 30, 0, Math.PI*2); ctx.fill();
        }
    });
}

function drawEntity(e) {
    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.type === 'ore') {
        ctx.fillStyle = e.oreType === 'gold' ? '#ffd700' : (e.oreType === 'silver' ? '#c0c0c0' : '#333333');
        ctx.beginPath();
        // Larger ores have more maxHp initially (size representation)
        ctx.arc(0, 0, 15 + (e.maxHp * 2), 0, Math.PI * 2);
        ctx.fill();
    } else if (e.type === 'crate') {
        ctx.fillStyle = '#8b5a2b';
        ctx.fillRect(-20, -20, 40, 40);
        ctx.strokeStyle = '#5c3a21';
        ctx.lineWidth = 2;
        ctx.strokeRect(-20, -20, 40, 40);
    } else if (e.type === 'animal') {
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(-15, -10, 30, 20);
    } else if (e.type === 'snake') {
        ctx.fillStyle = '#228B22';
        ctx.fillRect(-15, -5, 30, 10);
    } else if (e.type === 'hawk') {
        ctx.fillStyle = '#654321';
        ctx.beginPath();
        ctx.moveTo(15, 0); ctx.lineTo(-15, 15); ctx.lineTo(-15, -15);
        ctx.fill();
    } else if (e.type === 'enemy' || e.type === 'marshal') {
        ctx.fillStyle = e.type === 'marshal' ? '#00008b' : '#8b0000';
        ctx.beginPath(); ctx.arc(0, 0, 18, 0, Math.PI*2); ctx.fill();
        // Draw HP Bar
        ctx.fillStyle = 'red'; ctx.fillRect(-20, -30, 40, 5);
        ctx.fillStyle = 'green'; ctx.fillRect(-20, -30, 40 * (e.hp / (e.maxHp || 100)), 5);
    } else if (e.type === 'rock') {
        ctx.fillStyle = '#555'; // Jagged gray rock
        ctx.beginPath();
        ctx.moveTo(0, -30); ctx.lineTo(25, -10); ctx.lineTo(15, 20); ctx.lineTo(-20, 25); ctx.lineTo(-30, 0);
        ctx.fill();
    } else if (e.type === 'item') {
        ctx.fillStyle = '#00ffff';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
    } else if (e.type === 'shop') {
        ctx.fillStyle = '#5c3a21';
        ctx.fillRect(-30, -30, 60, 60);
        ctx.fillStyle = '#fff'; ctx.font = '14px Courier'; ctx.fillText('SHOP', -15, 5);
    } else if (e.type === 'barrel') {
        ctx.fillStyle = '#654321';
        ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '12px Courier'; ctx.fillText(e.sips, -8, 4);
    }

    ctx.restore();
}

function drawPlayer(p, isMe) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Name Plate
    ctx.fillStyle = isMe ? '#00ff00' : '#ffffff';
    ctx.font = '14px Courier';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, 0, -40);

    // Player Body
    ctx.fillStyle = isMe ? '#d1a554' : '#aa8844';
    if (p.role === 'Traitor' && isMe) ctx.fillStyle = '#cc2a2a'; // I see myself red if traitor
    ctx.beginPath();
    ctx.arc(0, 0, 20, 0, Math.PI * 2);
    ctx.fill();

    // Flashlight representation
    if (p.hasFlashlight) {
        ctx.fillStyle = 'yellow';
        ctx.fillRect(10, -5, 10, 10);
    }

    // Health Bar
    ctx.fillStyle = '#ff0000'; ctx.fillRect(-25, -35, 50, 6);
    ctx.fillStyle = '#00ff00'; ctx.fillRect(-25, -35, 50 * (p.hp / p.maxHp), 6);

    ctx.restore();
}

function drawTunnelLighting(me, train) {
    // Save current canvas content
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform to screen space
    
    // Create a dark overlay covering the whole screen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.98)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cut out light shapes using destination-out
    ctx.globalCompositeOperation = 'destination-out';

    // 1. Train Engine Headlight Cone
    let engX = -100 - camera.x;
    let engY = 0 - camera.y;
    let headLength = train.headlightUpgraded ? 1200 : 600;
    
    let grad = ctx.createRadialGradient(engX, engY, 50, engX - headLength, engY, headLength);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(engX, engY);
    ctx.lineTo(engX - headLength, engY - 400); // Spread Y
    ctx.lineTo(engX - headLength, engY + 400); // Spread Y
    ctx.fill();

    // 2. Personal Flashlight / Small Glow
    let pX = me.x - camera.x;
    let pY = me.y - camera.y;

    // Base personal small glow
    let pGrad = ctx.createRadialGradient(pX, pY, 10, pX, pY, 150);
    pGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    pGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = pGrad;
    ctx.beginPath(); ctx.arc(pX, pY, 150, 0, Math.PI*2); ctx.fill();

    // Directional Flashlight (if bought and active via L key)
    if (me.hasFlashlight && keys.l) {
        // Aim direction is mouse in screen space, or mobile aim angle
        let a = 0;
        if (isMobile && joysticks.right.active) a = mouse.aimAngle;
        else a = Math.atan2(mouse.y - pY, mouse.x - pX);

        let coneDist = 400;
        let spread = 0.4; // Radians

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.beginPath();
        ctx.moveTo(pX, pY);
        ctx.lineTo(pX + Math.cos(a - spread) * coneDist, pY + Math.sin(a - spread) * coneDist);
        ctx.arc(pX, pY, coneDist, a - spread, a + spread);
        ctx.lineTo(pX, pY);
        ctx.fill();
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();
}

// === START RENDERER ===
draw();
