document.addEventListener('DOMContentLoaded', () => {
    
    function getPlayerId() {
        let playerId = localStorage.getItem('amongUsPlayerId');
        if (!playerId) {
            playerId = uuid.v4();
            localStorage.setItem('amongUsPlayerId', playerId);
        }
        return playerId;
    }
    const myPlayerId = getPlayerId();

	const socket = io({ 
        query: { 
            role: 'PLAYER',
            playerId: myPlayerId
        } 
    });

	const elements = {
		playerNameDisplay: document.querySelector('#player-name-display'),
		emergencyMeetingBtn: document.querySelector('#emergency-meeting'), enableSoundBtn: document.querySelector('#enable-sound'),
		progressText: document.querySelector('#progress'), progressBar: document.querySelector('.progress-bar'),
		reportBtn: document.querySelector('#report'), tasksList: document.querySelector('#tasks'), playerList: document.querySelector('#player-list'),
		votingModal: document.querySelector('#voting-modal'), votingOptions: document.querySelector('#voting-options'), votingTitle: document.querySelector('#voting-title'),
        emergencyMeetingOverlay: document.querySelector('#emergency-meeting-overlay'), reportOverlay: document.querySelector('#report-overlay'),
        reportOverlayTitle: document.querySelector('#report-overlay-title'), selectDeadPlayerModal: document.querySelector('#select-dead-player-modal'),
        selectDeadPlayerOptions: document.querySelector('#select-dead-player-options'), crewmateWinOverlay: document.querySelector('#crewmate-win-overlay'),
        impostorWinOverlay: document.querySelector('#impostor-win-overlay'), voteResultOverlay: document.querySelector('#vote-result-overlay'),
        voteResultTitle: document.querySelector('#vote-result-title'), voteResultSubtitle: document.querySelector('#vote-result-subtitle'),
        cancelReportBtn: document.querySelector('#cancel-report-btn'),
	};

    let myPlayerState = { isAlive: true };

    const soundPlayer = new Audio();
    let canPlaySounds = false;
    if (elements.enableSoundBtn) {
        elements.enableSoundBtn.addEventListener('click', () => { canPlaySounds = true; elements.enableSoundBtn.style.display = 'none'; }, { once: true });
    }
    async function playSound(url) {
        if (!canPlaySounds) return;
        try { soundPlayer.src = url; await soundPlayer.play(); }
        catch (err) { console.error('Error playing sound:', err); }
    }

    const playerName = new URLSearchParams(window.location.search).get('name');
	if (playerName) {
        socket.emit('join-game', { playerName, playerId: myPlayerId });
        if (elements.playerNameDisplay) elements.playerNameDisplay.textContent = playerName;
    } else {
        alert('Player name not found.'); window.location.href = '/';
    }

    function updatePlayerState(isAlive) {
        myPlayerState.isAlive = isAlive;
        if (elements.reportBtn) elements.reportBtn.disabled = !isAlive;
        if (elements.emergencyMeetingBtn) elements.emergencyMeetingBtn.disabled = !isAlive;
        elements.tasksList.querySelectorAll('input[type="checkbox"]').forEach(checkbox => { checkbox.disabled = !isAlive; });
        const deadOverlay = document.querySelector('.you-are-dead-overlay');
        if (!isAlive && !deadOverlay) {
            const overlay = document.createElement('div');
            overlay.className = 'info-overlay you-are-dead-overlay';
            overlay.innerHTML = `<div class="info-content"><h1>You are Dead</h1><p>Waiting for the next round...</p></div>`;
            document.body.appendChild(overlay);
        } else if (isAlive && deadOverlay) {
            deadOverlay.remove();
        }
    }

	if (elements.reportBtn) { elements.reportBtn.addEventListener('click', () => { if(myPlayerState.isAlive) socket.emit('report'); }); }
	if (elements.emergencyMeetingBtn) { elements.emergencyMeetingBtn.addEventListener('click', () => { if(myPlayerState.isAlive) socket.emit('emergency-meeting'); }); }
	
    function handleMeetingFlow(e) {
        const readyButton = e.target.closest('.ready-to-vote-btn');
        const cancelButton = e.target.closest('.cancel-meeting-btn');
        if (readyButton) {
            socket.emit('player-ready-to-vote');
            readyButton.textContent = 'Waiting for others...';
            readyButton.disabled = true;
            if (cancelButton) cancelButton.style.display = 'none';
        }
        if (cancelButton) {
            socket.emit('cancel-meeting');
        }
    }
    if (elements.emergencyMeetingOverlay) elements.emergencyMeetingOverlay.addEventListener('click', handleMeetingFlow);
    if (elements.reportOverlay) elements.reportOverlay.addEventListener('click', handleMeetingFlow);
    
    if (elements.cancelReportBtn) {
        elements.cancelReportBtn.addEventListener('click', () => {
            if (elements.selectDeadPlayerModal) {
                elements.selectDeadPlayerModal.style.display = 'none';
            }
        });
    }

	socket.on('game-restarted', () => { alert('Game restarted.'); window.location.href = '/'; });
    socket.on('crewmates-win', () => { if (elements.crewmateWinOverlay) { playSound('/sounds/you-win.mp3'); elements.crewmateWinOverlay.style.display = 'flex'; } });
    socket.on('impostors-win', () => { if (elements.impostorWinOverlay) { playSound('/sounds/you-lose.mp3'); elements.impostorWinOverlay.style.display = 'flex'; } });
    
    socket.on('show-emergency-meeting-overlay', () => {
        if(elements.emergencyMeetingOverlay) {
            const btn = elements.emergencyMeetingOverlay.querySelector('.ready-to-vote-btn');
            const cancelBtn = elements.emergencyMeetingOverlay.querySelector('.cancel-meeting-btn');
            if (btn) { btn.textContent = 'Ready to Vote'; btn.disabled = false; }
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
            elements.emergencyMeetingOverlay.style.display = 'flex';
        }
    });
    socket.on('show-report-overlay', ({ deadPlayerName }) => {
        if(elements.reportOverlay) {
            elements.reportOverlayTitle.textContent = `${deadPlayerName}'s body reported!`;
            const btn = elements.reportOverlay.querySelector('.ready-to-vote-btn');
            const cancelBtn = elements.reportOverlay.querySelector('.cancel-meeting-btn');
            if (btn) { btn.textContent = 'Ready to Vote'; btn.disabled = false; }
            if (cancelBtn) cancelBtn.style.display = 'inline-block';
            elements.reportOverlay.style.display = 'flex';
        }
    });
    socket.on('prompt-dead-player-selection', (allPlayers) => {
        if (elements.selectDeadPlayerModal && elements.selectDeadPlayerOptions) {
            elements.selectDeadPlayerOptions.innerHTML = '';
            allPlayers.forEach(player => {
                const playerButton = document.createElement('button');
                playerButton.className = 'vote-button';
                playerButton.textContent = player.name;
                playerButton.disabled = !player.isAlive;
                playerButton.onclick = () => {
                    socket.emit('dead-player-reported', { deadPlayerId: player.id, deadPlayerName: player.name });
                    elements.selectDeadPlayerModal.style.display = 'none';
                };
                elements.selectDeadPlayerOptions.appendChild(playerButton);
            });
            elements.selectDeadPlayerModal.style.display = 'flex';
        }
    });
	socket.on('player-list-update', (players) => {
		if (!elements.playerList) return;
		elements.playerList.innerHTML = '';
		players.forEach(player => {
			const li = document.createElement('li');
			li.textContent = `${player.name} (${player.disconnected ? 'Disconnected' : (player.isAlive ? 'Alive' : 'Dead')})`;
			if (!player.isAlive || player.disconnected) li.classList.add('dead');
			elements.playerList.appendChild(li);
            if (player.id === myPlayerId && player.isAlive !== myPlayerState.isAlive) {
                updatePlayerState(player.isAlive);
            }
		});
	});
	socket.on('tasks', (tasks) => {
		if (!elements.tasksList) return;
		elements.tasksList.innerHTML = '';
		if (!tasks || Object.keys(tasks).length === 0) { elements.tasksList.innerHTML = '<li>You have no tasks.</li>'; return; }
		for (const [taskId, taskName] of Object.entries(tasks)) {
			const li = document.createElement('li');
			const label = document.createElement('label');
			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
            checkbox.disabled = !myPlayerState.isAlive;
			checkbox.onchange = event => { if(myPlayerState.isAlive) socket.emit(event.target.checked ? 'task-complete' : 'task-incomplete', taskId); };
			label.appendChild(checkbox);
			label.appendChild(document.createTextNode(` ${taskName}`));
			li.appendChild(label);
			elements.tasksList.appendChild(li);
		}
	});
	socket.on('role', (role) => {
        document.querySelectorAll('.role-overlay').forEach(el => el.remove());
		const overlay = document.createElement('div');
		overlay.className = 'role-overlay';
		overlay.innerHTML = `<div class="info-content"><h1 style="color: ${role === 'Impostor' ? '#ff4d4d' : '#33adff'};">${role}</h1><p class="dismiss-text">Click anywhere to dismiss</p></div>`;
		overlay.onclick = () => overlay.remove();
		document.body.appendChild(overlay);
	});
    socket.on('progress', (progress) => {
		if (elements.progressText && elements.progressBar) {
			elements.progressText.textContent = (progress * 100).toFixed(0);
			elements.progressBar.style.width = `${progress * 100}%`;
		}
	});
    socket.on('play-meeting', () => playSound('/sounds/meeting.mp3').then(() => setTimeout(() => playSound('/sounds/sussy-boy.mp3'), 2000)));
    socket.on('start-voting-phase', (livingPlayers) => {
        if (elements.emergencyMeetingOverlay) elements.emergencyMeetingOverlay.style.display = 'none';
        if (elements.reportOverlay) elements.reportOverlay.style.display = 'none';
        if (!elements.votingModal || !elements.votingOptions) return;
        elements.votingTitle.textContent = 'Who is the Impostor?';
        elements.votingOptions.innerHTML = '';
        livingPlayers.forEach(player => {
            const voteButton = document.createElement('button');
            voteButton.className = 'vote-button';
            voteButton.textContent = player.name;
            voteButton.dataset.votedId = player.id;
            elements.votingOptions.appendChild(voteButton);
        });
        const skipButton = document.createElement('button');
        skipButton.className = 'vote-button skip';
        skipButton.textContent = 'Abstain (Skip Vote)';
        skipButton.dataset.votedId = 'skip';
        elements.votingOptions.appendChild(skipButton);
        elements.votingOptions.onclick = (e) => {
            const target = e.target.closest('.vote-button');
            if (!target) return;
            socket.emit('player-vote', { voterId: myPlayerId, votedId: target.dataset.votedId });
            elements.votingTitle.textContent = 'I Voted!';
            elements.votingOptions.innerHTML = '<p>Waiting for other players...</p>';
            elements.votingOptions.onclick = null;
        };
        elements.votingModal.style.display = 'flex';
    });
    socket.on('vote-result', ({ title, subtitle }) => {
        if (!elements.voteResultOverlay) return;
        elements.votingModal.style.display = 'none';
        elements.voteResultTitle.textContent = title;
        elements.voteResultSubtitle.textContent = `(${subtitle})`;
        elements.voteResultOverlay.style.display = 'flex';
        setTimeout(() => { if (elements.voteResultOverlay) elements.voteResultOverlay.style.display = 'none'; }, 5000);
    });
    socket.on('meeting-cancelled', () => {
        if (elements.emergencyMeetingOverlay) elements.emergencyMeetingOverlay.style.display = 'none';
        if (elements.reportOverlay) elements.reportOverlay.style.display = 'none';
    });
    // NEW: Listen for kick event
    socket.on('kicked', () => {
        alert('You have been removed from the game by the admin.');
        window.location.href = '/';
    });
});