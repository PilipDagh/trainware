# Transcontinental Survival

A multiplayer 1870s-themed train survival game. Up to six players defend a steam locomotive across 3,181 km of forest, desert, and tundra biomes while fending off bandits, mining ore, and managing fuel.

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/PilipDagh/trainware)

## Requirements

- Node.js 16 or later
- npm

## Install and run

```bash
npm install
npm start
```

The server starts on the port configured in `server.js`. Open the URL in your browser to access the main menu.

## Lobby system

Players join games through lobbies. From the main menu you can host a new lobby or browse and join existing public lobbies.

### Create a lobby

1. From the main menu, choose **Create Lobby**.
2. Enter a lobby name, a maximum player count (1–6), and an optional password.
3. Submit the form to create the room. You are joined automatically as the host and assigned a unique color.
4. Share the lobby name (or password, if private) with friends so they can join.
5. When everyone is ready, the host clicks **Start Game** to begin.

Lobbies remain in the lobby list until the host starts the game. Once the game starts, the lobby is closed and no new players can join.

### Join a lobby

1. From the main menu, choose **Join Lobby** to fetch the current public lobby list.
2. Each entry shows the lobby name, current player count, max players, and a 🔒 icon if a password is required.
3. Click **Join** next to a lobby. If the lobby is private, you are prompted for the password.
4. Enter your player name (defaults to `Conductor` if blank) before joining.
5. Wait in the lobby until the host starts the game.

### Lobby rules

- Maximum of six players per lobby (one per available player color).
- Joining fails with a message if the lobby is full, the password is wrong, or the game has already started.
- Players who disconnect free up their slot for new joiners while the lobby is open.

## Controls

### Keyboard and mouse

| Action | Input |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Aim | Mouse |
| Shoot / mine ore | Left click |
| Interact (train button, horse, shop, coal dump) | `E` |
| Reload | `R` |
| Throw bomb | `F` |
| Knife attack | `Space` |

### Mobile controls

When you open the game on a touch device, on-screen buttons appear automatically once the round starts. Buttons are provided for movement, shoot, interact, reload, bomb, and knife.

## Gameplay overview

- **Train**: Press `E` near the engine to start or stop the train. The train consumes fuel while moving. If a player or enemy is off the train when it starts, they are left behind.
- **Mining**: While the train is stopped, click ore deposits to mine coal, silver, or gold. Sell silver and gold to the shop NPC, or dump coal into the engine for fuel.
- **Towns**: When the train stops in a town, a shop NPC appears. Press `E` near them to open the shop and buy bombs, bandages, ammo, knives, regen, warm clothes, or train upgrades.
- **Combat**: Bandits (gunmen, knifemen, and bombmen) attack along the route and during raids. Some ride horses you can mount with `E`.
- **Biomes**: The route passes through forest, desert, tundra, and back. In tundra, your cold meter drops without warm clothes.
- **Spectating**: When you die, you can spectate teammates. If everyone dies, surviving players can vote to restart.

## Project structure

- `server.js` — Express + Socket.IO server, room management, and game loop.
- `public/index.html` — Game UI markup.
- `public/client.js` — Client rendering, input handling, and lobby UI logic.
- `public/style.css` — Styles.
