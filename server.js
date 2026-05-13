// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;

// === CONSTANTS & CONFIG ===
const TICK_RATE = 30; // 30Hz server tick
const DT = 1 / TICK_RATE;
const MAX_DISTANCE = 3181;
const FUEL_MAX = 1003;
const FUEL_BURN_RATE = 17;
const TRAIN_MAX_SPEED = 35;
const ACCEL_RATE = 35 / 8; // 8 seconds to 35 km/h
const DISTANCE_SCALAR = 0.1; // Magic scalar to map speed to km progression
const WORLD_PIXEL_MULTIPLIER = 12; // Maps speed to pixel scrolling
const MAX_STORAGE_CARS = 6;
const COAL_FUEL_VALUE = 25; 
const ROLES = ['Conductor', 'Sharpshooter', 'Engineer', 'Prospector', 'Medic', 'Trapper', 'Soldier', 'Blacksmith', 'Stoker', 'Traitor'];

// === GAME STATE ===
const lobbies = {};

function createRoom(roomId) {
    return {
        id: roomId,
        status: 'lobby',
        players: {},
        entities: [],
        projectiles:[],
        stats: { kills: {}, sips: {}, coalMined: {} },
        train: {
            speed: 0,
            targetSpeed: 0,
            distance: 0,
            fuel: FUEL_MAX,
            maxFuel: FUEL_MAX,
            isStopHandled: false,
            buttonCooldown: 0,
            departureCountdown: 0,
            speedMult: 1,
            pressure: 100,
            fogActive: false,
            storageCars: 0,
            storage: { gold: 0, silver: 0, coal: 0, capacity: 99 },
            whistleActive: false
        },
        world: {
            biome: 'forest',
            nextTownDist: Math.random() * (497 - 274) + 274,
            townCount: 0,
            isInTown: false,
            avalancheTimer: 0,
            avalancheActive: false,
            avalancheHitTimer: 0,
            raidTimer: 0,
            tunnelActive: false,
            tunnelTimer: 0,
            tunnelEndDist: 0,
            mailHookActive: false
        },
        votesToRestart: new Set()
    };
}

// === UTILITIES ===
const getBiome = (dist) => {
    if (dist < 974) return 'forest';
    if (dist < 1521) return 'desert';
    if (dist < 1908) return 'tundra';
    if (dist < 2455) return 'desert';
    return 'forest';
};

const getDistance = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const generateId = () => Math.random().toString(36).substring(2, 9);

function checkTrainBounds(x, y, numStorage) {
    // Train goes from Engine (-100 to 100) to Caboose (1100 to 1300) + Storage (each 200px)
    const trainEnd = 1300 + (numStorage * 200);
    return (x >= -100 && x <= trainEnd && y >= -60 && y <= 60);
}

// === ENTITY GENERATORS ===
function spawnWildernessStop(room) {
    room.entities = room.entities.filter(e => e.type === 'rock'); // Keep avalanche rocks
    room.world.isInTown = false;

    // Spawn 6-9 Ore Nodes
    const oreCount = Math.floor(Math.random() * 4) + 6;
    const oreTypes = ['gold', 'silver', 'coal'];
    for (let i = 0; i < oreCount; i++) {
        let type = oreTypes[Math.floor(Math.random() * oreTypes.length)];
        let hits = type === 'gold' ? Math.floor(Math.random()*6)+4 : (type === 'silver' ? Math.floor(Math.random()*4)+2 : Math.floor(Math.random()*3)+2);
        room.entities.push({
            id: generateId(), type: 'ore', oreType: type, x: Math.random() * 1400 - 100, y: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 200 + 80), hp: hits, maxHp: hits
        });
    }

    // Crates
    for (let i = 0; i < 3; i++) {
        room.entities.push({ id: generateId(), type: 'crate', x: Math.random() * 1400 - 100, y: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 150 + 70), hp: 1 });
    }

    // Animals
    for (let i = 0; i < 4; i++) {
        room.entities.push({ id: generateId(), type: 'animal', ai: 'wander', x: Math.random() * 1400 - 100, y: Math.random() * 400 - 200, hp: 30 });
    }

    // Desert Specifics
    if (room.world.biome === 'desert') {
        for (let i = 0; i < 5; i++) { // Snakes
            room.entities.push({ id: generateId(), type: 'snake', state: 'flee', x: Math.random() * 1400 - 100, y: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 100 + 80), hp: 20 });
        }
    }
}

function spawnTown(room) {
    room.entities =[];
    room.world.isInTown = true;
    room.entities.push({ id: generateId(), type: 'shop', x: 600, y: -120 });
    
    if (room.world.townCount % 3 === 0) {
        for (let i = 0; i < 3; i++) {
            room.entities.push({ id: generateId(), type: 'marshal', x: 400 + i * 100, y: -150, hp: 331, maxHp: 331 });
        }
    }
}

function spawnRaid(room) {
    for (let i = 0; i < 4; i++) {
        room.entities.push({ id: generateId(), type: 'enemy', x: Math.random() * 1000, y: 0, hp: 100, isRaid: true });
    }
}

// === GAME LOOP ===
setInterval(() => {
    for (let roomId in lobbies) {
        const room = lobbies[roomId];
        if (room.status !== 'playing') continue;

        let livingPlayers = Object.values(room.players).filter(p => p.alive);
        if (livingPlayers.length === 0) {
            room.status = 'gameover';
            io.to(roomId).emit('state', room);
            continue;
        }

        const train = room.train;
        const world = room.world;

        // Role & Upgrade Modifiers
        const hasEngineer = livingPlayers.some(p => p.role === 'Engineer');
        const hasStoker = livingPlayers.some(p => p.role === 'Stoker');
        let currentAccel = hasStoker ? ACCEL_RATE * 1.2 : ACCEL_RATE;
        let fuelBurn = hasEngineer ? FUEL_BURN_RATE * 0.85 : FUEL_BURN_RATE;

        // Train Physics & Fuel
        if (train.speed > 0) {
            train.fuel -= fuelBurn * DT;
            if (train.fuel <= 0) {
                train.fuel = 0;
                train.targetSpeed = 0;
            }
        }

        // Acceleration / Deceleration
        if (train.speed < train.targetSpeed) {
            train.speed = Math.min(train.targetSpeed, train.speed + currentAccel * DT);
        } else if (train.speed > train.targetSpeed) {
            train.speed = Math.max(train.targetSpeed, train.speed - currentAccel * DT);
        }

        // Distance Progress
        let distDelta = train.speed * DISTANCE_SCALAR * DT;
        train.distance += distDelta;
        world.biome = getBiome(train.distance);

        // Victory
        if (train.distance >= MAX_DISTANCE) {
            room.status = 'victory';
            io.to(roomId).emit('victory', room.stats);
            continue;
        }

        // Button Cooldown & Departure
        if (train.buttonCooldown > 0) train.buttonCooldown -= DT;
        if (train.departureCountdown > 0) {
            train.departureCountdown -= DT;
            if (train.departureCountdown <= 0) {
                train.departureCountdown = 0;
                train.targetSpeed = TRAIN_MAX_SPEED * train.speedMult;
                train.isStopHandled = false;
                train.buttonCooldown = 3;
                
                // Teleport outside players to Caboose
                Object.values(room.players).forEach(p => {
                    if (p.alive && !checkTrainBounds(p.x, p.y, train.storageCars)) {
                        p.x = 1200; // Caboose X
                        p.y = 0;
                    }
                });
            }
        }

        // Stop Handled Trigger
        if (train.speed === 0 && train.targetSpeed === 0 && !train.isStopHandled) {
            train.isStopHandled = true;
            if (train.distance >= world.nextTownDist) {
                world.nextTownDist = train.distance + Math.random() * (497 - 274) + 274;
                world.townCount++;
                spawnTown(room);
            } else {
                spawnWildernessStop(room);
            }
        }

        // Scrolling World (Illusion of movement)
        let scrollDx = train.speed * WORLD_PIXEL_MULTIPLIER * DT;
        room.entities.forEach(e => {
            if (e.type !== 'enemy' || !e.isRaid) {
                e.x -= scrollDx;
            }
        });
        
        // Culling out of bounds entities
        room.entities = room.entities.filter(e => e.x > -2000);

        // Pressure Valve Decay & Fog Logic
        train.pressure -= 1.67 * (distDelta / 67);
        if (train.pressure < 0) train.pressure = 0;

        let valveInteractors = livingPlayers.filter(p => p.interactingValve);
        if (valveInteractors.length > 0) {
            train.fogActive = true;
            train.pressure = Math.min(100, train.pressure + (2 / 1.67) * valveInteractors.length * DT);
        } else {
            train.fogActive = false;
        }

        // Player Loops (Health, Mechanics, Movement limits)
        Object.values(room.players).forEach(p => {
            if (!p.alive) return;

            // Health Regen
            if (p.regenRate > 0 && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + p.regenRate * DT);

            // Cold Meter in Tundra
            if (world.biome === 'tundra' && !p.hasWarmClothes) {
                if (!checkTrainBounds(p.x, p.y, train.storageCars)) {
                    p.cold -= 2.8 * DT;
                    if (p.cold <= 0) { p.hp -= 5 * DT; checkDeath(p, room); }
                } else {
                    p.cold = Math.min(167, p.cold + 10 * DT);
                }
            } else {
                p.cold = 167;
            }

            // Beer Debuff
            if (p.sips >= 3) {
                p.beerTimer += DT;
                if (p.beerTimer >= 19) {
                    p.hp -= 11 + Math.floor(p.sips / 3) * 2;
                    p.beerTimer = 0;
                    checkDeath(p, room);
                }
            }

            // Fog Damage
            if (train.fogActive && getDistance(p.x, p.y, 200, 0) < 150) { // Assume valve is at coal car (x:200)
                p.fogTime += DT;
                if (p.fogTime > 4) {
                    p.fogDamageTimer += DT;
                    if (p.fogDamageTimer >= 0.67) {
                        p.hp -= 3;
                        p.fogDamageTimer = 0;
                        checkDeath(p, room);
                    }
                }
            } else {
                p.fogTime = 0;
            }

            // Train Barrier Clamp
            if (train.speed > 0 || train.targetSpeed > 0) {
                if (checkTrainBounds(p.x, p.y, train.storageCars)) {
                    p.x = Math.max(-100, Math.min(1300 + train.storageCars * 200, p.x));
                    p.y = Math.max(-60, Math.min(60, p.y));
                } else {
                    p.x -= scrollDx; // Player left outside train slides away
                }
            }

            // Cooking Timer
            if (p.isCooking && p.inventory.rawMeat > 0) {
                p.cookTimer += DT;
                if (p.cookTimer >= 13) {
                    let availableSpace = 7 - p.inventory.cookedMeat;
                    let meatToCook = Math.min(p.inventory.rawMeat, availableSpace);
                    p.inventory.cookedMeat += meatToCook;
                    p.inventory.rawMeat -= meatToCook; // Excess raw meat is burned/discarded per 13s bulk process logic.
                    if(p.inventory.rawMeat < 0) p.inventory.rawMeat = 0;
                    p.cookTimer = 0;
                    p.isCooking = false;
                }
            }
        });

        // Projectiles Loop
        room.projectiles.forEach((proj, idx) => {
            // Auto lock-on steering
            if (proj.homing) {
                let target = findNearestTarget(room, proj.x, proj.y, proj.ownerId);
                if (target) {
                    let angleToTarget = Math.atan2(target.y - proj.y, target.x - proj.x);
                    proj.angle = angleToTarget; 
                }
            }
            proj.x += Math.cos(proj.angle) * proj.speed * DT;
            proj.y += Math.sin(proj.angle) * proj.speed * DT;
            proj.life -= DT;

            // Hit detection
            let hit = false;
            if (proj.isTraitor) {
                // Hits normal players
                Object.values(room.players).forEach(p => {
                    if (p.alive && p.id !== proj.ownerId && getDistance(p.x, p.y, proj.x, proj.y) < 25) {
                        p.hp -= proj.dmg;
                        if (!room.stats.kills[proj.ownerId]) room.stats.kills[proj.ownerId] = 0;
                        if (p.hp <= 0) room.stats.kills[proj.ownerId]++;
                        checkDeath(p, room);
                        hit = true;
                    }
                });
            } else {
                // Hits enemies, animals, traitor
                room.entities.forEach(e => {
                    if ((e.type === 'animal' || e.type === 'snake' || e.type === 'enemy' || e.type === 'hawk' || e.type === 'marshal') && getDistance(e.x, e.y, proj.x, proj.y) < 30) {
                        e.hp -= proj.dmg;
                        hit = true;
                    }
                });
                Object.values(room.players).forEach(p => {
                    if (p.alive && p.role === 'Traitor' && p.id !== proj.ownerId && getDistance(p.x, p.y, proj.x, proj.y) < 25) {
                        p.hp -= proj.dmg;
                        hit = true;
                        checkDeath(p, room);
                    }
                });
            }

            if (hit || proj.life <= 0) room.projectiles.splice(idx, 1);
        });

        // Entity Cleanup & AI
        room.entities = room.entities.filter(e => {
            if (e.hp !== undefined && e.hp <= 0) {
                handleEntityDeath(room, e);
                return false;
            }
            // AI Logic
            if (e.type === 'hawk' && train.speed > 0) {
                e.x += 40 * DT; // Faster than train
                let target = findRandomPlayerOnTrain(room);
                if (target) {
                    let dist = getDistance(e.x, e.y, target.x, target.y);
                    if (dist < 20) { target.hp -= 34; checkDeath(target, room); e.hp = 0; }
                    else {
                        e.x += Math.cos(Math.atan2(target.y - e.y, target.x - e.x)) * 50 * DT;
                        e.y += Math.sin(Math.atan2(target.y - e.y, target.x - e.x)) * 50 * DT;
                    }
                }
            } else if (e.type === 'snake') {
                let nearest = findNearestPlayer(room, e.x, e.y);
                if (nearest && nearest.dist < 100) {
                    if (e.state === 'flee') {
                        e.x -= Math.cos(Math.atan2(nearest.p.y - e.y, nearest.p.x - e.x)) * 40 * DT;
                        e.y -= Math.sin(Math.atan2(nearest.p.y - e.y, nearest.p.x - e.x)) * 40 * DT;
                        e.fleeTimer = (e.fleeTimer || 0) + DT;
                        if (e.fleeTimer > 2) e.state = 'lunge';
                    } else if (e.state === 'lunge') {
                        e.x += Math.cos(Math.atan2(nearest.p.y - e.y, nearest.p.x - e.x)) * 150 * DT;
                        e.y += Math.sin(Math.atan2(nearest.p.y - e.y, nearest.p.x - e.x)) * 150 * DT;
                        if (nearest.dist < 20) { nearest.p.hp -= 54; checkDeath(nearest.p, room); e.hp = 0; }
                    }
                }
            }
            return true;
        });

        // Events logic
        handleEvents(room);

        // Sync State
        io.to(roomId).emit('state', room);
    }
}, 1000 / TICK_RATE);

function handleEvents(room) {
    const world = room.world;
    const train = room.train;

    // Avalanche (Forest)
    if (world.biome === 'forest' && train.speed > 0) {
        world.avalancheTimer += DT;
        if (world.avalancheTimer >= 4.1) {
            world.avalancheTimer = 0;
            if (Math.random() < 0.11 && !world.avalancheActive) {
                world.avalancheActive = true;
                world.avalancheHitTimer = 0.8;
                io.to(room.id).emit('avalanche_warning');
            }
        }
    }
    if (world.avalancheActive) {
        world.avalancheHitTimer -= DT;
        if (world.avalancheHitTimer <= 0) {
            world.avalancheActive = false;
            if (train.speed > 0) {
                Object.values(room.players).forEach(p => { if (p.alive) { p.hp -= 50; checkDeath(p, room); } });
                for(let i=0; i<15; i++) room.entities.push({id: generateId(), type: 'rock', x: Math.random()*1600 - 200, y: (Math.random()>0.5?1:-1)*(Math.random()*100+40)});
                io.to(room.id).emit('avalanche_hit');
            }
        }
    }

    // Tunnel of Darkness
    if (train.distance >= 1670 && !world.tunnelActive) {
        world.tunnelTimer += DT;
        if (world.tunnelTimer >= 11) {
            world.tunnelTimer = 0;
            if (Math.random() < 0.11) {
                world.tunnelActive = true;
                world.tunnelEndDist = train.distance + (200 + Math.random() * 220);
            }
        }
    }
    if (world.tunnelActive && train.distance >= world.tunnelEndDist) {
        world.tunnelActive = false;
    }

    // Raids
    world.raidTimer += DT;
    if (world.raidTimer >= 20) {
        world.raidTimer = 0;
        if (Math.random() < 0.10) {
            spawnRaid(room);
            io.to(room.id).emit('raid_alert');
        }
    }

    // Hawks in Desert
    if (world.biome === 'desert' && train.speed > 0 && Math.random() < (DT / 6)) { // ~ every 6 seconds average
        let hawks = room.entities.filter(e => e.type === 'hawk').length;
        if (hawks < 3) room.entities.push({ id: generateId(), type: 'hawk', x: -500, y: Math.random() * 200 - 100, hp: 10 });
    }
}

// === HELPER LOGIC ===
function checkDeath(player, room) {
    if (player.hp <= 0 && player.alive) {
        player.alive = false;
        player.hp = 0;
        io.to(room.id).emit('player_died', player.id);
    }
}

function handleEntityDeath(room, e) {
    if (e.type === 'animal') {
        let p = findNearestPlayer(room, e.x, e.y, 50)?.p;
        if (p) {
            if (p.inventory.rawMeat < 7) p.inventory.rawMeat++;
            else p.inventory.skins++;
        }
    } else if (e.type === 'crate') {
        let rand = Math.random();
        let drop = rand < 0.33 ? 'ammo' : (rand < 0.66 ? 'medkit' : (Math.random() > 0.5 ? 'goldWatch' : 'silverWatch'));
        room.entities.push({ id: generateId(), type: 'item', itemType: drop, x: e.x, y: e.y });
    } else if (e.isRaid) {
        let remaining = room.entities.filter(en => en.isRaid && en.hp > 0).length;
        if (remaining === 0) {
            Object.values(room.players).forEach(p => {
                if (p.alive) {
                    if (p.hp >= p.maxHp) p.money += 2;
                    else p.hp = Math.min(p.maxHp, p.hp + 30);
                }
            });
        }
    }
}

function findNearestPlayer(room, x, y, maxDist = Infinity) {
    let nearest = null; let minDist = maxDist;
    Object.values(room.players).forEach(p => {
        if (!p.alive) return;
        let d = getDistance(x, y, p.x, p.y);
        if (d < minDist) { minDist = d; nearest = p; }
    });
    return nearest ? { p: nearest, dist: minDist } : null;
}

function findRandomPlayerOnTrain(room) {
    let ps = Object.values(room.players).filter(p => p.alive && checkTrainBounds(p.x, p.y, room.train.storageCars));
    return ps.length > 0 ? ps[Math.floor(Math.random() * ps.length)] : null;
}

function findNearestTarget(room, x, y, ownerId) {
    // Used for auto lock-on
    let target = null; let minDist = 300;
    room.entities.forEach(e => {
        if (e.hp > 0 && e.type !== 'shop' && e.type !== 'rock' && e.type !== 'item') {
            let d = getDistance(x, y, e.x, e.y);
            if (d < minDist) { minDist = d; target = e; }
        }
    });
    return target;
}

// === SOCKET HANDLING ===
io.on('connection', (socket) => {
    socket.on('create_lobby', () => {
        const roomId = generateId();
        lobbies[roomId] = createRoom(roomId);
        socket.join(roomId);
        socket.emit('lobby_created', roomId);
    });

    socket.on('join_lobby', (roomId, username, settings) => {
        if (!lobbies[roomId]) return socket.emit('error', 'Lobby not found');
        const room = lobbies[roomId];
        if (room.status !== 'lobby') return socket.emit('error', 'Game already in progress');

        socket.join(roomId);
        room.players[socket.id] = {
            id: socket.id,
            name: username,
            x: 0, y: 0,
            hp: 100, maxHp: 100,
            alive: true,
            role: '',
            money: 0,
            ammo: 30, maxAmmo: 30,
            inventory: { gold: 0, silver: 0, coal: 0, rawMeat: 0, cookedMeat: 0, skins: 0, watches: 0 },
            cold: 167,
            regenRate: 0,
            sips: 0, beerTimer: 0,
            hasWarmClothes: false,
            knifeDmg: 56,
            miningMult: 1,
            autoLockOn: settings?.autoLockOn || false,
            interactingValve: false, isCooking: false, cookTimer: 0, fogTime: 0, fogDamageTimer: 0
        };
        io.to(roomId).emit('lobby_update', Object.values(room.players));
    });

    socket.on('start_game', (roomId) => {
        const room = lobbies[roomId];
        if (room && room.status === 'lobby') {
            room.status = 'playing';
            let pIds = Object.keys(room.players);
            let rolesArr = [...ROLES].sort(() => Math.random() - 0.5);
            
            pIds.forEach((pid, i) => {
                let p = room.players[pid];
                p.role = rolesArr[i % rolesArr.length];
                if (p.role === 'Sharpshooter') p.dmgMult = 1.2;
                if (p.role === 'Soldier') { p.ammo = 62; p.maxAmmo = 62; }
                if (p.role === 'Blacksmith') p.knifeDmg = 80;
                if (p.role === 'Prospector') p.miningMult = 0.75;
                if (p.role === 'Medic') p.medicBuff = true;
                if (p.role === 'Trapper') p.trapperBuff = true;
            });
            io.to(roomId).emit('game_started', room);
        }
    });

    socket.on('input', (roomId, data) => {
        const room = lobbies[roomId];
        if (!room || room.status !== 'playing') return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;

        // Move
        if (data.type === 'move') {
            let speed = (200 + (p.sips >= 3 ? 22 : 0)) * DT; 
            p.x += data.dx * speed;
            p.y += data.dy * speed;
            
            // Tunnel movement clamp (prevents wandering off tracks)
            if (room.world.tunnelActive && !checkTrainBounds(p.x, p.y, room.train.storageCars)) {
                p.y = Math.max(-100, Math.min(100, p.y));
            }
        }
        
        // Aim & Shoot
        if (data.type === 'shoot' && p.ammo > 0) {
            p.ammo--;
            let isTraitor = p.role === 'Traitor';
            room.projectiles.push({
                x: p.x, y: p.y,
                angle: data.angle,
                speed: 800,
                dmg: isTraitor ? 25 : (25 * (p.dmgMult || 1)) * (p.sips >= 3 ? 1.2 : 1),
                life: 1.5,
                ownerId: p.id,
                isTraitor: isTraitor,
                homing: p.autoLockOn
            });
        }

        // Knife
        if (data.type === 'knife') {
            room.entities.forEach(e => {
                if (e.type === 'crate' && getDistance(p.x, p.y, e.x, e.y) < 40) e.hp -= p.knifeDmg;
            });
        }
    });

    // Interaction handlers
    socket.on('interact', (roomId, actionData) => {
        const room = lobbies[roomId];
        if (!room) return;
        const p = room.players[socket.id];
        if (!p || !p.alive) return;

        switch (actionData.action) {
            case 'train_button':
                if (getDistance(p.x, p.y, 0, 0) < 50 && room.train.buttonCooldown <= 0) {
                    if (room.train.speed > 0 || room.train.targetSpeed > 0) {
                        room.train.targetSpeed = 0; // Decelerate
                        room.train.buttonCooldown = 3;
                    } else if (room.train.fuel > 0) {
                        room.train.departureCountdown = 8; // 8s warning
                        io.to(roomId).emit('train_departing');
                    }
                }
                break;
            case 'whistle':
                if (getDistance(p.x, p.y, 10, 0) < 30) io.to(roomId).emit('whistle_pulled');
                break;
            case 'dump_coal':
                if (getDistance(p.x, p.y, 200, 0) < 50 && p.inventory.coal > 0) {
                    let neededFuel = FUEL_MAX - room.train.fuel;
                    let coalNeeded = Math.ceil(neededFuel / COAL_FUEL_VALUE);
                    let coalToUse = Math.min(p.inventory.coal, coalNeeded);
                    p.inventory.coal -= coalToUse;
                    let fuelAdded = coalToUse * COAL_FUEL_VALUE * (p.role === 'Stoker' ? 1.1 : 1);
                    room.train.fuel = Math.min(FUEL_MAX, room.train.fuel + fuelAdded);
                    if (!room.stats.coalMined[p.id]) room.stats.coalMined[p.id] = 0;
                    room.stats.coalMined[p.id] += coalToUse;
                }
                break;
            case 'valve_start': p.interactingValve = true; break;
            case 'valve_stop': p.interactingValve = false; break;
            case 'cook_start': if (getDistance(p.x, p.y, 800, 0) < 50) p.isCooking = true; break;
            case 'cook_stop': p.isCooking = false; p.cookTimer = 0; break;
            case 'eat':
                if (p.inventory.cookedMeat > 0 && p.hp < p.maxHp) {
                    p.inventory.cookedMeat--;
                    p.hp = Math.min(p.maxHp, p.hp + 20);
                }
                break;
            case 'mine':
                room.entities.forEach(e => {
                    if (e.type === 'ore' && getDistance(p.x, p.y, e.x, e.y) < 40) {
                        e.hp -= 1 * p.miningMult;
                        if (e.hp <= 0) {
                            if (e.oreType === 'gold' && p.inventory.gold < 11) p.inventory.gold++;
                            if (e.oreType === 'silver' && p.inventory.silver < 15) p.inventory.silver++;
                            if (e.oreType === 'coal' && p.inventory.coal < 27) p.inventory.coal++;
                        }
                    }
                });
                break;
            case 'gamble':
                if (getDistance(p.x, p.y, 1000, 0) < 100 && p.money >= actionData.amount) {
                    p.money -= actionData.amount;
                    let win = false; let payout = 0;
                    if (actionData.game === 'roulette') {
                        let roll = Math.random();
                        if (actionData.bet === 'green' && roll < 0.05) { win = true; payout = 14; }
                        else if (actionData.bet === 'red' && roll >= 0.05 && roll < 0.525) { win = true; payout = 2; }
                        else if (actionData.bet === 'black' && roll >= 0.525) { win = true; payout = 2; }
                    } else if (actionData.game === 'horses') {
                        if (Math.random() < 0.25) { win = true; payout = 4; }
                    } else if (actionData.game === 'poker') {
                        if (Math.random() < 0.33) { win = true; payout = 3; }
                    }
                    if (win) p.money += actionData.amount * payout;
                    socket.emit('gamble_result', { win, payout: actionData.amount * payout });
                }
                break;
            case 'storage_deposit':
                // Sliders handle partial deposits
                let cap = room.train.storage.capacity;
                let currentTotal = room.train.storage.gold + room.train.storage.silver + room.train.storage.coal;
                let space = cap - currentTotal;
                let reqGold = Math.min(actionData.gold, p.inventory.gold);
                let depGold = Math.min(reqGold, space); space -= depGold; room.train.storage.gold += depGold; p.inventory.gold -= depGold;
                let reqSilver = Math.min(actionData.silver, p.inventory.silver);
                let depSilver = Math.min(reqSilver, space); space -= depSilver; room.train.storage.silver += depSilver; p.inventory.silver -= depSilver;
                let reqCoal = Math.min(actionData.coal, p.inventory.coal);
                let depCoal = Math.min(reqCoal, space); room.train.storage.coal += depCoal; p.inventory.coal -= depCoal;
                break;
            case 'drink_beer':
                if (actionData.barrelId) {
                    p.sips++;
                    if (!room.stats.sips[p.id]) room.stats.sips[p.id] = 0;
                    room.stats.sips[p.id]++;
                    if (p.sips >= 11) { p.hp = 0; checkDeath(p, room); }
                }
                break;
            case 'buy':
                handleShopPurchase(room, p, actionData.item);
                break;
            case 'sell_all':
                if (getDistance(p.x, p.y, 600, -120) < 100 && room.world.isInTown) {
                    p.money += (p.inventory.gold * 5) + (p.inventory.silver * 3) + (p.inventory.skins * (p.trapperBuff ? 3 : 1));
                    p.inventory.gold = p.inventory.silver = p.inventory.skins = 0;
                }
                break;
        }
    });

    socket.on('vote_restart', (roomId) => {
        const room = lobbies[roomId];
        if (room && room.status === 'gameover') {
            room.votesToRestart.add(socket.id);
            if (room.votesToRestart.size >= Object.keys(room.players).length / 2) {
                // Reset Room completely
                lobbies[roomId] = createRoom(roomId);
                io.to(roomId).emit('lobby_reset');
            }
        }
    });

    socket.on('disconnect', () => {
        for (let roomId in lobbies) {
            if (lobbies[roomId].players[socket.id]) {
                delete lobbies[roomId].players[socket.id];
                if (Object.keys(lobbies[roomId].players).length === 0) delete lobbies[roomId];
            }
        }
    });
});

function handleShopPurchase(room, p, item) {
    if (!room.world.isInTown || getDistance(p.x, p.y, 600, -120) > 100) return;
    const shopList = {
        'fuelTank': { cost: 7, limit: 4, action: () => room.train.maxFuel += 200 },
        'regen': { cost: 8, limit: 3, action: () => p.regenRate += 2 },
        'bombs': { cost: 5, action: () => p.inventory.bombs = (p.inventory.bombs || 0) + 1 },
        'bandages': { cost: 2, action: () => p.hp = Math.min(p.maxHp, p.hp + (p.medicBuff ? 80 : 50)) },
        'warmClothes': { cost: 11, action: () => p.hasWarmClothes = true },
        'knife': { cost: 5, action: () => p.hasKnife = true },
        'ammoPack': { cost: 4, limit: 3, action: () => p.ammo = Math.min(p.maxAmmo, p.ammo + 6) },
        'trainSpeed': { cost: 15, action: () => room.train.speedMult += 0.11 },
        'flashlight': { cost: 11, action: () => p.hasFlashlight = true },
        'globalHeadlight': { cost: 15, action: () => room.train.headlightUpgraded = true },
        'storageCar': { cost: 41, limit: MAX_STORAGE_CARS, action: () => room.train.storageCars++ },
        'beerBarrel': { cost: 11, action: () => room.entities.push({ id: generateId(), type: 'barrel', x: p.x, y: p.y, sips: 67 }) },
        'reviveKit': { cost: 21, action: () => p.hasReviveKit = true } // Logic executed client side via menu
    };
    
    let shopItem = shopList[item];
    if (shopItem && p.money >= shopItem.cost) {
        if (shopItem.limit) {
            p.purchases = p.purchases || {};
            if ((p.purchases[item] || 0) >= shopItem.limit) return;
            p.purchases[item] = (p.purchases[item] || 0) + 1;
        }
        p.money -= shopItem.cost;
        shopItem.action();
    }
}

server.listen(PORT, () => console.log(`Server executing seamlessly on port ${PORT}`));
