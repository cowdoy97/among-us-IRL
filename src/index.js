const PORT = 4046;

const express = require('express');
const http = require('http');
const _ = require('lodash');
const path = require('path');
const { Server } = require('socket.io');
const { v4: uuid } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const TASKS = [ "Do 10 reps of machine exercise (Joe's Gym)", 'Pour water (Kitchen)', 'Sink 1 ball (Billards table)', "Flip water bottle (Michael's room)", 'Wash your hands (basement bathroom)', 'Wash your hands (1st floor bathroom)', 'Take elevator', 'Spin 8, 9, or 10 in Life game (Hearth room)', 'Beat Smash (Upstairs guest room)', 'Hit a layup (Basketball court)', 'Take photo (Green screen)', 'Bounce ping pong ball 10 times (front door)', 'Take a lap (Around pool)', 'Flip a pillow (Activity room)', 'Water a plant (Sunroom)', 'Find the remote (Living Room)', 'Organize the bookshelf (Library)', 'Fix the Wi-Fi router (Office)', 'Restock the snack bar (Pantry)', 'Tune the guitar (Music Room)', 'Start the dishwasher (Kitchen)', 'Sort the laundry (Laundry Room)', 'Make a bed (Master Bedroom)', 'Check the mail (Front Porch)', 'Calibrate the telescope (Observatory)' ];
const N_TASKS = 5, MIN_PLAYERS = 4;
let players = {};
let taskProgress = {}, gameInProgress = false, meetingState = { inProgress: false, votes: {}, readyPlayers: new Set() };
let currentGameSettings = { numImpostors: 1 };

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'index.html')); });
app.get('/player', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'player.html')); });
app.get('/admin', (req, res) => { res.sendFile(path.join(__dirname, 'views', 'admin.html')); });
app.use('/', express.static(path.join(__dirname, 'public')));

const getSanitizedPlayers = () => Object.values(players);
const getLivingPlayers = () => getSanitizedPlayers().filter(p => p.isAlive && !p.disconnected);
function broadcastPlayerUpdates() {
    const allPlayers = getSanitizedPlayers();
    const playersForClients = allPlayers.map(p => _.omit(p, 'role'));
    for (const socket of io.of('/').sockets.values()) {
        if (socket.handshake.query.role === 'ADMIN') socket.emit('player-list-update', allPlayers);
        else if (Object.values(players).find(p => p.socketId === socket.id)) socket.emit('player-list-update', playersForClients);
    }
}
function checkWinConditions() {
    if (!gameInProgress) return;
    const livingImpostors = getLivingPlayers().filter(p => p.role === 'Impostor').length;
    const livingCrewmates = getLivingPlayers().filter(p => p.role === 'Crewmate').length;
    if (livingImpostors >= livingCrewmates) { io.emit('impostors-win'); gameInProgress = false; return; }
    if (livingImpostors === 0 && livingCrewmates > 0) { io.emit('crewmates-win'); gameInProgress = false; return; }
}
function broadcastTaskProgress() {
    const tasks = Object.values(taskProgress);
    if (tasks.length === 0) { io.emit('progress', 0); return; }
    const completed = tasks.filter(Boolean).length;
    const total = completed / tasks.length;
    io.emit('progress', total);
    if (total === 1 && gameInProgress) { io.emit('crewmates-win'); gameInProgress = false; }
}
function tallyVotes() {
    if (!meetingState.inProgress) return;
    const livingVoterCount = getLivingPlayers().length;
    const voteCounts = _.countBy(Object.values(meetingState.votes));
    const sortedVotes = _.toPairs(voteCounts).sort((a, b) => b[1] - a[1]);
    let result = { title: 'No one was ejected.', subtitle: 'Not enough votes were cast.' };
    if (sortedVotes.length > 0) {
        const [topId, topCount] = sortedVotes[0];
        const isTie = sortedVotes.length > 1 && sortedVotes[1][1] === topCount;
        const isMajority = topCount > livingVoterCount / 2;
        if (!isTie && isMajority && topId !== 'skip') {
            const ejectedPlayer = players[topId];
            if (ejectedPlayer) {
                ejectedPlayer.isAlive = false;
                result = { title: `${ejectedPlayer.name} was ejected.`, subtitle: `${topCount} vote(s)` };
            }
        } else if (isTie) { result.subtitle = 'Tie vote.'; } 
        else if (topId === 'skip') { result.subtitle = 'Most players abstained.'; }
        else { result.subtitle = 'No majority was reached.'; }
    }
    io.emit('vote-result', result);
    resetMeetingState();
    broadcastPlayerUpdates();
    checkWinConditions();
}
function resetMeetingState() { meetingState = { inProgress: false, votes: {}, readyPlayers: new Set() }; }
function initiateVotingPhase() { if (!gameInProgress || !meetingState.inProgress) return; io.emit('start-voting-phase', getLivingPlayers()); io.emit('play-meeting'); }

io.on('connection', socket => {
    const { playerId } = socket.handshake.query;
    if (playerId && players[playerId]) {
        players[playerId].socketId = socket.id;
        players[playerId].disconnected = false;
        broadcastPlayerUpdates();
    }
    socket.on('join-game', ({ playerName, playerId }) => {
        if (!players[playerId]) {
            players[playerId] = { id: playerId, socketId: socket.id, name: playerName, role: null, isAlive: true, disconnected: false };
        }
        broadcastPlayerUpdates();
    });
    
    socket.on('start-game', ({ numImpostors }) => {
        const nImpostors = parseInt(numImpostors, 10) || 1;
        currentGameSettings.numImpostors = nImpostors;
        const playerIds = Object.keys(players);
        
        if (playerIds.length < MIN_PLAYERS) {
            socket.emit('game-start-failed', `You need at least ${MIN_PLAYERS} players to start.`);
            return;
        }
        if (nImpostors >= playerIds.length / 2) {
            socket.emit('game-start-failed', `Too many impostors for the number of players.`);
            return;
        }

        gameInProgress = true;
        const impostors = _.shuffle(playerIds).slice(0, nImpostors);
        playerIds.forEach(id => {
            players[id].role = impostors.includes(id) ? 'Impostor' : 'Crewmate';
            io.to(players[id].socketId).emit('role', players[id].role);
        });
        taskProgress = {};
        let taskPool = _.shuffle(TASKS);
        playerIds.forEach(id => {
            const playerTasks = {};
            for (let i = 0; i < N_TASKS; i++) {
                if (taskPool.length === 0) taskPool = _.shuffle(TASKS);
                const taskId = uuid();
                playerTasks[taskId] = taskPool.pop();
                if (players[id].role === 'Crewmate') taskProgress[taskId] = false;
            }
            io.to(players[id].socketId).emit('tasks', playerTasks);
        });
        broadcastPlayerUpdates();
        broadcastTaskProgress();
    });

    socket.on('restart-game', () => { players = {}; taskProgress = {}; gameInProgress = false; io.emit('game-restarted'); resetMeetingState(); broadcastPlayerUpdates(); broadcastTaskProgress(); });
    socket.on('emergency-meeting', () => { if (!gameInProgress || meetingState.inProgress) return; meetingState.inProgress = true; io.emit('show-emergency-meeting-overlay'); });
    socket.on('report', () => { if (!gameInProgress || meetingState.inProgress) return; socket.emit('prompt-dead-player-selection', getLivingPlayers()); });
    socket.on('dead-player-reported', ({ deadPlayerId, deadPlayerName }) => {
        if (players[deadPlayerId]) {
            players[deadPlayerId].isAlive = false;
            meetingState.inProgress = true;
            broadcastPlayerUpdates();
            io.emit('show-report-overlay', { deadPlayerName });
        }
    });
    socket.on('player-ready-to-vote', () => {
        const player = Object.values(players).find(p => p.socketId === socket.id);
        if (!meetingState.inProgress || !player) return;
        meetingState.readyPlayers.add(player.id);
        const livingPlayerCount = getLivingPlayers().length;
        if (meetingState.readyPlayers.size === livingPlayerCount) {
            initiateVotingPhase();
        }
    });
    socket.on('cancel-meeting', () => { if (meetingState.inProgress) { resetMeetingState(); io.emit('meeting-cancelled'); } });
    socket.on('player-vote', ({ voterId, votedId }) => {
        if (meetingState.inProgress && players[voterId] && players[voterId].isAlive && !meetingState.votes[voterId]) {
            meetingState.votes[voterId] = votedId;
            const livingPlayerCount = getLivingPlayers().length;
            if (_.size(meetingState.votes) === livingPlayerCount) { tallyVotes(); }
        }
    });
    socket.on('player-set-alive-status', (playerId, isAlive) => { if (players[playerId]) { players[playerId].isAlive = isAlive; broadcastPlayerUpdates(); checkWinConditions(); } });

    // NEW: Handler to remove a player
    socket.on('remove-player', (playerId) => {
        if (players[playerId]) {
            const removedPlayerSocketId = players[playerId].socketId;
            delete players[playerId];
            // Optionally, kick the player's socket connection
            const playerSocket = io.sockets.sockets.get(removedPlayerSocketId);
            if (playerSocket) {
                playerSocket.emit('kicked'); // Tell the client they were kicked
                playerSocket.disconnect(true);
            }
            broadcastPlayerUpdates();
            checkWinConditions();
        }
    });

    socket.on('task-complete', taskId => { if (gameInProgress && taskProgress.hasOwnProperty(taskId)) { taskProgress[taskId] = true; broadcastTaskProgress(); } });
	socket.on('task-incomplete', taskId => { if (gameInProgress && taskProgress.hasOwnProperty(taskId)) { taskProgress[taskId] = false; broadcastTaskProgress(); } });
    socket.on('disconnect', () => {
        const disconnectedPlayer = Object.values(players).find(p => p.socketId === socket.id);
        if (disconnectedPlayer) {
            disconnectedPlayer.disconnected = true;
            broadcastPlayerUpdates();
            checkWinConditions();
        }
    });
});

server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));