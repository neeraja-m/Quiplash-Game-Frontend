//CLIENT-SIDE

var socket = null;

// Background Image by stockgiu on Freepik "https://www.freepik.com/free-vector/arcade-game-world-pixel-scene_4815143.htm#query=pixel%20background&position=1&from_view=search&track=sph"
// Music by Dream-Protocol from Pixabay "https://pixabay.com//?utm_source=link-attribution&amp;utm_medium=referral&amp;utm_campaign=music&amp;utm_content=116846"

//Prepare game
var app = new Vue({
    el: '#game',
    data: {
        connected: false,
        error:false,
        audio:false,
        prompt:'',
        username:'',
        password:'',
        answer:'',
        messages: [],
        chatmessage: '',
        playerState: { username: '', state: 0, score: 0 ,totalScore: 0,playerNumber:'',prompt:''},
        gameState: { state: false,round:0 },
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
        promptAnswer(){
            socket.emit('promptAnswer',this.username,this.prompt,this.answer);
            this.answer='';

            console.log("Prompt answered by ", username);

        },
        vote(prompt,answer){
            socket.emit('vote',prompt,answer);
            console.log("Players voted for ",answer);

        },
    
        submitPrompt(){
            socket.emit('submitPrompt',this.prompt,this.username,this.password);
            console.log("submitting prompt ",prompt);
            this.prompt='';
        },
        fail(message){
            console.log("reached fail message: ",message)
            this.error =message;
            setTimeout(() => this.error=null, 3000)
        
    },
    handleMusic() 
        {
            let audio = this.$refs.audio;
            document.querySelector(".toggle-sound").classList.add("pausedAudio");
            if (
                audio.paused &&
                document.querySelector(".toggle-sound").classList.contains("pausedAudio")
            )
            {
                audio.play();
                this.audio = true;
                document.querySelector(".toggle-sound").classList.remove("pausedAudio");
            } else
            {
                audio.pause();
                this.audio = false;
                document.querySelector(".toggle-sound").classList.add("pausedAudio");
            }
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

    socket.on('regSucc', ()=>{
        app.fail("Successful registration - please login to start playing");

    });

    //Handle incoming chat message
    socket.on('chat', function(message) {
        app.handleChat(message);
    });


    socket.on('state',function(data){
        app.updateState(data);
    });

    socket.on('fail',(message)=>{
        console.log("reached game.js fail");
        app.fail(message);
    })




}
