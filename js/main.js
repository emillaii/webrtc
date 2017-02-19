

var socket = io();
var RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.msRTCPeerConnection;
var RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription || window.msRTCSessionDescription;
navigator.getUserMedia = navigator.getUserMedia || navigator.mozGetUserMedia || navigator.webkitGetUserMedia || navigator.msGetUserMedia;
var twilioIceServers = [
     { url: 'stun:global.stun.twilio.com:3478?transport=udp' }
     // { url: 'turn:global.turn.twilio.com:3478?transport=udp',
     //   username: 'ea757ad2c42b932c7f2abe480295e7eb039dc2b13b78c86bc412818ed51e5eea',
     //   credential: 'MPnnojPRoPDI+B3kLONGF9P440Lb8NkrTq+FxxJBVro=' },
     // { url: 'turn:global.turn.twilio.com:3478?transport=tcp',
     //   username: 'ea757ad2c42b932c7f2abe480295e7eb039dc2b13b78c86bc412818ed51e5eea',
     //   credential: 'MPnnojPRoPDI+B3kLONGF9P440Lb8NkrTq+FxxJBVro=' },
     // { url: 'turn:global.turn.twilio.com:443?transport=tcp',
     //   username: 'ea757ad2c42b932c7f2abe480295e7eb039dc2b13b78c86bc412818ed51e5eea',
     //   credential: 'MPnnojPRoPDI+B3kLONGF9P440Lb8NkrTq+FxxJBVro=' }
];
var configuration = {"iceServers": [{"url": "stun:stun.l.google.com:19302"}]};
// configuration.iceServers = twilioIceServers;
var pcPeers = {};
var currentUsername = document.getElementById("currentUsername");
var roomName = document.getElementById("roomName");
var selfView = document.getElementById("selfView");
var remoteViewContainer = document.getElementById("remoteViewContainer");
var clientId = '';
var localStream;
function getLocalStream() {
  navigator.getUserMedia({ "audio": true, "video": true }, function (stream) {
    localStream = stream;
    selfView.src = URL.createObjectURL(stream);
    selfView.muted = true;
  }, logError);
}
function join(roomID) {
  socket.emit('join', {'roomID': roomID, 'userName': 'GOD', 'from': socket.io.engine.id }, function(socketIds){
    console.log('join', socketIds);
    console.log('join', roomID);
    roomName.innerHTML = 'Chat Room: ' + roomID;
    for (var i in socketIds) {
      var socketId = socketIds[i];
      createPC(socketId, true);
    }
  });
}
function createPC(socketId, isOffer) {
  var pc = new RTCPeerConnection(configuration);
  pcPeers[socketId] = pc;
  pc.onicecandidate = function (event) {
    console.log('onicecandidate', event);
    if (event.candidate) {
      socket.emit('exchange', {'to': socketId, 'candidate': event.candidate });
    }
  };
  function createOffer() {
    pc.createOffer(function(desc) {
      console.log('createOffer', desc);
      pc.setLocalDescription(desc, function () {
        console.log('setLocalDescription', pc.localDescription);
        socket.emit('exchange', {'to': socketId, 'sdp': pc.localDescription });
      }, logError);
    }, logError);
  }
  pc.onnegotiationneeded = function () {
    console.log('onnegotiationneeded');
    if (isOffer) {
      createOffer();
    }
  }
  pc.oniceconnectionstatechange = function(event) {
    console.log('oniceconnectionstatechange', event);
    if (event.target.iceConnectionState === 'connected') {
      createDataChannel();
    }
  };
  pc.onsignalingstatechange = function(event) {
    console.log('onsignalingstatechange', event);
  };
  pc.onaddstream = function (event) {
    console.log('onaddstream', event);
    var element = document.createElement('video');
    element.id = "remoteView" + socketId;
    element.autoplay = 'autoplay';
    element.src = URL.createObjectURL(event.stream);
    remoteViewContainer.appendChild(element);
    $('ul#user_list').append(( "<li><a href='#" + socketId +  "' id='" + socketId + "'>"+ socketId + "</a></li>" ));
  };
  pc.addStream(localStream);
  function createDataChannel() {
    if (pc.textDataChannel) {
      return;
    }
    var dataChannel = pc.createDataChannel("text");
    dataChannel.onerror = function (error) {
      console.log("dataChannel.onerror", error);
    };
    dataChannel.onmessage = function (event) {
      console.log("dataChannel.onmessage:", event.data);
      var content = document.getElementById('textRoomContent');
      content.value = content.value + socketId + ': ' + event.data + '\n';
    };
    dataChannel.onopen = function () {
      var textRoom = document.getElementById('textRoom');
      textRoom.style.display = "block";
    };
    dataChannel.onclose = function () {
      console.log("dataChannel.onclose " + socketId);
      var element = document.getElementById(socketId);
      element.remove();
    };
    pc.textDataChannel = dataChannel;
  }
  return pc;
}
function exchange(data) {
  var fromId = data.from;
  var pc;
  if (fromId in pcPeers) {
    pc = pcPeers[fromId];
  } else {
    pc = createPC(fromId, false);
  }
  if (data.sdp) {
    console.log('exchange sdp', data);
    pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
      if (pc.remoteDescription.type == "offer")
        pc.createAnswer(function(desc) {
          console.log('createAnswer', desc);
          pc.setLocalDescription(desc, function () {
            console.log('setLocalDescription', pc.localDescription);
            socket.emit('exchange', {'to': fromId, 'sdp': pc.localDescription });
          }, logError);
        }, logError);
    }, logError);
  } else {
    console.log('exchange candidate', data);
    pc.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
}
function leave(socketId) {
  console.log('leave', socketId);
  var pc = pcPeers[socketId];
  if (pc != null)  pc.close();
  delete pcPeers[socketId];
  var video = document.getElementById("remoteView" + socketId);
  if (video) video.remove();
}
socket.on('exchange', function(data){
  exchange(data);
});
socket.on('leave', function(socketId){
  leave(socketId);
});
socket.on('connect', function(data) {
  console.log('connect');
  getLocalStream();
});
function logError(error) {
  console.log("logError", error);
}
function press() {
  var roomID = document.getElementById('roomID').value;
  if (roomID == "") {
    alert('Please enter room ID');
  } else {
    var roomIDContainer = document.getElementById('roomIDContainer');
    roomIDContainer.parentElement.removeChild(roomIDContainer);
    join(roomID);
  }
}
function textRoomPress() {
  var text = document.getElementById('textRoomInput').value;
  if (text == "") {
    alert('Enter something');
  } else {
    document.getElementById('textRoomInput').value = '';
    var content = document.getElementById('textRoomContent');
    content.scrollTop = content.scrollHeight;
    content.value = content.value  + 'Me' + ': ' + text + '\n';
    for (var key in pcPeers) {
      var pc = pcPeers[key];
      pc.textDataChannel.send(text);
    }
  }
}