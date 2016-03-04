//establish the websocket connection with the server
var socket = io();

var tileset = [];//global reference - for server data...
var players = [];//global reference - for server data...

var client_player_index = undefined;

//initialise the Canvas

socket.emit('player joining game', 0);

socket.on('player color choices', function(colorSet){
    snDraw.initialiseCanvas();
    //probably need to decode colorSet here... ToDO - wtf does this comment mean?
    snDraw.Splash.identityPrompt(colorSet);
});



///upon arrival, process the transmitted game state from the server
socket.on('full game state transmission', function(gameState){

    /*
      there is a design decision to be made whether a full game state transmission
      is always crudely used when a snatch occurs etc, or whether to send a more specific
      update message to clients instead. The latter seems more efficient but more work.
      
      For now, receipt of the first ever game state message (compared with others) is detected
      by looking at the global tileset, which is initially [].
    */

    if(tileset.length<1){//RECIEVE THE MESSAGE FOR THE FIRST time - in this case need to add the listeners...

	//mouse event listeners
	canvas.on('mouse:down', function(e){snDraw.Game.Mouse.mDown(e); });
	canvas.on('mouse:up',   function(e){snDraw.Game.Mouse.mUp(e);   });
	canvas.on('mouse:over', function(e){snDraw.Game.Mouse.mOver(e); });
	canvas.on('mouse:out',  function(e){snDraw.Game.Mouse.mOut(e);  });

	//keyboard event listeners
	document.addEventListener("keydown",function(e){snDraw.Game.KB.kDown(e); }, false);

    }

    tileset = gameState.tileSet;
    players = gameState.playerSet;

    for(i=0; i<players.length; i++){
	players[i].index = i;
	snDraw.Game.TileGroupsArray[i] = [];//correctly create empty container
    }
    

    //draws the entire game state on the canvas from the data supplied
    snDraw.Game.initialDrawEntireGame();


});//end of function to load game data

socket.on('player has joined game', function(newPlayer){
    
    newPlayer.index = players.length;//take the length prior to pushing incorporates -1

    //DO NOT FORGET, upon addition of a new player, to modify their data structure accordingly.
    snDraw.Game.TileGroupsArray[newPlayer.index]=[];//correctly create empty container
    players.push(newPlayer);

    //Don't need to redraw screen here. New player won't actually have any words (makes no visible difference)
    console.log("TOAST: " + newPlayer.name + " has joined the game");

});



///upon server assertion that a letter is turned over
socket.on('tile turn assert', function(tileDetailsObj){
    var flipping_player_i = tileDetailsObj.playerIndex;
    var tile_id = tileDetailsObj.tileID;

    snDraw.Game.animateTileFlip(flipping_player_i, tile_id);
});

socket.on('player wants reset', function(player_index){
    var player_name = players[player_index].name;
    var resetAssent = confirm(player_name + " has requested to reset the game. Do you want to reset the game?");
    socket.emit('agree to reset', resetAssent);	
});


socket.on('player disconnected', function(player_index){
    var player_name = players[player_index].name;
    console.log("TOAST: " + player_name + " disconnected");
    console.log("this message needs to be replace with additional code to handle this event...");
});

//this is message to Tell me that Alex has said "Reset" - inform of another players decision
socket.on('player response to reset request', function(responseObj){
    var p_name = players[responseObj.player_index].name;
    var p_a = responseObj.response;
    console.log("TOAST: " + p_name + " responded to reset request with the answer: " + p_a);
});

socket.on('give client their player index', function(myIndex){
    console.log("player index of " + myIndex + " recieved");
    client_player_index = myIndex;
    
});



socket.on('snatch assert', function(SnatchUpdateMsg){

    //Process the incoming data: 
    var tile_indices = SnatchUpdateMsg.tile_id_array
    var PI = SnatchUpdateMsg.player_index;
    var word_usage = SnatchUpdateMsg.words_consumed;
    var snatching_player = players[PI];
    var client_is_snatcher = client_player_index == PI;

    //a toast
    console.log("TOAST: " + snatching_player.name + " has snatched a word, tile indices are:", tile_indices);    
    console.log("word usage : " + JSON.stringify(word_usage));

    //clear the spell only if client is snatcher
    if(client_is_snatcher){snDraw.Game.Spell.CancelWord();}

    //update the players data structure:
    snDraw.Game.removeWordsAndUngroup(word_usage);
    snatching_player.words.push(tile_indices);

    //most of the Zone reshaping work happens here
    snDraw.Game.Zones.ZoneHandlingUponSnatch(snatching_player);
    
    //update the tiles data structure:
    for(i=0; i<tile_indices.length; i++){
	var TID = tile_indices[i];
	tileset[TID].status = 'inword';
    }
    
    //draw the new word into the player zone...
    //for the case of the Snatcher being the Client player here, this is still necessary as it has the effect of grouping the letters, even if not moving them
    //the final parameter of this function call determines if animation is required; not required if client is snatcher.
    snDraw.Game.drawSingleCapturedWord(snatching_player,snatching_player.words.length - 1, true); //TODO shouldn't that 'true' be a (!client_is_snatcher)

});



socket.on('snatch rejected', function(rejection_reason){
    
    //a toast here
    snDraw.Game.Spell.ClearWordFromSpeller(true);
    console.log("The snatch was rejected by the server for the following reason: " + rejection_reason);
});

function PLAYER_SUBMITS_WORD(p)       {socket.emit('player submits word', p);}
function RESET_REQUEST()              {socket.emit('reset request', 0);}
function TILE_TURN_REQUEST(p)         {socket.emit('tile turn request', p);}
function PLAYER_JOINED_WITH_DETAILS(p){socket.emit('player joined with details', p);}



///Todo what uses this function? Can it be placed elsewhere in the code?
// Answer: used within snDraw.Game.Spell.shuffleAnagramRelease
Array.prototype.move = function (old_index, new_index) { 
    if (new_index >= this.length) {
        var k = new_index - this.length;
        while ((k--) + 1) {
            this.push(undefined);
        }
    }
    this.splice(new_index, 0, this.splice(old_index, 1)[0]);
    return this; // for testing purposes
};


//What uses this function?
//Answer: used by removeWordsAndRewrap to prevent changing indices during clearing...
Array.prototype.clean = function(deleteValue) {
  for (var i = 0; i < this.length; i++) {
    if (this[i] == deleteValue) {         
      this.splice(i, 1);
      i--;
    }
  }
  return this;
};


function contains(a, obj) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}

function commonElements(arr1, arr2){
    var clone1 = arr1.slice(0);
    var clone2 = arr2.slice(0);
    
    var ret = [];
    clone1.sort();
    clone2.sort();
    for(var i = 0; i < clone1.length; i += 1) {
        if(clone2.indexOf( clone1[i] ) > -1){
            ret.push( clone1[i] );
        }
    }
    return ret;
}

//integer between upper and lower bounds...
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}
