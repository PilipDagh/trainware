const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PLAYER_COLORS = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#e377c2'];
const rooms = {};

const BIOMES = [
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
        players: {}, enemies: [], ores: [], projectiles: [], bombs: [], horses: [], barrels: [],
        train: {
            distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED', 
            fuel: 1003, maxFuel: 1003, buttonCooldown: 0, departureTimer: 0,
            speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0,
            nextTownDist: Math.random() * (497 - 274) + 274,
            inTown: false, townWarningSent: false
        },
        townX: null, biome: 'forest', inMountains: false,
        mountainStart: Math.random() * (200 - 50) + 50, mountainEnd: 0,
        avalanche: { active: false, timer: 0 }, avalancheRocks: [],
        raidTimer: 0, raidActive: false, avalancheTimer: 0,
        shop: { active: false, items: [] }, shopNPC: null, votes: 0
    };
}

function spawnOres(room) {
    room.ores = [];
    for (let i = 0; i < 25; i++) {
        let rand = Math.random();
        let type = rand < 0.1 ? 'gold' : (rand < 0.3 ? 'silver' : 'coal');
        let hits = type === 'gold' ? Math.floor(Math.random() * 6) + 4 : (type === 'silver' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 3) + 2);
        let x, y;
        do {
            x = (Math.random() - 0.5) * 1400;
            y = (Math.random() - 0.5) * 1000;
        } while (x >= -400 && x <= 280 && y >= -50 && y <= 50); 
        room.ores.push({ id: Math.random().toString(), type, x, y, hits, maxHits: hits });
    }
}

function spawnEnemies(room, isTown, isRaid = false) {
    // Max 3 groups per stop, smaller sizes, highly spread out
    let groups = isTown ? Math.floor(Math.random() * 2) + 1 : 1; 
    if (isRaid) groups = 1;

    for (let g = 0; g < groups; g++) {
        let baseX = room.townX !== null ? room.townX + (Math.random() > 0.5 ? 300 : -300) : (Math.random() > 0.5 ? 600 : -600);
        let baseY = (Math.random() - 0.5) * 600;

        // Smaller groups: 1 gunman, 1 knifeman, rare bombman
        createEnemy(room, 'gunman', baseX, baseY, isRaid);
        createEnemy(room, 'knifeman', baseX, baseY, isRaid);
        if (Math.random() < 0.15) {
            createEnemy(room, 'bombman', baseX, baseY, isRaid);
        }
    }
}

function createEnemy(room, type, x, y, isRaid) {
    room.enemies.push({
        id: Math.random().toString(), type, isRaid,
        // Highly spread out offsets to prevent clumping
        x: x + (Math.random() - 0.5) * 300, 
        y: y + (Math.random() - 0.5) * 300,
        hp: type === 'gunman' ? 30 : 40,
        hasHorse: !isRaid && Math.random() < 0.20, 
        lastShot: 0, aimAngle: 0
    });
}

function generateShop(room) {
    room.shop.active = true;
    room.shop.items = [
        { id: 'bomb', name: 'Bomb', cost: 5, type: 'player' },
        { id: 'bandage', name: 'Bandage (+50 HP)', cost: 2, type: 'player' },
        { id: 'clothes', name: 'Warm Clothes', cost: 11, type: 'player' },
        { id: 'knife', name: 'Knife (56 DMG)', cost: 5, type: 'player' },
        { id: 'ammo', name: 'Ammo Pack (+6)', cost: 4, type: 'player', stock: 3 },
        { id: 'beer_bottle', name: 'Beer Bottle', cost: 3, type: 'player', stock: 4 },
        { id: 'beer_barrel', name: 'Beer Barrel', cost: 11, type: 'player', stock: 2 }
    ];
    if (room.train.fuelUpgrades < 4) room.shop.items.push({ id: 'fuel', name: `Fuel Tank (+200)[Lvl ${room.train.fuelUpgrades+1}/4]`, cost: 7, type: 'global' });
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
            inventory: { gold: 0, silver: 0, coal: 0, beerBottles: 0, beerBarrels: 0 },
            drunk: { sips: 0, timer: 0, damageTimer: 0 }, drinkCooldown: 0,
            coldMeter: 167, dead: false, onTrain: true, onHorse: false, aimAngle: 0,
            spectatingId: null, voted: false, settings: { hasAutoLock: false }
        };
        io.to(data.roomId).emit('lobbyUpdate', room);
    });

    socket.on('updateSettings', (settings) => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].settings = settings;
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
        
        let speedMult = (p.drunk.sips >= 3) ? 1.11 : 1;
        let speed = (p.onHorse ? 162 : 150) * speedMult;
        
        p.x += data.dx * speed * 0.033;
        p.y += data.dy * speed * 0.033;

        // DELAYED TRAIN BARRIER: Only active when actually moving, NOT during departure
        let isMoving =['ACCELERATING', 'MOVING', 'SLOWING'].includes(room.train.state);
        if (isMoving) {
            p.x = Math.max(-400, Math.min(280, p.x));
            p.y = Math.max(-50, Math.min(50, p.y));
        }
        p.onTrain = (p.x >= -400 && p.x <= 280 && p.y >= -50 && p.y <= 50);
    });

    socket.on('aim', (angle) => {
        let room = rooms[socket.roomId];
        if (room && room.players[socket.id]) room.players[socket.id].aimAngle = angle;
    });

    socket.on('shoot', () => {
        let room = rooms[socket.roomId];
        if (!room || room.status !== 'PLAYING') return;
        let p = room.players[socket.id];
        if (!p || p.dead || p.mag <= 0) return;
        
        p.mag--;
        let dmg = (p.drunk.sips >= 3) ? 30 * 1.2 : 30;
        
        let targetId = null;
        if (p.settings.hasAutoLock) {
            let closestDist = 600;
            room.enemies.forEach(e => {
                let d = Math.hypot(p.x - e.x, p.y - e.y);
                if (d < closestDist) { closestDist = d; targetId = e.id; }
            });
        }

        room.projectiles.push({
            id: Math.random().toString(), x: p.x, y: p.y,
            vx: Math.cos(p.aimAngle) * 450, vy: Math.sin(p.aimAngle) * 450,
            isPlayer: true, owner: socket.id, dmg: dmg, targetId: targetId
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
        
        let oreIndex = room.ores.findIndex(o => o.id === oreId);
        if (oreIndex !== -1) {
            let ore = room.ores[oreIndex];
            if (Math.hypot(p.x - ore.x, p.y - ore.y) < 100) { 
                ore.hits--;
                if (ore.hits <= 0) {
                    p.inventory[ore.type] += ore.maxHits;
                    room.ores.splice(oreIndex, 1);
                }
            }
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

        if (Math.hypot(p.x - 240, p.y - 0) < 40) {
            if (room.train.state === 'STOPPED' && room.train.buttonCooldown <= 0 && room.train.fuel > 0) {
                room.train.state = 'DEPARTING';
                room.train.departureTimer = 8.0;
                room.shop.active = false; room.shopNPC = null;
                io.to(room.id).emit('msg', `TRAIN DEPARTING IN 8 SECONDS!`);
            } else if (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING') {
                room.train.state = 'SLOWING';
            }
            return;
        }

        if (Math.hypot(p.x - 60, p.y - 0) < 40) {
            if (p.inventory.coal > 0) {
                let fuelAdded = p.inventory.coal * 50;
                room.train.fuel = Math.min(room.train.maxFuel, room.train.fuel + fuelAdded);
                p.inventory.coal = 0;
                io.to(room.id).emit('msg', `${p.name} refueled the train!`);
            }
            return;
        }

        if (room.shopNPC && Math.hypot(p.x - room.shopNPC.x, p.y - room.shopNPC.y) < 60) {
            let earned = (p.inventory.gold * 5) + (p.inventory.silver * 3);
            if (earned > 0) { p.money += earned; p.inventory.gold = 0; p.inventory.silver = 0; }
            socket.emit('openShop');
            return;
        }

        for (let b of room.barrels) {
            if (Math.hypot(p.x - b.x, p.y - b.y) < 40) {
                if (p.inventory.beerBottles > 0 && b.sipsLeft < 67) {
                    p.inventory.beerBottles--;
                    b.sipsLeft = Math.min(67, b.sipsLeft + 8); 
                } else if (b.sipsLeft > 0 && p.drinkCooldown <= 0) {
                    b.sipsLeft--; p.drunk.sips++; p.drunk.timer += 32; p.drinkCooldown = 1.0;
                    if (p.drunk.sips >= 11) {
                        p.dead = true; p.hp = 0;
                        io.to(room.id).emit('msg', `${p.name} exploded from too much beer!`);
                        checkAllDead(room);
                    }
                }
                return;
            }
        }
    });

    socket.on('placeBarrel', () => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || p.inventory.beerBarrels <= 0 || !p.onTrain) return;
        p.inventory.beerBarrels--;
        room.barrels.push({ id: Math.random().toString(), x: p.x, y: p.y, sipsLeft: 67 });
    });

    socket.on('throwBomb', (target) => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || p.bombs <= 0) return;
        p.bombs--;
        room.bombs.push({ x: target.x, y: target.y, timer: 1.5, isPlayer: true });
    });

    socket.on('stab', () => {
        let room = rooms[socket.roomId];
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || !p.hasKnife) return;
        let dmg = (p.drunk.sips >= 3) ? 56 * 1.2 : 56;
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
        if (!room || !room.players[socket.id]) return;
        let p = room.players[socket.id];
        if (p.dead || !room.shop.active) return;
        let item = room.shop.items.find(i => i.id === itemId);
        if (item && p.money >= item.cost) {
            if (item.stock !== undefined && item.stock <= 0) return;
            p.money -= item.cost;
            if (item.stock !== undefined) item.stock--;

            if (itemId === 'fuel' && room.train.fuelUpgrades < 4) { room.train.maxFuel += 200; room.train.fuelUpgrades++; generateShop(room); }
            if (itemId.startsWith('regen')) p.regen = Math.max(p.regen, item.val);
            if (itemId === 'bomb') p.bombs++;
            if (itemId === 'bandage') p.hp = Math.min(p.maxHp, p.hp + 50);
            if (itemId === 'clothes') p.hasClothes = true;
            if (itemId === 'knife') p.hasKnife = true;
            if (itemId === 'ammo') p.bullets += 6;
            if (itemId === 'beer_bottle') p.inventory.beerBottles++;
            if (itemId === 'beer_barrel') p.inventory.beerBarrels++;
            if (itemId === 'speed') { room.train.speedMultiplier = 1.11; room.train.speedUpgraded = true; generateShop(room); }
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
        
        // FIXED VOTE RESTART LOGIC (50%)
        let total = Object.keys(room.players).length;
        if (room.votes >= Math.ceil(total * 0.5)) { 
            io.to(room.id).emit('msg', 'Vote passed! Restarting...');
            setTimeout(() => resetRoom(room), 2000);
        } else {
            io.to(room.id).emit('msg', `Restart vote: ${room.votes}/${Math.ceil(total * 0.5)} needed.`);
        }
    });

    socket.on('disconnect', () => {
        let room = rooms[socket.roomId];
        if (room) {
            delete room.players[socket.id];
            if (Object.keys(room.players).length === 0) delete rooms[socket.roomId];
            else checkAllDead(room);
        }
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
    room.train = { distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED', fuel: 1003, maxFuel: 1003, buttonCooldown: 0, departureTimer: 0, speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0, nextTownDist: Math.random() * (497 - 274) + 274, inTown: false, townWarningSent: false };
    room.enemies = []; room.ores = []; room.projectiles =[]; room.bombs =[]; room.horses =[]; room.barrels = []; room.avalancheRocks =[]; room.shopNPC = null; room.townX = null;
    for (let id in room.players) {
        let p = room.players[id];
        p.hp = 120; p.dead = false; p.money = 0; p.bullets = 32; p.mag = 5; p.bombs = 0; p.hasClothes = false; p.hasKnife = false; p.regen = 0;
        p.inventory = { gold: 0, silver: 0, coal: 0, beerBottles: 0, beerBarrels: 0 };
        p.drunk = { sips: 0, timer: 0, damageTimer: 0 }; p.drinkCooldown = 0; p.coldMeter = 167; p.onTrain = true; p.onHorse = false; p.x = 200; p.y = 0; p.voted = false; p.spectatingId = null;
    }
    io.to(room.id).emit('lobbyUpdate', room);
}
// Master Game Loop (30 FPS)
setInterval(() => {
    let dt = 1 / 30;

    for (let roomId in rooms) {
        let room = rooms[roomId];
        if (room.status !== 'PLAYING') continue;

        let dx = 0; 

        // --- Train Physics & State Machine ---
        if (room.train.state === 'DEPARTING') {
            room.train.departureTimer -= dt;
            if (room.train.departureTimer <= 0) {
                room.train.state = 'ACCELERATING';
                // KILL PLAYERS LEFT BEHIND
                for (let id in room.players) {
                    let p = room.players[id];
                    if (!p.onTrain && !p.dead) {
                        p.dead = true; p.hp = 0;
                        io.to(room.id).emit('msg', `${p.name} was left behind and exploded!`);
                    }
                }
                checkAllDead(room);

                let enemiesKilled = false;
                room.enemies = room.enemies.filter(e => {
                    let onTrain = (e.x >= -400 && e.x <= 280 && e.y >= -50 && e.y <= 50);
                    if (!onTrain) enemiesKilled = true;
                    return onTrain;
                });
                if (enemiesKilled) io.to(room.id).emit('msg', 'Enemies left behind were obliterated!');
            }
        } else if (room.train.state === 'ACCELERATING') {
            room.train.speed += (room.train.maxSpeed / 8) * dt;
            room.avalancheRocks =[]; 
            if (room.train.speed >= room.train.maxSpeed) room.train.state = 'MOVING';
        } else if (room.train.state === 'SLOWING') {
            room.train.speed -= (room.train.maxSpeed / 4) * dt;
            if (room.train.speed <= 0) {
                room.train.speed = 0;
                room.train.state = 'STOPPED';
                room.train.buttonCooldown = 3;
                
                // NEW: 37% CHANCE FOR A TOWN TO SPAWN WHEN STOPPED
                if (Math.random() < 0.37) {
                    room.train.inTown = true;
                    generateShop(room);
                    room.townX = 0; 
                    room.shopNPC = { x: 0, y: 150 }; 
                    spawnEnemies(room, true);
                    io.to(room.id).emit('msg', 'Arrived at a town! Visit the NPC outside to sell ores and buy items.');
                } else {
                    room.train.inTown = false;
                    room.townX = null;
                    spawnOres(room);
                    spawnEnemies(room, false);
                    io.to(room.id).emit('msg', 'Stopped in the wilderness. Mine some ores!');
                }
            }
        }

        if (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING' || room.train.state === 'SLOWING') {
            let speedMps = (room.train.speed * room.train.speedMultiplier) * 0.277;
            dx = speedMps * 15 * dt; 
            room.train.distance += (room.train.speed * room.train.speedMultiplier * 0.1) * dt;
            room.train.fuel -= 17 * dt;
            if (room.train.fuel <= 0) { room.train.fuel = 0; room.train.state = 'SLOWING'; }

            room.ores.forEach(o => o.x -= dx);
            room.enemies.forEach(e => e.x -= dx);
            room.horses.forEach(h => h.x -= dx);
            room.avalancheRocks.forEach(r => r.x -= dx);
            if (room.shopNPC) room.shopNPC.x -= dx;
            if (room.townX !== null) room.townX -= dx;
        }

        if (room.train.buttonCooldown > 0) room.train.buttonCooldown -= dt;
        room.biome = getBiome(room.train.distance);

        for (let i = room.projectiles.length - 1; i >= 0; i--) {
            let proj = room.projectiles[i];
            if (proj.isPlayer && proj.targetId) {
                let target = room.enemies.find(e => e.id === proj.targetId);
                if (target) {
                    let angle = Math.atan2(target.y - proj.y, target.x - proj.x);
                    proj.vx = Math.cos(angle) * 450; proj.vy = Math.sin(angle) * 450;
                }
            }
            proj.x += proj.vx * dt - dx; 
            proj.y += proj.vy * dt;

            let hit = false;
            if (proj.isPlayer) {
                for (let j = room.enemies.length - 1; j >= 0; j--) {
                    let e = room.enemies[j];
                    if (Math.hypot(proj.x - e.x, proj.y - e.y) < 25) {
                        e.hp -= proj.dmg || 10;
                        if (e.hp <= 0) {
                            if (e.hasHorse) room.horses.push({ x: e.x, y: e.y });
                            room.enemies.splice(j, 1);
                        }
                        hit = true; break;
                    }
                }
            } else {
                for (let id in room.players) {
                    let p = room.players[id];
                    if (!p.dead && Math.hypot(proj.x - p.x, proj.y - p.y) < 20) {
                        p.hp -= proj.dmg;
                        if (p.hp <= 0) { p.dead = true; checkAllDead(room); }
                        hit = true; break;
                    }
                }
            }
            if (hit || Math.abs(proj.x) > 2500 || Math.abs(proj.y) > 2500) room.projectiles.splice(i, 1);
        }

        room.enemies.forEach(e => {
            let target = null; let minDist = Infinity;
            for (let id in room.players) {
                let p = room.players[id];
                if (p.dead) continue;
                let d = Math.hypot(p.x - e.x, p.y - e.y);
                if (d < minDist) { minDist = d; target = p; }
            }
            if (target) {
                let speed = e.hasHorse ? 65 : 60;
                if (minDist > 40) {
                    e.x += (target.x - e.x) / minDist * speed * dt;
                    e.y += (target.y - e.y) / minDist * speed * dt;
                }
                e.aimAngle = Math.atan2(target.y - e.y, target.x - e.x);
                e.lastShot += dt;
                if (e.type === 'gunman' && minDist < 400 && e.lastShot > 2.5) {
                    e.lastShot = 0;
                    room.projectiles.push({
                        id: Math.random().toString(), x: e.x, y: e.y,
                        vx: Math.cos(e.aimAngle) * 300, vy: Math.sin(e.aimAngle) * 300,
                        isPlayer: false, dmg: 15 // NERFED ENEMY DAMAGE
                    });
                } else if (e.type === 'knifeman' && minDist < 45 && e.lastShot > 1.2) {
                    e.lastShot = 0; target.hp -= 10; // NERFED ENEMY DAMAGE
                    if (target.hp <= 0) { target.dead = true; checkAllDead(room); }
                } else if (e.type === 'bombman' && minDist < 250 && e.lastShot > 3) {
                    e.lastShot = 0;
                    room.bombs.push({ x: target.x, y: target.y, timer: 1.5, isPlayer: false });
                }
            }
        });

        for (let id in room.players) {
            let p = room.players[id];
            if (p.dead) continue;
            if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);
            if (p.drinkCooldown > 0) p.drinkCooldown -= dt;
            if (p.drunk.sips >= 3) {
                p.drunk.timer -= dt; p.drunk.damageTimer += dt;
                if (p.drunk.damageTimer >= 19) { 
                    p.drunk.damageTimer = 0; p.hp -= 11; 
                    if (p.hp <= 0) { p.dead = true; io.to(room.id).emit('msg', `${p.name} died from alcohol poisoning!`); checkAllDead(room); } 
                }
                if (p.drunk.timer <= 0) { p.drunk.sips = 0; io.to(room.id).emit('msg', `${p.name} sobered up.`); }
            }
            if (room.biome === 'tundra') {
                if (p.onTrain) p.coldMeter = Math.min(167, p.coldMeter + 5 * dt);
                else if (!p.hasClothes) { p.coldMeter -= 2.8 * dt; if (p.coldMeter <= 0) { p.dead = true; p.hp = 0; io.to(room.id).emit('msg', `${p.name} froze to death!`); checkAllDead(room); } }
            } else { p.coldMeter = 167; }
        }

        for (let i = room.bombs.length - 1; i >= 0; i--) {
            let b = room.bombs[i];
            b.x -= dx; 
            b.timer -= dt;
            if (b.timer <= 0) {
                if (b.isPlayer) {
                    for (let j = room.enemies.length - 1; j >= 0; j--) {
                        if (Math.hypot(b.x - room.enemies[j].x, b.y - room.enemies[j].y) < 80) {
                            if (room.enemies[j].hasHorse) room.horses.push({ x: room.enemies[j].x, y: room.enemies[j].y });
                            room.enemies.splice(j, 1);
                        }
                    }
                } else {
                    for (let id in room.players) {
                        let p = room.players[id];
                        if (!p.dead && Math.hypot(b.x - p.x, b.y - p.y) < 80) {
                            p.hp -= 30; // NERFED BOMB DAMAGE
                            if (p.hp <= 0) { p.dead = true; checkAllDead(room); }
                        }
                    }
                }
                room.bombs.splice(i, 1);
            }
        }

        room.raidTimer += dt;
        if (room.raidTimer >= 20 && Math.random() < 0.1) {
            room.raidTimer = 0; io.to(room.id).emit('msg', 'TRAIN RAID!'); spawnEnemies(room, false, true);
        }

        if (room.inMountains && room.train.state !== 'STOPPED') {
            room.avalancheTimer += dt;
            if (room.avalancheTimer >= 8 && Math.random() < 0.03) {
                room.avalanche.active = true; room.avalanche.timer = 0.8;
                io.to(room.id).emit('msg', 'AVALANCHE WARNING!');
            }
        }
        if (room.avalanche.active) {
            room.avalanche.timer -= dt;
            if (room.train.state === 'STOPPED') room.avalanche.active = false;
            else if (room.avalanche.timer <= 0) {
                room.avalanche.active = false; room.train.state = 'STOPPED'; room.train.speed = 0;
                for (let i=0; i<20; i++) room.avalancheRocks.push({ x: (Math.random()-0.5)*800, y: (Math.random()-0.5)*300, size: Math.random()*30+20 });
                for (let id in room.players) { room.players[id].hp -= 50; if (room.players[id].hp <= 0) room.players[id].dead = true; }
                io.to(room.id).emit('msg', 'Avalanche hit the train!');
                checkAllDead(room);
            }
        }

        io.to(room.id).emit('state', room);
        if (room.train.distance >= 3181) { room.status = 'VOTING'; io.to(room.id).emit('victory'); }
    }
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
