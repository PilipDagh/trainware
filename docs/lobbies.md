---
title: Lobbies and multiplayer
description: Create or join multiplayer lobbies, set passwords and player limits, and manage spectating and restart votes.
---

# Lobbies and multiplayer

Up to six players can run the train together. Lobbies are created and joined from the main menu before a game starts.

## Create a lobby

From the main menu:

1. Enter a player name. You'll be assigned a unique color from the lobby palette.
2. Choose **Create Lobby**.
3. Set a lobby name, a max player count (1–6), and an optional password.
4. Share the lobby with friends, then press **Start Game** when everyone is in.

Public lobbies (no password) appear in the lobby browser. Password-protected lobbies still appear in the list, but require the password to join.

```js
// What the client sends when you create a lobby
socket.emit('createLobby', {
  name: 'Westbound Express',
  maxPlayers: 4,
  password: '' // empty string = public
});
```

## Join a lobby

1. Enter a player name.
2. Pick a lobby from the list, or paste a lobby ID.
3. Enter the password if the lobby is private.

You can't join a lobby that is full or already in progress.

## Start the game

The lobby host (anyone in the lobby can start, as long as at least one player is present) presses **Start Game**. The menu hides, the canvas appears, and the round begins. On touch devices, mobile controls appear at the same time.

## Spectator mode

When you die mid-run, you stay in the game as a spectator instead of being kicked back to the menu:

- The camera follows a surviving teammate.
- Press the **Spectate Next** button (or call `spectateNext()`) to cycle through living players.
- You keep watching until everyone dies or the run ends.

## Restart voting

After a wipe or a victory, the lobby enters voting mode. Each dead player can cast one vote to restart:

- A vote passes when at least 50% of players in the lobby vote yes (rounded up).
- When the vote passes, the lobby resets after a 3-second countdown: train, enemies, ores, projectiles, and player inventories all reset to their starting values, and the room status returns to `LOBBY`.
- A failed vote leaves the room in voting mode until enough players agree.

The on-screen message panel shows the current tally (for example, `Restart vote: 2/3 needed.`) so you know how many more yes votes are required.
