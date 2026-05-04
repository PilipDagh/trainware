# Transcontinental Survival

A multiplayer 1870s train survival game where you and up to five friends defend a steam locomotive across a 3,181 km journey through forests, plains, deserts, and frozen tundra.

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/PilipDagh/trainware)

## Getting started

### Prerequisites

- Node.js 18 or later
- npm

### Install and run

```bash
npm install
npm start
```

The server listens on the port defined by `PORT` (default: `3000`). Open `http://localhost:3000` in your browser to load the menu.

## Lobby system

When you launch the game, you land on the main menu. Enter your conductor name (up to 12 characters), then choose one of:

- **Create Lobby** — Set a lobby name, the maximum number of players (1–6), and an optional password. Leave the password blank to make the lobby public.
- **Join Lobby** — Browse public lobbies or enter a password to join a private one.

Once everyone is in the lobby, the host clicks **Start Game** to begin the run.

## Controls

### Desktop

| Action | Input |
| --- | --- |
| Move | `W`, `A`, `S`, `D` |
| Aim | Mouse |
| Shoot or mine | Left click |
| Interact, dump coal, or mount | `E` |
| Reload | `R` |
| Throw bomb | `F` |
| Knife attack | `Space` |

### Mobile

The game ships with on-screen touch controls that appear automatically on screens narrower than 768 px. The layout includes:

- A directional pad (`W`, `A`, `S`, `D`) on the left for movement.
- Action buttons on the right for **Shoot/Mine**, **Interact**, **Reload**, **Bomb**, and **Knife**.

Touch input is locked to game actions, so pinch-zoom and scroll gestures will not interrupt play.

## HUD reference

The in-game stats bar shows everything you need to survive:

- **HP**, **Ammo** (magazine/reserve), and **Bombs**
- **Distance** travelled out of 3,181 km, plus the current **Biome**
- **Fuel** and **Speed** (km/h) of the locomotive
- **Cold** exposure level
- Inventory totals for **Gold**, **Silver**, and **Coal**

## Gameplay loop

1. Defend the train from threats while it travels between towns.
2. Mine resources and feed coal into the engine to keep moving.
3. Stop at town shops to spend earnings on ammo, bombs, and upgrades.
4. If you die, you spectate teammates. If everyone dies, the team can vote to restart.
5. Reach the end of the line to trigger the victory screen.

## Credits

Made by Julian, Kylin, and Tyler.
