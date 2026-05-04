const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PLAYER_COLORS =['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#e377c2'];

const rooms = {};

const BIOMES =[
    { name: 'forest', end: 974 },
    { name: 'desert', end: 1521 },
    { name: 'tundra', end: 1908 },
    { name: 'desert', end: 2455 },
    { name: 'forest', end: 3181 }
];

function getBiome(dist) {
    for (let b of BIOMES) if (dist <= b.end) return b.name;
    return 'forest';
}

function createRoomState(id, name, password, maxPlayers) {
    return {
        id, name, password, maxPlayers, status: 'LOBBY',
        players: {}, enemies:[], ores: [], projectiles: [], bombs: [], horses:[], barrels:[],
        train: {
            distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED', // STOPPED, DEPARTING, ACCELERATING, MOVING, SLOWING
            fuel: 1003, maxFuel: 1003, buttonCooldown: 0, departureTimer: 0,
            speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0,
            nextTownDist: Math.random() * (497 - 274) + 274,
            inTown: false, townWarningSent: false
        },
        biome: 'forest', inMountains: false,
        mountainStart: Math.random() * (200 - 50) + 50, mountainEnd: 0,
        avalanche: { active: false, timer: 0 }, avalancheRocks:[],
        raidTimer: 0, raidActive: false, avalancheTimer: 0,
        shop: { active: false, items:[] }, shopNPC: null,
        votes: 0
    };
}

function spawnOres(room) {
    room.ores =[];
    for (let i = 0; i < 30; i++) {
        let rand = Math.random();
        let type = rand < 0.1 ? 'gold' : (rand < 0.3 ? 'silver' : 'coal');
        let hits = type === 'gold' ? Math.floor(Math.random() * 6) + 4 : (type === 'silver' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 3) + 2);
        
        let x, y, onTrain;
        do {
            x = (Math.random() - 0.5) * 1400;
            y = (Math.random() - 0.5) * 1000;
            onTrain = (x >= -400 && x <= 280 && y >= -50 && y <= 50);
        } while (onTrain);

        room.ores.push({ id: Math.random().toString(), type, x, y, hits, maxHits: hits });
    }
}

function spawnEnemies(room, isTown, isRaid = false) {
    // DRASTICALLY REDUCED ENEMY SPAWNS
    let groups = isTown ? 2 : 1; 
    if (!isTown && !isRaid) {
        if (Math.random() < 0.2) groups++; // Only 20% chance for an extra group in wilderness
    }
    if (isRaid) {
        groups = 2;
        room.raidActive = true;
    }

    for (let g = 0; g < groups; g++) {
        if (!isTown && !isRaid && Math.random() > 0.30) continue; // 70% chance a group doesn't even spawn in wilderness
        
        let baseX = (Math.random() > 0.5 ? 700 : -700);
        let baseY = (Math.random() > 0.5 ? 400 : -400);

        for (let i = 0; i < 2; i++) { // Reduced gunmen per group
            if (Math.random() < 0.5 || isRaid) createEnemy(room, 'gunman', baseX, baseY, isRaid);
        }
        for (let i = 0; i < 2; i++) createEnemy(room, 'knifeman', baseX, baseY, isRaid); // Reduced knifemen
        if (Math.random() < 0.15) { // Reduced bombmen chance
            createEnemy(room, 'bombman', baseX, baseY, isRaid);
        }
    }
}

function createEnemy(room, type, x, y, isRaid) {
    room.enemies.push({
        id: Math.random().toString(), type, isRaid,
        x: x + (Math.random() - 0.5) * 150, y: y + (Math.random() - 0.5) * 150,
        hp: type === 'gunman' ? 30 : 40,
        hasHorse: !isRaid && Math.random() < 0.25, // Reduced horse chance
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
        { id: 'beer_bottle', name: 'Beer Bottle (Refill)', cost: 3, type: 'player', stock: 4 },
        { id: 'beer_barrel', name: 'Beer Barrel (Placeable)', cost: 11, type: 'player', stock: 2 }
    ];
    
    if (room.train.fuelUpgrades < 4) {
        room.shop.items.push({ id: 'fuel', name: `Fuel Tank (+200)[Lvl ${room.train.fuelUpgrades+1}/4]`, cost: 7, type: 'global' });
    }
    
    room.shop.items.push({ id: 'regen1', name: 'Regen (+2 HP/s)', cost: 8, type: 'player', val: 2 });
    room.shop.items.push({ id: 'regen2', name: 'Regen (+4 HP/s)', cost: 8, type: 'player', val: 4 });
    room.shop.items.push({ id: 'regen3', name: 'Regen (+6 HP/s)', cost: 8, type: 'player', val: 6 });

    if (!room.train.speedUpgraded && Math.random() < 0.38) {
        room.shop.items.push({ id: 'speed', name: 'Train Speed (+11%)', cost: 15, type: 'global' });
    }
}

io.on('connection', (socket) => {
    socket.on('getLobbies', () => {
        let lobbyList = Object.values(rooms).filter(r => r.status === 'LOBBY').map(r => ({
            id: r.id, name: r.name, isPrivate: !!r.password, 
            players: Object.keys(r.players).length, maxPlayers: r.maxPlayers
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
            id: socket.id, name: data.playerName || 'Conductor',
            x: 200, y: 0, hp: 120, maxHp: 120, money: 0, color: availableColor,
            bullets: 32, mag: 5, bombs: 0, hasClothes: false, hasKnife: false, regen: 0,
            inventory: { gold: 0, silver: 0, coal: 0, beerBottles: 0, beerBarrels: 0 },
            drunk: { sips: 0, timer: 0, damageTimer: 0 }, drinkCooldown: 0,
            coldMeter: 167, dead: false, onTrain: true, onHorse: false, aimAngle: 0,
            spectatingId: null, voted: false
        };

        io.to(data.roomId).emit('lobbyUpdate', room);
    });

    socket.on('startGame', () => {
        let room = rooms[socket.roomId];
        if (room && room.status === 'LOBBY' && Object.keys(room.players).length >= 1) {
            room.status = 'PLAYING';
            io.to(room.id).emit('gameStarted');
        }
    });
