const socket = io();
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let gameState = null;
let keys = { w: false, a: false, s: false, d: false };
let mouseX = 0, mouseY = 0;

// Define the multi-car train layout (must match server)
const TRAIN_CARS =[
    { id: 'engine', x: 120, w: 160, y: -40, h: 80 },
    { id: 'coal', x: 10, w: 100, y: -35, h: 70 },
    { id: 'pass1', x: -140, w: 140, y: -40, h: 80 },
    { id: 'pass2', x: -290, w: 140, y: -40, h: 80 },
    { id: 'caboose', x: -400, w: 100, y: -35, h: 70 }
];

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

window.addEventListener('keydown', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    
    if (key === 'e') {
        socket.emit('interact');
        if (gameState && gameState.shop.active && gameState.train.inTown) {
            document.getElementById('shop').classList.remove('hidden');
            renderShop();
        }
    }
    
    if (key === 'f') {
        if (gameState && gameState.players[socket.id]) {
            let cx = canvas.width / 2;
            let cy = canvas.height / 2;
            let worldX = gameState.players[socket.id].x + (mouseX - cx);
            let worldY = gameState.players[socket.id].y + (mouseY - cy);
            socket.emit('throwBomb', { x: worldX, y: worldY });
        }
    }

    if (e.key === ' ') {
        socket.emit('stab');
    }
});

window.addEventListener('keyup', (e) => {
    let key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    if (gameState && gameState.players[socket.id]) {
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        let angle = Math.atan2(mouseY - cy, mouseX - cx);
        socket.emit('aim', angle);
    }
});

window.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
        let cx = canvas.width / 2;
        let cy = canvas.height / 2;
        
        let clickedOre = false;
        if (gameState && gameState.train.state === 'STOPPED') {
            let myPlayer = gameState.players[socket.id];
            if (myPlayer) {
                let worldX = myPlayer.x + (mouseX - cx);
                let worldY = myPlayer.y + (mouseY - cy);
                for (let ore of gameState.ores) {
                    if (Math.hypot(worldX - ore.x, worldY - ore.y) < 30) {
                        socket.emit('mine', ore.id);
                        clickedOre = true;
                        break;
                    }
                }
            }
        }
        if (!clickedOre) socket.emit('shoot');
    }
});

socket.on('state', (state) => {
    gameState = state;
    updateUI();
});

socket.on('msg', (msg) => {
    let el = document.getElementById('messages');
    el.innerText = msg;
    setTimeout(() => el.innerText = '', 4000);
});

socket.on('victory', () => {
    document.getElementById('victory').classList.remove('hidden');
});

function closeShop() {
    document.getElementById('shop').classList.add('hidden');
}

function renderShop() {
    let container = document.getElementById('shop-items');
    container.innerHTML = '';
    gameState.shop.items.forEach(item => {
        let btn = document.createElement('button');
        let stockText = item.stock !== undefined ? ` (${item.stock} left)` : '';
        btn.innerText = `${item.name} - $${item.cost}${stockText}`;
        btn.onclick = () => socket.emit('buy', item.id);
        container.appendChild(btn);
    });
}

function updateUI() {
    if (!gameState || !gameState.players[socket.id]) return;
    let p = gameState.players[socket.id];
    
    if (p.dead) document.getElementById('death').classList.remove('hidden');

    document.getElementById('hp').innerText = Math.floor(p.hp);
    document.getElementById('ammo').innerText = p.bullets;
    document.getElementById('bombs').innerText = p.bombs;
    document.getElementById('money').innerText = p.money;
    document.getElementById('dist').innerText = Math.floor(gameState.train.distance);
    document.getElementById('biome').innerText = gameState.biome.toUpperCase();
    document.getElementById('fuel').innerText = Math.floor(gameState.train.fuel);
    document.getElementById('speed').innerText = Math.floor(gameState.train.speed);
    document.getElementById('cold').innerText = Math.floor(p.coldMeter);
}
function drawHumanoid(x, y, color, angle, hasKnife, onHorse, isEnemy, enemyType) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Horse
    if (onHorse) {
        ctx.fillStyle = '#8b4513';
        ctx.fillRect(-20, -15, 50, 30); 
        ctx.fillRect(20, -10, 20, 20); 
        ctx.fillStyle = '#000';
        ctx.fillRect(35, -5, 5, 5); 
    }

    // Body
    ctx.fillStyle = color;
    ctx.fillRect(-8, -12, 16, 24);

    // Hands
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(10, -14, 5, 0, Math.PI*2); ctx.fill(); 
    ctx.beginPath(); ctx.arc(10, 14, 5, 0, Math.PI*2); ctx.fill(); 

    // Weapon
    if (hasKnife || enemyType === 'knifeman') {
        ctx.fillStyle = '#ccc';
        ctx.fillRect(10, 12, 15, 4); 
    } else if (enemyType === 'bombman') {
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(15, 14, 6, 0, Math.PI*2); ctx.fill(); 
    } else {
        ctx.fillStyle = '#333';
        ctx.fillRect(10, 12, 16, 4); 
        ctx.fillRect(10, 14, 4, 4); 
    }

    // Head
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();

    // Hat
    if (!isEnemy) {
        ctx.fillStyle = '#111'; 
        ctx.beginPath(); ctx.arc(2, 0, 11, -Math.PI/2, Math.PI/2); ctx.fill();
        ctx.fillStyle = color; 
        ctx.fillRect(-8, -9, 10, 18);
        ctx.fillStyle = '#ffd700'; 
        ctx.fillRect(-2, -4, 4, 8);
    } else {
        if (enemyType === 'gunman') {
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#333';
            ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI*2); ctx.fill();
        } else if (enemyType === 'knifeman') {
            ctx.fillStyle = '#800';
            ctx.fillRect(-8, -8, 16, 16);
        } else if (enemyType === 'bombman') {
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
        }
    }

    ctx.restore();
}

function drawTrain() {
    ctx.fillStyle = '#555';
    ctx.fillRect(110, -5, 10, 10); 
    ctx.fillRect(0, -5, 10, 10);   
    ctx.fillRect(-150, -5, 10, 10); 
    ctx.fillRect(-300, -5, 10, 10); 

    TRAIN_CARS.forEach(car => {
        ctx.save();
        ctx.translate(car.x, car.y);

        if (car.id === 'engine') {
            ctx.fillStyle = '#222';
            ctx.fillRect(0, 10, 100, 60);
            ctx.fillStyle = '#111';
            ctx.fillRect(100, 0, 60, 80);
            ctx.fillStyle = '#000';
            ctx.fillRect(95, -5, 70, 90);
            ctx.fillStyle = '#444';
            ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(-30, 40); ctx.lineTo(0, 70); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.fillRect(10, 30, 20, 20);
            
            ctx.fillStyle = gameState.train.state === 'STOPPED' && gameState.train.buttonCooldown <= 0 ? '#0f0' : '#f00';
            ctx.beginPath();
            ctx.arc(120, 40, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

        } else if (car.id === 'coal') {
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#0a0a0a';
            for(let i=10; i<car.w-10; i+=15) {
                for(let j=10; j<car.h-10; j+=15) {
                    ctx.fillRect(i, j, 12, 12);
                }
            }
        } else if (car.id.startsWith('pass')) {
            ctx.fillStyle = '#6b4423'; 
            ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#222';
            ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
            ctx.fillStyle = '#87ceeb';
            for(let i=20; i<car.w-20; i+=30) {
                ctx.fillRect(i, 10, 15, 15);
                ctx.fillRect(i, car.h - 25, 15, 15);
            }
        } else if (car.id === 'caboose') {
            ctx.fillStyle = '#8b0000'; 
            ctx.fillRect(0, 0, car.w, car.h);
            ctx.fillStyle = '#600000';
            ctx.fillRect(30, 15, 40, 40);
            ctx.fillStyle = '#222';
            ctx.fillRect(-5, -5, car.w + 10, car.h + 10);
        }

        ctx.restore();
    });
}

function draw() {
    if (!gameState) {
        requestAnimationFrame(draw);
        return;
    }

    let myPlayer = gameState.players[socket.id] || { x: 0, y: 0 };
    let cx = canvas.width / 2;
    let cy = canvas.height / 2;

    // 1. Base Biome Color
    let bgColor = '#2d4c1e'; // Forest
    if (gameState.biome === 'desert') bgColor = '#c2b280';
    if (gameState.biome === 'tundra') bgColor = '#e0e6ed';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(cx - myPlayer.x, cy - myPlayer.y);

    let pixelDist = gameState.train.distance * 1000;

    // 2. Draw Mountains (Parallax Scrolling)
    if (gameState.inMountains) {
        ctx.fillStyle = gameState.biome === 'tundra' ? '#aab' : '#555';
        let mountainOffset = (pixelDist * 0.2) % 400;
        for(let i = -2000; i < 2000; i+= 400) {
            ctx.beginPath();
            ctx.moveTo(i - mountainOffset + myPlayer.x, -400);
            ctx.lineTo(i + 200 - mountainOffset + myPlayer.x, -700);
            ctx.lineTo(i + 400 - mountainOffset + myPlayer.x, -400);
            ctx.fill();
        }
    }

    // 3. Draw Biome Scenery (Trees, Cacti, Snow Mounds)
    let sceneryOffset = pixelDist % 600;
    for(let i = -2000; i < 2000; i+= 300) {
        let xPos = i - sceneryOffset + myPlayer.x;
        
        // Draw scenery above and below the tracks
        [-300, -150, 150, 300].forEach(yOffset => {
            // Add slight pseudo-randomness to positions based on index
            let finalX = xPos + (Math.abs(yOffset) % 100);
            let finalY = yOffset + myPlayer.y;

            if (gameState.biome === 'forest') {
                // Pine Tree
                ctx.fillStyle = '#3e2723'; // Trunk
                ctx.fillRect(finalX - 5, finalY, 10, 20);
                ctx.fillStyle = '#1b5e20'; // Leaves
                ctx.beginPath(); ctx.moveTo(finalX, finalY - 40); ctx.lineTo(finalX - 20, finalY + 5); ctx.lineTo(finalX + 20, finalY + 5); ctx.fill();
            } else if (gameState.biome === 'desert') {
                // Cactus
                ctx.fillStyle = '#2e7d32';
                ctx.fillRect(finalX - 6, finalY - 30, 12, 40); // Main body
                ctx.fillRect(finalX - 15, finalY - 15, 10, 8); // Left arm
                ctx.fillRect(finalX + 5, finalY - 20, 10, 8);  // Right arm
            } else if (gameState.biome === 'tundra') {
                // Snow Mound
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(finalX, finalY, 25, 0, Math.PI, true); ctx.fill();
            }
        });
    }

    // 4. Draw Ground Speed Lines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    let groundOffset = pixelDist % 200;
    for(let i = -2000; i < 2000; i+= 200) {
        for(let j = -1000; j < 1000; j+= 100) {
            ctx.fillRect(i - groundOffset + myPlayer.x + (j%50), j + myPlayer.y, 20, 4);
        }
    }

    // 5. Draw Train Tracks
    let tieOffset = pixelDist % 40;
    ctx.fillStyle = '#4a3c31'; 
    for(let i = -2000; i < 2000; i+= 40) {
        ctx.fillRect(i - tieOffset + myPlayer.x, -35, 10, 70);
    }
    ctx.fillStyle = '#777'; 
    ctx.fillRect(-2000 + myPlayer.x, -25, 4000, 6);
    ctx.fillRect(-2000 + myPlayer.x, 19, 4000, 6);

    // 6. Draw Avalanche Rocks
    if (gameState.avalancheRocks && gameState.avalancheRocks.length > 0) {
        ctx.fillStyle = '#444';
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        gameState.avalancheRocks.forEach(rock => {
            ctx.beginPath();
            // Draw jagged rock
            ctx.moveTo(rock.x, rock.y - rock.size);
            ctx.lineTo(rock.x + rock.size, rock.y);
            ctx.lineTo(rock.x + rock.size/2, rock.y + rock.size);
            ctx.lineTo(rock.x - rock.size/2, rock.y + rock.size);
            ctx.lineTo(rock.x - rock.size, rock.y);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        });
    }

    // 7. Draw Ores
    gameState.ores.forEach(ore => {
        ctx.fillStyle = ore.type === 'gold' ? '#ffd700' : (ore.type === 'silver' ? '#e3e4e5' : '#111');
        ctx.beginPath();
        ctx.arc(ore.x, ore.y, 15 + (ore.maxHits * 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    // 8. Draw Unmounted Horses
    ctx.fillStyle = '#8b4513';
    gameState.horses.forEach(h => {
        ctx.fillRect(h.x - 15, h.y - 10, 30, 20);
        ctx.fillRect(h.x + 5, h.y - 15, 15, 15); 
    });

    // 9. Draw The Train
    drawTrain();

    // 10. Draw Enemies
    gameState.enemies.forEach(e => {
        let color = e.type === 'gunman' ? '#777' : (e.type === 'knifeman' ? '#8b4513' : '#222');
        drawHumanoid(e.x, e.y, color, e.aimAngle, false, e.hasHorse, true, e.type);
    });

    // 11. Draw Players
    for (let id in gameState.players) {
        let p = gameState.players[id];
        if (p.dead) continue;
        drawHumanoid(p.x, p.y, p.color, p.aimAngle, p.hasKnife, p.onHorse, false, null);
    }

    // 12. Draw Projectiles
    ctx.fillStyle = '#ffcc00';
    gameState.projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    // 13. Draw Bombs
    ctx.fillStyle = '#111';
    gameState.bombs.forEach(b => {
        ctx.beginPath();
        let pulse = Math.sin(b.timer * 15) * 3;
        ctx.arc(b.x, b.y, 12 + pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.restore();

    // Handle Movement Input Emission
    let dx = 0, dy = 0;
    if (keys.w) dy -= 1;
    if (keys.s) dy += 1;
    if (keys.a) dx -= 1;
    if (keys.d) dx += 1;
    if (dx !== 0 || dy !== 0) {
        let len = Math.hypot(dx, dy);
        socket.emit('move', { dx: dx / len, dy: dy / len });
    }

    requestAnimationFrame(draw);
}

// Start the render loop
draw();