// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const PLAYER_COLORS =['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#e377c2'];

// --- CHARACTER ROLES ---
const ROLES =[
    { name: 'Conductor', desc: 'Average Joe. No special buffs.', buff: {} },
    { name: 'Sharpshooter', desc: 'Expert aim. +20% Bullet Damage.', buff: { dmgMult: 1.2 } },
    { name: 'Engineer', desc: 'Efficiency expert. -15% Fuel Consumption.', buff: { fuelMult: 0.85 } },
    { name: 'Prospector', desc: 'Hard worker. Mine 25% faster.', buff: { mineMult: 1.25 } },
    { name: 'Medic', desc: 'Field doctor. Bandages heal +30 extra HP.', buff: { healBonus: 30 } },
    { name: 'Trapper', desc: 'Wilderness expert. Animal skins worth $3.', buff: { skinValue: 3 } },
    { name: 'Soldier', desc: 'Combat ready. Start with 64 bullets.', buff: { extraAmmo: 32 } },
    { name: 'Blacksmith', desc: 'Strong arms. Knife deals 80 damage.', buff: { knifeDmg: 80 } }
];

const rooms = {};

const BIOMES =[
    { name: 'forest', end: 974 }, { name: 'desert', end: 1521 },
    { name: 'tundra', end: 1908 }, { name: 'desert', end: 2455 }, { name: 'forest', end: 3181 }
];

function getBiome(dist) {
    for (let b of BIOMES) if (dist <= b.end) return b.name;
    return 'forest';
}

function createRoomState(id, name, password, maxPlayers) {
    return {
        id, name, password, maxPlayers: parseInt(maxPlayers) || 6, status: 'LOBBY',
        settings: { traitorEnabled: true, autoLockEnabled: false },
        players: {}, enemies:[], ores:[], crates: [], animals: [], planks: [], projectiles:[], bombs: [], horses: [], barrels:[],
        hawks: [], snakes:[], mailPoles:[], chasers: [], marshals:[],
        train: {
            distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED', 
            fuel: 1003, maxFuel: 1003, buttonCooldown: 0, departureTimer: 0,
            speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0, headlightUpgraded: false,
            nextTownDist: Math.random() * (497 - 274) + 274, townStops: 0,
            nextBridgeDist: Math.random() * (800 - 400) + 400,
            bridgeFixed: true, planksNeeded: 0, planksDeposited: 0,
            inTown: false, townWarningSent: false,
            storageCars: 1, storageInv: { gold: 0, silver: 0, coal: 0 },
            steamPressure: 100, steamActive: false, steamCloudTimer: 0
        },
        tunnel: { active: false, distanceLeft: 0, checkTimer: 0 },
        townX: null, biome: 'forest', inMountains: false,
        mountainStart: Math.random() * (200 - 50) + 50, mountainEnd: 0,
        avalanche: { active: false, timer: 0 }, avalancheRocks:[],
        raidTimer: 0, raidActive: false, avalancheTimer: 0, hawkTimer: 0, mailTimer: 0, chaseTimer: 0,
        shop: { active: false, items:[] }, shopNPC: null, votes: 0,
        gambling: { active: false, type: null, timer: 0, bets: {} }
    };
}

function assignRoles(room) {
    let playerIds = Object.keys(room.players);
    let traitorAssigned = false;

    playerIds.forEach(id => {
        let p = room.players[id];
        let randomRole = ROLES[Math.floor(Math.random() * ROLES.length)];
// --- GAME CONSTANTS ---
const ROLES =['Sharpshooter', 'Engineer', 'Prospector', 'Medic', 'Trapper', 'Soldier', 'Blacksmith', 'Normal'];
const COLORS =['#0000FF', '#FF0000', '#008000', '#800080', '#FFA500', '#FFC0CB'];
const JOURNEY_LENGTH = 3181;
const FPS = 60;
const TICK_RATE = 1000 / FPS;

// --- GLOBAL STATE ---
const lobbies = {};
const connectedPlayers = {};

// --- UTILITY FUNCTIONS ---
const generateId = () => Math.random().toString(36).substr(2, 9);
const distance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

class GameLobby {
    constructor(id, name, maxPlayers, password, enableTraitor) {
        this.id = id;
        this.name = name;
        this.maxPlayers = maxPlayers;
        this.password = password;
        this.enableTraitor = enableTraitor;
        this.players = {};
        this.state = 'LOBBY'; // LOBBY, PLAYING, VICTORY

        p.role = randomRole.name;
        p.buffs = randomRole.buff;
        if (p.buffs.extraAmmo) p.bullets += p.buffs.extraAmmo;

        if (room.settings.traitorEnabled && !traitorAssigned && Math.random() < 0.3) {
            p.role = 'Traitor'; p.isTraitor = true;
            p.desc = 'SABOTAGE THE TRAIN. Kill everyone else to win. Enemies ignore you.';
            traitorAssigned = true;
        } else {
            p.isTraitor = false; p.desc = randomRole.desc;
        }
    });
}
function getTrainBounds(room) {
    let backEdge = -700 - (room.train.storageCars * 110);
    return { minX: backEdge, maxX: 280, minY: -50, maxY: 50 };
}

function spawnOres(room) {
    room.ores =[]; let bounds = getTrainBounds(room);
    let numOres = Math.floor(Math.random() * 4) + 6; // REDUCED: 6 to 9 ores per stop
    for (let i = 0; i < numOres; i++) {
        let rand = Math.random();
        let type = rand < 0.1 ? 'gold' : (rand < 0.3 ? 'silver' : 'coal');
        let hits = type === 'gold' ? Math.floor(Math.random() * 6) + 4 : (type === 'silver' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 3) + 2);
        let x, y;
        do { x = (Math.random() - 0.5) * 1400; y = (Math.random() - 0.5) * 1000; } 
        while (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY); 
        room.ores.push({ id: Math.random().toString(), type, x, y, hits, maxHits: hits });
    }
}

function spawnCrates(room) {
    room.crates =[]; let bounds = getTrainBounds(room);
    let numCrates = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < numCrates; i++) {
        let x, y;
        do { x = (Math.random() - 0.5) * 1400; y = (Math.random() - 0.5) * 1000; } 
        while (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY); 
        let hasWatch = Math.random() < 0.15;
        let watchType = hasWatch ? (Math.random() < 0.3 ? 'gold' : 'silver') : null;
        room.crates.push({ id: Math.random().toString(), x, y, watchType });
    }
}

function spawnAnimals(room) {
    room.animals =[]; let bounds = getTrainBounds(room);
    let numAnimals = Math.floor(Math.random() * 4) + 2; 
    for (let i = 0; i < numAnimals; i++) {
        let x, y;
        do { x = (Math.random() - 0.5) * 1400; y = (Math.random() - 0.5) * 1000; } 
        while (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY); 
        room.animals.push({ id: Math.random().toString(), x, y, hp: 20, vx: 0, vy: 0, timer: 0 });
        // Train & World State
        this.train = {
            state: 'STOPPED', // STOPPED, DEPARTING, MOVING
            speed: 0,
            distance: 0,
            coal: 500,
            pressure: 0,
            departTimer: 0,
            stopProcessed: false,
            storageCars: 0,
            storageInventory: [],
            planksDeposited: 0
        };
        
        this.world = {
            objects:[], // Trees, Ores, Planks
            enemies:[], // Hawks, Snakes, Animals, Marshals
            bullets:[],
            townsVisited: 0,
            event: null, // 'TUNNEL', 'BRIDGE', null
            planksRequired: 0
        };
        
        this.stats = { kills: {}, beerSips: {}, coalMined: {}, traitorWon: false };
        this.loop = null;
}
}

function spawnSnakes(room) {
    room.snakes =[]; if (room.biome !== 'desert') return;
    let bounds = getTrainBounds(room); let numSnakes = Math.floor(Math.random() * 3) + 3; 
    for (let i = 0; i < numSnakes; i++) {
        let x, y;
        do { x = (Math.random() - 0.5) * 1400; y = (Math.random() - 0.5) * 1000; } 
        while (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY); 
        room.snakes.push({ id: Math.random().toString(), x, y, hp: 15, state: 'idle', timer: 0 });
    addPlayer(socketId, name) {
        if (Object.keys(this.players).length >= this.maxPlayers) return false;
        this.players[socketId] = {
            id: socketId, name: name, x: 100, y: 0, hp: 100, isDead: false,
            color: COLORS[Object.keys(this.players).length % COLORS.length],
            role: 'Normal', isTraitor: false,
            inventory: { gold: 0, silver: 0, coal: 0, meat: 0, cookedMeat: 0, ammo: 20, skins: 0, planks: 0, money: 0, flashlights: 0, bandages: 0, beer: 0 },
            stats: { kills: 0, beerSips: 0, coalMined: 0 }
        };
        return true;
}
}

function spawnPlanks(room, amount) {
    room.planks =[]; let bounds = getTrainBounds(room);
    for (let i = 0; i < amount; i++) {
        let x, y;
        do { x = (Math.random() - 0.5) * 1400; y = (Math.random() - 0.5) * 1000; } 
        while (x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY); 
        room.planks.push({ id: Math.random().toString(), x, y });
    start() {
        this.state = 'PLAYING';
        this.assignRoles();
        this.train.stopProcessed = false;
        this.loop = setInterval(() => this.update(), TICK_RATE);
}
}

function spawnEnemies(room, isTown, isRaid = false) {
    let groups = isTown ? Math.floor(Math.random() * 2) + 1 : 1; 
    if (isRaid) groups = 1;
    if (!isTown && !isRaid && Math.random() > 0.25) return; 
    assignRoles() {
        const pKeys = Object.keys(this.players);
        let availableRoles = [...ROLES];
        
        // Assign Traitor
        if (this.enableTraitor && pKeys.length > 1) {
            const traitorId = pKeys[randomInt(0, pKeys.length - 1)];
            this.players[traitorId].isTraitor = true;
        }

    for (let g = 0; g < groups; g++) {
        let baseX = room.townX !== null ? room.townX + (Math.random() > 0.5 ? 300 : -300) : (Math.random() > 0.5 ? 600 : -600);
        let baseY = (Math.random() - 0.5) * 600;
        for (let i = 0; i < 2; i++) createEnemy(room, 'gunman', baseX, baseY, isRaid);
        for (let i = 0; i < 2; i++) createEnemy(room, 'knifeman', baseX, baseY, isRaid); 
        if (Math.random() < 0.15) createEnemy(room, 'bombman', baseX, baseY, isRaid);
    }
}
        pKeys.forEach(id => {
            const roleIdx = randomInt(0, availableRoles.length - 1);
            this.players[id].role = availableRoles[roleIdx];
            availableRoles.splice(roleIdx, 1);
            if (availableRoles.length === 0) availableRoles = [...ROLES];

function spawnMarshals(room) {
    for (let i = 0; i < 3; i++) {
        let baseX = room.townX !== null ? room.townX + (Math.random() > 0.5 ? 300 : -300) : 600;
        let baseY = (Math.random() - 0.5) * 600;
        room.marshals.push({
            id: Math.random().toString(), type: 'marshal',
            x: baseX + (Math.random() - 0.5) * 100, y: baseY + (Math.random() - 0.5) * 100,
            hp: 331, hasHorse: false, lastShot: 0, aimAngle: 0
            // Apply starting buffs
            if (this.players[id].role === 'Soldier') this.players[id].inventory.ammo = 64;
});
}
}

function createEnemy(room, type, x, y, isRaid) {
    room.enemies.push({
        id: Math.random().toString(), type, isRaid,
        x: x + (Math.random() - 0.5) * 300, y: y + (Math.random() - 0.5) * 300,
        hp: type === 'gunman' ? 30 : 40,
        hasHorse: !isRaid && Math.random() < 0.20, 
        lastShot: 0, aimAngle: 0
    });
}

function generateShop(room) {
    room.shop.active = true;
    room.shop.items =[
        { id: 'bomb', name: 'Bomb', cost: 5, type: 'player' },
        { id: 'bandage', name: 'Bandage (+50 HP)', cost: 2, type: 'player' },
        { id: 'clothes', name: 'Warm Clothes', cost: 11, type: 'player' },
        { id: 'knife', name: 'Knife (56 DMG)', cost: 5, type: 'player' },
        { id: 'ammo', name: 'Ammo Pack (+6)', cost: 4, type: 'player', stock: 3 },
        { id: 'beer_bottle', name: 'Beer Bottle', cost: 3, type: 'player', stock: 4 },
        { id: 'beer_barrel', name: 'Beer Barrel', cost: 11, type: 'player', stock: 2 },
        { id: 'flashlight', name: 'Flashlight', cost: 11, type: 'player', stock: 3 },
        { id: 'revive_kit', name: 'REVIVE KIT (1 Use)', cost: 21, type: 'player', stock: 5 }
    ];
    if (room.train.fuelUpgrades < 4) room.shop.items.push({ id: 'fuel', name: `Fuel Tank (+200)[Lvl ${room.train.fuelUpgrades+1}/4]`, cost: 7, type: 'global' });
    if (room.train.storageCars < 7) room.shop.items.push({ id: 'storage_car', name: `Storage Car (+99 Cap)`, cost: 41, type: 'global' });
    if (!room.train.headlightUpgraded) room.shop.items.push({ id: 'headlight', name: 'High-Beams Upgrade', cost: 15, type: 'global' });
    room.shop.items.push({ id: 'regen1', name: 'Regen (+2 HP/s)', cost: 8, type: 'player', val: 2 });
    room.shop.items.push({ id: 'regen2', name: 'Regen (+4 HP/s)', cost: 8, type: 'player', val: 4 });
    room.shop.items.push({ id: 'regen3', name: 'Regen (+6 HP/s)', cost: 8, type: 'player', val: 6 });
    if (!room.train.speedUpgraded && Math.random() < 0.38) room.shop.items.push({ id: 'speed', name: 'Train Speed (+11%)', cost: 15, type: 'global' });
}
io.on('connection', (socket) => {
    socket.on('getLobbies', () => {
        let lobbyList = Object.values(rooms).filter(r => r.status === 'LOBBY').map(r => ({
            id: r.id, name: r.name, isPrivate: !!r.password, players: Object.keys(r.players).length, maxPlayers: r.maxPlayers
        }));
        socket.emit('lobbyList', lobbyList);
    });

    socket.on('createLobby', (data) => {
        let roomId = Math.random().toString(36).substring(2, 8);
        rooms[roomId] = createRoomState(roomId, data.name, data.password, data.maxPlayers);
        socket.emit('lobbyCreated', roomId);
    });

    socket.on('joinLobby', (data) => {
        let room = rooms[data.roomId];
        if (!room) return socket.emit('msg', 'Lobby not found!');
        if (room.status !== 'LOBBY') return socket.emit('msg', 'Game already started!');
        if (Object.keys(room.players).length >= room.maxPlayers) return socket.emit('msg', 'Lobby is full!');
        if (room.password && room.password !== data.password) return socket.emit('msg', 'Incorrect password!');

        socket.join(data.roomId);
        socket.roomId = data.roomId;

        let activeColors = Object.values(room.players).map(p => p.color);
        let availableColor = PLAYER_COLORS.find(c => !activeColors.includes(c)) || PLAYER_COLORS[0];

        room.players[socket.id] = {
            id: socket.id, name: data.playerName || 'Conductor', color: availableColor,
            x: 200, y: 0, hp: 120, maxHp: 120, money: 0, 
            bullets: 32, mag: 5, bombs: 0, hasClothes: false, hasKnife: false, regen: 0,
            inventory: { gold: 0, silver: 0, coal: 0, beerBottles: 0, beerBarrels: 0, skins: 0, planks: 0, watches: 0, rawMeat: 0, cookedMeat: 0 },
            drunk: { sips: 0, timer: 0, damageTimer: 0 }, drinkCooldown: 0,
            coldMeter: 167, dead: false, onTrain: true, onHorse: false, aimAngle: 0,
            spectatingId: null, voted: false, settings: { hasAutoLock: false },
            role: '', desc: '', buffs: {}, isTraitor: false,
            hasFlashlight: false, flashlightOn: false, steamTimer: 0, steamActive: false,
            cooking: { active: false, timer: 0, amount: 0 },
            stats: { kills: 0, coalDumped: 0, beerSips: 0 } 
        };
        io.to(data.roomId).emit('lobbyUpdate', room);
    });

    socket.on('updateSettings', (settings) => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].settings = settings;
    });

    socket.on('updateLobbySettings', (settings) => {
        let room = rooms[socket.roomId];
        if (room && room.status === 'LOBBY') room.settings.traitorEnabled = settings.traitorEnabled;
    connectedPlayers[socket.id] = { name: 'Conductor', lobbyId: null };

    socket.on('create_lobby', (data) => {
        const id = generateId();
        lobbies[id] = new GameLobby(id, data.name, data.maxPlayers, data.password, data.enableTraitor);
        lobbies[id].addPlayer(socket.id, data.playerName);
        connectedPlayers[socket.id].lobbyId = id;
        socket.join(id);
        io.to(id).emit('lobby_update', lobbies[id]);
});

    socket.on('startGame', () => {
        let room = rooms[socket.roomId];
        if (room && room.status === 'LOBBY' && Object.keys(room.players).length >= 1) {
            room.status = 'PLAYING';
            assignRoles(room);
            for (let id in room.players) {
                let p = room.players[id];
                io.to(id).emit('roleReveal', { role: p.role, desc: p.desc, isTraitor: p.isTraitor });
    socket.on('join_lobby', (data) => {
        const lobby = lobbies[data.lobbyId];
        if (lobby && (!lobby.password || lobby.password === data.password)) {
            if (lobby.addPlayer(socket.id, data.playerName)) {
                connectedPlayers[socket.id].lobbyId = lobby.id;
                socket.join(lobby.id);
                io.to(lobby.id).emit('lobby_update', lobby);
            } else {
                socket.emit('error_msg', 'Lobby is full.');
}
            io.to(room.id).emit('gameStarted');
        }
    });

    socket.on('move', (data) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead) return;
        
        let speedMult = (p.drunk.sips >= 3) ? 1.11 : 1;
        let speed = (p.onHorse ? 162 : 150) * speedMult;
        
        let nextX = p.x + data.dx * speed * 0.033;
        let nextY = p.y + data.dy * speed * 0.033;

        let isMoving = ['ACCELERATING', 'MOVING', 'SLOWING'].includes(room.train.state);
        let bounds = getTrainBounds(room);
        
        if (isMoving) {
            nextX = Math.max(bounds.minX, Math.min(bounds.maxX, nextX));
            nextY = Math.max(bounds.minY, Math.min(bounds.maxY, nextY));
        } else if (room.tunnel.active) {
            nextX = Math.max(bounds.minX - 150, Math.min(bounds.maxX + 150, nextX));
            nextY = Math.max(-120, Math.min(120, nextY));
        } else {
            socket.emit('error_msg', 'Invalid lobby or password.');
}

        p.x = nextX; p.y = nextY;
        p.onTrain = (p.x >= bounds.minX && p.x <= bounds.maxX && p.y >= bounds.minY && p.y <= bounds.maxY);
});

    socket.on('aim', (angle) => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].aimAngle = angle;
    socket.on('get_lobbies', () => {
        const publicLobbies = Object.values(lobbies).filter(l => l.state === 'LOBBY').map(l => ({
            id: l.id, name: l.name, players: Object.keys(l.players).length, max: l.maxPlayers, hasPassword: !!l.password
        }));
        socket.emit('lobby_list', publicLobbies);
});

    socket.on('toggleFlashlight', () => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) {
            let p = room.players[socket.id];
            if (p.hasFlashlight) p.flashlightOn = !p.flashlightOn;
    socket.on('start_game', () => {
        const lobbyId = connectedPlayers[socket.id].lobbyId;
        if (lobbyId && lobbies[lobbyId]) {
            lobbies[lobbyId].start();
            io.to(lobbyId).emit('game_started', lobbies[lobbyId]);
}
});
});
// Append to server.js

    socket.on('startSteam', () => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].steamActive = true;
    });

    socket.on('stopSteam', () => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].steamActive = false;
    });
GameLobby.prototype.update = function() {
    if (this.state !== 'PLAYING') return;

    socket.on('eatMeat', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.inventory.cookedMeat <= 0) return;
        
        p.inventory.cookedMeat--;
        p.hp = Math.min(p.maxHp, p.hp + 20);
        socket.emit('msg', 'Ate Cooked Meat (+20 HP)!');
    });
    const dx = this.train.speed / FPS; // World scroll amount

    socket.on('shoot', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.mag <= 0) return;
        
        p.mag--;
        let baseDmg = 30;
        if (p.buffs && p.buffs.dmgMult) baseDmg *= p.buffs.dmgMult;
        let dmg = (p.drunk.sips >= 3) ? baseDmg * 1.2 : baseDmg;
    // 1. Train State Machine & Scrolling Engine
    if (this.train.state === 'MOVING') {
        this.train.distance += dx;

        let targetId = null;
        if (p.settings.hasAutoLock) {
            let closestDist = 600;
            let targets =[...room.enemies, ...room.hawks, ...room.snakes, ...room.chasers, ...room.marshals];
            targets.forEach(t => {
                let d = Math.hypot(p.x - t.x, p.y - t.y);
                if (d < closestDist) { closestDist = d; targetId = t.id; }
            });
            if (p.isTraitor) {
                for (let id in room.players) {
                    let other = room.players[id];
                    if (!other.dead && !other.isTraitor && id !== socket.id) {
                        let d = Math.hypot(p.x - other.x, p.y - other.y);
                        if (d < closestDist) { closestDist = d; targetId = id; }
                    }
        // Scroll all world objects backwards (Train moves RIGHT, world moves LEFT)
        this.world.objects.forEach(obj => obj.x -= dx * 100); // 100px per km
        this.world.enemies.forEach(en => en.x -= dx * 100);

        // Fuel burn logic
        let fuelBurn = 0.05;
        Object.values(this.players).forEach(p => { if(p.role === 'Engineer') fuelBurn *= 0.85; });
        this.train.coal -= fuelBurn / FPS;
        if (this.train.coal <= 0) this.train.speed = 0;

        // Stop condition (Bridge Out or Random Stop)
        if (this.train.speed <= 0) {
            this.train.state = 'STOPPED';
            this.train.stopProcessed = false;
        }

        // Tunnel of Darkness Event (Post 1670km)
        if (this.train.distance > 1670 && !this.world.event && Math.random() < 0.0005) {
            this.world.event = 'TUNNEL';
        } else if (this.world.event === 'TUNNEL' && Math.random() < 0.001) {
            this.world.event = null; // End tunnel
        }

    } else if (this.train.state === 'DEPARTING') {
        this.train.departTimer -= 1 / FPS;
        if (this.train.departTimer <= 0) {
            this.train.state = 'MOVING';
            this.train.speed = 5;
            
            // Teleport stragglers to Caboose
            const cabooseX = -1650; // Based on layout
            Object.values(this.players).forEach(p => {
                if (!this.isPointInTrain(p.x, p.y) && !p.isDead) {
                    p.x = cabooseX;
                    p.y = 0;
}
            }
            });
}
    } else if (this.train.state === 'STOPPED') {
        if (!this.train.stopProcessed) {
            this.spawnWorldStop();
            this.train.stopProcessed = true;
        }
    }

        room.projectiles.push({
            id: Math.random().toString(), x: p.x, y: p.y,
            vx: Math.cos(p.aimAngle) * 450, vy: Math.sin(p.aimAngle) * 450,
            isPlayer: true, owner: socket.id, dmg: dmg, targetId: targetId, isTraitor: p.isTraitor
        });
    });

    socket.on('reload', () => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || p.mag >= 5 || p.bullets <= 0) return;
        let needed = 5 - p.mag;
        let toLoad = Math.min(needed, p.bullets);
        p.mag += toLoad; p.bullets -= toLoad;
    });

    socket.on('mine', (oreId) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || room.train.state !== 'STOPPED') return;
    // 2. Player Movement & Train Barrier
    Object.values(this.players).forEach(p => {
        if (p.isDead) return;

        let oreIndex = room.ores.findIndex(o => o.id === oreId);
        if (oreIndex !== -1) {
            let ore = room.ores[oreIndex];
            if (Math.hypot(p.x - ore.x, p.y - ore.y) < 100) { 
                if (ore.type === 'gold' && p.inventory.gold >= 11) return socket.emit('msg', 'Gold full! (Max 11)');
                if (ore.type === 'silver' && p.inventory.silver >= 15) return socket.emit('msg', 'Silver full! (Max 15)');
                if (ore.type === 'coal' && p.inventory.coal >= 27) return socket.emit('msg', 'Coal full! (Max 27)');
        // Apply inputs (handled via socket events updating p.vx, p.vy)
        let nextX = p.x + (p.vx || 0);
        let nextY = p.y + (p.vy || 0);

                let mineDmg = p.buffs && p.buffs.mineMult ? 1.25 : 1;
                ore.hits -= mineDmg;
                if (ore.hits <= 0) {
                    p.inventory[ore.type] += ore.maxHits;
                    room.ores.splice(oreIndex, 1);
                }
        // The Train Barrier
        if (this.train.state !== 'STOPPED') {
            if (this.isPointInTrain(nextX, nextY)) {
                p.x = nextX; p.y = nextY;
}
        } else {
            p.x = nextX; p.y = nextY; // Free roam when stopped
}
});

    socket.on('interact', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead) return;

        for (let i = 0; i < room.horses.length; i++) {
            if (Math.hypot(p.x - room.horses[i].x, p.y - room.horses[i].y) < 40) {
                p.onHorse = true; room.horses.splice(i, 1); return;
            }
        }

        for (let i = room.planks.length - 1; i >= 0; i--) {
            let plank = room.planks[i];
            if (Math.hypot(p.x - plank.x, p.y - plank.y) < 50) {
                if (p.inventory.planks >= 5) return socket.emit('msg', 'Cannot carry more planks!');
                p.inventory.planks++; room.planks.splice(i, 1);
                socket.emit('msg', 'Picked up a Wood Plank!'); return;
            }
        }
    // 3. AI & Wildlife Logic
    this.updateAI();
    
    // 4. Bullets & Combat
    this.updateBullets();

    // 5. Victory Check
    if (this.train.distance >= JOURNEY_LENGTH) {
        this.state = 'VICTORY';
        clearInterval(this.loop);
        io.to(this.id).emit('victory', this.stats);
    }

        if (Math.hypot(p.x - 240, p.y - 0) < 40) {
            if (room.train.state === 'STOPPED' && room.train.buttonCooldown <= 0 && room.train.fuel > 0) {
                if (!room.train.bridgeFixed) return socket.emit('msg', 'THE BRIDGE IS OUT! Repair the tracks first!');
                room.train.state = 'DEPARTING'; room.train.departureTimer = 8.0;
                room.shop.active = false; room.shopNPC = null;
                io.to(room.id).emit('msg', `TRAIN DEPARTING IN 8 SECONDS!`);
            } else if (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING') {
                room.train.state = 'SLOWING';
            }
            return;
    io.to(this.id).emit('game_state', {
        train: this.train,
        players: this.players,
        world: this.world
    });
};

GameLobby.prototype.isPointInTrain = function(x, y) {
    // Engine(0 to 300), Coal(-300 to 0), Pass1(-600 to -300), Pass2(-900 to -600)
    // Kitchen(-1200 to -900), Gambling(-1500 to -1200), Caboose(-1800 to -1500)
    // Storage(-1800 - N*300)
    const minX = -1800 - (this.train.storageCars * 300);
    const maxX = 300;
    const minY = -100;
    const maxY = 100;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
};

GameLobby.prototype.spawnWorldStop = function() {
    this.world.objects = [];
    this.world.enemies =[];
    this.world.townsVisited++;

    // Bridge Out Event (10% chance)
    if (Math.random() < 0.1) {
        this.world.event = 'BRIDGE';
        this.world.planksRequired = randomInt(8, 16);
        this.train.planksDeposited = 0;
        // Spawn planks in world
        for(let i=0; i<this.world.planksRequired + 5; i++) {
            this.world.objects.push({ type: 'Plank', x: randomInt(400, 2000), y: randomInt(-800, 800) });
        }
    } else {
        this.world.event = null;
        // Spawn Ores, Trees, Animals
        for(let i=0; i<20; i++) this.world.objects.push({ type: 'Tree', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 100 });
        for(let i=0; i<15; i++) this.world.objects.push({ type: 'Ore', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 100 });
        for(let i=0; i<5; i++) this.world.enemies.push({ type: 'Animal', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 50, vx: 0, vy: 0 });
        for(let i=0; i<3; i++) this.world.enemies.push({ type: 'Snake', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 30, state: 'flee' });
        
        // Marshals (Every 3rd town)
        if (this.world.townsVisited % 3 === 0) {
            for(let i=0; i<2; i++) this.world.enemies.push({ type: 'Marshal', x: randomInt(500, 1000), y: randomInt(-500, 500), hp: 331, vx: 0, vy: 0 });
}
    }
    
    // Shop NPC
    this.world.objects.push({ type: 'Shop', x: 400, y: 0 });
};
// Append to server.js

GameLobby.prototype.updateAI = function() {
    this.world.enemies.forEach(en => {
        if (en.hp <= 0) return;
        
        // Find nearest non-traitor player
        let target = null;
        let minDist = Infinity;
        Object.values(this.players).forEach(p => {
            if (p.isDead || p.isTraitor) return; // AI ignores Traitor
            let d = distance(en.x, en.y, p.x, p.y);
            if (d < minDist) { minDist = d; target = p; }
        });

        if (!room.train.bridgeFixed && Math.hypot(p.x - 300, p.y - 0) < 60) {
            if (p.inventory.planks > 0) {
                room.train.planksDeposited += p.inventory.planks; p.inventory.planks = 0;
                if (room.train.planksDeposited >= room.train.planksNeeded) {
                    room.train.bridgeFixed = true; io.to(room.id).emit('msg', 'BRIDGE REPAIRED! Tracks are fixed!');
                } else {
                    io.to(room.id).emit('msg', `Bridge Repair: ${room.train.planksDeposited}/${room.train.planksNeeded} planks.`);
        if (target) {
            const angle = Math.atan2(target.y - en.y, target.x - en.x);
            if (en.type === 'Marshal') {
                en.x += Math.cos(angle) * 2; en.y += Math.sin(angle) * 2;
                if (minDist < 300 && Math.random() < 0.05) {
                    this.world.bullets.push({ x: en.x, y: en.y, vx: Math.cos(angle)*10, vy: Math.sin(angle)*10, isTraitor: false, dmg: 20, owner: 'AI' });
}
            }
            return;
        }

        if (Math.hypot(p.x - 60, p.y - 0) < 40) {
            if (p.inventory.coal > 0) {
                let fuelNeeded = room.train.maxFuel - room.train.fuel;
                let coalNeeded = Math.ceil(fuelNeeded / 50);
                let coalToUse = Math.min(p.inventory.coal, coalNeeded);
                if (coalToUse > 0) {
                    room.train.fuel = Math.min(room.train.maxFuel, room.train.fuel + (coalToUse * 50));
                    p.inventory.coal -= coalToUse; p.stats.coalDumped += coalToUse;
                    io.to(room.id).emit('msg', `${p.name} added ${coalToUse * 50} fuel to the engine!`);
                } else { socket.emit('msg', 'Train fuel tank is already full!'); }
            }
            if (p.inventory.skins > 0) {
                let fuelAdded = p.inventory.skins * 7;
                room.train.fuel = Math.min(room.train.maxFuel, room.train.fuel + fuelAdded);
                p.inventory.skins = 0; io.to(room.id).emit('msg', `${p.name} burned animal skins for fuel!`);
            }
            return;
        }

        // Kitchen Car Stove (x: -370, y: 0)
        if (Math.hypot(p.x - (-370), p.y - 0) < 40) {
            if (p.cooking.active) return socket.emit('msg', 'Already cooking!');
            if (p.inventory.rawMeat > 0) {
                let space = 7 - p.inventory.cookedMeat;
                if (space <= 0) return socket.emit('msg', 'Cooked Meat inventory full! (Max 7)');
                let amountToCook = Math.min(p.inventory.rawMeat, space);
                p.inventory.rawMeat -= amountToCook;
                p.cooking.active = true; p.cooking.timer = 13.0; p.cooking.amount = amountToCook;
                socket.emit('msg', `Cooking ${amountToCook} meat... (13s)`);
            } else { socket.emit('msg', 'No Raw Meat to cook!'); }
            return;
        }

        // Gambling Car Tables (x: -520)
        if (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING') {
            if (Math.hypot(p.x - (-480), p.y - 0) < 40) { 
                if (!room.gambling.active) { room.gambling.active = true; room.gambling.type = 'roulette'; room.gambling.timer = 10; room.gambling.bets = {}; }
                if (room.gambling.type === 'roulette') socket.emit('openGambling', 'roulette'); return;
            }
            if (Math.hypot(p.x - (-520), p.y - 0) < 40) { 
                if (!room.gambling.active) { room.gambling.active = true; room.gambling.type = 'horse'; room.gambling.timer = 10; room.gambling.bets = {}; }
                if (room.gambling.type === 'horse') socket.emit('openGambling', 'horse'); return;
            }
            if (Math.hypot(p.x - (-560), p.y - 0) < 40) { 
                if (!room.gambling.active) { room.gambling.active = true; room.gambling.type = 'poker'; room.gambling.timer = 10; room.gambling.bets = {}; }
                if (room.gambling.type === 'poker') socket.emit('openGambling', 'poker'); return;
            }
        }

        // Storage Car Menu Trigger
        let storageCarX = -710; 
        if (Math.hypot(p.x - storageCarX, p.y - 0) < 50) {
            let currentTotal = room.train.storageInv.gold + room.train.storageInv.silver + room.train.storageInv.coal;
            let maxCap = room.train.storageCars * 99;
            socket.emit('openStorageMenu', { inv: room.train.storageInv, currentTotal, maxCap });
            return;
        }

        if (room.shopNPC && Math.hypot(p.x - room.shopNPC.x, p.y - room.shopNPC.y) < 60) {
            let skinVal = p.buffs && p.buffs.skinValue ? p.buffs.skinValue : 1;
            let earned = (p.inventory.gold * 5) + (p.inventory.silver * 3) + (p.inventory.skins * skinVal);
            if (earned > 0) { 
                p.money += earned; p.inventory.gold = 0; p.inventory.silver = 0; p.inventory.skins = 0;
                socket.emit('msg', `Sold items for $${earned}!`);
            }
            socket.emit('openShop'); return;
        }

        // Mail Hook Snag
        for (let i = room.mailPoles.length - 1; i >= 0; i--) {
            let pole = room.mailPoles[i];
            if (Math.hypot(p.x - pole.x, p.y - pole.y) < 60) {
                let money = Math.floor(Math.random() * 5) + 2; 
                p.money += money; room.mailPoles.splice(i, 1);
                socket.emit('msg', `Snagged a mail bag! Found $${money}!`); return;
            }
        }

        for (let b of room.barrels) {
            if (Math.hypot(p.x - b.x, p.y - b.y) < 40) {
                if (p.inventory.beerBottles > 0 && b.sipsLeft < 67) {
                    p.inventory.beerBottles--; b.sipsLeft = Math.min(67, b.sipsLeft + 8); 
                } else if (b.sipsLeft > 0 && p.drinkCooldown <= 0) {
                    b.sipsLeft--; p.drunk.sips++; p.drunk.timer += 32; p.drinkCooldown = 1.0; p.stats.beerSips++;
                    if (p.drunk.sips >= 11) {
                        p.dead = true; p.hp = 0; io.to(room.id).emit('msg', `${p.name} exploded from too much beer!`); checkAllDead(room);
                    }
            } else if (en.type === 'Snake') {
                if (en.state === 'flee' && minDist < 200) {
                    en.x -= Math.cos(angle) * 4; en.y -= Math.sin(angle) * 4;
                    if (Math.random() < 0.02) en.state = 'strike';
                } else if (en.state === 'strike') {
                    en.x += Math.cos(angle) * 6; en.y += Math.sin(angle) * 6;
                    if (minDist < 20) { target.hp -= 54; en.hp = 0; } // Strike and die
}
                return;
            } else if (en.type === 'Hawk') {
                en.x += Math.cos(angle) * 7; en.y += Math.sin(angle) * 7; // Faster than train
                if (minDist < 20) { target.hp -= 34; en.hp = 0; }
}
}
});

    socket.on('depositStorage', (data) => {
        let room = rooms[socket.roomId];
        if (!room) return;
        let p = room.players[socket.id];
        if (!p || p.dead) return;

        let maxCap = room.train.storageCars * 99;
        ['gold', 'silver', 'coal'].forEach(type => {
            let amountToDeposit = Math.min(p.inventory[type], parseInt(data[type]) || 0);
            for (let i = 0; i < amountToDeposit; i++) {
                let currentTotal = room.train.storageInv.gold + room.train.storageInv.silver + room.train.storageInv.coal;
                if (currentTotal >= maxCap) { socket.emit('msg', 'Storage cars are completely full!'); break; }
                p.inventory[type]--; room.train.storageInv[type]++;
    this.world.enemies = this.world.enemies.filter(e => e.hp > 0);
};

GameLobby.prototype.updateBullets = function() {
    for (let i = this.world.bullets.length - 1; i >= 0; i--) {
        let b = this.world.bullets[i];
        b.x += b.vx; b.y += b.vy;
        b.life = (b.life || 0) + 1;
        if (b.life > 100) { this.world.bullets.splice(i, 1); continue; }

        // Collision with players
        let hit = false;
        Object.values(this.players).forEach(p => {
            if (p.isDead || hit) return;
            if (b.owner !== p.id && distance(b.x, b.y, p.x, p.y) < 20) {
                // Friendly fire logic: Only Traitor can hurt innocents, Innocents can hurt Traitor
                const owner = this.players[b.owner];
                if (owner && !owner.isTraitor && !p.isTraitor && b.owner !== 'AI') return; // Block innocent friendly fire
                
                p.hp -= b.dmg;
                if (p.hp <= 0) {
                    p.isDead = true;
                    if (owner) owner.stats.kills++;
                }
                hit = true;
}
});
    });

    socket.on('placeBet', (data) => {
        let room = rooms[socket.roomId];
        if (!room || !room.gambling.active || room.gambling.timer <= 0) return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.money < data.amount) return;
        p.money -= data.amount;
        room.gambling.bets[socket.id] = { amount: data.amount, choice: data.choice };
    });

    socket.on('placeBarrel', () => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || p.inventory.beerBarrels <= 0 || !p.onTrain) return;
        p.inventory.beerBarrels--;
        room.barrels.push({ id: Math.random().toString(), x: p.x, y: p.y, sipsLeft: 67 });
    });

    socket.on('throwBomb', (data) => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || p.bombs <= 0) return;
        p.bombs--;
        room.bombs.push({ x: data.x, y: data.y, timer: 1.5, isPlayer: true, isTraitor: p.isTraitor });
    });

    socket.on('stab', () => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead) return;

        for (let i = room.crates.length - 1; i >= 0; i--) {
            let c = room.crates[i];
            if (Math.hypot(p.x - c.x, p.y - c.y) < 50) {
                room.crates.splice(i, 1);
                if (c.watchType) {
                    if (p.inventory.watches >= 2) socket.emit('msg', 'Inventory full of watches! (Max 2)');
                    else { p.inventory.watches++; p.money += (c.watchType === 'gold') ? 5 : 3; socket.emit('msg', `Found a ${c.watchType} watch! Sold automatically.`); }
                } else if (Math.random() < 0.5) {
                    let ammo = Math.floor(Math.random() * 23) + 20; p.bullets += ammo; socket.emit('msg', `Crate broken! Found ${ammo} Ammo!`);
                } else {
                    p.hp = Math.min(p.maxHp, p.hp + 50); socket.emit('msg', `Crate broken! Found a Medkit (+50 HP)!`);
        // Collision with enemies
        if (!hit && b.owner !== 'AI') {
            this.world.enemies.forEach(en => {
                if (!hit && distance(b.x, b.y, en.x, en.y) < 30) {
                    en.hp -= b.dmg;
                    hit = true;
                    if (en.hp <= 0) {
                        const owner = this.players[b.owner];
                        if (en.type === 'Animal' && owner) {
                            owner.inventory.meat++;
                            owner.inventory.skins++;
                            owner.inventory.money += owner.role === 'Trapper' ? 3 : 1;
                        }
                    }
}
            }
            });
}
        if (hit) this.world.bullets.splice(i, 1);
    }
};

        if (!p.hasKnife) return;
        let baseDmg = p.buffs && p.buffs.knifeDmg ? p.buffs.knifeDmg : 56;
        let dmg = (p.drunk.sips >= 3) ? baseDmg * 1.2 : baseDmg;
        
        let targets =[...room.enemies, ...room.chasers, ...room.marshals];
        for (let i = targets.length - 1; i >= 0; i--) {
            let e = targets[i];
            if (Math.hypot(p.x - e.x, p.y - e.y) < 50) {
                e.hp -= dmg;
                if (e.hp <= 0) {
                    if (e.hasHorse) room.horses.push({ x: e.x, y: e.y });
                    if (e.type === 'marshal') room.marshals = room.marshals.filter(m => m.id !== e.id);
                    else if (e.isChaser) room.chasers = room.chasers.filter(c => c.id !== e.id);
                    else room.enemies = room.enemies.filter(en => en.id !== e.id);
                    p.stats.kills++;
                }
            }
// --- SOCKET EVENT LISTENERS FOR GAMEPLAY ---
io.on('connection', (socket) => {
    socket.on('player_input', (data) => {
        const lobbyId = connectedPlayers[socket.id].lobbyId;
        if (!lobbyId) return;
        const lobby = lobbies[lobbyId];
        const p = lobby.players[socket.id];
        if (!p || p.isDead) return;

        p.vx = data.dx * 4;
        p.vy = data.dy * 4;

        if (data.shoot && p.inventory.ammo > 0) {
            p.inventory.ammo--;
            let dmg = p.role === 'Sharpshooter' ? 24 : 20;
            lobby.world.bullets.push({
                x: p.x, y: p.y, vx: Math.cos(data.angle)*15, vy: Math.sin(data.angle)*15,
                isTraitor: p.isTraitor, dmg: dmg, owner: p.id
            });
}
    });

        for (let i = room.animals.length - 1; i >= 0; i--) {
            let a = room.animals[i];
            if (Math.hypot(p.x - a.x, p.y - a.y) < 50) {
                a.hp -= dmg;
                if (a.hp <= 0) {
                    if (p.inventory.rawMeat < 7) { p.inventory.rawMeat++; socket.emit('msg', 'Harvested Raw Meat!'); }
                    else { p.inventory.skins++; socket.emit('msg', 'Harvested an animal skin!'); }
                    room.animals.splice(i, 1);
    socket.on('interact', () => {
        const lobbyId = connectedPlayers[socket.id].lobbyId;
        if (!lobbyId) return;
        const lobby = lobbies[lobbyId];
        const p = lobby.players[socket.id];
        if (!p || p.isDead) return;

        // Start Train
        if (lobby.train.state === 'STOPPED' && p.x > 0 && p.x < 300 && p.y > -100 && p.y < 100) {
            if (lobby.world.event === 'BRIDGE' && lobby.train.planksDeposited < lobby.world.planksRequired) return;
            lobby.train.state = 'DEPARTING';
            lobby.train.departTimer = 8;
            io.to(lobbyId).emit('departure_warning');
        }

        // Cook Meat (Kitchen Car: -1200 to -900)
        if (p.x > -1200 && p.x < -900 && p.inventory.meat > 0) {
            p.inventory.meat--;
            socket.emit('cooking_started');
            setTimeout(() => {
                if (lobby.players[p.id]) {
                    lobby.players[p.id].inventory.cookedMeat++;
                    socket.emit('cooking_done');
}
            }
            }, 13000);
}
    });

    socket.on('buy', (itemId) => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || !room.shop.active) return;
        let item = room.shop.items.find(i => i.id === itemId);
        if (item && p.money >= item.cost) {
            if (item.stock !== undefined && item.stock <= 0) return;
            p.money -= item.cost;
            if (item.stock !== undefined) item.stock--;

            if (itemId === 'fuel' && room.train.fuelUpgrades < 4) { room.train.maxFuel += 200; room.train.fuelUpgrades++; generateShop(room); }
            if (itemId === 'storage_car' && room.train.storageCars < 7) { room.train.storageCars++; generateShop(room); }
            if (itemId === 'headlight') { room.train.headlightUpgraded = true; generateShop(room); }
            if (itemId.startsWith('regen')) p.regen = Math.max(p.regen, item.val);
            if (itemId === 'bomb') p.bombs++;
            if (itemId === 'bandage') { let heal = p.buffs && p.buffs.healBonus ? 50 + p.buffs.healBonus : 50; p.hp = Math.min(p.maxHp, p.hp + heal); }
            if (itemId === 'clothes') p.hasClothes = true;
            if (itemId === 'knife') p.hasKnife = true;
            if (itemId === 'ammo') p.bullets += 6;
            if (itemId === 'beer_bottle') p.inventory.beerBottles++;
            if (itemId === 'beer_barrel') p.inventory.beerBarrels++;
            if (itemId === 'flashlight') p.hasFlashlight = true;
            if (itemId === 'revive_kit') {
                let deadPlayers = Object.values(room.players).filter(pl => pl.dead).map(pl => ({ id: pl.id, name: pl.name }));
                socket.emit('openReviveMenu', deadPlayers);
        // Bridge Planks
        if (lobby.world.event === 'BRIDGE') {
            lobby.world.objects.forEach((obj, idx) => {
                if (obj.type === 'Plank' && distance(p.x, p.y, obj.x, obj.y) < 50) {
                    p.inventory.planks++;
                    lobby.world.objects.splice(idx, 1);
                }
            });
            // Deposit
            if (p.x > 0 && p.x < 300 && p.inventory.planks > 0) {
                lobby.train.planksDeposited += p.inventory.planks;
                p.inventory.planks = 0;
}
            if (itemId === 'speed') { room.train.speedMultiplier = 1.11; room.train.speedUpgraded = true; generateShop(room); }
}
});

    socket.on('revivePlayer', (targetId) => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let target = room.players[targetId];
        let reviver = room.players[socket.id];
        if (target && target.dead) {
            target.dead = false; target.hp = 120; target.x = reviver.x; target.y = reviver.y; target.spectatingId = null;
            io.to(room.id).emit('msg', `${reviver.name} revived ${target.name}!`);
    socket.on('eat_meat', () => {
        const p = lobbies[connectedPlayers[socket.id].lobbyId]?.players[socket.id];
        if (p && p.inventory.cookedMeat > 0) {
            p.inventory.cookedMeat--;
            p.hp = Math.min(100, p.hp + 20);
}
});

    socket.on('spectateNext', () => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (!p.dead) return;
        let alive = Object.values(room.players).filter(pl => !pl.dead);
        if (alive.length === 0) return;
        let idx = alive.findIndex(pl => pl.id === p.spectatingId);
        p.spectatingId = alive[(idx + 1) % alive.length].id;
    });

    socket.on('voteRestart', () => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (!p.dead || p.voted) return;
        p.voted = true; room.votes++;
    // Gambling Logic
    socket.on('gamble', (data) => {
        const p = lobbies[connectedPlayers[socket.id].lobbyId]?.players[socket.id];
        if (!p || p.inventory.money < data.bet) return;
        p.inventory.money -= data.bet;

        let total = Object.keys(room.players).length;
        if (room.votes >= Math.ceil(total * 0.5)) { 
            io.to(room.id).emit('msg', 'Vote passed! Restarting...');
            setTimeout(() => resetRoom(room), 2000);
        } else {
            io.to(room.id).emit('msg', `Restart vote: ${room.votes}/${Math.ceil(total * 0.5)} needed.`);
        if (data.game === 'Roulette') {
            const roll = Math.random();
            if (data.choice === 'Red' && roll < 0.45) p.inventory.money += data.bet * 2;
            else if (data.choice === 'Black' && roll >= 0.45 && roll < 0.90) p.inventory.money += data.bet * 2;
            else if (data.choice === 'Green' && roll >= 0.90) p.inventory.money += data.bet * 14;
        } else if (data.game === 'Horse') {
            const winner = randomInt(1, 4);
            if (data.choice === winner) p.inventory.money += data.bet * 4;
            socket.emit('horse_result', winner);
}
});

socket.on('disconnect', () => {
        let room = rooms[socket.roomId];
        if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) delete rooms[socket.roomId];
            else checkAllDead(room);
        const info = connectedPlayers[socket.id];
        if (info && info.lobbyId && lobbies[info.lobbyId]) {
            delete lobbies[info.lobbyId].players[socket.id];
}
        delete connectedPlayers[socket.id];
});
});
function checkAllDead(room) {
    if (room.status !== 'PLAYING') return;
    if (Object.values(room.players).every(p => p.dead)) {
        room.status = 'VOTING';
        io.to(room.id).emit('allDead');
    }
}

function resetRoom(room) {
    room.status = 'LOBBY'; room.votes = 0;
    room.train = { 
        distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED', fuel: 1003, maxFuel: 1003, 
        buttonCooldown: 0, departureTimer: 0, speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0, headlightUpgraded: false,
        nextTownDist: Math.random() * (497 - 274) + 274, townStops: 0,
        nextBridgeDist: Math.random() * (800 - 400) + 400, bridgeFixed: true, planksNeeded: 0, planksDeposited: 0,
        inTown: false, townWarningSent: false, storageCars: 1, storageInv: { gold: 0, silver: 0, coal: 0 },
        steamPressure: 100, steamActive: false, steamCloudTimer: 0
    };
    room.enemies = []; room.ores =[]; room.crates =[]; room.animals = []; room.planks = [];
    room.projectiles =[]; room.bombs =[]; room.horses = []; room.barrels = []; room.avalancheRocks =[]; 
    room.hawks = []; room.snakes = []; room.mailPoles =[]; room.chasers = []; room.marshals =[];
    room.shopNPC = null; room.townX = null; room.gambling = { active: false, type: null, timer: 0, bets: {} };
    room.tunnel = { active: false, distanceLeft: 0, checkTimer: 0 };
    room.raidTimer = 0; room.avalancheTimer = 0; room.hawkTimer = 0; room.mailTimer = 0; room.chaseTimer = 0;
    
    for (let id in room.players) {
        let p = room.players[id];
        p.hp = 120; p.dead = false; p.money = 0; p.bullets = 32; p.mag = 5; p.bombs = 0; p.hasClothes = false; p.hasKnife = false; p.regen = 0;
        p.inventory = { gold: 0, silver: 0, coal: 0, beerBottles: 0, beerBarrels: 0, skins: 0, planks: 0, watches: 0, rawMeat: 0, cookedMeat: 0 };
        p.drunk = { sips: 0, timer: 0, damageTimer: 0 }; p.drinkCooldown = 0; p.coldMeter = 167; p.onTrain = true; p.onHorse = false; p.x = 200; p.y = 0; p.voted = false; p.spectatingId = null;
        p.role = ''; p.desc = ''; p.buffs = {}; p.isTraitor = false; p.hasFlashlight = false; p.flashlightOn = false; p.steamTimer = 0;
        p.cooking = { active: false, timer: 0, amount: 0 }; p.stats = { kills: 0, coalDumped: 0, beerSips: 0 };
    }
    io.to(room.id).emit('lobbyUpdate', room);
}

function resolveGambling(room) {
    let result;
    if (room.gambling.type === 'horse') {
        result = Math.floor(Math.random() * 4) + 1; 
    } else if (room.gambling.type === 'roulette') {
        result = Math.random() < 0.48 ? 'red' : (Math.random() < 0.96 ? 'black' : 'green');
    } else if (room.gambling.type === 'poker') {
        let suits =['Hearts', 'Spades', 'Clubs', 'Diamonds'];
        let values =['9', '10', 'Jack', 'Queen', 'King', 'Ace'];
        result = `${values[Math.floor(Math.random()*values.length)]} of ${suits[Math.floor(Math.random()*suits.length)]}`;
    }
    
    for (let socketId in room.gambling.bets) {
        let bet = room.gambling.bets[socketId]; let p = room.players[socketId];
        if (!p) continue;
        if (room.gambling.type === 'poker') {
            if (Math.random() < 0.33) {
                p.money += bet.amount * 3; io.to(socketId).emit('msg', `POKER WIN! You won $${bet.amount * 3}!`);
            } else { io.to(socketId).emit('msg', 'You folded. Lost the bet.'); }
        } else if (bet.choice == result) {
            let winAmount = room.gambling.type === 'horse' ? bet.amount * 4 : (bet.choice === 'green' ? bet.amount * 14 : bet.amount * 2);
            p.money += winAmount; io.to(socketId).emit('msg', `WINNER! Won $${winAmount}!`);
        } else {
            io.to(socketId).emit('msg', 'You lost the bet.');
        }
    }
    io.to(room.id).emit('gamblingResult', { type: room.gambling.type, result: result });
    setTimeout(() => { room.gambling.active = false; }, 3000);
}

// --- MASTER GAME LOOP (30 FPS) ---
setInterval(() => {
    let dt = 1 / 30;

    for (let roomId in rooms) {
        let room = rooms[roomId];
        if (room.status !== 'PLAYING') continue;

        let dx = 0; 
        let isMoving = false;

        if (room.train.state === 'DEPARTING') {
            room.train.departureTimer -= dt;
            if (room.train.departureTimer <= 0) {
                room.train.state = 'ACCELERATING';
                for (let id in room.players) {
                    let p = room.players[id];
                    if (!p.onTrain && !p.dead) {
                        p.x = -700; p.y = 0; 
                        io.to(room.id).emit('msg', `${p.name} scrambled onto the moving train!`);
                    }
                }
                checkAllDead(room);

                let enemiesKilled = false;
                room.enemies = room.enemies.filter(e => {
                    let bounds = getTrainBounds(room);
                    let onTrain = (e.x >= bounds.minX && e.x <= bounds.maxX && e.y >= bounds.minY && e.y <= bounds.maxY);
                    if (!onTrain) enemiesKilled = true;
                    return onTrain;
                });
                if (enemiesKilled) io.to(room.id).emit('msg', 'Enemies left behind were obliterated!');
            }
        } else if (room.train.state === 'ACCELERATING') {
            room.train.speed += (room.train.maxSpeed / 8) * dt;
            room.avalancheRocks =[]; 
            isMoving = true;
            if (room.train.speed >= room.train.maxSpeed) room.train.state = 'MOVING';
        } else if (room.train.state === 'SLOWING') {
            room.train.speed -= (room.train.maxSpeed / 4) * dt;
            isMoving = true;
            if (room.train.speed <= 0) {
                room.train.speed = 0; room.train.state = 'STOPPED'; room.train.buttonCooldown = 3;
                
                spawnCrates(room);
                spawnSnakes(room);

                if (room.train.distance >= room.train.nextBridgeDist) {
                    room.train.bridgeFixed = false;
                    room.train.planksNeeded = Math.floor(Math.random() * 9) + 8; 
                    room.train.planksDeposited = 0;
                    room.train.nextBridgeDist = room.train.distance + Math.random() * (800 - 400) + 400;
                    spawnPlanks(room, room.train.planksNeeded + 5);
                    spawnEnemies(room, false);
                    io.to(room.id).emit('msg', 'THE BRIDGE IS OUT! Collect wood planks to repair the tracks!');
                } else if (Math.random() < 0.37) {
                    room.train.inTown = true; room.train.townStops++;
                    generateShop(room);
                    room.townX = 0; room.shopNPC = { x: 0, y: 150 }; 
                    spawnEnemies(room, true);
                    io.to(room.id).emit('msg', 'Arrived at a town! Visit the NPC outside to sell items.');
                    
                    if (room.train.townStops % 3 === 0) {
                        spawnMarshals(room);
                        io.to(room.id).emit('msg', 'THE MARSHALS HAVE ARRIVED! They are hunting the Traitor!');
                    }
                } else {
                    room.train.inTown = false; room.townX = null;
                    spawnOres(room); spawnAnimals(room); spawnEnemies(room, false);
                    io.to(room.id).emit('msg', 'Stopped in the wilderness. Mine ores or hunt animals!');
                }
            }
        } else if (room.train.state === 'MOVING') {
            isMoving = true;
        }

        if (isMoving) {
            let fuelMult = 1;
            for (let id in room.players) {
                let p = room.players[id];
                if (!p.dead && p.onTrain && p.buffs && p.buffs.fuelMult) fuelMult = p.buffs.fuelMult;
            }

            let speedMps = (room.train.speed * room.train.speedMultiplier) * 0.277;
            dx = speedMps * 15 * dt; 
            room.train.distance += (room.train.speed * room.train.speedMultiplier * 0.1) * dt;
            room.train.fuel -= (17 * fuelMult) * dt;
            if (room.train.fuel <= 0) { room.train.fuel = 0; room.train.state = 'SLOWING'; }

            room.train.steamPressure = Math.max(0, room.train.steamPressure - (1.67 / 67) * (room.train.speed * room.train.speedMultiplier * 0.1) * dt);

            room.ores.forEach(o => o.x -= dx); room.crates.forEach(c => c.x -= dx); 
            room.animals.forEach(a => a.x -= dx); room.planks.forEach(p => p.x -= dx);
            room.enemies.forEach(e => e.x -= dx); room.horses.forEach(h => h.x -= dx);
            room.avalancheRocks.forEach(r => r.x -= dx); room.hawks.forEach(h => h.x -= dx);
            room.snakes.forEach(s => s.x -= dx); room.mailPoles.forEach(m => m.x -= dx);
            room.chasers.forEach(c => c.x -= dx); room.marshals.forEach(m => m.x -= dx);
            if (room.shopNPC) room.shopNPC.x -= dx;
            if (room.townX !== null) room.townX -= dx;

            room.mailTimer += dt;
            if (room.mailTimer >= 15 && Math.random() < 0.3) {
                room.mailTimer = 0;
                room.mailPoles.push({ id: Math.random().toString(), x: 1200, y: 60 }); 
            }

            room.chaseTimer += dt;
            if (room.chaseTimer >= 45 && Math.random() < 0.15) {
                room.chaseTimer = 0;
                io.to(room.id).emit('msg', 'BANDITS ARE CHASING THE TRAIN!');
                for(let i=0; i<3; i++) {
                    room.chasers.push({
                        id: Math.random().toString(), type: 'gunman',
                        x: -800 + (Math.random()*200), y: (Math.random() > 0.5 ? 150 : -150),
                        hp: 40, hasHorse: true, lastShot: 0, aimAngle: 0, isChaser: true
                    });
                }
            }
        }

        if (room.train.buttonCooldown > 0) room.train.buttonCooldown -= dt;
        room.biome = getBiome(room.train.distance);

        for (let id in room.players) {
            let p = room.players[id];
            if (p.cooking.active) {
                p.cooking.timer -= dt;
                if (p.cooking.timer <= 0) {
                    p.cooking.active = false;
                    p.inventory.cookedMeat += p.cooking.amount;
                    p.cooking.amount = 0;
                    io.to(id).emit('msg', 'Meat finished cooking! Press Y to eat.');
                }
            }
        }

        if (room.train.distance >= 1670) {
            if (!room.tunnel.active) {
                room.tunnel.checkTimer += dt;
                if (room.tunnel.checkTimer >= 11.0) {
                    room.tunnel.checkTimer = 0;
                    if (Math.random() < 0.11) {
                        room.tunnel.active = true;
                        room.tunnel.distanceLeft = Math.random() * (420 - 200) + 200;
                        io.to(room.id).emit('msg', 'Entering a dark mountain tunnel! Use your flashlights (L)!');
                    }
                }
            } else if (isMoving) {
                room.tunnel.distanceLeft -= (room.train.speed * room.train.speedMultiplier * 0.1) * dt;
                if (room.tunnel.distanceLeft <= 0) {
                    room.tunnel.active = false;
                    io.to(room.id).emit('msg', 'Exited the tunnel back into daylight.');
                }
            }
        }

        let steamBlowing = false;
        for (let id in room.players) {
            let p = room.players[id];
            if (!p.dead && p.steamActive && Math.hypot(p.x - 60, p.y - 0) < 40) {
                steamBlowing = true; p.steamTimer += dt;
                if (p.steamTimer >= 1.67) { p.steamTimer = 0; room.train.steamPressure = Math.min(100, room.train.steamPressure + 2); }
                for (let targetId in room.players) {
                    let target = room.players[targetId];
                    if (!target.dead && Math.hypot(target.x - 60, target.y - 0) < 120) {
                        target.steamCloudTimer = (target.steamCloudTimer || 0) + dt;
                        if (target.steamCloudTimer >= 4.0) {
                            target.steamCloudDmgTimer = (target.steamCloudDmgTimer || 0) + dt;
                            if (target.steamCloudDmgTimer >= 0.67) {
                                target.steamCloudDmgTimer = 0; target.hp -= 3;
                                if (target.hp <= 0) { target.dead = true; checkAllDead(room); }
                            }
                        }
                    } else if (target) { target.steamCloudTimer = 0; }
                }
            } else if (p) { p.steamTimer = 0; }
        }
        room.train.steamActive = steamBlowing;

        let allHostiles =[...room.enemies, ...room.chasers, ...room.marshals];
        allHostiles.forEach(e => {
            let target = null; let minDist = Infinity;
            for (let id in room.players) {
                let p = room.players[id]; 
                if (p.dead) continue;
                if (e.type === 'marshal' && !p.isTraitor) continue;
                if (e.type !== 'marshal' && p.isTraitor) continue;
                
                let d = Math.hypot(p.x - e.x, p.y - e.y); 
                if (d < minDist) { minDist = d; target = p; }
            }
            if (target) {
                let speed = e.hasHorse ? 65 : 60;
                if (e.isChaser) {
                    speed = (room.train.speed * 15) + 20; 
                    // Chasers stay parallel to the train
                    let targetY = target.y > 0 ? 150 : -150;
                    e.y += (targetY - e.y) * 2 * dt;
                    e.x += (target.x - e.x) / minDist * speed * dt;
                } else {
                    if (minDist > 40) { e.x += (target.x - e.x) / minDist * speed * dt; e.y += (target.y - e.y) / minDist * speed * dt; }
                }
                
                e.aimAngle = Math.atan2(target.y - e.y, target.x - e.x); e.lastShot += dt;
                
                if ((e.type === 'gunman' || e.type === 'marshal') && minDist < 400 && e.lastShot > 2.5) {
                    e.lastShot = 0; room.projectiles.push({ id: Math.random().toString(), x: e.x, y: e.y, vx: Math.cos(e.aimAngle) * 300, vy: Math.sin(e.aimAngle) * 300, isPlayer: false, dmg: e.type === 'marshal' ? 25 : 15 });
                } else if (e.type === 'knifeman' && minDist < 45 && e.lastShot > 1.2) {
                    e.lastShot = 0; target.hp -= 10; if (target.hp <= 0) { target.dead = true; checkAllDead(room); }
                } else if (e.type === 'bombman' && minDist < 250 && e.lastShot > 3) {
                    e.lastShot = 0; room.bombs.push({ x: target.x, y: target.y, timer: 1.5, isPlayer: false });
                }
            }
        });

        for (let i = room.projectiles.length - 1; i >= 0; i--) {
            let proj = room.projectiles[i];
            if (proj.isPlayer && proj.targetId) {
                let target = allHostiles.find(e => e.id === proj.targetId) || room.hawks.find(h => h.id === proj.targetId) || room.snakes.find(s => s.id === proj.targetId);
                if (!target) target = room.players[proj.targetId];
                if (target) {
                    let angle = Math.atan2(target.y - proj.y, target.x - proj.x);
                    proj.vx = Math.cos(angle) * 450; proj.vy = Math.sin(angle) * 450;
                }
            }
            proj.x += proj.vx * dt - dx; proj.y += proj.vy * dt;

            let hit = false;
            if (proj.isPlayer) {
                for (let j = allHostiles.length - 1; j >= 0; j--) {
                    let e = allHostiles[j];
                    if (Math.hypot(proj.x - e.x, proj.y - e.y) < 25) {
                        e.hp -= proj.dmg || 10;
                        if (e.hp <= 0) {
                            if (e.hasHorse) room.horses.push({ x: e.x, y: e.y });
                            let owner = room.players[proj.owner];
                            if (owner) owner.stats.kills++;
                            
                            if (e.type === 'marshal') room.marshals.splice(j, 1);
                            else if (e.isChaser) room.chasers.splice(j, 1);
                            else room.enemies.splice(j, 1);
                        }
                        hit = true; break;
                    }
                }
                if (!hit) {
                    for (let j = room.hawks.length - 1; j >= 0; j--) {
                        if (Math.hypot(proj.x - room.hawks[j].x, proj.y - room.hawks[j].y) < 25) { room.hawks.splice(j, 1); hit = true; break; }
                    }
                }
                if (!hit) {
                    for (let j = room.snakes.length - 1; j >= 0; j--) {
                        if (Math.hypot(proj.x - room.snakes[j].x, proj.y - room.snakes[j].y) < 25) { room.snakes.splice(j, 1); hit = true; break; }
                    }
                }
                if (!hit) {
                    for (let j = room.animals.length - 1; j >= 0; j--) {
                        if (Math.hypot(proj.x - room.animals[j].x, proj.y - room.animals[j].y) < 25) {
                            room.animals[j].hp -= proj.dmg || 10;
                            if (room.animals[j].hp <= 0) {
                                let owner = room.players[proj.owner];
                                if (owner) {
                                    if (owner.inventory.rawMeat < 7) { owner.inventory.rawMeat++; io.to(proj.owner).emit('msg', 'Harvested Raw Meat!'); }
                                    else { owner.inventory.skins++; io.to(proj.owner).emit('msg', 'Harvested an animal skin!'); }
                                }
                                room.animals.splice(j, 1);
                            }
                            hit = true; break;
                        }
                    }
                }
                if (!hit && proj.isTraitor) {
                    for (let id in room.players) {
                        let p = room.players[id];
                        if (!p.dead && id !== proj.owner && Math.hypot(proj.x - p.x, proj.y - p.y) < 20) {
                            p.hp -= proj.dmg; if (p.hp <= 0) { p.dead = true; checkAllDead(room); }
                            hit = true; break;
                        }
                    }
                }
            } else {
                for (let id in room.players) {
                    let p = room.players[id];
                    if (!p.dead && !p.isTraitor && Math.hypot(proj.x - p.x, proj.y - p.y) < 20) {
                        p.hp -= proj.dmg; if (p.hp <= 0) { p.dead = true; checkAllDead(room); }
                        hit = true; break;
                    }
                }
            }
            if (hit || Math.abs(proj.x) > 2500 || Math.abs(proj.y) > 2500) room.projectiles.splice(i, 1);
        }

        io.to(room.id).emit('state', room);
        
        if (room.train.distance >= 3181 && room.status === 'PLAYING') { 
            room.status = 'VOTING'; 
            let awards = { leadSlinger: 'No One', drunkard: 'No One', workhorse: 'No One', snake: 'No One' };
            let maxKills = 0, maxSips = 0, maxCoal = 0;
            for (let id in room.players) {
                let p = room.players[id];
                if (p.stats.kills > maxKills) { maxKills = p.stats.kills; awards.leadSlinger = p.name; }
                if (p.stats.beerSips > maxSips) { maxSips = p.stats.beerSips; awards.drunkard = p.name; }
                if (p.stats.coalDumped > maxCoal) { maxCoal = p.stats.coalDumped; awards.workhorse = p.name; }
                if (p.isTraitor && !p.dead) awards.snake = p.name;
            }
            io.to(room.id).emit('victory', awards); 
        }
    }
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
server.listen(3000, () => console.log('Server running on port 3000'));
