// Require the packages we will use:
var http = require("http"),
	socketio = require("socket.io"),
	fs = require("fs");
 
// Listen for HTTP connections.  This is essentially a miniature static file server that only serves our one file, client.html:
var app = http.createServer(function(req, resp){
	// This callback runs when a new connection is made to our HTTP server.
 
	fs.readFile("client.html", function(err, data){
		// This callback runs when the client.html file has been read from the filesystem.
 
		if(err) return resp.writeHead(500);
		resp.writeHead(200);
		resp.end(data);
	});
});
app.listen(3456);
 


// Do the Socket.IO magic:
var io = socketio.listen(app);

// Global variables
var userlist = [];  // Stored all the users
var publicroomlist = [];
var privateroomlist = [];
var fontcolor = "#606c71";

// Define the public room object
var publicroom = function(name, owner) {
	this.name = name;
	this.owner = owner;
	this.roomusers = [];
	this.banusers = [];
};

// Define the private room object
var privateroom = function(name, owner, password) {
	this.name = name;
	this.owner = owner;
	this.password = password;
	this.roomusers = [];
	this.banusers = [];
};

// Define the user object
var user = function (name, id) {
	this.name = name;
	this.id = id;
};

// Define the default room (a public room): main lobby 
var lobby = new publicroom("Lobby", "default");

// Add the lobby to the publicroomlist
publicroomlist.push(lobby);


io.sockets.on("connection", function(socket){
	// This callback runs when a new Socket.IO connection is established.
 	
 	// Receive the message from the client side
	socket.on('message_to_server', function(data) {
		// This callback runs when the server receives a new message from the client.
		//console.log("debug-fontcolor: " + data.fontcolor);
		console.log("message: " + data["message"]); // log it to the Node.JS output
		io.to(socket.room).emit("message_to_client", {message: data["message"], fontcolor: data.fontcolor}) // broadcast the message to other users
	});


	// Receive the username from the client side and check if it already exists 
	socket.on("logincheck", function(data) {
		var exisitingUsername = false;
		// Compare the username with those in the userlist to see if it already exists
		for (i=0; i<userlist.length; i++) {
			if (data["uncheckedusername"] == userlist[i].name) {
				exisitingUsername = true;
			}
		}
		io.sockets.to(socket.id).emit("checkedUsername", {checked: exisitingUsername});	
	}); // End of logincheck



	// Receive the username from the client side for the first time 
	//   Put the user in the default room, lobby
	socket.on('userlogined', function(data) {
		// Store the username in the session
		socket.username = data["username"];
		// Store the current user in a user variable 
		var newuser = new user(socket.username, socket.id);
		// Add the user to the userlist
		userlist[userlist.length] = newuser;
		//console.log(userlist);

		// Add the user to the lobby roomusers
		lobby.roomusers.push(socket.username);
			// console.log(lobby.roomusers);

		// Join the lobby 
		socket.room = lobby.name;

		socket.join(socket.room);
		io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: lobby.roomusers});
		io.sockets.emit("roomUpdate", {publicrooms: publicroomlist, privaterooms: privateroomlist});
	}); // End of userlogined



	// Receive the publicroom data from the client side
	socket.on('publicRoomCreated', function(data) {
		// Update roomlist
			 //console.log("debug-createdpublicroomname" + data['publicroomname']);
		var newPublicRoom = new publicroom(data['publicroomname'], socket.id);
		publicroomlist[publicroomlist.length] = newPublicRoom;
		console.log("Public room " + "'" + data['publicroomname'] + "'" + " is created by " + socket.username);
		// Ask the client side to update the roomlist
		io.sockets.emit("roomUpdate", {publicrooms: publicroomlist, privaterooms: privateroomlist});
		var msg = "System message: Public room " + "'" + data['publicroomname'] + "'" + " is created by " + socket.username;
		io.sockets.to(socket.id).emit('message_to_client', {message: msg, fontcolor: fontcolor});
	});	// End of publicRoomCreated



	// Receive the privateroom data from the client side
	socket.on('privateRoomCreated', function(data) {
		// Update the roomlist
			// console.log(data['privateroomname']);
			// console.log(data['privateroompwd']);
		var newPrivateRoom = new privateroom(data['privateroomname'], socket.id, data['privateroompwd']);
		privateroomlist[privateroomlist.length] = newPrivateRoom;
		console.log("Private room " + "'" + data['privateroomname'] + "'" + " is created by " + socket.username);
		// Ask the client side to update the roomlist
			// console.log(privateroomlist);
		io.sockets.emit("roomUpdate", {publicrooms: publicroomlist, privaterooms: privateroomlist});
		var msg = "System message: Private room " + "'" + data['privateroomname'] + "'" + " is created by " + socket.username + " with a password of " + data['privateroompwd'];
		io.sockets.to(socket.id).emit('message_to_client', {message: msg, fontcolor: fontcolor});
	});	 // End of privateRoomCreated



	// Receive publicroomname from the client side
	//   let the user enter the room if he is not banned
	//   update the roomusers for the old and new room
	socket.on('enterPublicRoom', function(data) {
		var newroomname = data.publicroomname;
		var oldroomtype = data.oldroomtype;

		var oldroomindex;
		var newroomindex;
		var banned = false;

		//console.log("debug-newroomname: "+newroomname);

		// Find the oldroom's index and newroom's index on the publicroomlist
		if (oldroomtype == "public") {
			for (i=0; i<publicroomlist.length; i++) {
					// console.log(publicroomlist[i].name);
					// console.log(socket.room);
				// Find the oldroom's index on the publicroomlist
				if (publicroomlist[i].name == socket.room) {
					oldroomindex = i;
				}
			}			
		}
		if (oldroomtype == "private") {
			for (i=0; i<privateroomlist.length; i++) {
					// console.log(publicroomlist[i].name);
					// console.log(socket.room);
				// Find the oldroom's index on the publicroomlist
				if (privateroomlist[i].name == socket.room) {
					oldroomindex = i;
				}
			}
		}

		for (i=0; i<publicroomlist.length; i++) {
			// Find the newroom's index on the publicroomlist
			if (publicroomlist[i].name == newroomname) {
				newroomindex = i;
			}
		}
		// Check if the person is banned 
        for (i=0; i<publicroomlist[newroomindex].banusers.length; i++) {
            if (publicroomlist[newroomindex].banusers[i] == socket.username) {
                banned = true;
        	}
		}
			console.log("oldroomindex: " + oldroomindex);
			console.log("newroomindex: " + newroomindex);


		// Check if the entering user is the owner of the room or not
		var ownercheck = false;
		//console.log("debug-The entering user: " + socket.id);
		//console.log("debug-The owner: " + publicroomlist[newroomindex].owner);
		if (socket.id == publicroomlist[newroomindex].owner) {
			ownercheck = true;
		}

		var roomowner;
		// Get roomowner's username
		for (i=0; i<userlist.length; i++) {
			if (userlist[i].id == publicroomlist[newroomindex].owner) {
				roomowner = userlist[i].name;
			}
		}

			//console.log("debug-olduserlist before move: " + publicroomlist[oldroomindex].roomusers);
		// If the user is not banned and allowed to enter the new room
		if (banned == false) {
			// Remove that user from the old room's roomuser list
			if (oldroomtype == "public") {
				for (i=0; i<publicroomlist[oldroomindex].roomusers.length; i++) {
					if (publicroomlist[oldroomindex].roomusers[i] == socket.username) {
						publicroomlist[oldroomindex].roomusers.splice(i, 1);
					}
				}					
			}
			if (oldroomtype == "private") {
				for (i=0; i<privateroomlist[oldroomindex].roomusers.length; i++) {
					if (privateroomlist[oldroomindex].roomusers[i] == socket.username) {
						privateroomlist[oldroomindex].roomusers.splice(i, 1);
					}
				}					
			}
			//console.log("debug-olduserlist after move: " + publicroomlist[oldroomindex].roomusers);

			//socket.leave(socket.room);

			// Create a leaving message
			var msg = socket.username + " left the room.";
			console.log(msg);
			io.sockets.to(socket.room).emit("message_to_client", {message: msg, fontcolor: fontcolor});
			// Update the oldroom's roomuserlist
			if (oldroomtype == "public") {
				io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: publicroomlist[oldroomindex].roomusers});
			}
			if (oldroomtype == "private") {
				io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: privateroomlist[oldroomindex].roomusers});
			}
		
			socket.leave(socket.room);

			// Join the new room
			// Change the current room to the new room
			socket.room = newroomname;
			socket.join(socket.room);

			// Add the user to the new room's roomuserlist
			publicroomlist[newroomindex].roomusers.push(socket.username);
			//console.log("debug-newuserlist: " + publicroomlist[newroomindex].roomusers);
			// Update the newroom's roomuserlist
			io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: publicroomlist[newroomindex].roomusers});
			console.log("Room changed: " + socket.room);

			// Change the room layout on the client side
			io.sockets.to(socket.id).emit("roomEntered", {roomname: socket.room, roomtype: "public", ownercheck: ownercheck, owner: roomowner});

			// Create a joining message
			var msg = socket.username + " entered the room.";
			console.log (socket.username + " entered " + socket.room);
			io.sockets.to(socket.room).emit("message_to_client", {message: msg, fontcolor: fontcolor});
			

		}

		else {
			// If the user is banned, send a personal message in the old room saying the person is banned 
			var msg = "You are banned from entering that room."
			io.sockets.to(socket.id).emit("bannedentering", {message: msg});
		}
	}); // End of enterPublicRoom



	// // Receive privateroomname and from the client side
	// //   let the user enter the room if he is not banned
	// //   update the roomusers for the old and new room
	socket.on('enterPrivateRoom', function(data) {
		var newroomname = data.privateroomname;
		var enteredPwd = data.pwd;

		var oldroomtype = data.oldroomtype;

		var oldroomindex;
		var newroomindex;
		var banned = false;

		// Find the oldroom's index and newroom's index on the publicroomlist
		if (oldroomtype == "public") {
			for (i=0; i<publicroomlist.length; i++) {
				// Find the oldroom's index on the publicroomlist
				if (publicroomlist[i].name == socket.room) {
					oldroomindex = i;
				}
			}			
		}
		if (oldroomtype == "private") {
			for (i=0; i<privateroomlist.length; i++) {
				// Find the oldroom's index on the publicroomlist
				if (privateroomlist[i].name == socket.room) {
					oldroomindex = i;
				}
			}
		}

		for (i=0; i<privateroomlist.length; i++) {
			// Find the newroom's index on the publicroomlist
			if (privateroomlist[i].name == newroomname) {
				newroomindex = i;
			}
		}

		// Check if the entered password is correct
		var correctPwd = privateroomlist[newroomindex].password;
		//console.log("debug-the entered password is: " + enteredPwd);
		//console.log("debug-the correct password is: " + correctPwd);
		if (enteredPwd != correctPwd) {
			var msg = "Wrong password!";
			io.sockets.to(socket.id).emit("wrongPwd", {message: msg});
		}
		else {

			// Check if the entering user is the owner of the room or not
			var ownercheck = false;
			if (socket.id == privateroomlist[newroomindex].owner) {
				ownercheck = true;
			}

			var roomowner;
			// Get roomowner's username
			for (i=0; i<userlist.length; i++) {
				if (userlist[i].id == privateroomlist[newroomindex].owner) {
					roomowner = userlist[i].name;
				}
			}

			// Check if the person is banned 
	        for (i=0; i<privateroomlist[newroomindex].banusers.length; i++) {
	            if (privateroomlist[newroomindex].banusers[i] == socket.username) {
	                banned = true;
	        	}
			}

			// If the user is not banned
			if (banned == false) {
				// Remove that user from the old room's roomuser list
				if (oldroomtype == "public") {
					for (i=0; i<publicroomlist[oldroomindex].roomusers.length; i++) {
						if (publicroomlist[oldroomindex].roomusers[i] == socket.username) {
							publicroomlist[oldroomindex].roomusers.splice(i, 1);
						}
					}					
				}
				if (oldroomtype == "private") {
					for (i=0; i<privateroomlist[oldroomindex].roomusers.length; i++) {
						if (privateroomlist[oldroomindex].roomusers[i] == socket.username) {
							privateroomlist[oldroomindex].roomusers.splice(i, 1);
						}
					}					
				}

				//socket.leave(socket.room);

				// Create a leaving message
				var msg = socket.username + " left the room.";
				console.log(msg);
				io.sockets.to(socket.room).emit("message_to_client", {message: msg, fontcolor: fontcolor});
				// Update the oldroom's roomuserlist
				if (oldroomtype == "public") {
					io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: publicroomlist[oldroomindex].roomusers});
				}
				if (oldroomtype == "private") {
					io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: privateroomlist[oldroomindex].roomusers});
				}
				socket.leave(socket.room);

				// Join the new room
				// Change the current room to the new room
				socket.room = newroomname;
				socket.join(socket.room);

				// Add the user to the new room's roomuserlist
				privateroomlist[newroomindex].roomusers.push(socket.username);
				//console.log("debug-newuserlist: " + privateroomlist[newroomindex].roomusers);
				// Update the newroom's roomuserlist
				io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: privateroomlist[newroomindex].roomusers});
				console.log("Room changed: " + socket.room);
				// Change the room layout on the client side
				io.sockets.to(socket.id).emit("roomEntered", {roomname: socket.room, roomtype: "private", ownercheck: ownercheck, owner: roomowner});

				// Create a joining message
				var msg = socket.username + " entered the room.";
				console.log (socket.username + " entered " + socket.room);
				io.sockets.to(socket.room).emit("message_to_client", {message: msg, fontcolor: fontcolor});
			}
			else {
				// If the user is banned, send a personal message in the old room saying the person is banned 
				var msg = "You are banned from entering that room."
				io.sockets.to(socket.id).emit("bannedentering", {message: msg, fontcolor: fontcolor});
			}			
		}

	}); // End of enterPrivateRoom



	socket.on('kicking', function(data) {
		// Get the room type
		var roomtype = data.roomtype;

		// Get the kicked person
		var kickeduser = data.kickeduser;
		
		var userexist = false;

		var roomindex;
		if (roomtype == "public") {
			// Search the publicroomlist to find the room index
			for (i=0; i<publicroomlist.length; i++) {
				if (publicroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually in the room
			for (i=0; i<publicroomlist[roomindex].roomusers.length; i++) {
				if (kickeduser == publicroomlist[roomindex].roomusers[i]) {
					userexist = true;	
				}
			}
		}

		if (roomtype == "private") {
			// Search the privateroomlist to find the room index
			for (i=0; i<privateroomlist.length; i++) {
				if (privateroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually in the room
			for (i=0; i<privateroomlist[roomindex].roomusers.length; i++) {
				if (kickeduser == privateroomlist[roomindex].roomusers[i]) {
					userexist = true;	
				}
			}
		}

		// If the user does not exist, send back to the client side and alert it
		if (userexist == false) {
			io.sockets.to(socket.id).emit("kickcheck", {userexist: userexist});	
		}
		else {
			// So now the kicked user is actually in this room, kick it
			//   remove it from the roomuserlist, and put him in the lobby
			if (roomtype == "public") {
				// Remove the user from the current roomsuerlist
				for (i=0; i<publicroomlist[roomindex].roomusers.length; i++) {
					if (publicroomlist[roomindex].roomusers[i] == kickeduser) {
						publicroomlist[roomindex].roomusers.splice(i, 1);
						// Update the curret room's roomuserlist
						io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: publicroomlist[roomindex].roomusers});
					}
				}	
			}
			if (roomtype == "private") {
				// Remove the user from the current roomsuerlist
				for (i=0; i<privateroomlist[roomindex].roomusers.length; i++) {
					if (privateroomlist[roomindex].roomusers[i] == kickeduser) {
						privateroomlist[roomindex].roomusers.splice(i, 1);
						// Update the curret room's roomuserlist
						io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: privateroomlist[roomindex].roomusers});
					}
				}	
			}

			// Leave a kicked messgage
			console.log(kickeduser + " is kicked out from " + socket.room + " by " + socket.username);
			var msg = "System message: " + kickeduser + " is kicked out by the room owner.";
			io.sockets.to(socket.room).emit('message_to_client', {message: msg, fontcolor: fontcolor});
			// Put the user into the lobby
			//   and send him a message saying he's being kicked out
			// Get the kickeduser's id
			var kickeduserid;
			for (i=0; i<userlist.length; i++) {
				if (userlist[i].name == kickeduser) {
					kickeduserid = userlist[i].id;
				}
			}
			io.sockets.to(kickeduserid).emit('kicked', {newroom: "Lobby", oldroom: socket.room, oldroomtype: roomtype});
			// Create a joining message
			var msg = kickeduser + " entered the room.";
			console.log (kickeduser + " entered the lobby");
			io.sockets.to(lobby).emit("message_to_client", {message: msg, fontcolor: fontcolor});
			var msg = "System message: You are kicked out from " + socket.room + " by the owner.";
			io.sockets.to(kickeduserid).emit('message_to_client', {message: msg, fontcolor: fontcolor});
		}
	});


	socket.on('banning', function(data) {
		// Get the room type
		var roomtype = data.roomtype;

		// Get the kicked person
		var banneduser = data.banneduser;
		
		var userexist = false;

		var roomindex;

		var userinroom = false;

		if (roomtype == "public") {
			// Search the publicroomlist to find the room index
			for (i=0; i<publicroomlist.length; i++) {
				if (publicroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually in the room
			for (i=0; i<publicroomlist[roomindex].roomusers.length; i++) {
				if (banneduser == publicroomlist[roomindex].roomusers[i]) {
					userinroom = true;	
				}
			}
		}

		if (roomtype == "private") {
			// Search the privateroomlist to find the room index
			for (i=0; i<privateroomlist.length; i++) {
				if (privateroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually in the room
			for (i=0; i<privateroomlist[roomindex].roomusers.length; i++) {
				if (banneduser == privateroomlist[roomindex].roomusers[i]) {
					userinroom = true;	
				}
			}
		}

		//console.log(userlist);
		// Check if that user is actually in the system (not specific to this room!!)
		for (i=0; i<userlist.length; i++) {
			if (banneduser == userlist[i].name) {
				userexist = true;	
			}
		}	

		// If the user does not exist, send back to the client side and alert it
		if (userexist == false) {
			io.sockets.to(socket.id).emit("bancheck", {userexist: userexist});	
		}
		else {
			// So now the banned user is actually in this room, kick it
			//   remove it from the roomuserlist, and put him in the lobby
			if (roomtype == "public") {
				// Remove the user from the current roomsuerlist
				for (i=0; i<publicroomlist[roomindex].roomusers.length; i++) {
					if (publicroomlist[roomindex].roomusers[i] == banneduser) {
						publicroomlist[roomindex].roomusers.splice(i, 1);
						// Update the curret room's roomuserlist
						io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: publicroomlist[roomindex].roomusers});
					}
				}	
			}
			if (roomtype == "private") {
				// Remove the user from the current roomsuerlist
				for (i=0; i<privateroomlist[roomindex].roomusers.length; i++) {
					if (privateroomlist[roomindex].roomusers[i] == banneduser) {
						privateroomlist[roomindex].roomusers.splice(i, 1);
						// Update the curret room's roomuserlist
						io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: privateroomlist[roomindex].roomusers});
					}
				}	
			}

			// Leave a banned messgage
			console.log(banneduser + " is banned from entering " + socket.room + " by " + socket.username);
			var msg = "System message: " + banneduser + " is banned by the room owner.";
			io.sockets.to(socket.room).emit('message_to_client', {message: msg, fontcolor: fontcolor});

			// Put the user on this room's banusers list
			if (roomtype == "public") {
				// Remove the user from the current roomsuerlist
				for (i=0; i<publicroomlist[roomindex].roomusers.length; i++) {
					publicroomlist[roomindex].banusers.push(banneduser);
				}	
			}
			if (roomtype == "private") {
				// Remove the user from the current roomsuerlist
				for (i=0; i<privateroomlist[roomindex].roomusers.length; i++) {
					privateroomlist[roomindex].banusers.push(banneduser);
				}	
			}

			// If the user is already in this room...
			if (userinroom==true) {
				//   put him into the lobby
				//   and send him a message saying he's being kicked out
				// Get the bannedduser's id
				var banneduserid;
				for (i=0; i<userlist.length; i++) {
					if (userlist[i].name == banneduser) {
						banneduserid = userlist[i].id;
					}
				}
				io.sockets.to(banneduserid).emit('banned', {newroom: "Lobby", oldroom: socket.room, oldroomtype: roomtype})
				// Create a joining message
				var msg = banneduser + " entered the room.";
				console.log (banneduser + " entered the lobby");
				io.sockets.to(lobby).emit("message_to_client", {message: msg, fontcolor: fontcolor});				
			}

			var msg = "System message: You are banned from entering " + socket.room + " by the owner.";
			io.sockets.to(banneduserid).emit('message_to_client', {message: msg, fontcolor: fontcolor});
		} 
	}); // End of banning



	socket.on('unbanning', function(data) {
		// Get the room type
		var roomtype = data.roomtype;

		// Get the kicked person
		var unbanneduser = data.unbanneduser;
		
		var userexist = false;

		var roomindex;

		if (roomtype == "public") {
			// Search the publicroomlist to find the room index
			for (i=0; i<publicroomlist.length; i++) {
				if (publicroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually on this room's banuserlist 
			for (i=0; i<publicroomlist[roomindex].banusers.length; i++) {
				if (unbanneduser == publicroomlist[roomindex].banusers[i]) {
					userexist = true;	
				}
			}	
		}
		if (roomtype == "private") {
			// Search the privateroomlist to find the room index
			for (i=0; i<privateroomlist.length; i++) {
				if (privateroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually on this room's banuserlist 
			for (i=0; i<privateroomlist[roomindex].banusers.length; i++) {
				if (unbanneduser == privateroomlist[roomindex].banusers[i]) {
					userexist = true;	
				}
			}	
		}

		// If the user does not exist, send back to the client side and alert it
		if (userexist == false) {
			io.sockets.to(socket.id).emit("unbancheck", {userexist: userexist});	
		}
		else {
			// So now the unbanned user is actually on the banusrlist
			if (roomtype == "public") {
				// Remove the user from this room's banuserlist
				for (i=0; i<publicroomlist[roomindex].banusers.length; i++) {
					if (publicroomlist[roomindex].banusers[i] == unbanneduser) {
						publicroomlist[roomindex].banusers.splice(i, 1);
					}
				}	
			}
			if (roomtype == "private") {
				// Remove the user from the current roomsuerlist
				for (i=0; i<privateroomlist[roomindex].banusers.length; i++) {
					if (privateroomlist[roomindex].banusers[i] == unbanneduser) {
						privateroomlist[roomindex].banusers.splice(i, 1);
					}
				}	
			}

			// Leave an unbanned messgage
			console.log(unbanneduser + " is unbanned from entering " + socket.room + " by " + socket.username);
			var msg = "System message: " + unbanneduser + " is now unbanned by the room owner.";
			io.sockets.to(socket.room).emit('message_to_client', {message: msg, fontcolor: fontcolor});

			// Get the unbannedduser's id
			var unbanneduserid;
			for (i=0; i<userlist.length; i++) {
				if (userlist[i].name == unbanneduser) {
					unbanneduserid = userlist[i].id;
				}
			}
			
			// Send a system mesage to the previously banned user
			var msg = "System message: You are now unbanned from entering " + socket.room + " by the owner.";
			io.sockets.to(unbanneduserid).emit('message_to_client', {message: msg, fontcolor: fontcolor});
		} 
	}); // End of unbanning



	socket.on('pming', function(data) {
		var pmeduser = data.pmeduser;
		//console.log("debug-pmeduser: " + pmeduser);

		var userexist = false;
		var pmedself = false;  // check if the user is pming to himself
		var oldroomtype = data.oldroomtype;
		var roomindex;

		if (oldroomtype == "public") {
			// Search the publicroomlist to find the room index
			for (i=0; i<publicroomlist.length; i++) {
				if (publicroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually in the room
			for (i=0; i<publicroomlist[roomindex].roomusers.length; i++) {
				if (pmeduser == publicroomlist[roomindex].roomusers[i]) {
					userexist = true;	
				}
			}
		}

		if (oldroomtype == "private") {
			// Search the privateroomlist to find the room index
			for (i=0; i<privateroomlist.length; i++) {
				if (privateroomlist[i].name == socket.room) {
					roomindex = i;
				}
			}
			// Check if that user is actually in the room
			for (i=0; i<privateroomlist[roomindex].roomusers.length; i++) {
				if (pmeduser == privateroomlist[roomindex].roomusers[i]) {
					userexist = true;	
				}
			}
		}

		// Check if the user is trying to pming himself
		if (socket.username == pmeduser) {
			pmedself = true;
		}

		// If the user is not in the room, send back to the client side and alert it
		if (userexist == false) {
			io.sockets.to(socket.id).emit("pmcheck", {userexist: userexist, pmedself: pmedself});	
		}
		else if (pmedself == true) {
			io.sockets.to(socket.id).emit("pmcheck", {userexist: userexist, pmedself: pmedself});	
		}
		else {
			// Get the pmeduser's id
			var pmeduserid;
			for (i=0; i<userlist.length; i++) {
				if (userlist[i].name == pmeduser) {
					pmeduserid = userlist[i].id;
				}
			}

			// Send messages
			var msg1 = "(PM from " + socket.username + ": " + data.pmmsg + ")";
			io.sockets.to(pmeduserid).emit('message_to_client', {message: msg1, fontcolor: fontcolor});
			var msg2 = "(PM to " + pmeduser + ": " + data.pmmsg + ")";
			io.sockets.to(socket.id).emit('message_to_client', {message: msg2, fontcolor: fontcolor});

			console.log("(PM from " + socket.username + " to " + pmeduser + ": " + data.pmmsg + ")");
		}
	}); // End of pming


	socket.on('deleteRoom', function(data) {
		// Get the roomname and roomtype
		var roomname = data.roomname;
		var roomtype = data.roomtype;
		console.log(roomtype);

		var roomindex;

		// Find the room on the roomlist
		//   and remove it from the list
		if (roomtype == "public") {
			for (i=0; i<publicroomlist.length; i++) {
				// Find the room's index on the publicroomlist
				if (publicroomlist[i].name == roomname) {
					roomindex = i;
				}
			}		
		}
		if (roomtype == "private") {
			for (i=0; i<privateroomlist.length; i++) {
				// Find the room's index on the privateroomlist
				if (privateroomlist[i].name == roomname) {
					roomindex = i;
				}
			}
		}

		// Remove all the users from the room to the lobby
		var userid
		if (roomtype == "public") {
			for (i=0; i<publicroomlist[roomindex].roomusers.length; i++) {
				// Find each roomuser's id
				for (j=0; j<userlist.length; j++) {
					if (publicroomlist[roomindex].roomusers[i] == userlist[j].name) {
						userid = userlist[j].id;
						io.sockets.to(userid).emit('deleteRemove', {newroom: "Lobby", oldroom: socket.room, oldroomtype: roomtype});
					}
				}
			}
		}
		if (roomtype == "private") {
			for (i=0; i<privateroomlist[roomindex].roomusers.length; i++) {
				// Find each roomuser's id
				for (j=0; j<userlist.length; j++) {
					if (privateroomlist[roomindex].roomusers[i] == userlist[j].name) {
						userid = userlist[j].id;
						io.sockets.to(userid).emit('deleteRemove', {newroom: "Lobby", oldroom: socket.room});
					}
				}
			}
		}


		// Remove the room from the roomlist
		if (roomtype == "public") {
			publicroomlist.splice(roomindex, 1);		
		}
		if (roomtype == "private") {
			privateroomlist.splice(roomindex, 1);
		}
		console.log(publicroomlist);
		console.log(privateroomlist);
		// Update the roomlist on the client side
		io.sockets.emit("roomUpdate", {publicrooms: publicroomlist, privaterooms: privateroomlist});
		console.log(socket.room + " is deleted by " + socket.username);
	}); // End of deleteRoom



	socket.on('deleterEnter', function(data) {
		var newroomname = data.publicroomname; // the Lobby
		var newroomindex;
		var ownercheck = false;
		var roomowner = "default";

		for (i=0; i<publicroomlist.length; i++) {
			// Find the newroom's index on the publicroomlist
			if (publicroomlist[i].name == newroomname) {
				newroomindex = i;
			}
		}

		// Join the new room
		// Change the current room to the new room
		socket.room = newroomname;
		socket.join(socket.room);

		// Add the user to the new room's roomuserlist
		publicroomlist[newroomindex].roomusers.push(socket.username);
		//console.log("debug-newuserlist: " + publicroomlist[newroomindex].roomusers);
		// Update the newroom's roomuserlist
		io.sockets.to(socket.room).emit("roomusersUpdate", {roomusers: publicroomlist[newroomindex].roomusers});
		console.log("Room changed: " + socket.room);

		// Change the room layout on the client side
		io.sockets.to(socket.id).emit("roomEntered", {roomname: socket.room, roomtype: "public", ownercheck: ownercheck, owner: roomowner});

		// Create a joining message
		var msg = socket.username + " entered the room.";
		console.log (socket.username + " entered " + socket.room);
		io.sockets.to(socket.room).emit("message_to_client", {message: msg, fontcolor: fontcolor});
	}); // End of deleteEnter


}); // End of sockets io connection