// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

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

    start() {
        this.state = 'PLAYING';
        this.assignRoles();
        this.train.stopProcessed = false;
        this.loop = setInterval(() => this.update(), TICK_RATE);
    }

    assignRoles() {
        const pKeys = Object.keys(this.players);
        let availableRoles = [...ROLES];
        
        // Assign Traitor
        if (this.enableTraitor && pKeys.length > 1) {
            const traitorId = pKeys[randomInt(0, pKeys.length - 1)];
            this.players[traitorId].isTraitor = true;
        }

        pKeys.forEach(id => {
            const roleIdx = randomInt(0, availableRoles.length - 1);
            this.players[id].role = availableRoles[roleIdx];
            availableRoles.splice(roleIdx, 1);
            if (availableRoles.length === 0) availableRoles = [...ROLES];

            // Apply starting buffs
            if (this.players[id].role === 'Soldier') this.players[id].inventory.ammo = 64;
        });
    }
}

io.on('connection', (socket) => {
    connectedPlayers[socket.id] = { name: 'Conductor', lobbyId: null };

    socket.on('create_lobby', (data) => {
        const id = generateId();
        lobbies[id] = new GameLobby(id, data.name, data.maxPlayers, data.password, data.enableTraitor);
        lobbies[id].addPlayer(socket.id, data.playerName);
        connectedPlayers[socket.id].lobbyId = id;
        socket.join(id);
        io.to(id).emit('lobby_update', lobbies[id]);
    });

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
        } else {
            socket.emit('error_msg', 'Invalid lobby or password.');
        }
    });

    socket.on('get_lobbies', () => {
        const publicLobbies = Object.values(lobbies).filter(l => l.state === 'LOBBY').map(l => ({
            id: l.id, name: l.name, players: Object.keys(l.players).length, max: l.maxPlayers, hasPassword: !!l.password
        }));
        socket.emit('lobby_list', publicLobbies);
    });

    socket.on('start_game', () => {
        const lobbyId = connectedPlayers[socket.id].lobbyId;
        if (lobbyId && lobbies[lobbyId]) {
            lobbies[lobbyId].start();
            io.to(lobbyId).emit('game_started', lobbies[lobbyId]);
        }
    });
});
// Append to server.js

GameLobby.prototype.update = function() {
    if (this.state !== 'PLAYING') return;

    const dx = this.train.speed / FPS; // World scroll amount

    // 1. Train State Machine & Scrolling Engine
    if (this.train.state === 'MOVING') {
        this.train.distance += dx;
        
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
            });
        }
    } else if (this.train.state === 'STOPPED') {
        if (!this.train.stopProcessed) {
            this.spawnWorldStop();
            this.train.stopProcessed = true;
        }
    }

    // 2. Player Movement & Train Barrier
    Object.values(this.players).forEach(p => {
        if (p.isDead) return;
        
        // Apply inputs (handled via socket events updating p.vx, p.vy)
        let nextX = p.x + (p.vx || 0);
        let nextY = p.y + (p.vy || 0);

        // The Train Barrier
        if (this.train.state !== 'STOPPED') {
            if (this.isPointInTrain(nextX, nextY)) {
                p.x = nextX; p.y = nextY;
            }
        } else {
            p.x = nextX; p.y = nextY; // Free roam when stopped
        }
    });

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

        if (target) {
            const angle = Math.atan2(target.y - en.y, target.x - en.x);
            if (en.type === 'Marshal') {
                en.x += Math.cos(angle) * 2; en.y += Math.sin(angle) * 2;
                if (minDist < 300 && Math.random() < 0.05) {
                    this.world.bullets.push({ x: en.x, y: en.y, vx: Math.cos(angle)*10, vy: Math.sin(angle)*10, isTraitor: false, dmg: 20, owner: 'AI' });
                }
            } else if (en.type === 'Snake') {
                if (en.state === 'flee' && minDist < 200) {
                    en.x -= Math.cos(angle) * 4; en.y -= Math.sin(angle) * 4;
                    if (Math.random() < 0.02) en.state = 'strike';
                } else if (en.state === 'strike') {
                    en.x += Math.cos(angle) * 6; en.y += Math.sin(angle) * 6;
                    if (minDist < 20) { target.hp -= 54; en.hp = 0; } // Strike and die
                }
            } else if (en.type === 'Hawk') {
                en.x += Math.cos(angle) * 7; en.y += Math.sin(angle) * 7; // Faster than train
                if (minDist < 20) { target.hp -= 34; en.hp = 0; }
            }
        }
    });
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
            });
        }
        if (hit) this.world.bullets.splice(i, 1);
    }
};

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
            }, 13000);
        }

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
        }
    });

    socket.on('eat_meat', () => {
        const p = lobbies[connectedPlayers[socket.id].lobbyId]?.players[socket.id];
        if (p && p.inventory.cookedMeat > 0) {
            p.inventory.cookedMeat--;
            p.hp = Math.min(100, p.hp + 20);
        }
    });

    // Gambling Logic
    socket.on('gamble', (data) => {
        const p = lobbies[connectedPlayers[socket.id].lobbyId]?.players[socket.id];
        if (!p || p.inventory.money < data.bet) return;
        p.inventory.money -= data.bet;
        
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
        const info = connectedPlayers[socket.id];
        if (info && info.lobbyId && lobbies[info.lobbyId]) {
            delete lobbies[info.lobbyId].players[socket.id];
        }
        delete connectedPlayers[socket.id];
    });
});

server.listen(3000, () => console.log('Server running on port 3000'));
