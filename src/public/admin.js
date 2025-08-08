document.addEventListener('DOMContentLoaded', () => {
    const socket = io({ query: { role: 'ADMIN' } });

    const startGameBtn = document.querySelector('#start-game');
    const restartGameBtn = document.querySelector('#restart-game-btn');
    const playerListEl = document.querySelector('#player-list');
    const impostorCountInput = document.querySelector('#impostor-count-input');
    const showHideRolesBtn = document.querySelector('#show-hide-roles-btn');

    if (!startGameBtn || !playerListEl || !restartGameBtn || !impostorCountInput || !showHideRolesBtn) {
        console.error('Fatal Error: Could not find essential admin elements on the page.');
        return;
    }

    startGameBtn.addEventListener('click', () => {
        const numImpostors = impostorCountInput.value;
        socket.emit('start-game', { numImpostors });
    });

    restartGameBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to end the current game and restart?')) {
            socket.emit('restart-game');
        }
    });

    showHideRolesBtn.addEventListener('click', () => {
        playerListEl.classList.toggle('show-roles');
        const isShowing = playerListEl.classList.contains('show-roles');
        showHideRolesBtn.textContent = isShowing ? 'Hide Roles' : 'Show Roles';
    });

    function setPlayerAliveStatus(playerId, isAlive) {
        socket.emit('player-set-alive-status', playerId, isAlive);
    }

    // NEW: Function to remove a player
    function removePlayer(playerId, playerName) {
        if (confirm(`Are you sure you want to remove ${playerName} from the game?`)) {
            socket.emit('remove-player', playerId);
        }
    }

    socket.on('game-start-failed', (message) => {
        alert(`Could not start game: ${message}`);
    });

    socket.on('player-list-update', (players) => {
        playerListEl.innerHTML = '';
        if (players.length === 0) {
            playerListEl.innerHTML = '<li>No players connected.</li>';
            return;
        }
        players.forEach(player => {
            const li = document.createElement('li');
            li.classList.toggle('dead', !player.isAlive);

            const infoContainer = document.createElement('div');
            infoContainer.innerHTML = `
                <span>${player.name} - </span>
                <span class="role">${player.role || 'Unassigned'} - </span>
                <span>(${player.isAlive ? 'Alive' : 'Dead'})</span>
            `;
            
            // NEW: Actions container for both buttons
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'player-actions';

            const statusButton = document.createElement('button');
            statusButton.textContent = player.isAlive ? 'Mark Dead' : 'Mark Alive';
            statusButton.onclick = () => setPlayerAliveStatus(player.id, !player.isAlive);
            
            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.className = 'remove-player-btn';
            removeButton.onclick = () => removePlayer(player.id, player.name);

            actionsContainer.appendChild(statusButton);
            actionsContainer.appendChild(removeButton);
            
            li.appendChild(infoContainer);
            li.appendChild(actionsContainer);
            playerListEl.appendChild(li);
        });
    });

    const SOUNDS = {
        meeting: new Audio('/sounds/meeting.mp3'),
        sussyBoy: new Audio('/sounds/sussy-boy.mp3'),
    };
    async function playSound(sound) {
        try {
            sound.currentTime = 0;
            await sound.play();
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }

    socket.on('play-meeting', async () => {
        await playSound(SOUNDS.meeting);
        setTimeout(() => playSound(SOUNDS.sussyBoy), 2000);
    });
});