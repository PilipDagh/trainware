// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));

const FPS = 60;
const TICK_RATE = 1000 / FPS;
const JOURNEY_LENGTH = 3181;
const MAX_COAL = 1003;
const MAX_PRESSURE = 100;

const ROLES =['Sharpshooter', 'Engineer', 'Prospector', 'Medic', 'Trapper', 'Soldier', 'Blacksmith', 'Normal'];
const COLORS =['#0000FF', '#FF0000', '#008000', '#800080', '#FFA500', '#FFC0CB'];

const lobbies = {};
const connectedPlayers = {};

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
        this.state = 'LOBBY'; 
        
        this.train = {
            state: 'STOPPED', 
            speed: 0,
            distance: 0,
            coal: 500,
            pressure: 0,
            departTimer: 0,
            stopProcessed: false,
            storageCars: 0,
            storageInventories:[],
            planksDeposited: 0,
            fogActive: false
        };
        
        this.world = {
            objects: [], 
            enemies:[], 
            bullets:[],
            townsVisited: 0,
            event: null, 
            planksRequired: 0
        };
        
        this.stats = { kills: {}, beerSips: {}, coalMined: {}, traitorWon: false };
        this.loop = null;
    }

    addPlayer(socketId, name) {
        if (Object.keys(this.players).length >= this.maxPlayers) return false;
        this.players[socketId] = {
            id: socketId, name: name, x: 150, y: 0, hp: 100, isDead: false,
            color: COLORS[Object.keys(this.players).length % COLORS.length],
            role: 'Normal', isTraitor: false,
            inventory: { 
                gold: 0, silver: 0, coal: 0, meat: 0, cookedMeat: 0, 
                ammo: 20, skins: 0, planks: 0, money: 0, flashlights: 0, 
                bandages: 0, beer: 0, bombs: 0, watches: 0, warmClothes: 0, reviveKits: 0 
            },
            stats: { kills: 0, beerSips: 0, coalMined: 0 },
            drunkLevel: 0,
            vx: 0, vy: 0, angle: 0,
            isCooking: false
        };
        this.stats.kills[name] = 0;
        this.stats.beerSips[name] = 0;
        this.stats.coalMined[name] = 0;
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
        let availableRoles =[...ROLES];
        
        if (this.enableTraitor && pKeys.length > 1) {
            const traitorId = pKeys[randomInt(0, pKeys.length - 1)];
            this.players[traitorId].isTraitor = true;
        }

        pKeys.forEach(id => {
            const roleIdx = randomInt(0, availableRoles.length - 1);
            this.players[id].role = availableRoles[roleIdx];
            availableRoles.splice(roleIdx, 1);
            if (availableRoles.length === 0) availableRoles = [...ROLES];

            if (this.players[id].role === 'Soldier') this.players[id].inventory.ammo = 64;
        });
    }

    isPointInTrain(x, y) {
        const minX = -1800 - (this.train.storageCars * 300);
        const maxX = 300;
        const minY = -100;
        const maxY = 100;
        return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }

    spawnWorldStop() {
        this.world.objects =[];
        this.world.enemies =[];
        this.world.townsVisited++;

        if (Math.random() < 0.1) {
            this.world.event = 'BRIDGE';
            this.world.planksRequired = randomInt(8, 16);
            this.train.planksDeposited = 0;
            for(let i=0; i < this.world.planksRequired + 5; i++) {
                this.world.objects.push({ id: generateId(), type: 'Plank', x: randomInt(400, 2000), y: randomInt(-800, 800) });
            }
        } else {
            this.world.event = null;
            for(let i=0; i<20; i++) this.world.objects.push({ id: generateId(), type: 'Tree', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 100 });
            for(let i=0; i<15; i++) this.world.objects.push({ id: generateId(), type: 'Ore', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 100 });
            for(let i=0; i<5; i++) this.world.enemies.push({ id: generateId(), type: 'Animal', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 50 });
            for(let i=0; i<3; i++) this.world.enemies.push({ id: generateId(), type: 'Snake', x: randomInt(400, 2000), y: randomInt(-800, 800), hp: 30, state: 'flee' });
            
            if (this.world.townsVisited % 3 === 0) {
                for(let i=0; i<2; i++) this.world.enemies.push({ id: generateId(), type: 'Marshal', x: randomInt(500, 1000), y: randomInt(-500, 500), hp: 331 });
            }
        }
        
        this.world.objects.push({ id: generateId(), type: 'Shop', x: 400, y: 0 });
    }

    update() {
        if (this.state !== 'PLAYING') return;

        const dx = this.train.speed / FPS;

        if (this.train.state === 'MOVING') {
            this.train.distance += dx;
            
            this.world.objects.forEach(obj => obj.x -= dx * 100);
            this.world.enemies.forEach(en => en.x -= dx * 100);

            if (Math.floor(this.train.distance) % 67 === 0 && this.train.distance > 0) {
                this.train.pressure = Math.max(0, this.train.pressure - (1.67 / FPS));
            }

            let fuelBurn = 0.05;
            Object.values(this.players).forEach(p => { if(p.role === 'Engineer' && !p.isDead) fuelBurn *= 0.85; });
            this.train.coal -= fuelBurn / FPS;
            
            if (this.train.coal <= 0) {
                this.train.coal = 0;
                this.train.speed = 0;
                this.train.state = 'STOPPED';
                this.train.stopProcessed = false;
            }

            if (this.train.distance > 1670 && !this.world.event && Math.random() < 0.0005) {
                this.world.event = 'TUNNEL';
            } else if (this.world.event === 'TUNNEL' && Math.random() < 0.001) {
                this.world.event = null;
            }

        } else if (this.train.state === 'DEPARTING') {
            this.train.departTimer -= 1 / FPS;
            if (this.train.departTimer <= 0) {
                this.train.state = 'MOVING';
                this.train.speed = 5;
                
                const cabooseX = -1650;
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

        Object.values(this.players).forEach(p => {
            if (p.isDead) return;
            
            let speedMult = p.drunkLevel >= 3 ? 1.5 : 1;
            let nextX = p.x + (p.vx * speedMult);
            let nextY = p.y + (p.vy * speedMult);

            if (this.train.state !== 'STOPPED') {
                if (this.isPointInTrain(nextX, nextY)) {
                    p.x = nextX; p.y = nextY;
                } else if (this.isPointInTrain(p.x, nextY)) {
                    p.y = nextY;
                } else if (this.isPointInTrain(nextX, p.y)) {
                    p.x = nextX;
                }
            } else {
                p.x = nextX; p.y = nextY;
            }

            if (this.train.fogActive && p.x > -150 && p.x < 150 && p.y > -150 && p.y < 150) {
                p.fogTime = (p.fogTime || 0) + 1/FPS;
                if (p.fogTime > 4) {
                    p.fogDamageTimer = (p.fogDamageTimer || 0) + 1/FPS;
                    if (p.fogDamageTimer >= 0.67) {
                        p.hp -= 3;
                        p.fogDamageTimer = 0;
                        if (p.hp <= 0) p.isDead = true;
                    }
                }
            } else {
                p.fogTime = 0;
            }
        });

        this.world.enemies.forEach(en => {
            if (en.hp <= 0) return;
            
            let target = null;
            let minDist = Infinity;
            Object.values(this.players).forEach(p => {
                if (p.isDead || p.isTraitor) return;
                let d = distance(en.x, en.y, p.x, p.y);
                if (d < minDist) { minDist = d; target = p; }
            });

            if (target) {
                const angle = Math.atan2(target.y - en.y, target.x - en.x);
                if (en.type === 'Marshal') {
                    en.x += Math.cos(angle) * 2; en.y += Math.sin(angle) * 2;
                    if (minDist < 300 && Math.random() < 0.05) {
                        this.world.bullets.push({ id: generateId(), x: en.x, y: en.y, vx: Math.cos(angle)*10, vy: Math.sin(angle)*10, isTraitor: false, dmg: 20, owner: 'AI' });
                    }
                } else if (en.type === 'Snake') {
                    if (en.state === 'flee' && minDist < 200) {
                        en.x -= Math.cos(angle) * 4; en.y -= Math.sin(angle) * 4;
                        if (Math.random() < 0.02) en.state = 'strike';
                    } else if (en.state === 'strike') {
                        en.x += Math.cos(angle) * 6; en.y += Math.sin(angle) * 6;
                        if (minDist < 20) { target.hp -= 54; en.hp = 0; if(target.hp <= 0) target.isDead = true; }
                    }
                } else if (en.type === 'Hawk') {
                    en.x += Math.cos(angle) * 7; en.y += Math.sin(angle) * 7;
                    if (minDist < 20) { target.hp -= 34; en.hp = 0; if(target.hp <= 0) target.isDead = true; }
                } else if (en.type === 'Animal') {
                    if (minDist < 200) {
                        en.x -= Math.cos(angle) * 3; en.y -= Math.sin(angle) * 3;
                    }
                }
            }
        });
        this.world.enemies = this.world.enemies.filter(e => e.hp > 0);

        for (let i = this.world.bullets.length - 1; i >= 0; i--) {
            let b = this.world.bullets[i];
            b.x += b.vx; b.y += b.vy;
            b.life = (b.life || 0) + 1;
            if (b.life > 100) { this.world.bullets.splice(i, 1); continue; }

            let hit = false;
            Object.values(this.players).forEach(p => {
                if (p.isDead || hit) return;
                if (b.owner !== p.id && distance(b.x, b.y, p.x, p.y) < 20) {
                    const owner = this.players[b.owner];
                    if (owner && !owner.isTraitor && !p.isTraitor && b.owner !== 'AI') return; 
                    
                    p.hp -= b.dmg;
                    if (p.hp <= 0) {
                        p.isDead = true;
                        if (owner) {
                            owner.stats.kills++;
                            this.stats.kills[owner.name] = owner.stats.kills;
                        }
                    }
                    hit = true;
                }
            });
            
            if (!hit && b.owner !== 'AI') {
                this.world.enemies.forEach(en => {
                    if (!hit && distance(b.x, b.y, en.x, en.y) < 30) {
                        en.hp -= b.dmg;
                        hit = true;
                        if (en.hp <= 0) {
                            const owner = this.players[b.owner];
                            if (en.type === 'Animal' && owner) {
                                if (owner.inventory.meat < 7) owner.inventory.meat++;
                                owner.inventory.skins++;
                                owner.inventory.money += owner.role === 'Trapper' ? 3 : 1;
                            }
                        }
                    }
                });
            }
            if (hit) this.world.bullets.splice(i, 1);
        }

        if (this.train.distance >= JOURNEY_LENGTH) {
            this.state = 'VICTORY';
            let traitorAlive = false;
            Object.values(this.players).forEach(p => { if (p.isTraitor && !p.isDead) traitorAlive = true; });
            this.stats.traitorWon = traitorAlive;
            clearInterval(this.loop);
            io.to(this.id).emit('victory', this.stats);
        }

        io.to(this.id).emit('game_state', {
            train: this.train,
            players: this.players,
            world: this.world
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

    socket.on('player_input', (data) => {
        const lobbyId = connectedPlayers[socket.id].lobbyId;
        if (!lobbyId) return;
        const lobby = lobbies[lobbyId];
        const p = lobby.players[socket.id];
        if (!p || p.isDead) return;

        p.vx = data.dx * 4;
        p.vy = data.dy * 4;
        p.angle = data.angle;

        if (data.shoot && p.inventory.ammo > 0) {
            p.inventory.ammo--;
            let dmg = p.role === 'Sharpshooter' ? 24 : 20;
            if (p.drunkLevel >= 3) dmg *= 1.5;
            lobby.world.bullets.push({
                id: generateId(), x: p.x, y: p.y, 
                vx: Math.cos(data.angle)*15, vy: Math.sin(data.angle)*15,
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

        if (lobby.train.state === 'STOPPED' && p.x > 0 && p.x < 300 && p.y > -100 && p.y < 100) {
            if (lobby.world.event === 'BRIDGE' && lobby.train.planksDeposited < lobby.world.planksRequired) return;
            lobby.train.state = 'DEPARTING';
            lobby.train.departTimer = 8;
            io.to(lobbyId).emit('departure_warning');
        }

        if (p.x > -1200 && p.x < -900 && p.inventory.meat > 0 && !p.isCooking) {
            p.isCooking = true;
            p.inventory.meat--;
            socket.emit('notification', 'Cooking started... (13s)');
            setTimeout(() => {
                if (lobby.players[p.id]) {
                    lobby.players[p.id].inventory.cookedMeat++;
                    lobby.players[p.id].isCooking = false;
                    socket.emit('notification', 'Meat Cooked!');
                }
            }, 13000);
        }

        if (lobby.world.event === 'BRIDGE') {
            lobby.world.objects.forEach((obj, idx) => {
                if (obj.type === 'Plank' && distance(p.x, p.y, obj.x, obj.y) < 50) {
                    p.inventory.planks++;
                    lobby.world.objects.splice(idx, 1);
                }
            });
            if (p.x > 0 && p.x < 300 && p.inventory.planks > 0) {
                lobby.train.planksDeposited += p.inventory.planks;
                p.inventory.planks = 0;
            }
        }

        lobby.world.objects.forEach((obj, idx) => {
            if (obj.type === 'Ore' && distance(p.x, p.y, obj.x, obj.y) < 50) {
                let mineSpeed = p.role === 'Prospector' ? 750 : 1000;
                setTimeout(() => {
                    if (lobby.players[p.id] && distance(lobby.players[p.id].x, lobby.players[p.id].y, obj.x, obj.y) < 50) {
                        const roll = Math.random();
                        if (roll < 0.5 && p.inventory.coal < 27) { p.inventory.coal++; p.stats.coalMined++; lobby.stats.coalMined[p.name] = p.stats.coalMined; }
                        else if (roll < 0.8 && p.inventory.silver < 15) p.inventory.silver++;
                        else if (p.inventory.gold < 11) p.inventory.gold++;
                        lobby.world.objects.splice(idx, 1);
                    }
                }, mineSpeed);
            }
            if (obj.type === 'Shop' && distance(p.x, p.y, obj.x, obj.y) < 50) {
                let earned = (p.inventory.gold * 5) + (p.inventory.silver * 3);
                p.inventory.money += earned;
                p.inventory.gold = 0;
                p.inventory.silver = 0;
                socket.emit('open_shop');
            }
        });
    });

    socket.on('buy_item', (item) => {
        const lobbyId = connectedPlayers[socket.id].lobbyId;
        if (!lobbyId) return;
        const p = lobbies[lobbyId].players[socket.id];
        if (!p || p.isDead) return;

        const prices = { 'Bandages': 2, 'Bombs': 5, 'Knife': 5, 'Ammo': 4, 'WarmClothes': 11, 'BeerBottle': 3, 'BeerBarrel': 11, 'ReviveKit': 21, 'Flashlight': 11 };
        if (p.inventory.money >= prices[item]) {
            p.inventory.money -= prices[item];
            if (item === 'Ammo') p.inventory.ammo += 10;
            else if (item === 'Bandages') p.inventory.bandages++;
            else if (item === 'BeerBottle') p.inventory.beer += 8;
            else if (item === 'BeerBarrel') p.inventory.beer += 67;
            else if (item === 'ReviveKit') p.inventory.reviveKits++;
            else if (item === 'Flashlight') p.inventory.flashlights++;
        }
    });

    socket.on('eat_meat', () => {
        const p = lobbies[connectedPlayers[socket.id].lobbyId]?.players[socket.id];
        if (p && p.inventory.cookedMeat > 0) {
            p.inventory.cookedMeat--;
            p.hp = Math.min(100, p.hp + 20);
        }
    });

    socket.on('drink_beer', () => {
        const lobby = lobbies[connectedPlayers[socket.id].lobbyId];
        const p = lobby?.players[socket.id];
        if (p && p.inventory.beer > 0) {
            p.inventory.beer--;
            p.drunkLevel++;
            p.stats.beerSips++;
            lobby.stats.beerSips[p.name] = p.stats.beerSips;
            if (p.drunkLevel >= 11) {
                p.hp = 0; p.isDead = true; 
            }
        }
    });

    socket.on('steam_valve', (active) => {
        const lobby = lobbies[connectedPlayers[socket.id].lobbyId];
        if (lobby && lobby.train.state === 'MOVING') {
            if (active && lobby.train.pressure < MAX_PRESSURE) {
                lobby.train.pressure += (2 / (FPS * 1.67));
                lobby.train.fogActive = true;
            } else {
                lobby.train.fogActive = false;
            }
        }
    });

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
