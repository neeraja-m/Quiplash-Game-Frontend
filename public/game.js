//CLIENT-SIDE

var socket = null;
// import fetch from "node-fetch";
//player states: 0-playing, 1-audience 
//game states: 0-not started, 1-entering prompts, 2-completed answers, 3-voting round,4-scores 

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        error:false,
        username:'',
        password:'',
        messages: [],
        chatmessage: '',
        playerState: { username: '', state: 0, score: 0 },
        gameState: { state: false },
        playerList: {},
        audienceList:{},
    },
    mounted: function() {
        connect(); 
    },
    methods: {
        handleChat(message) {
            if(this.messages.length + 1 > 10) {
                this.messages.pop();
            }
            this.messages.unshift(message);
        },
        updateState(data){
            this.playerState = data.playerState;
            this.gameState = data.gameState;
            this.playerList = data.playerList
            this.audienceList = data.audienceList;
        },
        chat() {
            socket.emit('chat',this.chatmessage);
            this.chatmessage = '';
        },

        admin(command){
            socket.emit('admin',command);
        },
    
        register(){ //to register the player
            console.log("Registering user ", this.username,this.password);

            socket.emit('register',this.username,this.password);
            this.username = '';
            this.password='';

        },
        login(){ //to login
            console.log("Attempting to login: ", this.username);
            socket.emit('login',this.username,this.password);
            this.username = '';
            this.password='';
        },
        // update(username,toAdd,password){ //to update player stats
        //     socket.emit('update',username,toAdd);
        //     console.log("Updating ", username, " stats");
        // },
        leaderboard(n){ //return top n players
            socket.emit('leaderboard',n);
            console.log("Retrieving leaderboard");
        },
        createPrompt(prompt,username){ //create and store prompt
            socket.emit('createPrompt',prompt);
            console.log("Creating prompt: ", prompt);
        },
        editPrompt(prompt,username){ //edit stored prompt
            socket.emit('editPrompt',prompt,username);
            console.log("Editing prompt from user ", username);
        },
        deletePrompt(prompt,username){ //delete stored prompt
            socket.emit('deletePrompt',username,password);
            console.log("Deleting prompt from user: ", username);
        },
        getPrompt(n){ //get n random prompts
            socket.emit('getPrompt',n);
            console.log("Retrieving prompts");

        },
        promptAnswer(username,prompt,answer){
            socket.emit('promptAnswer',prompt,answer,username);
            console.log("Prompt answered by ",username);

        },
        vote(username,answer){
            socket.emit('vote',username,answer);
            console.log("Players voted for ",username,answer);

        },
        advance(){
            socket.emit('advance');
            console.log("Advancing game");

        },
        submitPrompt(){
            socket.emit('submitPrompt',username,password,prompt);
            console.log("submitting prompt");
        },
    
    }
});

function connect() {
    //Prepare web socket
    socket = io();

    //Connect
    socket.on('connect', function() {
        console.log("===========connected============")
        //Set connected state to true
        app.connected = true;
    });

    //Handle connection error
    socket.on('connect_error', function(message) {
        console.log("===========connect error============")
        alert('Unable to connect: ' + message);
    });

    //Handle disconnection
    socket.on('disconnect', function() {
        alert('Disconnected');
        app.connected = false;
    });

    //Handle incoming chat message
    socket.on('chat', function(message) {
        app.handleChat(message);
    });

    socket.on('homerror',message =>{
        console.log("homeError reached");
    });



}
