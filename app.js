'use strict';
//SERVER-SIDE
// import fetch from "node-fetch";
const APP_KEY="6UHiE2ZDpvhVgmq0eVG6tZH9xEKKuw67u-fkOGLpMOAtAzFu4xtmcg=="
const LOCAL_SERVER="http://localhost:7071/api"
// #Replace below as appropriate
const CLOUD_SERVER="https://quiplash-njm1g20.azurewebsites.net/api"
const prefix =  CLOUD_SERVER;

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

let playerList = new Map(); //holds active players
let playersToSockets = new Map(); //(username,socket)
let socketsToPlayers = new Map();
let audience = new Map(); //holds audience members
let audienceToSockets = new Map();
let socketsToAudience = new Map();
let gameState = { state: false };
let timer = null;
let nextPlayerNumber = 0;

//player states: 0-playing, 1-audience 
//game states: 0-not started, 1-entering prompts, 2-completed answers, 3-voting round,4-winning 

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

//Handle new connection
io.on('connection', socket => { 
  console.log('New connection');

  socket.on('register', (username,password)=>{
    console.log('registering',username,password);
    handleRegister(socket,username,password);
  });

  socket.on('login', (username,password)=>{
    console.log('logging in',username);
    handleLogin(socket,username,password);

  });

  socket.on('submitPrompt', (username,prompt)=>{
    console.log(prompt,' submitted by ',username);
    handleSubmitPrompt(username,prompt);
  });

  socket.on('promptAnswer', (username,prompt,answer)=>{
    console.log(username, 'answered ',prompt, answer);
    handleAnswer(prompt,answer,username);
  });

  socket.on('vote', (username,answer)=>{
    console.log('vote for ', username,answer);
    handleVote(username,answer);
  })

  socket.on('advance', ()=>{
    console.log('advancing');
    handleAdvance();
  });

  //Handle on chat message received
  socket.on('chat', message => {
    handleChat(message);
  });

  //Handle disconnection
  socket.on('disconnect', () => {
    console.log('Dropped connection');
  });

});

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
    .then(json => errorHandler(socket,json))
    .catch(function(err) {
      console.log(err)
    });
 
}

function handleLogin(socket,username,password){
  console.log("handle login");
  console.log(username,password);

    let payload = {
      "username" : username,"password":password
  };

  fetch(prefix+'/player/login', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'x-functions-key' : APP_KEY  }
  }).then(res => res.json())
    .then(json => errorHandler(socket,json))
    .catch(function(err) {
      console.log(err)
    });

    //if successful login:
    if(nextPlayerNumber<7){ //if max players not reached yet
    console.log("adding a new player ",username);
    playerList.set(username,{ username: username, state: 1, score: 0,playerNumber:nextPlayerNumber });
    nextPlayerNumber++;
    playersToSockets.set(username,socket);
    socketsToPlayers.set(socket,username);
    }else{ //if max players reached then make audience member
    audience.set(username,{ username: username, state: 1, score: 0,playerNumber:nextPlayerNumber });
    nextPlayerNumber++;
    audienceToSockets.set(username,socket);
    socketsToAudience.set(socket,username);
    }

    socket.emit('logged');
 
}


function handleSubmitPrompt(username,password,prompt){
  console.log("handle submit prompt");
  console.log(username,password,prompt);

    let payload = {
      "text" : prompt,"username":username,"password":password
  };

  fetch(prefix+'/player/create', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'x-functions-key' : APP_KEY  }
  }).then(res => res.json())
    .then(json => errorHandler(json))
    .catch(function(err) {
      console.log(err)
    });
 
}

function handleAnswer(prompt,answer,username){
  console.log("handle answer");

    
 
}



function handleVote(username,answer){
  console.log("handle vote");
  console.log(username,password);

 
}


function handleAdvance(){
  //todo: handle rounds
  console.log("handle advance");
  if(gameState.state==0){
    gameState.state =1;
  }else if (gameState.state ==1){
    gameState.state=2;
  }else if(gameState.state==3){
    gameState.state=4;
  }
}

//if false then show that in alert
function errorHandler(socket,response){
  let respMsg = response.msg;
  let respRes = response.result;
  console.log("handling response: ",respMsg);
  
  if(!respRes){
    console.log("if reached");
    socket.emit('homerror',respMsg);
    console.log("finished");
  }
  // console.log(response.result);

}


//Start server
if (module === require.main) {
  startServer();
  
}

module.exports = server;
