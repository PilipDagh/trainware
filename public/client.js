// Define basic functions for menu and game canvas logic
const menu = document.getElementById('menu');
const gameCanvas = document.getElementById('gameCanvas');
const createLobbyButton = document.getElementById('create-lobby');
const joinLobbyButton = document.getElementById('join-lobby');
const settingsButton = document.getElementById('settings');
const ctx = gameCanvas.getContext('2d');

// Event listeners for navigation
createLobbyButton.addEventListener('click', () => {
  menu.style.display = 'none';
  gameCanvas.style.display = 'block';
  startGame();
});

joinLobbyButton.addEventListener('click', () => {
  alert("Join Lobby functionality is not yet implemented.");
});

settingsButton.addEventListener('click', () => {
  alert("Settings menu is not yet implemented.");
});

// Start the game (basic placeholder for now)
function startGame() {
  ctx.fillStyle = 'brown';
  ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height); // Simulate a train floor
  ctx.fillStyle = 'white';
  ctx.font = '20px Georgia';
  ctx.fillText('Game Started: Placeholder Train Screen', 20, 30);
}
