# Transcontinental Survival

A multiplayer 1870s train survival game. Crew up with friends, keep the engine fed, fight off ambushes between towns, and ride the rails 3,181 km across the frontier.

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/PilipDagh/trainware)

## Run the game

Prerequisites: Node.js 18+.

```bash
npm install
npm start
```

The server starts on the default port. Open the URL in your browser to reach the main menu.

## Main menu

From the main menu you can:

- **Set your name.** Enter a name (up to 12 characters) before joining or creating a lobby. Your name appears above your character and in the lobby roster.
- **Create Lobby.** Set a lobby name, max player count (1–6), and an optional password. Leave the password blank to make the lobby public and listed.
- **Join Lobby.** Browse public lobbies. Locked lobbies prompt for a password.
- **Settings.** Open the settings menu (see below).

## Settings

Open **Settings** from the main menu to configure how you play.

### Force Mobile Touch Controls

By default, on-screen touch controls appear automatically on phones and tablets. Toggle **Force Mobile Touch Controls** on if you want them on a desktop or laptop too — useful for testing the mobile layout or playing with a touchscreen monitor.

When enabled, the on-screen D-pad and action buttons appear alongside keyboard and mouse input.

## Controls

### Keyboard and mouse

| Action | Key |
| --- | --- |
| Move | `W` `A` `S` `D` |
| Aim | Mouse |
| Shoot / Mine ore | Left click |
| Interact / Dump coal / Drink | `E` |
| Reload | `R` |
| Place beer barrel | `B` |
| Throw bomb (toward cursor) | `F` |
| Knife | `Space` |

`R` gives you direct control over reloading instead of swapping magazines automatically. Use `E` to interact with shops and the train's coal dump, and to drink a beer bottle for a quick refill.

### Mobile touch controls

On touch devices (or with **Force Mobile Touch Controls** enabled), an on-screen control layout appears:

- **D-pad** (`W` / `A` / `S` / `D`) for movement.
- **Shoot/Mine**, **Interact (E)**, **Reload (R)**, **Bomb (F)**, **Knife (Spc)**, and **Barrel (B)** action buttons.

Pinch-to-zoom and accidental scrolling are disabled in-game so input stays on the controls.

## In-game HUD

The stats panel shows:

- HP, magazine ammo / reserve ammo, bombs, and money.
- Distance traveled out of 3,181 km, and current biome (Forest, Desert, Tundra).
- Train fuel and speed (km/h).
- Cold meter (for tundra runs).
- Inventory tally for **Gold**, **Silver**, **Coal**, **Beer Bottles**, and **Beer Barrels**.

A **Train departing in N seconds** banner appears when the train is about to leave a town, giving you time to wrap up shopping or mining and get back on board.

## Shop items

Stop at a town and walk up to the shop NPC to open the shop overlay. Available items vary by town and stock, and now include:

- **Beer Bottle ($3).** A quick personal refill. Drink with `E`.
- **Beer Barrel ($11).** Place on the train with `B` to share with your group.

Beer bottles and barrels are tracked separately from your other inventory.

## Multiplayer and spectating

- Up to 6 players per lobby, each assigned a unique color.
- If you die, you enter **spectator mode**. Use **Spectate Next Player** to cycle through surviving teammates instead of being kicked out.
- When everyone dies or you reach the end of the line, use **Vote to Restart** to begin a new run with your group.
