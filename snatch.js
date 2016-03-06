var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/snatch_files/snatch.html');
});

app.use(express.static('public'));

var snatchSvr = require('./snatch-server.js');

var myGame = snatchSvr(100);//create a snatch game instance with 50 tiles...

io.on('connection', function(socket){

    //basic logging
    console.log('a user connected, with ID: '+socket.id);
    socket.on('disconnect', function(){
	//does a player with this socket ID still exist in the server's list anyway?
	if(myGame.playerWithSocketExists(socket.id)){
	    var dis_pl_i = myGame.playerIndexFromSocket(socket.id);
	    socket.broadcast.emit('player disconnected',dis_pl_i);
	    myGame.removePlayer(socket.id);

	    //TODO: this is duplication of the intent of the message above. Rethink this a little and neaten
	    //Transmit entire gamestate to everyone to inform them of the player who has left the game...
	    var gameObj = myGame.getGameObject();
	    socket.broadcast.emit('full game state transmission', gameObj);
	}
	console.log('user disconnected with ID: '+socket.id);
    });

    //this is the first message a client will send...
    socket.on('player joining game', function (blank_msg){
	//respond by providing a set of colours to choose between
	console.log('player joining game message received by server');
	
	//this data structure needs to be generated by the myGame object...
	socket.emit('player color choices', myGame.provideColorChoice(socket.id) );
    });

    //client provides player details, which is also a request for the full game state
    socket.on('player joined with details', function (details_obj){
	//this newly joined player can be added to the game...
	console.log('player joined with details : ' + JSON.stringify(details_obj));
	myGame.addPlayer(details_obj, socket.id);

	//index to the new joiner
	var pl_i = myGame.playerIndexFromSocket(socket.id);
	socket.emit('give client their player index', pl_i);

	//gamestate to the new joiner
	var gameObj = myGame.getGameObject();
	socket.emit('full game state transmission', gameObj);//now just transmit to the new player
	
	//new joiner to the rest of the players
	socket.broadcast.emit('player has joined game', myGame.getPlayerObject(socket.id) );
    });

    socket.on('reset request', function (blank_msg){
	var all_one_agree = myGame.playerAgreesToReset(socket.id);//the return value indicates whether all players agree to the reset
	if (all_one_agree){
	    myGame.resetGame(50);
	    //now sent out the new game object:
	    var gameObj = myGame.getGameObject();
	    io.emit('full game state transmission', gameObj);
	}
	else{//in the case where there are other players...
	    var pl_i = myGame.playerIndexFromSocket(socket.id);
	    socket.broadcast.emit('player wants reset', pl_i);
	}
    });

    //client requests to turn over a tile
    socket.on('agree to reset', function(agrees){
	var pl_i = myGame.playerIndexFromSocket(socket.id);
	socket.broadcast.emit('player response to reset request', {player_index: pl_i, response: agrees});
	if(agrees){
	    var reset_agreement = myGame.playerAgreesToReset(socket.id);//the return value indicates whether all players agree to the reset
	    if (reset_agreement){
		myGame.resetGame(50);
		//now sent out the new game object:
		var gameObj = myGame.getGameObject();
		io.emit('full game state transmission', gameObj);
	    }
	}
    });


    socket.on('player submits word', function(tile_id_array){
	console.log("Snatch Submission with letters: ",tile_id_array);

	var SnatchResponse = myGame.playerSnatches(tile_id_array, socket.id)

	if(SnatchResponse.val_check == 'accepted'){
	    io.emit('snatch assert', SnatchResponse.SnatchUpdateMsg);	    
	}else{
	    socket.emit('snatch rejected', SnatchResponse.val_check);
	}

    
    });




    //client requests to turn over a tile
    socket.on('tile turn request', function(tileTurnDetails){
	myGame.flipLetter(tileTurnDetails.tileID);//note that in this handler we discard the knowledge of the player ID, as it stands.
	//however, in reflecting the message back to all clients, we do pass on that data
	io.emit('tile turn assert', tileTurnDetails);
	console.log("PI=" + tileTurnDetails.playerIndex + " flips tileID=" + tileTurnDetails.tileID);
    });

});

http.listen(3008,'127.0.0.1');
console.log('Snatch server, listening on 127.0.0.1:3008');
