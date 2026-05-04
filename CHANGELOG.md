# Changelog

## Week of June 8, 2026

### Updates

- **Towns now scroll past in view.** Towns and the shop NPC are anchored to the spot where the train stopped, so the world properly slides by as you depart instead of snapping around.
- **You can't fall off a moving train.** While the train is departing, accelerating, moving, or slowing, your character is now kept inside the train's footprint. The old instant-death penalty for stepping off mid-trip is gone.
- **Stragglers get teleported back.** If the departure timer runs out while you're still off the train, you're now whisked back to the caboose with a message to the lobby instead of exploding.
- **Enemies stick around at stops.** Enemies left behind when the train departs are no longer wiped out, so a fight you skipped won't vanish into thin air.
- **Cleaner town stops.** Ore veins now only spawn at wilderness stops. Pull into town and you'll get the shop and town encounters without random ores cluttering the area.

## Week of June 1, 2026

### New features

- **Tundra cold meter.** Stepping off the train in the tundra biome without warm clothes now drains a cold meter, and hitting zero kills you. Stay on the train to warm back up, or grab Warm Clothes from the shop before you head out.
- **Mountain avalanches.** Forest stretches now have mountain ranges with rare avalanche events. You'll get a warning to stop the train; if you don't make it in time, the train takes a hit, everyone loses 50 HP, and rocks scatter across the tracks.
- **Train raids.** Bandit raids now occasionally ambush you between towns. Survive a raid as a group and everyone heals 30 HP, or earns $2 if already at full health.
- **Victory.** Reach the end of the line (3,181km) and your run now ends in a proper victory screen for the whole lobby, kicking off the restart vote.

### Updates

- **Smoother multiplayer.** The server now broadcasts game state at a steady 30 FPS, so player positions, enemies, and projectiles stay in sync across the lobby instead of only updating when actions happen.
- **Drunk consequences kick in over time.** Past three sips, your character now takes 11 damage every 19 seconds until you sober up. Drink too long and you'll die from alcohol poisoning even before hitting the explosion threshold.
- **Sobering up.** The drunk timer now actually counts down. Stop drinking long enough and you'll get a "You sobered up" message and lose your buffs (and the damage).
- **Enemies left behind get cleaned up.** When the train departs, any enemies still off the train are removed alongside players who got left behind, so old encounters don't follow you into the next stop.

## Week of May 25, 2026

### New features

- **Settings menu.** A new Settings option on the main menu lets you tweak preferences before jumping into a game.
- **Force mobile controls toggle.** Turn on the on-screen mobile controls from Settings even on desktop, handy for testing layouts or playing with a touchscreen monitor.
- **Place beer barrels with a button.** Press **B** (or tap the new barrel button on mobile) to drop a Beer Barrel from your inventory without digging through menus.
- **Barrel sip counter.** Placed barrels now show a live `sips left / 67` label above them so your group can tell at a glance how much beer is still in the keg.
- **Drunk visual effects.** As your sip count climbs, the screen progressively distorts across three stages, giving you a visible cue that you're getting close to the explosion threshold.
- **Train departure countdown HUD.** When someone hits the engine button, an on-screen warning with a live countdown appears for everyone in the lobby so no one misses the train.
- **Beer bottles and barrels in the inventory panel.** The HUD now tracks your carried Beer Bottles and Beer Barrels alongside gold, silver, and coal.

### Updates

- **Wider mining reach.** The click radius for mining ores has been doubled, so you no longer need pixel-perfect aim to swing at a vein.
- **Cancel a departure mid-countdown.** The engine button stays active while the train is in the departing state, letting you abort the countdown if a teammate is still scrambling back on board.

## Week of May 18, 2026

### New features

- **Live multiplayer gameplay.** Movement, aiming, shooting, reloading, mining, bomb throwing, and knife stabs now sync between everyone in the lobby in real time. Joining a game with friends finally plays the way the lobby promised.
- **Beer barrels you can place and share.** Drop a Beer Barrel anywhere on the train, then have anyone in your group walk up and drink from it. Bottles can top barrels back up so a crew can keep one barrel going for a whole run.
- **Drunk perks (and consequences).** Three or more sips give you a 11% movement and 20% damage boost with pistol and knife. Push past 11 sips and your character explodes, so pace yourself.
- **Coal-to-fuel cart.** Walk up to the coal car with mined coal in your inventory and dump it in to refuel the train (50 fuel per coal). Anyone in the group can contribute.
- **Sell ores at the shop.** Approaching the shop NPC now auto-sells any gold and silver in your inventory ($5 and $3 each) before opening the menu, so you don't have to manage cash separately.
- **Spectate teammates after dying.** Press to cycle through living players and watch the run continue instead of staring at a static screen.
- **Group restart vote.** Once everyone is down or you've won, a 50% restart vote sends the lobby back to the menu with stats reset for another run.

### Updates

- **Manual reload.** Reload now pulls from your reserve ammo on demand and tops the magazine without wasting bullets, replacing the older auto-reload behavior.
- **Horse riding.** Walk up to a riderless horse and interact to mount it for a movement speed boost out in the wilderness.
- **Train departure warning.** Hitting the engine button starts an 8-second countdown broadcast to the whole lobby so stragglers can sprint back on board.
- **Leaving a moving train is fatal.** Stepping off the train while it's accelerating, moving, or slowing now kills your character, with a message to the rest of the group.

## Week of May 11, 2026

### New features

- **Beer at the saloon.** Two new shop items are stocked in town: **Beer Bottles** ($3) for a quick refill and **Beer Barrels** ($11) you can place on the train for your group. Tracked separately in your inventory.

### Updates

- **Easier wilderness runs.** Enemy spawn rates between towns have been dialed back significantly. Expect fewer ambush groups, fewer gunmen and knifemen per group, and far fewer bombers and horseback enemies, so early runs are more forgiving.
- **Town arrival warning.** You'll now get a heads-up as the train approaches a town, giving you time to prep before you pull in.

## Week of May 4, 2026

### New features

- **Multiplayer lobbies.** Create or join games from a new main menu. Set a lobby name, player limit (up to 6), and an optional password to keep games private. Public lobbies are listed for anyone to join.
- **Player names and colors.** Pick a name before joining a lobby. Each player gets a unique color shown in the lobby roster.
- **Mobile touch controls.** Play on phones and tablets with on-screen movement, shoot, interact, reload, bomb, and knife buttons. Controls appear automatically on touch devices.
- **Spectator mode.** When you die, keep watching the action and cycle through surviving players instead of being kicked back to a refresh prompt.
- **Restart voting.** After everyone dies or you reach victory, vote with your group to start a new run.

### Updates

- **Reload action.** A dedicated reload key (R) replaces the old auto-reload behavior, giving you direct control over when to swap magazines.
- **Expanded HUD.** The in-game stats panel now shows magazine ammo separately from reserve ammo, plus a live tally of gold, silver, and coal in your inventory.
- **Cleaner game start.** The canvas and HUD stay hidden behind the menu until the game actually begins, so you no longer see an empty world while picking a lobby.
- **Refreshed menu styling.** Menus, overlays, and lobby lists use a consistent dark theme with hover states and clearer layout.

### Bug fixes

- **Clicks no longer leak through menus.** Clicking buttons in the lobby or shop no longer fires your weapon or starts mining in the background.
- **Mobile zoom prevented.** Pinch-to-zoom and accidental scrolling are disabled in-game so touch input stays on the controls.
