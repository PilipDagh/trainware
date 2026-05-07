return {
id, name, password, maxPlayers: parseInt(maxPlayers) || 6, status: 'LOBBY',
settings: { traitorEnabled: true, autoLockEnabled: false },
        players: {}, enemies:[], ores:[], crates: [], animals: [], planks: [], projectiles: [], bombs: [], horses: [], barrels:[],
        hawks: [], snakes:[], mailPoles: [], chasers: [], marshals:[],
        players: {}, enemies:[], ores:[], crates: [], animals: [], planks: [], projectiles:[], bombs: [], horses: [], barrels:[],
        hawks: [], snakes:[], mailPoles:[], chasers: [], marshals:[],
train: {
distance: 0, speed: 0, maxSpeed: 35, state: 'STOPPED', 
fuel: 1003, maxFuel: 1003, buttonCooldown: 0, departureTimer: 0,
@@ -84,16 +84,14 @@ function assignRoles(room) {
});
}
function getTrainBounds(room) {
    // Engine(120 to 280), Coal(10 to 110), Pass1(-140 to 0), Pass2(-290 to -150)
    // Kitchen(-440 to -300), Gambling(-590 to -450), Caboose(-700 to -600)
    // Storage starts at -710 and goes back 110 per car.
let backEdge = -700 - (room.train.storageCars * 110);
return { minX: backEdge, maxX: 280, minY: -50, maxY: 50 };
}

function spawnOres(room) {
room.ores =[]; let bounds = getTrainBounds(room);
    for (let i = 0; i < 25; i++) {
    let numOres = Math.floor(Math.random() * 4) + 6; // REDUCED: 6 to 9 ores per stop
    for (let i = 0; i < numOres; i++) {
let rand = Math.random();
let type = rand < 0.1 ? 'gold' : (rand < 0.3 ? 'silver' : 'coal');
let hits = type === 'gold' ? Math.floor(Math.random() * 6) + 4 : (type === 'silver' ? Math.floor(Math.random() * 4) + 2 : Math.floor(Math.random() * 3) + 2);
@@ -164,7 +162,6 @@ function spawnEnemies(room, isTown, isRaid = false) {
}

function spawnMarshals(room) {
    // Spawns 3 elite Marshals in town
for (let i = 0; i < 3; i++) {
let baseX = room.townX !== null ? room.townX + (Math.random() > 0.5 ? 300 : -300) : 600;
let baseY = (Math.random() - 0.5) * 600;
@@ -243,9 +240,9 @@ io.on('connection', (socket) => {
coldMeter: 167, dead: false, onTrain: true, onHorse: false, aimAngle: 0,
spectatingId: null, voted: false, settings: { hasAutoLock: false },
role: '', desc: '', buffs: {}, isTraitor: false,
            hasFlashlight: false, flashlightOn: false, steamTimer: 0,
            hasFlashlight: false, flashlightOn: false, steamTimer: 0, steamActive: false,
cooking: { active: false, timer: 0, amount: 0 },
            stats: { kills: 0, coalDumped: 0, beerSips: 0 } // For Hall of Fame
            stats: { kills: 0, coalDumped: 0, beerSips: 0 } 
};
io.to(data.roomId).emit('lobbyUpdate', room);
});
@@ -272,6 +269,7 @@ io.on('connection', (socket) => {
io.to(room.id).emit('gameStarted');
}
});

socket.on('move', (data) => {
let room = rooms[socket.roomId];
if (!room || room.status !== 'PLAYING') return;
@@ -284,7 +282,7 @@ io.on('connection', (socket) => {
let nextX = p.x + data.dx * speed * 0.033;
let nextY = p.y + data.dy * speed * 0.033;

        let isMoving =['ACCELERATING', 'MOVING', 'SLOWING'].includes(room.train.state);
        let isMoving = ['ACCELERATING', 'MOVING', 'SLOWING'].includes(room.train.state);
let bounds = getTrainBounds(room);

if (isMoving) {
@@ -403,20 +401,19 @@ io.on('connection', (socket) => {
}
}
});

socket.on('interact', () => {
let room = rooms[socket.roomId];
if (!room || room.status !== 'PLAYING') return;
let p = room.players[socket.id];
if (!p || p.dead) return;

        // 1. Mount Horse
for (let i = 0; i < room.horses.length; i++) {
if (Math.hypot(p.x - room.horses[i].x, p.y - room.horses[i].y) < 40) {
p.onHorse = true; room.horses.splice(i, 1); return;
}
}

        // 2. Pick up Bridge Planks
for (let i = room.planks.length - 1; i >= 0; i--) {
let plank = room.planks[i];
if (Math.hypot(p.x - plank.x, p.y - plank.y) < 50) {
@@ -426,7 +423,6 @@ io.on('connection', (socket) => {
}
}

        // 3. Train Start/Stop Button (Engine: x: 240, y: 0)
if (Math.hypot(p.x - 240, p.y - 0) < 40) {
if (room.train.state === 'STOPPED' && room.train.buttonCooldown <= 0 && room.train.fuel > 0) {
if (!room.train.bridgeFixed) return socket.emit('msg', 'THE BRIDGE IS OUT! Repair the tracks first!');
@@ -439,7 +435,6 @@ io.on('connection', (socket) => {
return;
}

        // 4. Deposit Bridge Planks
if (!room.train.bridgeFixed && Math.hypot(p.x - 300, p.y - 0) < 60) {
if (p.inventory.planks > 0) {
room.train.planksDeposited += p.inventory.planks; p.inventory.planks = 0;
@@ -452,7 +447,6 @@ io.on('connection', (socket) => {
return;
}

        // 5. Coal Dump Cart (Coal Car: x: 60, y: 0)
if (Math.hypot(p.x - 60, p.y - 0) < 40) {
if (p.inventory.coal > 0) {
let fuelNeeded = room.train.maxFuel - room.train.fuel;
@@ -472,7 +466,7 @@ io.on('connection', (socket) => {
return;
}

        // 6. Kitchen Car Stove (x: -370, y: 0)
        // Kitchen Car Stove (x: -370, y: 0)
if (Math.hypot(p.x - (-370), p.y - 0) < 40) {
if (p.cooking.active) return socket.emit('msg', 'Already cooking!');
if (p.inventory.rawMeat > 0) {
@@ -486,23 +480,23 @@ io.on('connection', (socket) => {
return;
}

        // 7. Gambling Car Tables (x: -520)
        // Gambling Car Tables (x: -520)
if (room.train.state === 'MOVING' || room.train.state === 'ACCELERATING') {
            if (Math.hypot(p.x - (-480), p.y - 0) < 40) { // Roulette
            if (Math.hypot(p.x - (-480), p.y - 0) < 40) { 
if (!room.gambling.active) { room.gambling.active = true; room.gambling.type = 'roulette'; room.gambling.timer = 10; room.gambling.bets = {}; }
if (room.gambling.type === 'roulette') socket.emit('openGambling', 'roulette'); return;
}
            if (Math.hypot(p.x - (-520), p.y - 0) < 40) { // Horse Racing
            if (Math.hypot(p.x - (-520), p.y - 0) < 40) { 
if (!room.gambling.active) { room.gambling.active = true; room.gambling.type = 'horse'; room.gambling.timer = 10; room.gambling.bets = {}; }
if (room.gambling.type === 'horse') socket.emit('openGambling', 'horse'); return;
}
            if (Math.hypot(p.x - (-560), p.y - 0) < 40) { // Poker
            if (Math.hypot(p.x - (-560), p.y - 0) < 40) { 
if (!room.gambling.active) { room.gambling.active = true; room.gambling.type = 'poker'; room.gambling.timer = 10; room.gambling.bets = {}; }
if (room.gambling.type === 'poker') socket.emit('openGambling', 'poker'); return;
}
}

        // 8. Storage Car Menu Trigger
        // Storage Car Menu Trigger
let storageCarX = -710; 
if (Math.hypot(p.x - storageCarX, p.y - 0) < 50) {
let currentTotal = room.train.storageInv.gold + room.train.storageInv.silver + room.train.storageInv.coal;
@@ -511,7 +505,6 @@ io.on('connection', (socket) => {
return;
}

        // 9. Shop NPC
if (room.shopNPC && Math.hypot(p.x - room.shopNPC.x, p.y - room.shopNPC.y) < 60) {
let skinVal = p.buffs && p.buffs.skinValue ? p.buffs.skinValue : 1;
let earned = (p.inventory.gold * 5) + (p.inventory.silver * 3) + (p.inventory.skins * skinVal);
@@ -522,19 +515,16 @@ io.on('connection', (socket) => {
socket.emit('openShop'); return;
}

        // 10. Mail Hook Snag
        // Mail Hook Snag
for (let i = room.mailPoles.length - 1; i >= 0; i--) {
let pole = room.mailPoles[i];
if (Math.hypot(p.x - pole.x, p.y - pole.y) < 60) {
                let money = Math.floor(Math.random() * 5) + 2; // $2 to $6
                p.money += money;
                room.mailPoles.splice(i, 1);
                socket.emit('msg', `Snagged a mail bag! Found $${money}!`);
                return;
                let money = Math.floor(Math.random() * 5) + 2; 
                p.money += money; room.mailPoles.splice(i, 1);
                socket.emit('msg', `Snagged a mail bag! Found $${money}!`); return;
}
}

        // 11. Beer Barrels
for (let b of room.barrels) {
if (Math.hypot(p.x - b.x, p.y - b.y) < 40) {
if (p.inventory.beerBottles > 0 && b.sipsLeft < 67) {
@@ -549,6 +539,7 @@ io.on('connection', (socket) => {
}
}
});

socket.on('depositStorage', (data) => {
let room = rooms[socket.roomId];
if (!room) return;
@@ -742,7 +733,7 @@ function resetRoom(room) {
inTown: false, townWarningSent: false, storageCars: 1, storageInv: { gold: 0, silver: 0, coal: 0 },
steamPressure: 100, steamActive: false, steamCloudTimer: 0
};
    room.enemies = []; room.ores = []; room.crates =[]; room.animals = []; room.planks = [];
    room.enemies = []; room.ores =[]; room.crates =[]; room.animals = []; room.planks = [];
room.projectiles =[]; room.bombs =[]; room.horses = []; room.barrels = []; room.avalancheRocks =[]; 
room.hawks = []; room.snakes = []; room.mailPoles =[]; room.chasers = []; room.marshals =[];
room.shopNPC = null; room.townX = null; room.gambling = { active: false, type: null, timer: 0, bets: {} };
@@ -767,7 +758,6 @@ function resolveGambling(room) {
} else if (room.gambling.type === 'roulette') {
result = Math.random() < 0.48 ? 'red' : (Math.random() < 0.96 ? 'black' : 'green');
} else if (room.gambling.type === 'poker') {
        // Simple high-card poker simulation
let suits =['Hearts', 'Spades', 'Clubs', 'Diamonds'];
let values =['9', '10', 'Jack', 'Queen', 'King', 'Ace'];
result = `${values[Math.floor(Math.random()*values.length)]} of ${suits[Math.floor(Math.random()*suits.length)]}`;
@@ -777,7 +767,6 @@ function resolveGambling(room) {
let bet = room.gambling.bets[socketId]; let p = room.players[socketId];
if (!p) continue;
if (room.gambling.type === 'poker') {
            // Poker is a 1 in 3 chance to win 3x your bet
if (Math.random() < 0.33) {
p.money += bet.amount * 3; io.to(socketId).emit('msg', `POKER WIN! You won $${bet.amount * 3}!`);
} else { io.to(socketId).emit('msg', 'You folded. Lost the bet.'); }
@@ -803,15 +792,14 @@ setInterval(() => {
let dx = 0; 
let isMoving = false;

        // --- Train Physics & State Machine ---
if (room.train.state === 'DEPARTING') {
room.train.departureTimer -= dt;
if (room.train.departureTimer <= 0) {
room.train.state = 'ACCELERATING';
for (let id in room.players) {
let p = room.players[id];
if (!p.onTrain && !p.dead) {
                        p.x = -700; p.y = 0; // Teleport to Caboose
                        p.x = -700; p.y = 0; 
io.to(room.id).emit('msg', `${p.name} scrambled onto the moving train!`);
}
}
@@ -855,7 +843,6 @@ setInterval(() => {
spawnEnemies(room, true);
io.to(room.id).emit('msg', 'Arrived at a town! Visit the NPC outside to sell items.');

                    // Marshals spawn every 3 towns
if (room.train.townStops % 3 === 0) {
spawnMarshals(room);
io.to(room.id).emit('msg', 'THE MARSHALS HAVE ARRIVED! They are hunting the Traitor!');
@@ -869,6 +856,7 @@ setInterval(() => {
} else if (room.train.state === 'MOVING') {
isMoving = true;
}

if (isMoving) {
let fuelMult = 1;
for (let id in room.players) {
@@ -884,7 +872,6 @@ setInterval(() => {

room.train.steamPressure = Math.max(0, room.train.steamPressure - (1.67 / 67) * (room.train.speed * room.train.speedMultiplier * 0.1) * dt);

            // Scroll all world objects
room.ores.forEach(o => o.x -= dx); room.crates.forEach(c => c.x -= dx); 
room.animals.forEach(a => a.x -= dx); room.planks.forEach(p => p.x -= dx);
room.enemies.forEach(e => e.x -= dx); room.horses.forEach(h => h.x -= dx);
@@ -894,14 +881,12 @@ setInterval(() => {
if (room.shopNPC) room.shopNPC.x -= dx;
if (room.townX !== null) room.townX -= dx;

            // Mail Hook Spawning
room.mailTimer += dt;
if (room.mailTimer >= 15 && Math.random() < 0.3) {
room.mailTimer = 0;
                room.mailPoles.push({ id: Math.random().toString(), x: 1200, y: 60 }); // Spawns just off the top edge
                room.mailPoles.push({ id: Math.random().toString(), x: 1200, y: 60 }); 
}

            // Moving Bandit Chases (Rare)
room.chaseTimer += dt;
if (room.chaseTimer >= 45 && Math.random() < 0.15) {
room.chaseTimer = 0;
@@ -919,7 +904,6 @@ setInterval(() => {
if (room.train.buttonCooldown > 0) room.train.buttonCooldown -= dt;
room.biome = getBiome(room.train.distance);

        // Cooking Logic
for (let id in room.players) {
let p = room.players[id];
if (p.cooking.active) {
@@ -933,7 +917,6 @@ setInterval(() => {
}
}

        // Tunnel of Darkness Logic
if (room.train.distance >= 1670) {
if (!room.tunnel.active) {
room.tunnel.checkTimer += dt;
@@ -954,7 +937,6 @@ setInterval(() => {
}
}

        // Steam Valve Logic
let steamBlowing = false;
for (let id in room.players) {
let p = room.players[id];
@@ -978,14 +960,12 @@ setInterval(() => {
}
room.train.steamActive = steamBlowing;

        // AI & Combat (Enemies, Marshals, Chasers, Hawks, Snakes)
let allHostiles =[...room.enemies, ...room.chasers, ...room.marshals];
allHostiles.forEach(e => {
let target = null; let minDist = Infinity;
for (let id in room.players) {
let p = room.players[id]; 
if (p.dead) continue;
                // Marshals ONLY target the Traitor. Normal enemies ignore the Traitor.
if (e.type === 'marshal' && !p.isTraitor) continue;
if (e.type !== 'marshal' && p.isTraitor) continue;

@@ -994,9 +974,16 @@ setInterval(() => {
}
if (target) {
let speed = e.hasHorse ? 65 : 60;
                if (e.isChaser) speed = (room.train.speed * 15) + 20; // Chasers match train speed + a bit
                if (e.isChaser) {
                    speed = (room.train.speed * 15) + 20; 
                    // Chasers stay parallel to the train
                    let targetY = target.y > 0 ? 150 : -150;
                    e.y += (targetY - e.y) * 2 * dt;
                    e.x += (target.x - e.x) / minDist * speed * dt;
                } else {
                    if (minDist > 40) { e.x += (target.x - e.x) / minDist * speed * dt; e.y += (target.y - e.y) / minDist * speed * dt; }
                }

                if (minDist > 40) { e.x += (target.x - e.x) / minDist * speed * dt; e.y += (target.y - e.y) / minDist * speed * dt; }
e.aimAngle = Math.atan2(target.y - e.y, target.x - e.x); e.lastShot += dt;

if ((e.type === 'gunman' || e.type === 'marshal') && minDist < 400 && e.lastShot > 2.5) {
@@ -1009,7 +996,6 @@ setInterval(() => {
}
});

        // Projectiles
for (let i = room.projectiles.length - 1; i >= 0; i--) {
let proj = room.projectiles[i];
if (proj.isPlayer && proj.targetId) {
@@ -1040,7 +1026,41 @@ setInterval(() => {
hit = true; break;
}
}
                // Hit Animals/Hawks/Snakes/Traitors logic omitted for brevity but functions identically to previous chunks
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
@@ -1055,7 +1075,6 @@ setInterval(() => {

io.to(room.id).emit('state', room);

        // Victory & Hall of Fame
if (room.train.distance >= 3181 && room.status === 'PLAYING') { 
room.status = 'VOTING'; 
let awards = { leadSlinger: 'No One', drunkard: 'No One', workhorse: 'No One', snake: 'No One' };
