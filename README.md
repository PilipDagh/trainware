# Transcontinental Survival

A real-time multiplayer 1870s train survival game. Up to six players ride a steam train across forests, deserts, and tundra, fighting off enemies, mining ore, refueling the engine, and trying to reach the end of the line in one piece.

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/PilipDagh/trainware)

## Run the game locally

Prerequisites: Node.js 18 or newer.

```bash
npm install
npm start
```

The server listens on the port reported in the console (default `3000`). Open `http://localhost:3000` in your browser to reach the main menu.

## Main menu

From the main menu you can:

- **Create Lobby** — host a new game. Set a lobby name, a max player count (1–6), and an optional password. Public lobbies (no password) are listed for everyone to join.
- **Join Lobby** — browse open lobbies and connect, entering a password if required.
- **Settings** — toggle preferences before starting a game.

Pick a name (up to 12 characters) before creating or joining. Each player in a lobby is assigned a unique color used in the roster and on the map.

### Settings

| Setting | What it does |
| --- | --- |
| Force Mobile Touch Controls | Shows the on-screen movement and action buttons even on desktop, useful for testing layouts or playing with a touchscreen. |

## Controls

### Keyboard and mouse

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| Mouse | Aim |
| Left click | Shoot or mine the targeted ore |
| `E` | Interact, dump coal into the coal car, drink from a barrel |
| `R` | Reload (pulls from reserve ammo on demand) |
| `B` | Place a Beer Barrel from inventory |
| `F` | Throw a bomb |
| `Space` | Knife attack |

### Mobile

On phones and tablets the on-screen D-pad and action buttons appear automatically. The same buttons are available with **Force Mobile Touch Controls** enabled in Settings. Pinch-to-zoom and accidental scrolling are disabled in-game so input stays on the controls.

## In-game HUD

The stats panel shows:

- **HP**, **Ammo** (magazine / reserve), **Bombs**, and **$** (money).
- **Distance** travelled out of `3181` km, plus the current **Biome** (forest, desert, tundra).
- **Fuel** remaining and current train **Speed**.
- **Cold** exposure level.
- Inventory tallies for **Gold**, **Silver**, **Coal**, **Beer Bottles**, and **Beer Barrels**.

A train departure warning with a live countdown appears for everyone in the lobby when someone hits the engine button.

## Gameplay loop

1. **Mine ore** along the route. Click ore veins to swing — the click radius is generous, so pixel-perfect aim is not required. Gold, silver, and coal go straight into your inventory.
2. **Refuel the train** by walking up to the coal car with coal in your inventory and pressing `E`. Each coal adds 50 fuel and anyone in the lobby can contribute.
3. **Stop in towns.** As the train approaches a town you get an on-screen warning. Approach the shop NPC to auto-sell gold (`$5` each) and silver (`$3` each), then browse the shop menu.
4. **Depart again.** Hitting the engine button starts an 8-second countdown broadcast to the whole lobby. The button stays active during the countdown so you can cancel if a teammate is still scrambling back on board. Stepping off a moving train is fatal.
5. **Survive ambushes** between towns from gunmen, knifemen, bombers, and horseback enemies. Mount any riderless horse you find with `E` for a movement speed boost.

## Shop items

| Item | Price | Notes |
| --- | --- | --- |
| Beer Bottle | `$3` | Quick personal refill. Tracked separately in your inventory. |
| Beer Barrel | `$11` | Place on the train with `B` for the whole group to share. |

## Beer barrels and drunk perks

- Place a barrel anywhere on the train with `B` (or the **Barrel** button on mobile). Placed barrels show a live `sips left / 67` label above them so the group can tell at a glance how much beer is left.
- Press `E` next to a barrel to drink. Use a Beer Bottle on a barrel to top it back up so a single keg can last a whole run.
- Three or more sips give you a **11% movement** and **20% damage** boost with pistol and knife.
- As your sip count climbs, the screen progressively distorts across three stages — a visible cue that you're getting close to the explosion threshold.
- Past **11 sips** your character explodes. Pace yourself.

## Multiplayer behavior

- Movement, aiming, shooting, reloading, mining, bomb throws, and knife stabs sync between every player in the lobby in real time.
- **Spectator mode**: when you die, press the spectate button to cycle through living teammates instead of being kicked out.
- **Restart vote**: once everyone is down or you reach victory, a 50% restart vote sends the lobby back to the menu with stats reset for another run.

## Project layout

```
server.js          Express + Socket.IO game server
public/index.html  Main menu, in-game HUD, and overlays
public/client.js   Client-side rendering, input, and networking
public/style.css   Menu and HUD styling
CHANGELOG.md       Week-by-week feature and update history
```

See [`CHANGELOG.md`](./CHANGELOG.md) for the full release history.
