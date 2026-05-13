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

    // ... (Interactions and Game Loop in next chunk)
