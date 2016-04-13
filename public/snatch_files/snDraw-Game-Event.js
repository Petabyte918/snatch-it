snDraw.Game.Event = {

    //this function is called upon entry into the game and anything that requires redraw of all (such as window resize)
    DrawAll: function(){

	// 1. Determine Scale Constants & set background...
	var Spacings = snDraw.Game.calculateRenderingDimentionConstants();
	canvas.setBackgroundColor(snDraw.Game.bg_col);

	// 2. Add the controls strip
	snDraw.Game.Controls.createControls();

	// 3. Create all the grid tiles...
	snDraw.Game.Grid.InitialiseGrid(Spacings);
	for (var i = 0; i < tilestats.n_turned; i++){
	    if(tileset[i].status == "turned"){
		//generate tile & put in grid
		var TileObject_i = snDraw.Game.generateTileObject(tileset[i], i);
		var gridRC = snDraw.Game.Grid.GetGridSpace();
		snDraw.Game.Grid.PlaceTileInGrid(i, gridRC, false, null);//todo rename this...
	    }
	}

	// 4. Create the zones containers (this is NOT visually creating the zones)
	snDraw.Game.Zones.PlayerZone = [];

	// 4.1 Unconditionally add client's zone
	snDraw.Game.Zones.PlayerZone[0] = {
	    player: players[client_player_index],
	    is_client: true
	};

	// 4.2 Add all players who who have words and aren't client
	for (var i=0; i<players.length; i++){
	    if((i!=client_player_index) && (players[i].words.length>0)){
		snDraw.Game.Zones.PlayerZone.push({
		    player: players[i],
		    is_client: false
		});
	    }
	}

	// 5. For all zones: generate words and determine their arrangement
	var ArrangementsArray = [];
	var ZonesWordsGroups = [];
	for (var i=0; i < snDraw.Game.Zones.PlayerZone.length; i++){

	    var Zone_i = snDraw.Game.Zones.PlayerZone[i];
	    var player_i = Zone_i.player;

	    // 5.1 Generate that player's word list (as Fabric Groups)
	    var WordGrpsList_i = [];
	    for (var j = 0; j < player_i.words.length; j++){

		//extract the tileIDs of the tiles that make up this word, and create a tile object array
		var WordTileArray = [];
		for (var k = 0; k < player_i.words[j].length; k++){
		    var TID = player_i.words[j][k];
		    var TileObject = snDraw.Game.generateTileObject(tileset[TID], TID);
		    WordTileArray.push(TileObject);
		}
		
		//Now make it into a word...
		var WordGroup_j = snDraw.Game.Words.CreateWordAsTileGroupAtOrigin(
		    WordTileArray, Spacings, player_i);

		//Add that word to the list...
		WordGrpsList_i.push(WordGroup_j);
	    }

	    // 5.2 Determine the Arrangement of that player's words.
	    // ?? efficiency problem. Use the function iteratively?
	    /*
	      This is a problem. We're supposed to get the inner bound of the box from creating the zone,
	      but we also require the before the zone is created. Refactor AAargh.
	    */

	    var Tx = snDraw.Game.tileSize / 10;

	    var PlayerZoneStyle = { //all in pixels
		hpad: Tx * 1.5,  // horizonal padding between screen boundary and box edge (vertical)
		w_hpad: Tx * 2.0, // horizonal padding between words and the inside of the box
		spellpad: Tx * 2.5, // vertical padding of spell (upper edge of bottom box to lower edge of tile).
		box_fill: 'rgba(0,0,0,0)', // inside the box
		text_bg: 'black', // inside the box
		thick: Tx * 1.2, // thickness of the box line
		text_pad: " ",
		justify: "left", // justification of the title
		titlepad: Tx * 10, // effectively, the indentation of the title	
		fontsize: Tx * 7, // refers to the font of the title
		fonthalfheight: Tx * 4, // refers to the offset between top of font and top surface of box
		w_vpad: Tx * 8.2, // vertical padding between words and the inside of the box
		isClient: false, // boolean, means extra
		scale_you: Tx * 20, // scaling of the block saying "you"
		tri_w: Tx * 12, // Width, in pixels, of the little triangle (spell pointer)
		tri_h: Tx * 8 // Height, in pixels, of the little triangle (spell pointer)
	    };


	    var WordBlockBounds = {
		left: (PlayerZoneStyle.hpad + PlayerZoneStyle.thick + PlayerZoneStyle.w_hpad),
		right: (snDraw.canv_W - (PlayerZoneStyle.hpad + PlayerZoneStyle.thick + PlayerZoneStyle.w_hpad)),
		topPadding: PlayerZoneStyle.w_vpad
	    };
	    
	    var ZoneVPaddings = {
		above: Tx,
		between: Tx * 1.5,
		bottom: Tx
	    }

	    console.log(WordBlockBounds);

	    var Arrangement_i = snDraw.Game.Words.GenWordArrangement(WordGrpsList_i, WordBlockBounds, Spacings, "left");
	    ArrangementsArray.push(Arrangement_i);
	    ZonesWordsGroups.push(WordGrpsList_i);
	}
	

	// 6. Determine the sizes for all the zones, then make them as Fabric objects...
	var grid_bottom_px = snDraw.Game.Grid.GetGridBottomPx();
	var ZoneSizes = snDraw.Game.Zones.CalcZoneSizes(ArrangementsArray, grid_bottom_px, ZoneVPaddings, Spacings);

	for (var i = 0; i < snDraw.Game.Zones.PlayerZone.length; i++){
	    var Height = ZoneSizes[i].Height;
	    var Top = ZoneSizes[i].Top;



	    var Properties = {
		color: snDraw.Game.Zones.PlayerZone[i].player.color, // text colour and box boundary
		text: snDraw.Game.Zones.PlayerZone[i].player.name // Text of the title
	    };

	    
	    //generate the fabric objects that represent the new zone. Note that properties left & top are not set
	    //nor are the objects present onf the canvas.
	    var Zone_i_FabObjs = snDraw.Game.Zones.CreateZoneBox(Height, PlayerZoneStyle, Properties);
	    var Zone_i_Tops = snDraw.Game.Zones.DetermineZoneBoxObjectsTops(Top, Height, PlayerZoneStyle);
	    var Zone_i_Lefts = snDraw.Game.Zones.DetermineZoneBoxObjectsLefts(0, PlayerZoneStyle);

	    //for each object making the ZONE, set coordinates and place on canvas...
	    for (var j = 0; j < Zone_i_FabObjs.length; j++){
		Zone_i_FabObjs[j].setLeft(Zone_i_Lefts[j]);
		Zone_i_FabObjs[j].setTop(Zone_i_Tops[j]);
		canvas.add(Zone_i_FabObjs[j]);
	    }

	    // place the words in the zone

	    var WordsTopPx = Top + WordBlockBounds.topPadding;
	    var Arrangement_i = snDraw.Game.Words.WordArrangementSetHeight(ArrangementsArray[i], WordsTopPx);
	    for (var j = 0; j < Arrangement_i.coords.length; j++){
		snDraw.moveSwitchable(ZonesWordsGroups[i][j], false, null, Arrangement_i.coords[j]);
	    }
	}


    },

    SnatchEvent: function(){

    },
    
    TileTurn: function(){

    },
    
    Disconnection: function(){
	return null;
    },
    
    Reconnection: function(){

    }

};
