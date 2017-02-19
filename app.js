'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var https = require('https');
var socketIO = require('socket.io');
var fs = require('fs');

var socketId2UsernameMap = [];
var options = {
    key: fs.readFileSync('key/server.key'),
    cert: fs.readFileSync('key/server.crt')
};

var fileServer = new(nodeStatic.Server)();
var app = https.createServer(options, function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

var io = socketIO.listen(app);

function socketIdsInRoom(name) {
  var socketIds = io.nsps['/'].adapter.rooms[name];
  if (socketIds) {
    var collection = [];
    for (var key in socketIds) {
      collection.push(key);
    }
    return collection;
  } else {
    return [];
  }
}

io.on('connection', function(socket){
  console.log('connection');
  socket.on('disconnect', function(){
    console.log('disconnect socket id: ', socket.id);
    if (socket.room) {
      var room = socket.room;
      io.to(room).emit('leave', socket.id);
      socket.leave(room);
      if (socketId2UsernameMap[socket.id] != null) {delete socketId2UsernameMap[socket.id];}
    }
  });

  socket.on('join', function(data, callback){
    console.log('join', data);
    var socketIds = socketIdsInRoom(data.roomID);
    callback(socketIds);
    socket.join(data.roomID);
    socket.room = data.roomID;
    //This socket-user name is not really scalable if the user is up to million.
    socketId2UsernameMap[data.from] = data.userName;
    for (var i in socketId2UsernameMap) {
        console.log('Current active user: ' + i);
    }
  });

  socket.on('joined', function(data){
    console.log('joined', data);
    socketId2UsernameMap[data.from] = data.userName;
    for (var i in socketId2UsernameMap) {
        console.log('Current active user: ' + i);
    }
  });

  socket.on('exchange', function(data){
    //console.log('exchange', data);
    data.from = socket.id;
    var to = io.sockets.connected[data.to];
    to.emit('exchange', data);
  });
});