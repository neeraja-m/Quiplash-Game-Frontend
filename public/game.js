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
    
        register(username,password){ //to register the player
            this.username = username;
            this.password=password;
        
            socket.emit('register',"test","testtestt");
            console.log("Registering user ", username);
            this.username = '';
            this.password='';

        },
        login(username,password){ //to login
            this.username = username;
            this.password=password;
            socket.emit('login',username,password);
            console.log("Attempting to join: ", username);
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
        promptAnswer(answer,username){
            socket.emit('promptAnswer',answer,username);
            console.log("Prompt answered by ",username);

        },
        vote(answer){
            socket.emit('vote',answer);
            console.log("Players voted for ",answer);

        },
        advance(){
            socket.emit('advance');
            console.log("Advancing game");

        }
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


}
