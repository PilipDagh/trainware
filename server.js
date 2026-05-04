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
    socket.on('move', (data) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead) return;
        
        // Drunk speed boost (11%)
        let speedMult = (p.drunk.sips >= 3) ? 1.11 : 1;
        let speed = (p.onHorse ? 162 : 150) * speedMult;
        
        p.x += data.dx * speed * 0.033;
        p.y += data.dy * speed * 0.033;

        let onTrain = (p.x >= -400 && p.x <= 280 && p.y >= -50 && p.y <= 50);
        p.onTrain = onTrain;

        if (!onTrain && (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING' || room.train.state === 'SLOWING')) {
            p.dead = true; p.hp = 0;
            io.to(room.id).emit('msg', `${p.name} exploded by leaving the moving train!`);
            checkAllDead(room);
        }
    });

    socket.on('aim', (angle) => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].aimAngle = angle;
    });

    socket.on('placeBarrel', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.inventory.beerBarrels <= 0 || !p.onTrain) return;

        p.inventory.beerBarrels--;
        room.barrels.push({ id: Math.random().toString(), x: p.x, y: p.y, sipsLeft: 67 });
        io.to(room.id).emit('msg', `${p.name} placed a Beer Barrel!`);
    });

    socket.on('interact', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead) return;

        // 1. Mount Horse
        for (let i = 0; i < room.horses.length; i++) {
            if (Math.hypot(p.x - room.horses[i].x, p.y - room.horses[i].y) < 40) {
                p.onHorse = true;
                room.horses.splice(i, 1);
                return;
            }
        }

        // 2. Train Start/Stop Button (Engine: x: 240, y: 0)
        if (Math.hypot(p.x - 240, p.y - 0) < 40) {
            if (room.train.state === 'STOPPED' && room.train.buttonCooldown <= 0 && room.train.fuel > 0) {
                room.train.state = 'DEPARTING';
                room.train.departureTimer = 8.0;
                room.shop.active = false;
                room.shopNPC = null;
                io.to(room.id).emit('msg', `TRAIN DEPARTING IN 8 SECONDS! GET ON BOARD!`);
            } else if (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING') {
                room.train.state = 'SLOWING';
            }
            return;
        }

        // 3. Coal Dump Cart (Coal Car: x: 60, y: 0)
        if (Math.hypot(p.x - 60, p.y - 0) < 40) {
            if (p.inventory.coal > 0) {
                let fuelAdded = p.inventory.coal * 50;
                room.train.fuel = Math.min(room.train.maxFuel, room.train.fuel + fuelAdded);
                io.to(room.id).emit('msg', `${p.name} added ${fuelAdded} fuel!`);
                p.inventory.coal = 0;
            }
            return;
        }

        // 4. Shop NPC
        if (room.shopNPC && Math.hypot(p.x - room.shopNPC.x, p.y - room.shopNPC.y) < 50) {
            let earned = (p.inventory.gold * 5) + (p.inventory.silver * 3);
            if (earned > 0) {
                p.money += earned;
                p.inventory.gold = 0;
                p.inventory.silver = 0;
                socket.emit('msg', `Sold ores for $${earned}!`);
            }
            socket.emit('openShop');
            return;
        }

        // 5. Beer Barrels (Drink or Refill)
        for (let i = 0; i < room.barrels.length; i++) {
            let b = room.barrels[i];
            if (Math.hypot(p.x - b.x, p.y - b.y) < 40) {
                if (p.inventory.beerBottles > 0 && b.sipsLeft < 67) {
                    // Refill
                    p.inventory.beerBottles--;
                    b.sipsLeft = Math.min(67, b.sipsLeft + Math.ceil(67 * 0.08)); // ~5.36 sips per bottle
                    socket.emit('msg', `Refilled barrel! (${b.sipsLeft}/67)`);
                } else if (b.sipsLeft > 0 && p.drinkCooldown <= 0) {
                    // Drink
                    b.sipsLeft--;
                    p.drunk.sips++;
                    p.drunk.timer += 32;
                    p.drinkCooldown = 1.0;
                    socket.emit('msg', `*Gulp* (${b.sipsLeft} sips left)`);
                    
                    if (p.drunk.sips >= 11) {
                        p.dead = true; p.hp = 0;
                        io.to(room.id).emit('msg', `${p.name} drank too much and exploded!`);
                        checkAllDead(room);
                    }
                }
                return;
            }
        }
    });

    socket.on('mine', (oreId) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || room.train.state !== 'STOPPED') return;
        
        let oreIndex = room.ores.findIndex(o => o.id === oreId);
        if (oreIndex !== -1) {
            let ore = room.ores[oreIndex];
            if (Math.hypot(p.x - ore.x, p.y - ore.y) < 60) {
                ore.hits--;
                if (ore.hits <= 0) {
                    p.inventory[ore.type] += ore.maxHits;
                    room.ores.splice(oreIndex, 1);
                }
            }
        }
    });

    socket.on('shoot', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.mag <= 0) return;
        
        p.mag--;
        let dmg = (p.drunk.sips >= 3) ? 30 * 1.2 : 30; // 20% more damage if drunk
        room.projectiles.push({
            id: Math.random().toString(), x: p.x, y: p.y,
            vx: Math.cos(p.aimAngle) * 400, vy: Math.sin(p.aimAngle) * 400,
            isPlayer: true, owner: socket.id, dmg: dmg
        });
    });

    socket.on('reload', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.mag >= 5 || p.bullets <= 0) return;

        let bulletsNeeded = 5 - p.mag;
        let bulletsToLoad = Math.min(bulletsNeeded, p.bullets);
        p.mag += bulletsToLoad;
        p.bullets -= bulletsToLoad;
    });

    socket.on('throwBomb', (target) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.bombs <= 0) return;
        p.bombs--;
        room.bombs.push({ x: target.x, y: target.y, timer: 1.5, isPlayer: true });
    });

    socket.on('stab', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || !p.hasKnife) return;
        
        let dmg = (p.drunk.sips >= 3) ? 56 * 1.2 : 56; // 20% more damage if drunk
        for (let i = room.enemies.length - 1; i >= 0; i--) {
            let e = room.enemies[i];
            if (Math.hypot(p.x - e.x, p.y - e.y) < 50) {
                e.hp -= dmg;
                if (e.hp <= 0) {
                    if (e.hasHorse) room.horses.push({ x: e.x, y: e.y });
                    room.enemies.splice(i, 1);
                }
            }
        }
    });

    socket.on('buy', (itemId) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || !room.shop.active) return;
        
        let item = room.shop.items.find(i => i.id === itemId);
        if (item && p.money >= item.cost) {
            if (item.stock !== undefined && item.stock <= 0) return;
            p.money -= item.cost;
            if (item.stock !== undefined) item.stock--;

            if (itemId === 'fuel' && room.train.fuelUpgrades < 4) {
                room.train.maxFuel += 200;
                room.train.fuelUpgrades++;
                generateShop(room);
            }
            if (itemId.startsWith('regen')) p.regen = Math.max(p.regen, item.val);
            if (itemId === 'bomb') p.bombs++;
            if (itemId === 'bandage') p.hp = Math.min(p.maxHp, p.hp + 50);
            if (itemId === 'clothes') p.hasClothes = true;
            if (itemId === 'knife') p.hasKnife = true;
            if (itemId === 'ammo') p.bullets += 6;
            if (itemId === 'beer_bottle') p.inventory.beerBottles++;
            if (itemId === 'beer_barrel') p.inventory.beerBarrels++;
            if (itemId === 'speed') {
                room.train.speedMultiplier = 1.11;
                room.train.speedUpgraded = true;
                generateShop(room);
            }
        }
    });

    socket.on('spectateNext', () => {
        let room = rooms[socket.roomId];
        if (!room) return;
        let p = room.players[socket.id];
        if (!p || !p.dead) return;

        let alivePlayers = Object.values(room.players).filter(pl => !pl.dead);
        if (alivePlayers.length === 0) return;

        let currentIndex = alivePlayers.findIndex(pl => pl.id === p.spectatingId);
        let nextIndex = (currentIndex + 1) % alivePlayers.length;
        p.spectatingId = alivePlayers[nextIndex].id;
    });

    socket.on('voteRestart', () => {
        let room = rooms[socket.roomId];
        if (!room) return;
        let p = room.players[socket.id];
        if (!p || !p.dead || p.voted) return;

        p.voted = true;
        room.votes++;
        
        let totalPlayers = Object.keys(room.players).length;
        // Fixed: Now requires 50% of players to vote yes
        if (room.votes >= Math.ceil(totalPlayers * 0.5)) {
            io.to(room.id).emit('msg', 'Vote passed! Restarting lobby...');
            setTimeout(() => resetRoom(room), 3000);
        } else {
            io.to(room.id).emit('msg', `Restart vote: ${room.votes}/${Math.ceil(totalPlayers * 0.5)} needed.`);
        }
    });

    socket.on('disconnect', () => {
        let room = rooms[socket.roomId];
        if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) {
                delete rooms[socket.roomId];
            } else {
                io.to(room.id).emit('lobbyUpdate', room);
                checkAllDead(room);
            }
        }
    });
});

function checkAllDead(room) {
    if (room.status !== 'PLAYING') return;
    let allDead = Object.values(room.players).every(p => p.dead);
    if (allDead) {
        room.status = 'VOTING';
        io.to(room.id).emit('allDead');
    }
}

function resetRoom(room) {
    room.status = 'LOBBY';
    room.votes = 0;
    room.train = {
        distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED',
        fuel: 1003, maxFuel: 1003, buttonCooldown: 0, departureTimer: 0,
        speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0,
        nextTownDist: Math.random() * (497 - 274) + 274,
        inTown: false, townWarningSent: false
    };
    room.enemies = []; room.ores = []; room.projectiles = []; room.bombs =[]; room.horses =[]; room.barrels = [];
    room.avalancheRocks =[]; room.shopNPC = null;
    
    for (let id in room.players) {
        let p = room.players[id];
        p.hp = 120; p.dead = false; p.money = 0; p.bullets = 32; p.mag = 5;
        p.bombs = 0; p.hasClothes = false; p.hasKnife = false; p.regen = 0;
        p.inventory = { gold: 0, silver: 0, coal: 0, beerBottles: 0, beerBarrels: 0 };
        p.drunk = { sips: 0, timer: 0, damageTimer: 0 }; p.drinkCooldown = 0;
        p.coldMeter = 167; p.onTrain = true; p.onHorse = false;
        p.x = 200; p.y = 0; p.voted = false; p.spectatingId = null;
    }
    io.to(room.id).emit('lobbyUpdate', room);
}
socket.on('move', (data) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead) return;
        
        // Drunk speed boost (11%)
        let speedMult = (p.drunk.sips >= 3) ? 1.11 : 1;
        let speed = (p.onHorse ? 162 : 150) * speedMult;
        
        p.x += data.dx * speed * 0.033;
        p.y += data.dy * speed * 0.033;

        let onTrain = (p.x >= -400 && p.x <= 280 && p.y >= -50 && p.y <= 50);
        p.onTrain = onTrain;

        if (!onTrain && (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING' || room.train.state === 'SLOWING')) {
            p.dead = true; p.hp = 0;
            io.to(room.id).emit('msg', `${p.name} exploded by leaving the moving train!`);
            checkAllDead(room);
        }
    });

    socket.on('aim', (angle) => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].aimAngle = angle;
    });

    socket.on('placeBarrel', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.inventory.beerBarrels <= 0 || !p.onTrain) return;

        p.inventory.beerBarrels--;
        room.barrels.push({ id: Math.random().toString(), x: p.x, y: p.y, sipsLeft: 67 });
        io.to(room.id).emit('msg', `${p.name} placed a Beer Barrel!`);
    });

    socket.on('interact', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead) return;

        // 1. Mount Horse
        for (let i = 0; i < room.horses.length; i++) {
            if (Math.hypot(p.x - room.horses[i].x, p.y - room.horses[i].y) < 40) {
                p.onHorse = true;
                room.horses.splice(i, 1);
                return;
            }
        }

        // 2. Train Start/Stop Button (Engine: x: 240, y: 0)
        if (Math.hypot(p.x - 240, p.y - 0) < 40) {
            if (room.train.state === 'STOPPED' && room.train.buttonCooldown <= 0 && room.train.fuel > 0) {
                room.train.state = 'DEPARTING';
                room.train.departureTimer = 8.0;
                room.shop.active = false;
                room.shopNPC = null;
                io.to(room.id).emit('msg', `TRAIN DEPARTING IN 8 SECONDS! GET ON BOARD!`);
            } else if (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING') {
                room.train.state = 'SLOWING';
            }
            return;
        }

        // 3. Coal Dump Cart (Coal Car: x: 60, y: 0)
        if (Math.hypot(p.x - 60, p.y - 0) < 40) {
            if (p.inventory.coal > 0) {
                let fuelAdded = p.inventory.coal * 50;
                room.train.fuel = Math.min(room.train.maxFuel, room.train.fuel + fuelAdded);
                io.to(room.id).emit('msg', `${p.name} added ${fuelAdded} fuel!`);
                p.inventory.coal = 0;
            }
            return;
        }

        // 4. Shop NPC
        if (room.shopNPC && Math.hypot(p.x - room.shopNPC.x, p.y - room.shopNPC.y) < 50) {
            let earned = (p.inventory.gold * 5) + (p.inventory.silver * 3);
            if (earned > 0) {
                p.money += earned;
                p.inventory.gold = 0;
                p.inventory.silver = 0;
                socket.emit('msg', `Sold ores for $${earned}!`);
            }
            socket.emit('openShop');
            return;
        }

        // 5. Beer Barrels (Drink or Refill)
        for (let i = 0; i < room.barrels.length; i++) {
            let b = room.barrels[i];
            if (Math.hypot(p.x - b.x, p.y - b.y) < 40) {
                if (p.inventory.beerBottles > 0 && b.sipsLeft < 67) {
                    // Refill
                    p.inventory.beerBottles--;
                    b.sipsLeft = Math.min(67, b.sipsLeft + Math.ceil(67 * 0.08)); // ~5.36 sips per bottle
                    socket.emit('msg', `Refilled barrel! (${b.sipsLeft}/67)`);
                } else if (b.sipsLeft > 0 && p.drinkCooldown <= 0) {
                    // Drink
                    b.sipsLeft--;
                    p.drunk.sips++;
                    p.drunk.timer += 32;
                    p.drinkCooldown = 1.0;
                    socket.emit('msg', `*Gulp* (${b.sipsLeft} sips left)`);
                    
                    if (p.drunk.sips >= 11) {
                        p.dead = true; p.hp = 0;
                        io.to(room.id).emit('msg', `${p.name} drank too much and exploded!`);
                        checkAllDead(room);
                    }
                }
                return;
            }
        }
    });

    socket.on('mine', (oreId) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || room.train.state !== 'STOPPED') return;
        
        let oreIndex = room.ores.findIndex(o => o.id === oreId);
        if (oreIndex !== -1) {
            let ore = room.ores[oreIndex];
            if (Math.hypot(p.x - ore.x, p.y - ore.y) < 60) {
                ore.hits--;
                if (ore.hits <= 0) {
                    p.inventory[ore.type] += ore.maxHits;
                    room.ores.splice(oreIndex, 1);
                }
            }
        }
    });

    socket.on('shoot', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.mag <= 0) return;
        
        p.mag--;
        let dmg = (p.drunk.sips >= 3) ? 30 * 1.2 : 30; // 20% more damage if drunk
        room.projectiles.push({
            id: Math.random().toString(), x: p.x, y: p.y,
            vx: Math.cos(p.aimAngle) * 400, vy: Math.sin(p.aimAngle) * 400,
            isPlayer: true, owner: socket.id, dmg: dmg
        });
    });

    socket.on('reload', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.mag >= 5 || p.bullets <= 0) return;

        let bulletsNeeded = 5 - p.mag;
        let bulletsToLoad = Math.min(bulletsNeeded, p.bullets);
        p.mag += bulletsToLoad;
        p.bullets -= bulletsToLoad;
    });

    socket.on('throwBomb', (target) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.bombs <= 0) return;
        p.bombs--;
        room.bombs.push({ x: target.x, y: target.y, timer: 1.5, isPlayer: true });
    });

    socket.on('stab', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || !p.hasKnife) return;
        
        let dmg = (p.drunk.sips >= 3) ? 56 * 1.2 : 56; // 20% more damage if drunk
        for (let i = room.enemies.length - 1; i >= 0; i--) {
            let e = room.enemies[i];
            if (Math.hypot(p.x - e.x, p.y - e.y) < 50) {
                e.hp -= dmg;
                if (e.hp <= 0) {
                    if (e.hasHorse) room.horses.push({ x: e.x, y: e.y });
                    room.enemies.splice(i, 1);
                }
            }
        }
    });

    socket.on('buy', (itemId) => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || !room.shop.active) return;
        
        let item = room.shop.items.find(i => i.id === itemId);
        if (item && p.money >= item.cost) {
            if (item.stock !== undefined && item.stock <= 0) return;
            p.money -= item.cost;
            if (item.stock !== undefined) item.stock--;

            if (itemId === 'fuel' && room.train.fuelUpgrades < 4) {
                room.train.maxFuel += 200;
                room.train.fuelUpgrades++;
                generateShop(room);
            }
            if (itemId.startsWith('regen')) p.regen = Math.max(p.regen, item.val);
            if (itemId === 'bomb') p.bombs++;
            if (itemId === 'bandage') p.hp = Math.min(p.maxHp, p.hp + 50);
            if (itemId === 'clothes') p.hasClothes = true;
            if (itemId === 'knife') p.hasKnife = true;
            if (itemId === 'ammo') p.bullets += 6;
            if (itemId === 'beer_bottle') p.inventory.beerBottles++;
            if (itemId === 'beer_barrel') p.inventory.beerBarrels++;
            if (itemId === 'speed') {
                room.train.speedMultiplier = 1.11;
                room.train.speedUpgraded = true;
                generateShop(room);
            }
        }
    });

    socket.on('spectateNext', () => {
        let room = rooms[socket.roomId];
        if (!room) return;
        let p = room.players[socket.id];
        if (!p || !p.dead) return;

        let alivePlayers = Object.values(room.players).filter(pl => !pl.dead);
        if (alivePlayers.length === 0) return;

        let currentIndex = alivePlayers.findIndex(pl => pl.id === p.spectatingId);
        let nextIndex = (currentIndex + 1) % alivePlayers.length;
        p.spectatingId = alivePlayers[nextIndex].id;
    });

    socket.on('voteRestart', () => {
        let room = rooms[socket.roomId];
        if (!room) return;
        let p = room.players[socket.id];
        if (!p || !p.dead || p.voted) return;

        p.voted = true;
        room.votes++;
        
        let totalPlayers = Object.keys(room.players).length;
        // Fixed: Now requires 50% of players to vote yes
        if (room.votes >= Math.ceil(totalPlayers * 0.5)) {
            io.to(room.id).emit('msg', 'Vote passed! Restarting lobby...');
            setTimeout(() => resetRoom(room), 3000);
        } else {
            io.to(room.id).emit('msg', `Restart vote: ${room.votes}/${Math.ceil(totalPlayers * 0.5)} needed.`);
        }
    });

    socket.on('disconnect', () => {
        let room = rooms[socket.roomId];
        if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) {
                delete rooms[socket.roomId];
            } else {
                io.to(room.id).emit('lobbyUpdate', room);
                checkAllDead(room);
            }
        }
    });
});

function checkAllDead(room) {
    if (room.status !== 'PLAYING') return;
    let allDead = Object.values(room.players).every(p => p.dead);
    if (allDead) {
        room.status = 'VOTING';
        io.to(room.id).emit('allDead');
    }
}

function resetRoom(room) {
    room.status = 'LOBBY';
    room.votes = 0;
    room.train = {
        distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED',
        fuel: 1003, maxFuel: 1003, buttonCooldown: 0, departureTimer: 0,
        speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0,
        nextTownDist: Math.random() * (497 - 274) + 274,
        inTown: false, townWarningSent: false
    };
    room.enemies = []; room.ores = []; room.projectiles = []; room.bombs =[]; room.horses =[]; room.barrels = [];
    room.avalancheRocks =[]; room.shopNPC = null;
    
    for (let id in room.players) {
        let p = room.players[id];
        p.hp = 120; p.dead = false; p.money = 0; p.bullets = 32; p.mag = 5;
        p.bombs = 0; p.hasClothes = false; p.hasKnife = false; p.regen = 0;
        p.inventory = { gold: 0, silver: 0, coal: 0, beerBottles: 0, beerBarrels: 0 };
        p.drunk = { sips: 0, timer: 0, damageTimer: 0 }; p.drinkCooldown = 0;
        p.coldMeter = 167; p.onTrain = true; p.onHorse = false;
        p.x = 200; p.y = 0; p.voted = false; p.spectatingId = null;
    }
    io.to(room.id).emit('lobbyUpdate', room);
}
