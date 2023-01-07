//CLIENT-SIDE

var socket = null;

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        error:false,
        prompt:'',
        username:'',
        password:'',
        answer:'',
        messages: [],
        chatmessage: '',
        playerState: { username: '', state: 0, score: 0 ,totalScore: 0,playerNumber:'',prompt:''},
        gameState: { state: false },
        playerList: {},
        audienceList:{},
        ifMyPrompt:false,
        promptList:{},
        voteInfo:''
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
            this.playerList = data.playerList;
            this.audienceList = data.audienceList;
            this.prompt = data.prompt;
            this.ifMyPrompt=data.ifMyPrompt;
            this.promptList = data.promptList;
            this.voteInfo = data.voteInfo;
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
            
        },
    
        leaderboard(n){ //return top n players
            socket.emit('leaderboard',n);
            console.log("Retrieving leaderboard");
        },
    
        promptAnswer(){
            socket.emit('promptAnswer',this.username,this.prompt,this.answer);
            this.answer='';

            console.log("Prompt answered by ", username);

        },
        vote(prompt,answer){
            socket.emit('vote',prompt,answer);
            console.log("Players voted for ",answer);

        },
        advance(){
            socket.emit('advance');
            console.log("Advancing game");

        },
        submitPrompt(){
            socket.emit('submitPrompt',this.prompt,this.username,this.password);
            console.log("submitting prompt ",prompt);
            this.prompt='';
        },
        fail(message){
            console.log("reached fail message: ",message)
            this.error = message;
            setTimeout(() => this.error=null, 3000)
            // this.error="";
        
    
    }}
});

function connect() {
    //Prepare web socket
    socket = io();

    //Connect
    socket.on('connect', function() {
        console.log("===========connected============")
        //Set connected state to true
        app.connected = true;
        console.log(app.gameState.state);
     
    });

    socket.on('logged', () =>{
        //Set connected state to true
        console.log(app.gameState.state);

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


    socket.on('state',function(data){
        app.updateState(data);
    });

    socket.on('fail',function(message){
        app.fail(message);
    })



}
