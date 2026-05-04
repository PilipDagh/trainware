# Transcontinental Survival

A multiplayer 1870s train survival game. Form a posse of up to 6 players, ride the rails across 3,181 km of frontier, and keep the train fueled, armed, and moving. Built with Node.js, Express, and Socket.IO.

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/PilipDagh/trainware)

## Run the game

Prerequisites: Node.js 18 or later.

```bash
npm install
npm start
```

The server listens on the port configured in `server.js`. Open `http://localhost:<port>` in a browser to play. Share the URL on your local network for friends to join.

## Quickstart

1. Pick a name on the main menu.
2. **Create Lobby** to host, or **Join Lobby** to pick a public game.
3. Set a max player count (1–6) and an optional password to keep your game private.
4. Once everyone is in, the host presses **Start Game**.
5. Mine ore, fight off ambushes, refuel at the coal car, and ride the train all the way to the end.

## Controls

### Desktop

| Key | Action |
| --- | --- |
| `WASD` | Move |
| `Mouse` | Aim |
| `Click` | Shoot or mine |
| `E` | Interact, dump coal, drink from a barrel |
| `R` | Reload from reserve ammo |
| `B` | Place a Beer Barrel from your inventory |
| `F` | Throw a bomb |
| `Space` | Knife stab |

### Mobile and touch

On-screen controls appear automatically on touch devices. To force them on a desktop browser, open **Settings** from the main menu and enable **Force Mobile Touch Controls**. This is useful for testing layouts or playing on a touchscreen monitor.

## Gameplay systems

### Multiplayer lobbies

Movement, shooting, reloading, mining, bombs, and knife stabs sync across the lobby in real time. Public lobbies are listed under **Join Lobby**; password-protected lobbies are hidden until the password is entered.

### Ores and the shop

Mine gold, silver, and coal from veins in the wilderness. The mining click radius is generous, so you don't need pixel-perfect aim. When you walk up to the shop NPC in town, gold and silver auto-sell ($5 and $3 each) before the menu opens. Spend the cash on:

- **Bomb** — $5
- **Bandage (+50 HP)** — $2
- **Warm Clothes** — $11 (helps in the tundra biome)
- **Knife (56 DMG)** — $5
- **Ammo Pack (+6)** — $4
- **Beer Bottle (Refill)** — $3
- **Beer Barrel (Placeable)** — $11
- **Regen** tiers — $8 each
- **Fuel Tank** and **Train Speed** upgrades — group purchases

### Coal-to-fuel cart

Mined coal isn't just for selling. Walk up to the coal car with coal in your inventory and press **E** to dump it into the engine. Each coal adds 50 fuel, and anyone in the group can contribute.

### Beer, barrels, and getting drunk

Buy **Beer Bottles** for a personal refill or **Beer Barrels** to share. Press **B** (or tap the barrel button on mobile) to drop a barrel anywhere on the train. Placed barrels show a live `sips left / 67` label so the group can see how much beer is left, and bottles can top them back up to keep one barrel going for a whole run.

Drinking has tradeoffs:

- 3+ sips: +11% movement speed and +20% damage with pistol and knife.
- The screen progressively distorts across three stages as your sip count climbs.
- 11 sips: your character explodes. Pace yourself.

### Train departures

Press the engine button to start an 8-second departure countdown. A warning HUD with a live timer appears for everyone in the lobby so stragglers can sprint back. The engine button stays active during the countdown, so you can press it again to abort if a teammate is still scrambling on board.

Stepping off the train while it's accelerating, moving, or slowing kills your character, and the rest of the group is notified.

### Horses

Walk up to a riderless horse in the wilderness and interact to mount it for a movement speed boost.

### Towns and biomes

The train passes through forests, mountains, and tundra biomes. A heads-up message warns the group as a town approaches so you have time to prep. Tundra runs apply cold damage; buy **Warm Clothes** at the shop to mitigate it.

### Death, spectating, and restart votes

When you die, a spectator overlay lets you cycle through living teammates and watch the run continue. Once the whole group is down or you reach victory, a 50% **Vote to Restart** sends the lobby back to the menu with stats reset.

## HUD reference

The in-game stats panel tracks:

- HP, magazine ammo / reserve ammo, bombs, and money
- Distance traveled, current biome, fuel, and train speed
- Cold meter (tundra)
- Inventory: gold, silver, coal, beer bottles, beer barrels

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a week-by-week list of new features, updates, and bug fixes.
