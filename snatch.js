var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.get('/', function(req, res){
    res.sendFile(__dirname + '/public/snatch_files/snatch.html');
});

app.get('/hardreset', function(req, res){
    myGame = snatchSvr_factory(qty_tiles);//create a snatch game instance with 50 tiles...
    X = new Date();
    res.send('Hard reset of the SNATCH server at ' + X);
});






app.use(express.static('public'));

var qty_tiles = 100;
var snatchSvr_factory = require('./snatch-server.js');
var myGame = snatchSvr_factory(qty_tiles);//create a snatch game instance with 50 tiles...

var SDC_factory = require('./scrape_definition_client.js');
var my_SDC = SDC_factory();
    
var prev_result = undefined;
var prev_word = undefined;
my_SDC.rEvent.on('searchComplete', function(result){
    prev_result = result;

});

app.get('/definition/*', function(req, res){
    var frags = req.url.split('/');
    var word = frags[frags.length-1];
    my_SDC.lookup_definition(word);
    res.send('You have just looked up: ' + word + '. <br> Previously, you\
 looked up ' + prev_word + ' and a search result was:<br>' + prev_result);
    prev_word = word;
});


io.on('connection', function(socket){

    //basic logging
    console.log('a user connected, with ID: '+socket.id);
    socket.on('disconnect', function(){
	var dis_pl_i = myGame.playerIndexFromSocket(socket.id);
	//does a player with this socket ID still exist in the server's list anyway?

	if(myGame.playerWithSocketExists(socket.id)){

	    socket.broadcast.emit('player disconnected',dis_pl_i);
	    myGame.removePlayer(socket.id);
	}
	console.log('Player ' + dis_pl_i + ' disconnected (socket.id = ' + socket.id + ')');
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
	    myGame.resetGame(qty_tiles);
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
		myGame.resetGame(qty_tiles);
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
    socket.on('tile turn request', function(blank_msg){
	var newTile_info = myGame.flipNextTile(socket.id);
	io.emit('new turned tile', newTile_info);
	if(newTile_info){
	    console.log("PI=" + newTile_info.flipping_player + " flips tileID=" + newTile_info.tile_index + " (" + newTile_info.tile_letter + ")");
	}else{
	    console.log("All tiles turned - flip message recieved...");
	}
    });


    //client requests to turn over a tile
    socket.on('many_tile_turn_hack', function(n_tiles){

	var letters = [];
	var tileID_first = undefined
	var tileID_final = undefined
	var fl_player = undefined
	for (var i = 0; i < n_tiles; i++){
	    var newTile_info = myGame.flipNextTile(socket.id);
	    if(newTile_info){
		io.emit('new turned tile', newTile_info);
		letters.push(newTile_info.tile_letter);
		tileID_final = newTile_info.tile_index
		fl_player = newTile_info.flipping_player;
		if(i==0){tileID_first = newTile_info.tile_index;}
	    }else{
		break;
	    }
	}

	if(tileID_final !== undefined){
	    console.log("PI=" + fl_player + " has turned multiple tiles at once, from\
 tileID=" + tileID_first + " to tileID=" + tileID_final + ". The letters are: " + letters);
	}else{
	    console.log("All tiles turned");
	}
    });


});

http.listen(3008,'127.0.0.1');
console.log('Snatch server, listening on 127.0.0.1:3008');
