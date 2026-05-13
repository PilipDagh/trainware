const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

const lobbies = {};

const ROLES =[
    { name: 'Sharpshooter', desc: '+20% damage' },
    { name: 'Engineer', desc: '-15% fuel burn' },
    { name: 'Prospector', desc: '25% faster mining' },
    { name: 'Medic', desc: '+30 HP bandages' },
    { name: 'Trapper', desc: 'Start with 3 skins' },
    { name: 'Soldier', desc: 'Start with +32 ammo' },
    { name: 'Blacksmith', desc: '80 knife damage' },
    { name: 'Stoker', desc: '10% more fuel, 20% faster accel' },
    { name: 'Normal', desc: 'Just a guy' }
];

class Lobby {
    constructor(id) {
        this.id = id;
        this.players = {};
        this.train = {
            distance: 0, speed: 0, targetSpeed: 0, maxSpeed: 35, accel: 35/8,
            fuel: 1003, maxFuel: 1003, fuelBurn: 17,
            pressure: 0, lastPressureDecay: 0,
            isMoving: false, departureTimer: 0, cooldownTimer: 0,
            stopEventTriggered: false, speedUpgraded: false,
            headlightUpgraded: false,
            planksNeeded: 0, planksDeposited: 0,
            cars:[
                { type: 'Engine', x: 0, w: 200 },
                { type: 'Coal', x: 200, w: 200 },
                { type: 'Passenger', x: 400, w: 200 },
                { type: 'Passenger', x: 600, w: 200 },
                { type: 'Kitchen', x: 800, w: 200 },
                { type: 'Gambling', x: 1000, w: 200 },
                { type: 'Trading', x: 1200, w: 200 },
                { type: 'Caboose', x: 1400, w: 200 }
            ]
        };
        this.storage = { count: 0, capacity: 0, gold: 0, silver: 0, coal: 0 };
        this.trade = {
            p1: null, p2: null,
            offer1: { gold: 0, silver: 0, coal: 0, skins: 0, money: 0 },
            offer2: { gold: 0, silver: 0, coal: 0, skins: 0, money: 0 },
            locked1: false, locked2: false, timer: 0, active: false
        };
        this.world = {
            ores:[], enemies: [], animals: [], crates: [], planks: [], towns: [],
            steamClouds: [], bullets:[]
        };
        this.state = {
            biome: 'Forest', tunnelActive: false, lastTunnelCheck: 0,
            bridgeOut: false, bridgeDistance: 500,
            victory: false, townCounter: 0
        };
        this.stats = { leadSlinger: {id:null, dmg:0}, drunkard: {id:null, sips:0}, workhorse: {id:null, mined:0}, snake: {id:null, betrayals:0} };
        this.lastTick = Date.now();
        
        // Generate Towns
        let d = 300;
        while(d < 3181) {
            this.world.towns.push({ distance: d, active: true });
            d += Math.floor(Math.random() * (497 - 274 + 1)) + 274;
        }
    }

    getBiome() {
        let d = this.train.distance;
        if (d < 974) return 'Forest';
        if (d < 1521) return 'Desert';
        if (d < 1908) return 'Tundra';
        if (d < 2455) return 'Desert';
        return 'Forest';
    }
}

io.on('connection', (socket) => {
    socket.on('create_lobby', (data) => {
        const lobbyId = Math.random().toString(36).substring(2, 8).toUpperCase();
        lobbies[lobbyId] = new Lobby(lobbyId);
        joinLobby(socket, lobbyId, data.name, data.isTraitor);
    });

    socket.on('join_lobby', (data) => {
        if (lobbies[data.lobbyId]) {
            joinLobby(socket, data.lobbyId, data.name, data.isTraitor);
        } else {
            socket.emit('error_msg', 'Lobby not found');
        }
    });

    function joinLobby(socket, lobbyId, name, isTraitor) {
        socket.join(lobbyId);
        socket.lobbyId = lobbyId;
        const lobby = lobbies[lobbyId];
        
        const role = ROLES[Math.floor(Math.random() * ROLES.length)];
        
        lobby.players[socket.id] = {
            id: socket.id, name: name || 'Player',
            x: 100, y: 300, hp: 100, maxHp: 100,
            role: role, isTraitor: isTraitor,
            inventory: { gold: 0, silver: 0, coal: 0, rawMeat: 0, cookedMeat: 0, skins: 0, watches: 0, ammo: role.name==='Soldier'?62:30, money: 0 },
            caps: { gold: 11, silver: 15, coal: 27, meat: 7, watches: 2 },
            isDead: false, spectateIndex: 0,
            sips: 0, drunkTimer: 0, flashlight: false, lightOn: false,
            stats: { dmg: 0, sips: 0, mined: 0, betrayals: 0 }
        };
        
        if (role.name === 'Trapper') lobby.players[socket.id].inventory.skins = 3;

        socket.emit('init_game', { lobbyId, player: lobby.players[socket.id], train: lobby.train });
        io.to(lobbyId).emit('update_players', lobby.players);
    }

    socket.on('input', (data) => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby) return;
        const p = lobby.players[socket.id];
        if (!p || p.isDead) return;

        // Movement
        let speed = 200 * data.dt;
        if (p.sips >= 3 && p.sips < 11) speed *= 1.5; // Drunk speed boost

        let newX = p.x + data.dx * speed;
        let newY = p.y + data.dy * speed;

        // Physical barrier if train moving
        if (lobby.train.speed > 0) {
            let trainLen = lobby.train.cars[lobby.train.cars.length-1].x + lobby.train.cars[lobby.train.cars.length-1].w;
            if (newY >= 250 && newY <= 350 && newX >= 0 && newX <= trainLen) {
                p.x = newX; p.y = newY;
            } else if (p.y >= 250 && p.y <= 350) {
                // Constrain to train
                p.x = Math.max(0, Math.min(trainLen, newX));
                p.y = Math.max(250, Math.min(350, newY));
            } else {
                // Off train while moving? Dragged back by speed
                p.x -= lobby.train.speed * 10 * data.dt; 
            }
        } else {
            p.x = newX; p.y = newY;
        }
        
        p.aimAngle = data.aimAngle;
    });
socket.on('interact', (action) => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby) return;
        const p = lobby.players[socket.id];
        if (!p || p.isDead) return;

        if (action === 'toggle_train') {
            if (p.x >= 0 && p.x <= 200 && p.y >= 250 && p.y <= 350) { // Engine
                if (lobby.train.speed > 0 || lobby.train.targetSpeed > 0) {
                    lobby.train.targetSpeed = 0;
                } else if (lobby.train.cooldownTimer <= 0 && lobby.train.fuel > 0 && !lobby.state.bridgeOut) {
                    lobby.train.departureTimer = 8;
                    io.to(lobby.id).emit('train_warning', 8);
                }
            }
        }
        
        if (action === 'dump_coal') {
            if (p.x > 200 && p.x <= 400) { // Coal Car
                let needed = lobby.train.maxFuel - lobby.train.fuel;
                let dump = Math.min(p.inventory.coal * 10, needed); // 1 coal = 10 fuel
                let coalUsed = Math.ceil(dump / 10);
                lobby.train.fuel += dump;
                p.inventory.coal -= coalUsed;
            }
        }

        if (action === 'release_steam') {
            if (p.x > 200 && p.x <= 400) {
                if (!p.lastSteam) p.lastSteam = 0;
                let now = Date.now();
                if (now - p.lastSteam >= 1670) {
                    lobby.train.pressure = Math.min(100, lobby.train.pressure + 2);
                    p.lastSteam = now;
                    lobby.world.steamClouds.push({ x: p.x, y: p.y, timer: 4000 });
                }
            }
        }

        if (action === 'eat') {
            if (p.inventory.cookedMeat > 0) {
                p.inventory.cookedMeat--;
                p.hp = Math.min(p.maxHp, p.hp + 20);
            }
        }

        if (action === 'drink_beer') {
            if (p.inventory.beer > 0) {
                p.inventory.beer--;
                p.sips++;
                p.stats.sips++;
                if (p.sips === 11) {
                    p.hp = 0; // Explode
                    p.isDead = true;
                    io.to(lobby.id).emit('explosion', {x: p.x, y: p.y});
                }
            }
        }

        if (action === 'mine') {
            lobby.world.ores.forEach((ore, i) => {
                let dist = Math.hypot(p.x - ore.x, p.y - ore.y);
                if (dist < 50) {
                    ore.hits -= (p.role.name === 'Prospector' ? 1.25 : 1);
                    if (ore.hits <= 0) {
                        if (ore.type === 'gold' && p.inventory.gold < p.caps.gold) p.inventory.gold++;
                        if (ore.type === 'silver' && p.inventory.silver < p.caps.silver) p.inventory.silver++;
                        if (ore.type === 'coal' && p.inventory.coal < p.caps.coal) p.inventory.coal++;
                        p.stats.mined++;
                        lobby.world.ores.splice(i, 1);
                    }
                }
            });
        }
    });

    // Game Loop
    setInterval(() => {
        for (let id in lobbies) {
            let lobby = lobbies[id];
            let now = Date.now();
            let dt = (now - lobby.lastTick) / 1000;
            lobby.lastTick = now;

            if (lobby.state.victory) continue;

            // Train Departure Logic
            if (lobby.train.departureTimer > 0) {
                lobby.train.departureTimer -= dt;
                if (lobby.train.departureTimer <= 0) {
                    lobby.train.departureTimer = 0;
                    lobby.train.targetSpeed = lobby.train.speedUpgraded ? 45 : 35;
                    // Teleport off-train players to Caboose
                    let cabooseX = lobby.train.cars[lobby.train.cars.length-1].x + 100;
                    for (let pid in lobby.players) {
                        let p = lobby.players[pid];
                        if (p.y < 250 || p.y > 350) {
                            p.x = cabooseX; p.y = 300;
                        }
                    }
                }
            }

            // Train Movement
            let accel = lobby.train.accel * dt;
            // Stoker role check for accel
            let hasStoker = Object.values(lobby.players).some(p => p.role.name === 'Stoker' && !p.isDead);
            if (hasStoker) accel *= 1.2;

            if (lobby.train.speed < lobby.train.targetSpeed) {
                lobby.train.speed = Math.min(lobby.train.targetSpeed, lobby.train.speed + accel);
            } else if (lobby.train.speed > lobby.train.targetSpeed) {
                lobby.train.speed = Math.max(lobby.train.targetSpeed, lobby.train.speed - accel * 2);
            }

            if (lobby.train.speed > 0) {
                lobby.train.distance += (lobby.train.speed / 3600) * dt * 1000; // km/h to km/s
                
                // Fuel Burn
                let burnRate = lobby.train.fuelBurn * dt;
                let hasEngineer = Object.values(lobby.players).some(p => p.role.name === 'Engineer' && !p.isDead);
                if (hasEngineer) burnRate *= 0.85;
                if (hasStoker) burnRate *= 0.9; // Stoker gives 10% more fuel efficiency effectively
                
                lobby.train.fuel -= burnRate;
                if (lobby.train.fuel <= 0) {
                    lobby.train.fuel = 0;
                    lobby.train.targetSpeed = 0;
                }

                // Pressure Decay
                if (lobby.train.distance - lobby.train.lastPressureDecay >= 67) {
                    lobby.train.pressure = Math.max(0, lobby.train.pressure - 1.67);
                    lobby.train.lastPressureDecay = lobby.train.distance;
                }

                lobby.train.stopEventTriggered = false;
                
                // Tunnel Event
                if (lobby.train.distance > 1670 && now - lobby.state.lastTunnelCheck > 11000) {
                    lobby.state.lastTunnelCheck = now;
                    if (Math.random() < 0.11) {
                        lobby.state.tunnelActive = true;
                        setTimeout(() => lobby.state.tunnelActive = false, 15000);
                    }
                }

                // Bridge Out Event
                if (!lobby.state.bridgeOut && lobby.train.distance > lobby.state.bridgeDistance) {
                    lobby.state.bridgeOut = true;
                    lobby.train.targetSpeed = 0;
                    lobby.train.planksNeeded = Math.floor(Math.random() * 9) + 8;
                    lobby.train.planksDeposited = 0;
                    // Spawn planks
                    for(let i=0; i<20; i++) {
                        lobby.world.planks.push({
                            x: Math.random() * 2000 - 500,
                            y: Math.random() < 0.5 ? Math.random()*200 + 50 : Math.random()*200 + 400
                        });
                    }
                }

                // Victory
                if (lobby.train.distance >= 3181) {
                    lobby.state.victory = true;
                    io.to(lobby.id).emit('victory', lobby.stats);
                }
            } else {
                // Stopped
                if (lobby.train.targetSpeed === 0 && lobby.train.cooldownTimer <= 0 && !lobby.train.stopEventTriggered) {
                    lobby.train.cooldownTimer = 3;
                    lobby.train.stopEventTriggered = true;
                    spawnStopEvents(lobby);
                }
                if (lobby.train.cooldownTimer > 0) lobby.train.cooldownTimer -= dt;
            }

            // Move world objects relative to train
            let worldShift = (lobby.train.speed / 3600) * dt * 1000 * 100; // 100 pixels per km
            
            // Steam Clouds
            lobby.world.steamClouds.forEach((cloud, i) => {
                cloud.timer -= dt * 1000;
                if (cloud.timer <= 0) lobby.world.steamClouds.splice(i, 1);
                else {
                    Object.values(lobby.players).forEach(p => {
                        if (Math.hypot(p.x - cloud.x, p.y - cloud.y) < 60) {
                            if (!p.cloudTime) p.cloudTime = 0;
                            p.cloudTime += dt * 1000;
                            if (p.cloudTime > 4000) {
                                if (!p.lastCloudDmg || now - p.lastCloudDmg > 670) {
                                    p.hp -= 3;
                                    p.lastCloudDmg = now;
                                }
                            }
                        } else {
                            p.cloudTime = 0;
                        }
                    });
                }
            });

            // Drunk Damage
            Object.values(lobby.players).forEach(p => {
                if (p.sips >= 3 && p.sips < 11) {
                    if (!p.drunkDmgTimer) p.drunkDmgTimer = 0;
                    p.drunkDmgTimer += dt;
                    if (p.drunkDmgTimer >= 19) {
                        p.hp -= 11;
                        p.drunkDmgTimer = 0;
                    }
                }
                if (p.hp <= 0 && !p.isDead) p.isDead = true;
            });

            // Kitchen Cooking
            Object.values(lobby.players).forEach(p => {
                if (p.x > 800 && p.x <= 1000 && p.inventory.rawMeat > 0) {
                    if (!p.cookTimer) p.cookTimer = 13;
                    p.cookTimer -= dt;
                    if (p.cookTimer <= 0) {
                        p.inventory.cookedMeat += p.inventory.rawMeat;
                        p.inventory.rawMeat = 0;
                        p.cookTimer = 0;
                    }
                } else {
                    p.cookTimer = 0;
                }
            });

            io.to(lobby.id).emit('state_update', {
                train: lobby.train,
                players: lobby.players,
                world: lobby.world,
                state: lobby.state
            });
        }
    }, 1000 / 30);
});

function spawnStopEvents(lobby) {
    lobby.world.ores =[];
    lobby.world.animals = [];
    lobby.world.enemies =[];
    
    // Ores
    let numOres = Math.floor(Math.random() * 4) + 6; // 6 to 9
    for(let i=0; i<numOres; i++) {
        lobby.world.ores.push({
            x: Math.random() * 1000,
            y: Math.random() < 0.5 ? Math.random() * 150 + 50 : Math.random() * 150 + 400,
            type: ['gold', 'silver', 'coal'][Math.floor(Math.random()*3)],
            hits: Math.floor(Math.random() * 8) + 2
        });
    }

    // Animals
    for(let i=0; i<3; i++) {
        lobby.world.animals.push({
            x: Math.random() * 1500, y: Math.random() * 600,
            hp: 20, type: 'deer'
        });
    }

    // Desert Wildlife
    if (lobby.getBiome() === 'Desert') {
        lobby.world.enemies.push({ x: 500, y: 100, hp: 30, type: 'hawk', speed: 40 });
        lobby.world.enemies.push({ x: 800, y: 400, hp: 50, type: 'snake', dmg: 54 });
    }
}

server.listen(3000, () => console.log('Server running on port 3000'));
// Trading System
    socket.on('trade_sit', (seat) => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby) return;
        if (seat === 1 && !lobby.trade.p1) lobby.trade.p1 = socket.id;
        if (seat === 2 && !lobby.trade.p2) lobby.trade.p2 = socket.id;
        io.to(lobby.id).emit('trade_update', lobby.trade);
    });

    socket.on('trade_offer', (offer) => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby) return;
        if (lobby.trade.p1 === socket.id) lobby.trade.offer1 = offer;
        if (lobby.trade.p2 === socket.id) lobby.trade.offer2 = offer;
        io.to(lobby.id).emit('trade_update', lobby.trade);
    });

    socket.on('trade_confirm', () => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby) return;
        if (lobby.trade.p1 === socket.id) lobby.trade.locked1 = true;
        if (lobby.trade.p2 === socket.id) lobby.trade.locked2 = true;
        
        if (lobby.trade.locked1 && lobby.trade.locked2 && !lobby.trade.active) {
            lobby.trade.active = true;
            lobby.trade.timer = 5;
            let countdown = setInterval(() => {
                lobby.trade.timer--;
                io.to(lobby.id).emit('trade_update', lobby.trade);
                if (lobby.trade.timer <= 0) {
                    clearInterval(countdown);
                    executeTrade(lobby);
                }
                if (!lobby.trade.locked1 || !lobby.trade.locked2) {
                    clearInterval(countdown);
                    lobby.trade.active = false;
                }
            }, 1000);
        }
        io.to(lobby.id).emit('trade_update', lobby.trade);
    });

    socket.on('trade_decline', () => {
        const lobby = lobbies[socket.lobbyId];
        if (!lobby) return;
        if (lobby.trade.active) {
            lobby.trade.locked1 = false; lobby.trade.locked2 = false; lobby.trade.active = false;
        } else {
            if (lobby.trade.p1 === socket.id) lobby.trade.p1 = null;
            if (lobby.trade.p2 === socket.id) lobby.trade.p2 = null;
        }
        io.to(lobby.id).emit('trade_update', lobby.trade);
    });

    function executeTrade(lobby) {
        let p1 = lobby.players[lobby.trade.p1];
        let p2 = lobby.players[lobby.trade.p2];
        let o1 = lobby.trade.offer1;
        let o2 = lobby.trade.offer2;

        // Deduct
        p1.inventory.gold -= o1.gold; p1.inventory.silver -= o1.silver; p1.inventory.coal -= o1.coal; p1.inventory.skins -= o1.skins; p1.inventory.money -= o1.money;
        p2.inventory.gold -= o2.gold; p2.inventory.silver -= o2.silver; p2.inventory.coal -= o2.coal; p2.inventory.skins -= o2.skins; p2.inventory.money -= o2.money;
        // Add
        p1.inventory.gold += o2.gold; p1.inventory.silver += o2.silver; p1.inventory.coal += o2.coal; p1.inventory.skins += o2.skins; p1.inventory.money += o2.money;
        p2.inventory.gold += o1.gold; p2.inventory.silver += o1.silver; p2.inventory.coal += o1.coal; p2.inventory.skins += o1.skins; p2.inventory.money += o1.money;

        lobby.trade = { p1: null, p2: null, offer1: {gold:0,silver:0,coal:0,skins:0,money:0}, offer2: {gold:0,silver:0,coal:0,skins:0,money:0}, locked1: false, locked2: false, timer: 0, active: false };
        io.to(lobby.id).emit('trade_update', lobby.trade);
    }

    // Storage
    socket.on('buy_storage', () => {
        const lobby = lobbies[socket.lobbyId];
        const p = lobby.players[socket.id];
        if (p.inventory.money >= 41 && lobby.storage.count < 6) {
            p.inventory.money -= 41;
            lobby.storage.count++;
            lobby.storage.capacity += 99;
            lobby.train.cars.splice(lobby.train.cars.length-1, 0, { type: 'Storage', x: 1400 + (lobby.storage.count-1)*200, w: 200 });
            lobby.train.cars[lobby.train.cars.length-1].x += 200; // Move caboose back
            io.to(lobby.id).emit('storage_update', lobby.storage);
        }
    });

    socket.on('deposit_storage', (items) => {
        const lobby = lobbies[socket.lobbyId];
        const p = lobby.players[socket.id];
        let total = items.gold + items.silver + items.coal;
        let currentTotal = lobby.storage.gold + lobby.storage.silver + lobby.storage.coal;
        if (currentTotal + total <= lobby.storage.capacity) {
            p.inventory.gold -= items.gold; lobby.storage.gold += items.gold;
            p.inventory.silver -= items.silver; lobby.storage.silver += items.silver;
            p.inventory.coal -= items.coal; lobby.storage.coal += items.coal;
            io.to(lobby.id).emit('storage_update', lobby.storage);
        }
    });

    // Gambling
    socket.on('gamble', (type) => {
        const lobby = lobbies[socket.lobbyId];
        const p = lobby.players[socket.id];
        if (p.inventory.money >= 10) {
            p.inventory.money -= 10;
            let win = false; let payout = 0;
            if (type === 'horse') { if (Math.random() < 0.25) { win = true; payout = 40; } }
            if (type === 'roulette_red') { if (Math.random() < 0.48) { win = true; payout = 20; } }
            if (type === 'roulette_green') { if (Math.random() < 0.04) { win = true; payout = 140; } }
            if (type === 'poker') { if (Math.random() < 0.33) { win = true; payout = 30; } }
            
            if (win) p.inventory.money += payout;
            socket.emit('gamble_result', { win, payout });
        }
    });
