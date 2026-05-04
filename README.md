# Trainware

Trainware (a.k.a. **Transcontinental Survival**) is a browser-based, multiplayer 1870s train survival game. Up to six players share a steam train traveling 3,181 km across forests, tundra, and towns. Together you mine ore, fight bandits, manage fuel and beer, and try to reach the end of the line alive.

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/PilipDagh/trainware)

## Run the server

You need Node.js 18+.

```bash
npm install
npm start
```

The server starts on port `3000` by default. Open `http://localhost:3000` in a browser to play. The server uses Express and Socket.IO to broadcast game state to every connected client at 30 FPS.

## How to play

### 1. Create or join a lobby

From the main menu, set a name (max 12 characters) and either:

- **Create Lobby** — pick a lobby name, max players (1–6), and an optional password. Public lobbies are listed for anyone to join.
- **Join Lobby** — browse open lobbies and click one to enter.

Each player is assigned a unique color shown in the lobby roster. The host clicks **Start Game** when everyone is ready.

### 2. Survive the journey

Your goal is to keep the train fueled and your crew alive long enough to cover all 3,181 km. Reach the end of the line and the whole lobby triggers a **Victory** screen and a restart vote.

If everyone dies, you'll see the **Everyone Died** screen and can vote to restart together (50% threshold).

## Controls

### Desktop

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Aim | Mouse |
| Shoot / mine | Left click |
| Interact / dump coal / drink | `E` |
| Reload | `R` |
| Throw bomb | `F` |
| Knife stab | `Space` |
| Place beer barrel | `B` |

Reloading is manual: pressing `R` pulls from your reserve ammo and tops the magazine without wasting bullets.

### Mobile and touch

On phones and tablets the on-screen controls appear automatically. To force them on a desktop browser (handy for testing or touchscreen monitors):

1. Open **Settings** from the main menu.
2. Toggle **Force Mobile Touch Controls** on.

The mobile pad provides movement, **Shoot/Mine**, **Interact**, **Reload**, **Bomb**, **Knife**, and **Barrel** buttons.

## Game systems

### The train

The train has four states: **stopped**, **departing**, **moving**, and **arriving**. Walk up to the **engine button** and press `E` to start an 8-second departure countdown that's broadcast to the whole lobby with a HUD warning. Press the engine button again during the countdown to abort it if a teammate is still scrambling back.

Stepping off the train while it's accelerating, moving, or slowing kills your character instantly, and the rest of the group sees a death message.

### Fuel and coal

The train consumes fuel as it moves. Mine **coal** in the wilderness, then walk up to the **coal car** with coal in your inventory and press `E` to dump it. Each piece of coal adds 50 fuel, and anyone in the group can contribute.

### Towns and the shop

You'll get a heads-up message as the train approaches a town so you can prep. Walking up to the **shop NPC** auto-sells any **gold** ($5 each) and **silver** ($3 each) in your inventory before opening the shop menu, so cash management stays simple.

The town shop stocks ammo, bombs, warm clothes, beer bottles ($3), and beer barrels ($11), among other items.

### Mining

Click an ore vein to mine it. The click radius is generous, so you don't need pixel-perfect aim. Ores you can find include gold, silver, and coal.

### Beer, drinking, and consequences

Beer adds risk-reward to the run.

- **Beer Bottle** — drink for an instant sip. Bottles can also be used to top up a placed beer barrel.
- **Beer Barrel** — press `B` (or the mobile barrel button) to drop a barrel anywhere on the train. Anyone in your group can walk up and drink from it. The barrel shows a live `sips left / 67` label so the crew can see how much beer is left.

Drinking effects:

- **3+ sips** — +11% movement speed and +20% damage with pistol and knife.
- **Past 3 sips** — you take 11 damage every 19 seconds until you sober up. Drink too long and you die from alcohol poisoning before hitting the explosion threshold.
- **11+ sips** — your character explodes. Pace yourself.
- **Visuals** — the screen progressively distorts across three stages as your sip count climbs, giving a clear cue you're nearing the limit.
- **Sobering up** — stop drinking long enough and you'll get a `You sobered up` message; buffs and damage-over-time end together.

### Biomes and weather

The map cycles through forests and tundra. Each biome introduces its own hazards.

- **Forest** — rare **mountain avalanche** events trigger a stop warning. Fail to halt in time and the train takes a hit, everyone loses 50 HP, and rocks scatter across the tracks.
- **Tundra** — stepping off the train without **Warm Clothes** drains a **cold meter**. Hitting zero kills you. Buy Warm Clothes from the shop, or stay on the train to warm back up.

### Combat and enemies

Between towns, bandits, gunmen, knifemen, bombers, and horseback enemies attack the train. Spawn rates were dialed back significantly in early stretches to make starting runs more forgiving.

**Train raids** ambush you between towns. Survive a raid with your group and everyone heals 30 HP, or earns $2 if already at full HP.

When the train departs, any enemies still off the train are removed alongside players who got left behind, so old encounters don't follow you into the next stop.

### Horses

Walk up to a riderless horse in the wilderness and press `E` to mount it for a movement speed boost.

### Death and spectating

When you die, you can press the **Spectate Next Player** button to cycle through living teammates and watch the run continue. Once everyone is down (or the run is won), the lobby votes on a restart.

## HUD reference

The in-game stats panel tracks:

- HP, magazine ammo / reserve ammo, bombs, money
- Distance traveled / 3,181 km, current biome
- Fuel and current train speed
- Cold meter (tundra)
- Inventory: gold, silver, coal, beer bottles, beer barrels

## Project layout

- `server.js` — Express + Socket.IO server. Hosts lobbies and broadcasts authoritative game state at 30 FPS.
- `public/index.html` — Menu, in-game HUD, overlays, and mobile controls.
- `public/client.js` — Client-side rendering, input handling, and Socket.IO event wiring.
- `public/style.css` — Menu and HUD styling.
- `CHANGELOG.md` — Week-by-week list of new features, updates, and bug fixes.

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for week-by-week release notes covering new features, balance updates, and bug fixes.
