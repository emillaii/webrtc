'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var https = require('https');
var socketIO = require('socket.io');
var fs = require('fs');

var socketId2UsernameMap = [];
var options = {
//    key: fs.readFileSync('key/server.key'),
//    cert: fs.readFileSync('key/server.crt')
};

const serverPort = process.argv[2]; 


var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(serverPort);

var io = socketIO.listen(app);

//Create a Redis Client 
var redis = require('socket.io-redis'); 
const redisPort = process.argv[3]; 
io.adapter(redis({ host: '127.0.0.1', port: redisPort })); 

function socketIdsInRoom(name) {
  var clients = io.of('/').adapter.clients([name]);
  console.log(clients);
  var collection = []; 
  for (var key in clients) {
      console.log(clients[key]); 
      collection.push(clients[key]);
  }
  return collection; 
}

io.sockets.on('connection', function (socket) {
   console.log('connection');
   socket.on('join', function(data, callback){
       console.log('join', data);
       //var socketIds = socketIdsInRoom(data.roomID);
       io.of('/').adapter.clients([data.roomID], function(err, clients) {
          var collection = []; 
	  for (var key in clients) {
	  	console.log(clients[key]); 
		collection.push(clients[key]); 
	  }
	  callback(collection); 
	  socket.join(data.roomID); 
       }); 
   });

    socket.on('exchange', function(data){
        var room = 'abc'; 
        console.log('exchange to ', socket.id);
	data.from = socket.id;
	//var to = io.sockets.connected[data.to];
	io.to(room).emit('exchange', data);
    });
});

