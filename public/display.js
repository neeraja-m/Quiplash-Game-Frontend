//CLIENT-SIDE

var socket = null;

//Prepare game
var app = new Vue({
    el: '#display',
    data: {
        connected: false,
        error:false,
        gameState: { state: false ,round:0},
        playerList: {},
        audienceList:{},
        voteInfo:'',
        playerState: { username: '', state: 0, score: 0 ,totalScore: 0,playerNumber:'',prompt:''},
        // waitingPlayers:{},
        ifMyPrompt:false,
        promptList:'',
    },
    mounted: function() {
        connect(); 
    },
    methods: {
       
        updateState(data){
            this.gameState = data.gameState;
            this.playerList = data.playerList;
            this.audienceList = data.audienceList;
            this.ifMyPrompt=data.ifMyPrompt;
            this.promptList = data.promptList;
            this.voteInfo = data.voteInfo;
            this.playerState=data.playerState;
            // this.waitingPlayers=data.waitingPlayers;
        },
        fail(message){
            console.log("reached fail message: ",message)
            this.error =message;
            setTimeout(() => this.error=null, 3000)
    }}
});

function connect() {
    //Prepare web socket
    socket = io();

    //Connect
    socket.on('connect', function() {
        console.log("===========connected=======display=====")
        //Set connected state to true
        app.connected = true;

        socket.emit('display');
     
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



    socket.on('state',function(data){
        app.updateState(data);
    });

    socket.on('fail',(message)=>{
        console.log("reached game.js fail");
        app.fail(message);
    })



}
