const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PLAYER_COLORS =['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#e377c2'];

// Define the multi-car train layout
const TRAIN_CARS =[
    { id: 'engine', x: 120, w: 160, y: -40, h: 80 },
    { id: 'coal', x: 10, w: 100, y: -35, h: 70 },
    { id: 'pass1', x: -140, w: 140, y: -40, h: 80 },
    { id: 'pass2', x: -290, w: 140, y: -40, h: 80 },
    { id: 'caboose', x: -400, w: 100, y: -35, h: 70 }
];

const state = {
    train: {
        distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED',
        fuel: 1003, maxFuel: 1003, buttonCooldown: 0,
        speedMultiplier: 1, speedUpgraded: false, fuelUpgrades: 0,
        nextTownDist: Math.random() * (497 - 274) + 274,
        inTown: false
    },
    players: {}, enemies:[], ores: [], projectiles: [], bombs:[], horses:[],
    biome: 'forest', inMountains: false,
    mountainStart: Math.random() * (89 - 10) + 10, mountainEnd: 0,
    avalanche: { active: false, timer: 0 }, avalancheRocks:[],
    raidTimer: 0, raidActive: false, avalancheTimer: 0,
    shop: { active: false, items:[] }
};

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

function spawnOres() {
    state.ores =[];
    for (let i = 0; i < 30; i++) {
        let rand = Math.random();
        let type = rand < 0.1 ? 'gold' : (rand < 0.3 ? 'silver' : 'coal');
        let hits = type === 'gold' ? Math.floor(Math.random() * 6) + 4 : (type === 'silver' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 3) + 2);
        
        let x, y, onTrain;
        do {
            x = (Math.random() - 0.5) * 1400;
            y = (Math.random() - 0.5) * 1000;
            onTrain = TRAIN_CARS.some(car => x >= car.x - 20 && x <= car.x + car.w + 20 && y >= car.y - 20 && y <= car.y + car.h + 20);
        } while (onTrain);

        state.ores.push({ id: Math.random().toString(), type, x, y, hits, maxHits: hits });
    }
}

function spawnEnemies(isTown, isRaid = false) {
    let groups = isTown ? 3 : 4;
    if (!isTown && !isRaid) {
        let extraChance = Math.floor(state.train.distance / 1000) * 0.5;
        if (Math.random() < extraChance) groups++;
    }
    if (isRaid) {
        groups = 2;
        state.raidActive = true;
    }

    for (let g = 0; g < groups; g++) {
        if (!isTown && !isRaid && Math.random() > 0.67) continue;
        
        // Enemies ALWAYS spawn outside the train now, even during raids
        let baseX = (Math.random() > 0.5 ? 700 : -700);
        let baseY = (Math.random() > 0.5 ? 400 : -400);

        for (let i = 0; i < 3; i++) {
            if (Math.random() < 0.5 || isRaid) createEnemy('gunman', baseX, baseY, isRaid);
        }
        for (let i = 0; i < 3; i++) createEnemy('knifeman', baseX, baseY, isRaid);
        if (Math.random() < 0.2) {
            for (let i = 0; i < 2; i++) createEnemy('bombman', baseX, baseY, isRaid);
        }
    }
}

function createEnemy(type, x, y, isRaid) {
    state.enemies.push({
        id: Math.random().toString(), type, isRaid,
        x: x + (Math.random() - 0.5) * 150, y: y + (Math.random() - 0.5) * 150,
        hp: type === 'gunman' ? 30 : 40,
        hasHorse: !isRaid && Math.random() < 0.41,
        lastShot: 0, aimAngle: 0
    });
}

function generateShop() {
    state.shop.active = true;
    state.shop.items =[
        { id: 'bomb', name: 'Bomb', cost: 5, type: 'player' },
        { id: 'bandage', name: 'Bandage (+50 HP)', cost: 2, type: 'player' },
        { id: 'clothes', name: 'Warm Clothes', cost: 11, type: 'player' },
        { id: 'knife', name: 'Knife (56 DMG)', cost: 5, type: 'player' },
        { id: 'ammo', name: 'Ammo Pack (+6)', cost: 4, type: 'player', stock: 3 }
    ];
    
    if (state.train.fuelUpgrades < 4) {
        state.shop.items.push({ id: 'fuel', name: `Fuel Tank (+200)[Lvl ${state.train.fuelUpgrades+1}/4]`, cost: 7, type: 'global' });
    }
    
    state.shop.items.push({ id: 'regen1', name: 'Regen (+2 HP/s)', cost: 8, type: 'player', val: 2 });
    state.shop.items.push({ id: 'regen2', name: 'Regen (+4 HP/s)', cost: 8, type: 'player', val: 4 });
    state.shop.items.push({ id: 'regen3', name: 'Regen (+6 HP/s)', cost: 8, type: 'player', val: 6 });

    if (!state.train.speedUpgraded && Math.random() < 0.38) {
        state.shop.items.push({ id: 'speed', name: 'Train Speed (+11%)', cost: 15, type: 'global' });
    }
}
io.on('connection', (socket) => {
    let activeColors = Object.values(state.players).map(p => p.color);
    let availableColor = PLAYER_COLORS.find(c => !activeColors.includes(c)) || PLAYER_COLORS[0];

    if (Object.keys(state.players).length >= 6) {
        socket.disconnect();
        return;
    }

    state.players[socket.id] = {
        x: 200, y: 0, hp: 120, maxHp: 120, money: 0, color: availableColor,
        bullets: 32, bombs: 0, hasClothes: false, hasKnife: false, regen: 0,
        coldMeter: 167, dead: false, onTrain: true, onHorse: false, aimAngle: 0
    };

    socket.on('move', (data) => {
        let p = state.players[socket.id];
        if (!p || p.dead) return;
        
        let speed = p.onHorse ? 162 : 150;
        p.x += data.dx * speed * 0.033;
        p.y += data.dy * speed * 0.033;

        let onTrain = TRAIN_CARS.some(car => p.x >= car.x && p.x <= car.x + car.w && p.y >= car.y && p.y <= car.y + car.h);
        p.onTrain = onTrain;

        if (!onTrain && state.train.state !== 'STOPPED') {
            p.dead = true; p.hp = 0;
            io.emit('msg', 'A player exploded by leaving the moving train!');
        }
    });

    socket.on('aim', (angle) => {
        if (state.players[socket.id]) state.players[socket.id].aimAngle = angle;
    });

    socket.on('interact', () => {
        let p = state.players[socket.id];
        if (!p || p.dead) return;

        for (let i = 0; i < state.horses.length; i++) {
            if (Math.hypot(p.x - state.horses[i].x, p.y - state.horses[i].y) < 40) {
                p.onHorse = true;
                state.horses.splice(i, 1);
                return;
            }
        }

        if (Math.hypot(p.x - 240, p.y - 0) < 40) {
            if (state.train.state === 'STOPPED' && state.train.buttonCooldown <= 0 && state.train.fuel > 0) {
                state.train.state = 'ACCELERATING';
                state.ores =[];
                state.shop.active = false;
                
                // Kill players off train
                for (let id in state.players) {
                    if (!state.players[id].onTrain) {
                        state.players[id].dead = true;
                        state.players[id].hp = 0;
                        io.emit('msg', 'A player exploded because they were off the train when it started!');
                    }
                }

                // Kill enemies off train
                let enemiesKilled = false;
                state.enemies = state.enemies.filter(e => {
                    let onTrain = TRAIN_CARS.some(car => e.x >= car.x && e.x <= car.x + car.w && e.y >= car.y && e.y <= car.y + car.h);
                    if (!onTrain) enemiesKilled = true;
                    return onTrain;
                });
                if (enemiesKilled) {
                    io.emit('msg', 'Enemies left behind were obliterated by the train!');
                }

            } else if (state.train.state === 'MOVING' || state.train.state === 'ACCELERATING') {
                state.train.state = 'SLOWING';
            }
        }
    });

    socket.on('throwBomb', (target) => {
        let p = state.players[socket.id];
        if (!p || p.dead || p.bombs <= 0) return;
        p.bombs--;
        state.bombs.push({ x: target.x, y: target.y, timer: 1.5, isPlayer: true });
    });

    socket.on('stab', () => {
        let p = state.players[socket.id];
        if (!p || p.dead || !p.hasKnife) return;
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            let e = state.enemies[i];
            if (Math.hypot(p.x - e.x, p.y - e.y) < 50) {
                e.hp -= 56;
                if (e.hp <= 0) {
                    if (e.hasHorse) state.horses.push({ x: e.x, y: e.y });
                    state.enemies.splice(i, 1);
                }
            }
        }
    });

    socket.on('mine', (oreId) => {
        let p = state.players[socket.id];
        if (!p || p.dead || state.train.state !== 'STOPPED') return;
        let oreIndex = state.ores.findIndex(o => o.id === oreId);
        if (oreIndex !== -1) {
            let ore = state.ores[oreIndex];
            if (Math.hypot(p.x - ore.x, p.y - ore.y) < 60) {
                ore.hits--;
                if (ore.hits <= 0) {
                    if (ore.type === 'gold') p.money += 5 * ore.maxHits;
                    if (ore.type === 'silver') p.money += 3 * ore.maxHits;
                    if (ore.type === 'coal') state.train.fuel = Math.min(state.train.maxFuel, state.train.fuel + 50 * ore.maxHits);
                    state.ores.splice(oreIndex, 1);
                }
            }
        }
    });

    socket.on('shoot', () => {
        let p = state.players[socket.id];
        if (!p || p.dead || p.bullets <= 0) return;
        p.bullets--;
        state.projectiles.push({
            id: Math.random().toString(), x: p.x, y: p.y,
            vx: Math.cos(p.aimAngle) * 400, vy: Math.sin(p.aimAngle) * 400,
            isPlayer: true, owner: socket.id
        });
    });

    socket.on('buy', (itemId) => {
        let p = state.players[socket.id];
        if (!p || p.dead || !state.shop.active) return;
        let item = state.shop.items.find(i => i.id === itemId);
        if (item && p.money >= item.cost) {
            if (item.stock !== undefined && item.stock <= 0) return;
            p.money -= item.cost;
            if (item.stock !== undefined) item.stock--;

            if (itemId === 'fuel' && state.train.fuelUpgrades < 4) {
                state.train.maxFuel += 200;
                state.train.fuelUpgrades++;
                generateShop();
            }
            if (itemId.startsWith('regen')) p.regen = Math.max(p.regen, item.val);
            if (itemId === 'bomb') p.bombs++;
            if (itemId === 'bandage') p.hp = Math.min(p.maxHp, p.hp + 50);
            if (itemId === 'clothes') p.hasClothes = true;
            if (itemId === 'knife') p.hasKnife = true;
            if (itemId === 'ammo') p.bullets += 6;
            if (itemId === 'speed') {
                state.train.speedMultiplier = 1.11;
                state.train.speedUpgraded = true;
                generateShop();
            }
        }
    });

    socket.on('disconnect', () => { delete state.players[socket.id]; });
});
// Game Loop (30 FPS)
setInterval(() => {
    let dt = 1 / 30;

    if (state.train.state === 'ACCELERATING') {
        state.train.speed += (state.train.maxSpeed / 8) * dt;
        // Clear avalanche rocks when we start moving
        state.avalancheRocks =[]; 
        if (state.train.speed >= state.train.maxSpeed) state.train.state = 'MOVING';
    } else if (state.train.state === 'SLOWING') {
        state.train.speed -= (state.train.maxSpeed / 4) * dt;
        if (state.train.speed <= 0) {
            state.train.speed = 0;
            state.train.state = 'STOPPED';
            state.train.buttonCooldown = 3;
            spawnOres();
            
            if (state.train.distance >= state.train.nextTownDist) {
                state.train.inTown = true;
                state.train.nextTownDist = state.train.distance + Math.random() * (497 - 274) + 274;
                generateShop();
                spawnEnemies(true);
            } else {
                state.train.inTown = false;
                spawnEnemies(false);
            }
        }
    }

    if (state.train.state !== 'STOPPED') {
        state.train.distance += (state.train.speed * state.train.speedMultiplier * 0.1) * dt;
        state.train.fuel -= 17 * dt;
        if (state.train.fuel <= 0) {
            state.train.fuel = 0;
            state.train.state = 'SLOWING';
        }
    }

    if (state.train.buttonCooldown > 0) state.train.buttonCooldown -= dt;
    state.biome = getBiome(state.train.distance);

    if (state.biome === 'forest') {
        if (!state.inMountains && state.train.distance >= state.mountainStart) {
            state.inMountains = true;
            state.mountainEnd = state.train.distance + Math.random() * (108 - 23) + 23;
        } else if (state.inMountains && state.train.distance >= state.mountainEnd) {
            state.inMountains = false;
            state.mountainStart = state.train.distance + Math.random() * (89 - 10) + 10;
        }
    } else {
        state.inMountains = false;
    }

    if (state.inMountains && state.train.state !== 'STOPPED') {
        state.avalancheTimer += dt;
        if (state.avalancheTimer >= 4.1) {
            state.avalancheTimer = 0;
            if (Math.random() < 0.11) {
                state.avalanche.active = true;
                state.avalanche.timer = 0.8;
                io.emit('msg', 'AVALANCHE WARNING! STOP THE TRAIN!');
            }
        }
    }

    if (state.avalanche.active) {
        state.avalanche.timer -= dt;
        if (state.train.state === 'STOPPED') {
            state.avalanche.active = false;
        } else if (state.avalanche.timer <= 0) {
            state.avalanche.active = false;
            state.train.state = 'STOPPED';
            state.train.speed = 0;
            
            // Generate visible avalanche rocks around the train
            for(let i=0; i<20; i++) {
                state.avalancheRocks.push({
                    x: (Math.random() - 0.5) * 800,
                    y: (Math.random() - 0.5) * 300,
                    size: Math.random() * 30 + 20
                });
            }

            for (let id in state.players) {
                state.players[id].hp -= 50;
                if (state.players[id].hp <= 0) state.players[id].dead = true;
            }
            io.emit('msg', 'Avalanche hit the train!');
        }
    }

    // Raids happen less frequently now (every 15 seconds, 12% chance)
    state.raidTimer += dt;
    if (state.raidTimer >= 15.0) {
        state.raidTimer = 0;
        if (Math.random() < 0.12) {
            io.emit('msg', 'TRAIN RAID! Enemies are approaching!');
            spawnEnemies(false, true);
        }
    }

    if (state.raidActive) {
        let raidAlive = state.enemies.some(e => e.isRaid);
        if (!raidAlive) {
            state.raidActive = false;
            for (let id in state.players) {
                let p = state.players[id];
                if (!p.dead) {
                    if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + 30);
                    else p.money += 2;
                }
            }
            io.emit('msg', 'Raid defeated! Healed 30 HP or gained $2.');
        }
    }

    for (let id in state.players) {
        let p = state.players[id];
        if (p.dead) continue;
        
        if (p.regen > 0) p.hp = Math.min(p.maxHp, p.hp + p.regen * dt);

        if (state.biome === 'tundra') {
            if (p.onTrain) {
                p.coldMeter = Math.min(167, p.coldMeter + 5 * dt);
            } else if (!p.hasClothes) {
                p.coldMeter -= 2.8 * dt; // 0.84 per 0.3s
                if (p.coldMeter <= 0) {
                    p.dead = true; p.hp = 0;
                    io.emit('msg', 'A player froze to death!');
                }
            }
        } else {
            p.coldMeter = 167;
        }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
        let e = state.enemies[i];
        let target = null; let minDist = Infinity;
        for (let id in state.players) {
            let p = state.players[id];
            if (p.dead) continue;
            let dist = Math.hypot(p.x - e.x, p.y - e.y);
            if (dist < minDist) { minDist = dist; target = p; }
        }

        if (target) {
            let speed = e.hasHorse ? 60 * 1.08 : 60;
            if (minDist > 40) {
                e.x += (target.x - e.x) / minDist * speed * dt;
                e.y += (target.y - e.y) / minDist * speed * dt;
            }
            e.aimAngle = Math.atan2(target.y - e.y, target.x - e.x);

            e.lastShot += dt;
            if (e.type === 'gunman' && minDist < 300 && e.lastShot > 2) {
                e.lastShot = 0;
                state.projectiles.push({
                    id: Math.random().toString(), x: e.x, y: e.y,
                    vx: Math.cos(e.aimAngle) * 300, vy: Math.sin(e.aimAngle) * 300,
                    isPlayer: false, dmg: 30
                });
            } else if (e.type === 'knifeman' && minDist < 40 && e.lastShot > 1) {
                e.lastShot = 0;
                target.hp -= 20;
                if (target.hp <= 0) target.dead = true;
            } else if (e.type === 'bombman' && minDist < 250 && e.lastShot > 3) {
                e.lastShot = 0;
                state.bombs.push({ x: target.x, y: target.y, timer: 1.5, isPlayer: false });
            }
        }
    }

    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        let proj = state.projectiles[i];
        proj.x += proj.vx * dt;
        proj.y += proj.vy * dt;

        let hit = false;
        if (proj.isPlayer) {
            for (let j = state.enemies.length - 1; j >= 0; j--) {
                let e = state.enemies[j];
                if (Math.hypot(proj.x - e.x, proj.y - e.y) < 20) {
                    e.hp -= 10;
                    if (e.hp <= 0) {
                        if (e.hasHorse) state.horses.push({ x: e.x, y: e.y });
                        state.enemies.splice(j, 1);
                    }
                    hit = true; break;
                }
            }
        } else {
            for (let id in state.players) {
                let p = state.players[id];
                if (!p.dead && Math.hypot(proj.x - p.x, proj.y - p.y) < 20) {
                    p.hp -= proj.dmg;
                    if (p.hp <= 0) p.dead = true;
                    hit = true; break;
                }
            }
        }
        if (hit || Math.abs(proj.x) > 1500 || Math.abs(proj.y) > 1500) state.projectiles.splice(i, 1);
    }

    for (let i = state.bombs.length - 1; i >= 0; i--) {
        let b = state.bombs[i];
        b.timer -= dt;
        if (b.timer <= 0) {
            if (b.isPlayer) {
                for (let j = state.enemies.length - 1; j >= 0; j--) {
                    if (Math.hypot(b.x - state.enemies[j].x, b.y - state.enemies[j].y) < 80) {
                        if (state.enemies[j].hasHorse) state.horses.push({ x: state.enemies[j].x, y: state.enemies[j].y });
                        state.enemies.splice(j, 1);
                    }
                }
            } else {
                for (let id in state.players) {
                    let p = state.players[id];
                    if (!p.dead && Math.hypot(b.x - p.x, b.y - p.y) < 80) {
                        p.hp -= 60;
                        if (p.hp <= 0) p.dead = true;
                    }
                }
            }
            state.bombs.splice(i, 1);
        }
    }

    io.emit('state', state);

    if (state.train.distance >= 3181) {
        io.emit('victory');
    }
}, 1000 / 30);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));