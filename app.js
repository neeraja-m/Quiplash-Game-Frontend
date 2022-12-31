'use strict';
//SERVER-SIDE
// import fetch from "node-fetch";
const APP_KEY="6UHiE2ZDpvhVgmq0eVG6tZH9xEKKuw67u-fkOGLpMOAtAzFu4xtmcg=="
const LOCAL_SERVER="http://localhost:7071/api"
// #Replace below as appropriate
const CLOUD_SERVER="https://quiplash-njm1g20.azurewebsites.net/api"
const prefix =  CLOUD_SERVER;

const { ifError } = require('assert');
const { AsyncLocalStorage } = require('async_hooks');
const { error } = require('console');
const { json } = require('express');
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
let gameState = { state: false }; 
let regSucc= false;
let activePromptstoVotes = new Map(); //(prompt, true/false) 
let promptToAnswer = new Map(); //(prompt, (answer,socket)) prompt and who submitted the answer
let answerToSocket = new Map(); //(answer, socket) 
let promptToSocket = new Map(); //(prompt,socket) which player was assigned what prompt
let nextPlayerNumber = 0;
let numToAll = new Map(); //(player number, username)
let allToNum = new Map(); //(username, player number)

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
    io.emit('chat',message);
}

///////////////for all handles show alert if there is error///////////////////
function handleRegister(socket,username,password){
  console.log("handle register");
  console.log(username,password);

    let payload = {
      "username" : username,"password":password
  };

  fetch(prefix+'/player/register', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'x-functions-key' : APP_KEY  }
  }).then(res => res.json())
    .then(json => respHandler(socket,json))
    .catch(function(err) {
      console.log(err)
    });

  //if resp true, pop up
  if (regSucc){


  }
  //handleLogin(socket,username,password);
}

function handleLogin(socket,username,password){
  console.log("handle login");
  console.log(username,password);

    let payload = {
      "username" : username,"password":password
  };

  //fix error catching
  fetch(prefix+'/player/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'x-functions-key' : APP_KEY  }
  }).then(res => res.json())
    .then(json => respHandler(socket,json))
    .catch(function(err) {
      console.log(err)
    });


    //if successful login and game not started yet, add to playerlist, set player number, set player socket, set game state
    //if successful login:
    if((gameState.state != false) ||(gameState.state!=0) ) {
      console.log("Game has already begun")
      handleError(socket,'Game has already begun',true);

      return;
  }

    if(nextPlayerNumber<8){ //if max players not reached yet
    console.log("adding a new player ",username);
    playerList.set(nextPlayerNumber ,{ username: username, state: 1, score: 0,playerNumber:nextPlayerNumber});
    allToNum.set(username,nextPlayerNumber);
    numToAll.set(nextPlayerNumber,username);
    gameState.state=0;
    nextPlayerNumber++;
    playersToSockets.set(username,socket);
    socketsToPlayers.set(socket,username);
    }else{ //if max players reached then make audience member
    audienceList.set(nextPlayerNumber,{ username: username, state: 1, score: 0,playerNumber:nextPlayerNumber});
    allToNum.set(username,nextPlayerNumber);
    numToAll.set(nextPlayerNumber,username);
    gameState.state=0;
    nextPlayerNumber++;
    audienceToSockets.set(username,socket);
    socketsToAudience.set(socket,username);
    }

    for(let [playerNumber,playerState] of playerList) {
      console.log("Player: " , numToAll.get(playerNumber));
    }    

    for(let [playerNumber,playerState] of audienceList) {
      console.log("aud: " , numToAll.get(playerNumber));
    }    


    socket.emit('logged');

}
//Handle errors
function handleError(socket, message, halt) {
  console.log('Error: ' + message);
  socket.emit('fail',message);
  if(halt) {
      socket.disconnect();
  }else{
      //show try again popup
  }
}

//Update state of all players
//update list of prompts?
function updateAll() {
  console.log('Updating all players');
  for(let [username,socket] of playersToSockets) {
      updateIndPlayer(socket);
      console.log(username);

  }
  for(let [username,socket] of audienceToSockets) {
    updateIndAud(socket);
    console.log(username);
  }
}

//Update one player
function updateIndPlayer(socket) {
  const playerName = socketsToPlayers.get(socket);
  const playerNum = allToNum.get(playerName)
  const thePlayer = playerList.get(playerNum);
  const data = { gameState: gameState, playerState: thePlayer, playerList: Object.fromEntries(playerList),audienceList: Object.fromEntries(audienceList) }; 
  socket.emit('state',data);
}

function updateIndAud(socket) {
  const audName = socketsToAudience.get(socket);
  const audNum = allToNum.get(audName)
  const theAud= audienceList.get(audNum);
  const data = { gameState: gameState, playerState: theAud, playerList: Object.fromEntries(playerList),audienceList: Object.fromEntries(audienceList) }; 
  socket.emit('state',data);
}


function handleSubmitPrompt(prompt,socket){
  let username="";
  let password=""; //retrieve from db?
  console.log("handle submit prompt", prompt);
  if(isPlayer(socket)){
    username = socketsToPlayers.get(socket);
  }else{
    username = socketsToAudience.get(socket);
  }
    let payload = {
      "text" : prompt,"username":username,"password":password
  };

  fetch(prefix+'/player/create', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'x-functions-key' : APP_KEY  }
  }).then(res => res.json())
    .then(json => respHandler(json))
    .catch(function(err) {
      console.log(err)
    });

  // if prompt successfully stored:
  if(isPlayer(socket)){
    const playerName = socketsToPlayers.get(socket);
    const playerNum = allToNum.get(playerName)
    const thePlayer = playerList.get(playerNum);
    thePlayer.state=2; 
    //if player is in state 2 they need to answer next once sumission done
  }else{
    const audName = socketsToAudience.get(socket);
    const audNum = allToNum.get(audName)
    const theAud= audienceList.get(audNum);
    theAud.state=2;
    //if audience is in state 2 they see the waiting screen until vote
  }

  activePromptstoVotes.set(prompt,false); 

  assignPrompts();
}

function handleAnswer(prompt,answer,username){
  console.log("handle answer");

}

function handleVote(username,answer){
  console.log("handle vote");
  console.log(username,password);
}

function isPlayer(socketToCheck){
  let isplayer=false;

  for(let [username,socket] in playerList){
    if(socketToCheck=socket){
      isplayer = true;
    }
  }
  for(let [username,socket] in audienceList){
    if(socketToCheck=socket){
      isplayer = false;
    }
  }
  return isplayer;
  
}


function handleAdvance(){
  //todo: handle rounds
  console.log("handle advance");
  if(gameState.state===0){
    gameState.state =1;
  }else if (gameState.state ==1){
    gameState.state=2;
  }else if(gameState.state==3){
    gameState.state=4;
  }
}

//if false then show that in alert
function respHandler(socket,response){
  let respMsg = response.msg;
  let respRes = response.result;
  console.log("handling response: ",respMsg);
  
  if(!respRes){
    handleError(socket,respMsg,false)
    console.log("finished");
    return false;
  }else{
    return true;
  }
}



function handleAdmin(player,action) {
  console.log("reached handleamdin");
  if(player !== 0) {
      console.log('Failed admin action from player ' + player + ' for ' + action);
      return;
  }

  if(action == 'start' && gameState.state === 0) {
    console.log( "starting game"); 

      gameState.state=1;
      console.log(gameState)
      
  // } else if (action == 'advance' )  {
  //   console.log( action); 
  //   handleAdvance();
  }else {
      console.log('Unknown admin action: ' + action); 
  }
}
function startGame(){
  //initialise all players
  for(let [username, socket] in playerList){
  const playerName = socketsToPlayers.get(socket);
  const playerNum = allToNum.get(playerName)
  const thePlayer = playerList.get(playerNum);
  thePlayer.state=1; 
  }
  for(let [username,socket] in audienceList){
    const audName = socketsToAudience.get(socket);
    const audNum = allToNum.get(audName)
    const theAud= audienceList.get(audNum);
    theAud.state=1;
  }

}

function assignPrompts(){
  //if 8 players, 4 prompts needed 
   //2 from api, 2 from just submitted
  let n = playerList.size;
  let totalPromptsNeeded = Math.ceil(n/2); 
  let numbertoRetrive =  Math.ceil(totalPromptsNeeded/2);
  let payload = {
    "prompts":numbertoRetrive};

fetch(prefix+'/player/get', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: { 'x-functions-key' : APP_KEY  }
}).then(res => res.json())
  .then(json => respHandler(json))
  .catch(function(err) {
    console.log(err)
  });
  let prompts=[]
  for(var i in json){
  console.log(i);
  prompts.push([i, json_data [i]]);
  }

}


//Handle new connection
io.on('connection', socket => { 
  console.log('New connection');

  socket.on('register', (username,password)=>{
    console.log('registering',username,password);
    handleRegister(socket,username,password);
    updateAll();
  });

  socket.on('login', (username,password)=>{
    console.log('logging in',username);
    handleLogin(socket,username,password);
    updateAll();

  });

  socket.on('submitPrompt', (prompt)=>{
    console.log(prompt);
    handleSubmitPrompt(prompt,socket);
    updateAll();
  });

  socket.on('promptAnswer', (username,prompt,answer)=>{
    console.log(username, 'answered ',prompt, answer);
    handleAnswer(prompt,answer,username);
    updateAll();

  });

  socket.on('vote', (username,answer)=>{
    console.log('vote for ', username,answer);
    handleVote(username,answer);
    updateAll();

  })

  socket.on('advance', ()=>{
    console.log('advancing');
    handleAdvance();
    updateAll();

  });

  //Handle on chat message received
  socket.on('chat', message => {
    handleChat(message);
    updateAll();

  });
  socket.on('admin', action => {
    if(!socketsToPlayers.has(socket)) return;
    handleAdmin(allToNum.get(socketsToPlayers.get(socket)),action);
    updateAll();
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
