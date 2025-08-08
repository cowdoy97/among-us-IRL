# Among Us IRL

Used this guys code: https://github.com/michaelgira23/among-us-real-life 
and edited to be exactly what I needed.

## Features

-   Assign impostors/crewmates
-   Assign tasks (Easily edited)
-   Checking off tasks updates a global progress bar in real-time
-   Win logic for crew/imposters
-   Voting Systems
-   Disables app for those who have been reported dead

## Usage

This was built for personal use, but anyone is welcome to use this for hosting their own game.

### 1. Configure the game

You may want to modify the following properties located in [`src/index.js`](https://github.com/michaelgira23/among-us-real-life/blob/master/src/index.js):

[`TASKS`](https://github.com/michaelgira23/among-us-real-life/blob/master/src/index.js#L14) - An array of strings that consist of all possible tasks. These will be randomly assigned to players.

[`N_TASKS`](https://github.com/michaelgira23/among-us-real-life/blob/master/src/index.js#L31) - Number of tasks to assign each player

### 2. Start the backend

Start the backend with

```
$ npm install
$ npm start
```


### 3. Connect to the admin dashboard

Visit [http://localhost:4046/admin](http://localhost:4046/admin) to access the admin panel. There is a single button to start the game.

Pressing the start button will reset task progress, assign new tasks, and assign impostors. Press it once all players connect, otherwise you will have to press it again.

### 4. Invite friends to join

Players may access the the game at [http://localhost:4046](http://localhost:4046). On other computers (or phones), you will need to enter the computer's local IP or use a tunneling service like [ngrok](https://ngrok.com). Alternatively, you could deploy this yourself.

