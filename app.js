'use strict';
//SERVER-SIDE
// import fetch from "node-fetch";
const APP_KEY = "6UHiE2ZDpvhVgmq0eVG6tZH9xEKKuw67u-fkOGLpMOAtAzFu4xtmcg=="
const LOCAL_SERVER = "http://localhost:7071/api"
// #Replace below as appropriate
const CLOUD_SERVER = "https://quiplash-njm1g20.azurewebsites.net/api"
const prefix = CLOUD_SERVER;

const { ifError } = require('assert');
const { AsyncLocalStorage } = require('async_hooks');
const { error } = require('console');
const { json } = require('express');
const e = require('express');
//Set up express
const express = require('express');
const app = express();
const fetch = require('node-fetch');

//Setup socket.io
const server = require('http').Server(app);
const io = require('socket.io')(server);

//Setup static page handling
app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

//Handle client interface on /
app.get('/', (req, res) => {
  res.render('client');
});
//Handle display interface on /display
app.get('/display', (req, res) => {
  res.render('display');
});

let playerList = new Map(); //holds active players (player number, player data)
let playersToSockets = new Map(); //(username,socket)
let socketsToPlayers = new Map(); //(socket, username)
let audienceList = new Map(); //holds audience members
let audienceToSockets = new Map(); //(username,socket)
let socketsToAudience = new Map(); //(socket,username)
let gameState = { state: false, round: 0 };
let regSucc = false;
let allGamePrompts = new Map(); //(prompt, number of players assigned to) 
let activeGamePrompts = new Map();
let promptToAnswer = new Map(); //(prompt, [answer]) prompt and their answers
let socketToAnswer = new Map(); //(socket, [answer]) who submitted which answers 
let promptToSocket = new Map(); //(prompt, [socket]) which players are associated with what prompts
let socketToPrompt = new Map(); //(socket,[prompt]) which player was assigned what prompts
let nextPlayerNumber = 0;
let numToAll = new Map(); //(player number, username)
let allToNum = new Map(); //(username, player number)
let socketToVotes = new Map();
let socketToVotesTemp = new Map();
// player states: 0-playing, 1-audience 
// game states: 0-not started, 1-entering prompts, 2-completed answers, 3-voting round,4-winning 

//Start the server
function startServer() {
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

//Chat message
function handleChat(message) {
  console.log('Handling chat: ' + message);
  io.emit('chat', message);
}

///////////////for all handles show alert if there is error///////////////////
async function handleRegister(socket, username, password) {
  console.log("handle register");
  console.log(username, password);

  const payload = {
    "username": username, "password": password
  };

  const response = respHandler(socket, await (await fetch(prefix + '/player/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-functions-key': APP_KEY }
  })).json())

}

async function handleLogin(socket, username, password) {
  console.log("handle login");
  console.log(username, password);

  const payload = {
    "username": username, "password": password
  };


  const response = respHandler(socket, (await (await fetch(prefix + '/player/login', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-functions-key': APP_KEY }
  })).json()))

  //if successful login and game not started yet, add to playerlist, set player number, set player socket, set game state
  //if successful login:
  if ((gameState.state != false) || (gameState.state != 0)) { //make audience member
    console.log("Game has already begun")
    audienceList.set(nextPlayerNumber, { username: username, state: 1, score: 0, playerNumber: nextPlayerNumber });
    allToNum.set(username, nextPlayerNumber);
    numToAll.set(nextPlayerNumber, username);
    gameState.state = 0;
    nextPlayerNumber++;
    audienceToSockets.set(username, socket);
    socketsToAudience.set(socket, username);
    return;
  }

  if (nextPlayerNumber < 8) { //if max players not reached yet
    console.log("adding a new player ", username);
    playerList.set(nextPlayerNumber, { username: username, state: 1, score: 0, playerNumber: nextPlayerNumber });
    allToNum.set(username, nextPlayerNumber);
    numToAll.set(nextPlayerNumber, username);
    gameState.state = 0;
    nextPlayerNumber++;
    playersToSockets.set(username, socket);
    socketsToPlayers.set(socket, username);
  } else { //if max players reached then make audience member
    audienceList.set(nextPlayerNumber, { username: username, state: 1, score: 0, playerNumber: nextPlayerNumber });
    allToNum.set(username, nextPlayerNumber);
    numToAll.set(nextPlayerNumber, username);
    gameState.state = 0;
    nextPlayerNumber++;
    audienceToSockets.set(username, socket);
    socketsToAudience.set(socket, username);
  }

  for (let [playerNumber, playerState] of playerList) {
    console.log("Player: ", numToAll.get(playerNumber));
  }

  for (let [playerNumber, playerState] of audienceList) {
    console.log("aud: ", numToAll.get(playerNumber));
  }



}
//Handle errors
function handleError(socket, message) {
  console.log('Error: ' + message);
  socket.emit('fail', message);
}

//Update state of all players
//update list of prompts?
function updateAll() {
  console.log('Updating all players');
  // console.log('SocketToPrompt', Array.from(socketToPrompt.keys()).map(socket => socket.id), socketToPrompt.values())
  // console.log('promptToSocket', promptToSocket.keys(), Array.from(promptToSocket.values()).map(sockets => Array.from(sockets).map(socket=>socket.id).flat()))

  if (nextPlayerNumber > 7) {
    for (let [username, socket] of playersToSockets) {
      updateIndPlayer(socket);
    }
    for (let [username, socket] of audienceToSockets) {
      updateIndAud(socket);
    }
  } else {
    for (let [username, socket] of playersToSockets) {
      updateIndPlayer(socket);
    }
  }
}

//Update one player
function updateIndPlayer(socket) {
  //find the users who submitted that prompt
  //for each user find out:
  //answer,the user who answered the prompt, the users who voted for it, the total  number of votes
  // const voteNum =  socketToVotes.get(so)
  const playerName = socketsToPlayers.get(socket);
  const playerNum = allToNum.get(playerName)
  const thePlayer = playerList.get(playerNum);
  const promptAnswer = Array.from(promptToAnswer)[0]; //(prompt,[answers]) current one
  const playerPrompt = socketToPrompt.get(socket);
  let isMyPrompt = false;
  let data;
  let allVoteInfo = []; //[[u,vp,vn],[u,vp,vn]]
  let socketsToCheck;
  let answers;
  if (playerPrompt != undefined) {
    if (promptAnswer != undefined) {
      console.log(promptAnswer[0]);
      socketsToCheck = promptToSocket.get(promptAnswer[0]); //[sockets] associated with current prompt
      answers = promptAnswer[1]//answers to display for current prompt
      // console.log(socketsToCheck);
      if (socketsToCheck.includes(socket)) {
        isMyPrompt = true;
      }
    }

    if (gameState.state > 3) {
      for (let s in socketsToCheck) {
        console.log(s);
        let voteInfo = [];
        let voteNumber;
        let smth = socketToAnswer.get(socketsToCheck[s]); //[answers] submitted by answerer
        const findAnswer = smth.filter(value => answers.includes(value));

        let n = socketsToPlayers.get(socketsToCheck[s]); //username of prompt answerer
        console.log(n);
        let ps = socketToVotesTemp.get(socketsToCheck[s]); //usernames of players who voted for that prompt
        if (ps == undefined) {
          voteNumber = 0;
        } else {
          console.log(ps);
          voteNumber = ps.length;
        }
        voteInfo.push(findAnswer[0], n, voteNumber, ps);
        allVoteInfo.push(voteInfo);
        console.log(allVoteInfo);
      }



    }
    data = { gameState: gameState, playerState: thePlayer, playerList: Object.fromEntries(playerList), audienceList: Object.fromEntries(audienceList), ifMyPrompt: isMyPrompt, promptList: promptAnswer, prompt: playerPrompt[0], voteInfo: allVoteInfo };
  } else {
    data = { gameState: gameState, playerState: thePlayer, playerList: Object.fromEntries(playerList), audienceList: Object.fromEntries(audienceList), ifMyPrompt: isMyPrompt, promptList: promptAnswer, prompt: playerPrompt, voteInfo: allVoteInfo };
  }

  socket.emit('state', data);
}

function updateIndAud(socket) {

  const promptAnswer = Array.from(promptToAnswer)[0];
  const audName = socketsToAudience.get(socket);
  const audNum = allToNum.get(audName)
  const theAud = audienceList.get(audNum);

  let socketsToCheck;
  let allVoteInfo = [];
  let answers;
  if (promptAnswer != undefined) {
    console.log(promptAnswer[0]);
    socketsToCheck = promptToSocket.get(promptAnswer[0]); //[sockets] associated with current prompt
    answers = promptAnswer[1]//answers to display for current prompt
    // console.log(socketsToCheck);

  }

  if (gameState.state > 3) {
    for (let s in socketsToCheck) {
      console.log(s);
      let voteInfo = [];
      let voteNumber;
      let smth = socketToAnswer.get(socketsToCheck[s]); //[answers] submitted by answerer
      const findAnswer = smth.filter(value => answers.includes(value));

      let n = socketsToPlayers.get(socketsToCheck[s]); //username of prompt answerer
      console.log(n);
      let ps = socketToVotesTemp.get(socketsToCheck[s]); //usernames of players who voted for that prompt
      if (ps == undefined) {
        voteNumber = 0;
      } else {
        console.log(ps);
        voteNumber = ps.length;
      }
      voteInfo.push(findAnswer[0], n, voteNumber, ps);
      allVoteInfo.push(voteInfo);
      console.log(allVoteInfo);
    }



  }

  const data = { gameState: gameState, playerState: theAud, playerList: Object.fromEntries(playerList), audienceList: Object.fromEntries(audienceList), ifMyPrompt: false, promptList: Object.fromEntries(promptAnswer), prompt: null, voteInfo: allVoteInfo };
  console.log("sending data to ", audName, " with ", data);

  socket.emit('state', data);
}


async function handleSubmitPrompt(prompt, socket, username, password) {

  let payload = {
    "text": prompt, "username": username, "password": password
  };


  let response = respHandler(socket, (await (await fetch(prefix + '/prompt/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-functions-key': APP_KEY }
    })).json()));

  // if prompt successfully stored:::::::::::::::::::::::::::::::::::::::::::::::::::::
  if (socketsToPlayers.has(socket)) {
    const playerName = socketsToPlayers.get(socket);
    const playerNum = allToNum.get(playerName)
    const thePlayer = playerList.get(playerNum);
    thePlayer.state = 2; //go to waiting screen
    //if player is in state 2 they need to answer next once sumission done
  } else {
    const audName = socketsToAudience.get(socket);
    const audNum = allToNum.get(audName)
    const theAud = audienceList.get(audNum);
    theAud.state = 2;
    //if audience is in state 2 they see the waiting screen until vote
  }

  allGamePrompts.set(prompt, -1);
  // votestoActivePrompts.set(false, prompt);

}

function handleAnswer(socket, prompt, answer, username) {
  console.log("handle answer ", answer, " for prompt ", prompt, " by ", username);
  let tempPtoA = promptToAnswer.get(prompt);
  let tempStoA = socketToAnswer.get(socket);
  if (tempPtoA == undefined) {
    promptToAnswer.set(prompt, []);
    promptToAnswer.get(prompt).push(answer);
    console.log("ptoA ", promptToAnswer.get(prompt));
  } else {
    promptToAnswer.get(prompt).push(answer);
    console.log("ptoA ", promptToAnswer.get(prompt));

  }

  if (tempStoA == undefined) {

    socketToAnswer.set(socket, []);
    socketToAnswer.get(socket).push(answer);
    console.log("stoA ", socketToAnswer.get(socket));

  } else {

    socketToAnswer.get(socket).push(answer);
    console.log("stoA ", socketToAnswer.get(socket));
  }



  let a = socketToPrompt.get(socket);
  let index = a.indexOf(prompt);
  if (index > -1) { // only splice array when item is found
    a.splice(index, 1); // 2nd parameter means remove one item only
    console.log("removing ", prompt, socketToPrompt.get(socket));


    if ((socketToPrompt.get(socket)).length == 0) { //if all prompts answered
      console.log("stp ", socketToPrompt.get(socket).length);
      let playerNumber = allToNum.get(username);
      let playerData = playerList.get(playerNumber);
      playerData.state = 2; //waiting page
      console.log(username, " finished answering all prompts ", playerData.state);
    } else {
      console.log("stp ", socketToPrompt.get(socket).length);
      let playerNumber = allToNum.get(username);
      let playerData = playerList.get(playerNumber);
      playerData.state = 1; //get next prompt
      updateIndPlayer(socket);
    }
  }

};

function handleVote(socket, prompt, answer) { //clear socketstovotes at the end of each prompt
  console.log("handle vote for ", prompt, answer);

  //check is socket is same as voted socket
  let socketFound = false;
  let votingPlayer = socketsToPlayers.get(socket);//gets the username of the player who voted
  let tempSockets = promptToSocket.get(prompt); //list containing socket of voted player
  console.log("pta size: ", tempSockets.length);
  for (let s of tempSockets) {
    let tempAnswers = socketToAnswer.get(s); //answers submitted by the socket

    for (let a of tempAnswers) {
      if (a == answer) {
        socketFound = s;
        console.log("found voted player")
        break;
      };
    }
  }




  if (socketToVotes.has(socketFound)) {
    socketToVotes.get(socketFound).push(votingPlayer);
  } else {
    socketToVotes.set(socketFound, [votingPlayer]);
  }

  if (socketToVotesTemp.has(socketFound)) {
    socketToVotes.get(socketFound).push(votingPlayer);
  } else {
    socketToVotesTemp.set(socketFound, [votingPlayer]);
  }



  let playerName = socketsToPlayers.get(socket);
  let playerNum = allToNum.get(playerName)
  let thePlayer = playerList.get(playerNum);
  thePlayer.state = 2; //done voting, waiting for next prompt



};

function handleScore() { //call in end of vote in handleadmin
  //when next round starts, add round score to total score and reset round score
  console.log("handling score");
  for (let [username, socket] of playersToSockets) {
    let playerName = socketsToPlayers.get(socket);
    let playerNum = allToNum.get(playerName)
    let thePlayer = playerList.get(playerNum);
    let votes;
    if (socketToVotes.has(socket)) {
      votes = socketToVotes.get(socket).length; //check if undefined -> make 0
    } else {
      votes = 0; //check if undefined -> make 0
    }
    thePlayer.score = gameState.round * votes * 100
    console.log(thePlayer.score);
  }

}

function handleAdvance() {
  //todo: handle rounds
  console.log("handle advance");
  if (gameState.state === 0) {
    gameState.state = 1;
  } else if (gameState.state == 1) {
    gameState.state = 2;
  } else if (gameState.state == 3) {
    gameState.state = 4;
  }
}

//if false then show that in alert
function respHandler(socket, response) {
  let respMsg = response.msg;
  let respRes = response.result;
  console.log("handling response: ", respMsg);

  if (!respRes)
    throw new Error(respMsg)
    
}

function handleNextRound() {
  console.log("handling next round",);
  gameState.state = 1;
  for (let [username, socket] of playersToSockets) { //reset round score
    let playerName = socketsToPlayers.get(socket);
    let playerNum = allToNum.get(playerName)
    let thePlayer = playerList.get(playerNum);

    thePlayer.totalScore += thePlayer.score;
    thePlayer.score = 0;
    console.log(thePlayer.score, thePlayer.totalScore);
  }
  promptToAnswer.clear();
  socketToAnswer.clear();
  activeGamePrompts.clear();
  socketToVotes.clear();
  promptToSocket.clear();
  socketToPrompt.clear();
}

function resetGame() {
  gameState.round = 1;
  for (let [username, socket] of playersToSockets) { //reset round score
    let playerName = socketsToPlayers.get(socket);
    let playerNum = allToNum.get(playerName)
    let thePlayer = playerList.get(playerNum);

    thePlayer.totalScore = 0;
    thePlayer.score = 0;
    console.log(thePlayer.score, thePlayer.totalscore);
  }
  promptToAnswer.clear();
  socketToAnswer.clear();
  activeGamePrompts.clear();
  socketToVotes.clear();
  promptToSocket.clear();
  socketToPrompt.clear();


}


async function handleAdmin(player, action) {
  console.log("reached handleamdin");
  if (player !== 0) {
    console.log('Failed admin action from player ' + player + ' for ' + action);
    return;
  }

  if (action == 'start' && gameState.state === 0) {//once everyone has joined
    console.log("starting game");

    gameState.state = 1;
    setState(1);
    console.log(gameState)

  } else if (action == 'advance' && gameState.state == 1) {//once all prompts are submitted
    await assignPrompts();
    gameState.round++;
    gameState.state = 2;
    setState(1);
    return;
  } else if (action == 'advance' && gameState.state == 2) {//once one answer has been submitted
    gameState.state = 3;
    setState(1);
    console.log(gameState)
  } else if (action == 'advance' && gameState.state == 3) { //voting
    gameState.state = 4;
    setState(1);
    console.log(gameState)
  } else if (action == 'advance' && gameState.state == 4) {
    if (promptToAnswer.size == 0) { //all prompts voted on show round scores
      console.log("here");
      handleScore();
      gameState.state = 5;
      setState(1);
      console.log(gameState)
    } else {

      const promptAnswer = Array.from(promptToAnswer)[0];
      promptToAnswer.delete((promptAnswer[0]));
      console.log("deleted prompt ", promptAnswer);
      socketToVotesTemp.clear();
      gameState.state = 3;
      setState(1);
      console.log(gameState)
    }
    if (promptToAnswer.size == 0) { //all prompts voted on show round scores
      console.log("acc here");
      handleScore();
      gameState.state = 5;
      setState(1);
      console.log(gameState)
    };
  } else if (action == 'advance' && gameState.state == 5) {  //TEST THIS!!!!
    if (gameState.round == 3) { //if all rounds played, go to final scoreboard
      gameState.state = 6;
      console.log(gameState);
    } else { //go to next round
      handleNextRound();
      setState(1);
      console.log(gameState);
    }
  } else if (action == 'advance' && gameState.state == 6) {
    gameState.state = 0;
    setState(1);
    console.log(gameState)
    resetGame();
  } else {
    console.log('Unknown admin action: ' + action);

  }
}

//readd check for if not enough prompts eg. if no prompts in db
async function assignPrompts() {

  console.log("assigning prompts");
  //if 8 players, 4 prompts needed 
  //2 from api, 2 from just submitted
  let totalPromptsNeeded = 0;

  let n = playerList.size;
  if (n % 2 == 0) { //if even number of players
    totalPromptsNeeded = n / 2;
  } else {//if odd number of players
    totalPromptsNeeded = n
  }

  let numbertoRetrieve = Math.ceil(totalPromptsNeeded / 2);
  let numbertoKeep = totalPromptsNeeded - numbertoRetrieve;

  let payload = { "prompts": numbertoRetrieve };

  await fetch(prefix + '/prompts/get', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-functions-key': APP_KEY }
  })
    .then(res => res.json())
    .then(json => helper(json, totalPromptsNeeded, numbertoKeep))
    .then(() => {
      console.log('SocketToPrompt AFTER', Array.from(socketToPrompt.keys()).map(socket => socket.id), socketToPrompt.values())
      console.log('promptToSocket', promptToSocket.keys(), Array.from(promptToSocket.values()).map(sockets => Array.from(sockets).map(socket => socket.id).flat()))
    })
    .catch(function (err) {
      console.log(err)
    });
}

async function helper(json, totalPromptsNeeded, numbertoKeep) {
  await parsePrompts(json);
  let n = playerList.size;

  let i = 0;

  //assigning from all prompts to prompts from current round
  for (let [prompt, used] of allGamePrompts) {
    if (used == -1 && activeGamePrompts.size < totalPromptsNeeded) { //if prompt hasnt already been used and while there is less promps active than needed
      allGamePrompts.set(prompt, 0);
      activeGamePrompts.set(prompt, 0)
      i++;
    }
  }

  for (let [username, socket] of playersToSockets) {
    socketToPrompt.set(socket, []);
  };
  for (let [prompt, aCount] of activeGamePrompts) {
    promptToSocket.set(prompt, []);
  };

  //if even number of players:
  if (n % 2 == 0) {
    let j = 0;

    for (let [username, socket] of playersToSockets) {
      let tempPrompt = Array.from(activeGamePrompts.keys())[j];
      let count = activeGamePrompts.get(tempPrompt);

      if (count < 2) {
        socketToPrompt.get(socket).push(tempPrompt);
        promptToSocket.get(tempPrompt).push(socket);
        activeGamePrompts.set(tempPrompt, count + 1);
      } else {
        j++;
        tempPrompt = Array.from(activeGamePrompts.keys())[j];
        count = activeGamePrompts.get(tempPrompt);
      }
    };

  } else {
    let j = 0;
    let tempPlayers = Array.from(playersToSockets.keys()); //array of usernames
    tempPlayers = tempPlayers.concat(tempPlayers);


    for (let player of tempPlayers) {
      let tempPrompt = Array.from(activeGamePrompts.keys())[j];
      let count = activeGamePrompts.get(tempPrompt);
      if (count < 2) {
        socketToPrompt.get(playersToSockets.get(player)).push(tempPrompt);
        promptToSocket.get(tempPrompt).push(playersToSockets.get(player));
        activeGamePrompts.set(tempPrompt, count + 1);
      } else {
        j++;
        tempPrompt = Array.from(activeGamePrompts.keys())[j];
        count = activeGamePrompts.get(tempPrompt);
        socketToPrompt.get(playersToSockets.get(player)).push(tempPrompt);
        promptToSocket.get(tempPrompt).push(playersToSockets.get(player));
        activeGamePrompts.set(tempPrompt, count + 1);
      }
    }


  }

  for (let [username, socket] of playersToSockets) {
    const playerNum = allToNum.get(username);
    const thePlayer = playerList.get(playerNum);
    thePlayer.state = 1; //go to main screen
  };


  // console.log('SocketToPrompt', Array.from(socketToPrompt.keys()).map(socket => socket.id), socketToPrompt.values())
  // console.log('promptToSocket', promptToSocket.keys(), Array.from(promptToSocket.values()).map(sockets => Array.from(sockets).map(socket=>socket.id).flat()))
};


async function parsePrompts(resp) {
  console.log("parsing retrieved prompts", resp);
  for (var i = 0; i < resp.length; i++) {
    console.log(resp[i].text);
    allGamePrompts.set(resp[i].text, 0)
    activeGamePrompts.set(resp[i].text, 0);
  }
}


function setState(state) {
  //initialise all players
  for (let [username, socket] of playersToSockets) {
    const playerName = socketsToPlayers.get(socket);
    const playerNum = allToNum.get(playerName)
    const thePlayer = playerList.get(playerNum);
    thePlayer.state = state;
  }
  for (let [username, socket] of audienceToSockets) {
    const audName = socketsToAudience.get(socket);
    const audNum = allToNum.get(audName)
    const theAud = audienceList.get(audNum);
    theAud.state = state;
  }

}
//Handle new connection
io.on('connection', socket => {
  console.log('New connection');

  socket.on('register', async (username, password) => {
    console.log('registering', username, password);
    try{
      await handleRegister(socket, username, password);
      updateAll();
    }
    catch(error){
      handleError(socket, error.message)
    }
  });

  socket.on('login', async (username, password) => {
    console.log('logging in', username);
    try {
      await handleLogin(socket, username, password);
      updateAll();
    }
    catch (error) {
      console.log('Error', error);
      handleError(socket, error.message)
    }

  });

  socket.on('submitPrompt', async (prompt, username, password) => {
    console.log(prompt);
    try {
      await handleSubmitPrompt(prompt, socket, username, password);
      updateAll();
    }
    catch (error) {
      console.log('Error', error);
      handleError(socket, error.message)
    
    }
  });

  socket.on('promptAnswer', (username, prompt, answer) => {
    console.log(username, 'answered ', prompt, " with ", answer);
    handleAnswer(socket, prompt, answer, username);
    updateAll();
  });

  socket.on('vote', (prompt, answer) => {
    console.log('vote for ', prompt, answer);
    handleVote(socket, prompt, answer);
    updateAll();

  })


  //Handle on chat message received
  socket.on('chat', message => {
    handleChat(message);
    updateAll();

  });

  socket.on('admin', async action => {
    if (!socketsToPlayers.has(socket)) return;
    updateAll();
    try {
      await handleAdmin(allToNum.get(socketsToPlayers.get(socket)), action);
      updateAll();
    }
    catch (error) {
      console.log('Error', error);
      handleError(socket, error.message)
    }
    
  });
  //Handle disconnection
  socket.on('disconnect', () => {
    console.log('Dropped connection');
  });

});

//Start server
if (module === require.main) {
  startServer();

}

module.exports = server;
