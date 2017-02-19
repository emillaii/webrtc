/*
body {
  font-family: sans-serif;
}

video {
  max-width: 100%;
}

.sidenav {
  background-color: #f1f1f1;
  height: 100%;
}

.button_row{
  margin-top: 30px;
  margin-bottom: 30px;
  margin-left: 10px;
  margin-right: 10px;
}

.small_id {
  font-size:10px;
  color: #9A9;
}
<!DOCTYPE html><html><head><title>Realtime communication with WebRTC</title><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css"><!-- script src="https://ajax.googleapis.com/ajax/libs/jquery/3.1.1/jquery.min.js"></script>--><script src="/web-rtc/js/lib/jquery.min.js"></script><script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js"></script><link rel="stylesheet" href="/web-rtc/css/main.css"></head><body><div class="container-fluid"><h3>Realtime communication with WebRTC</h3><div class="col-sm-3 sidenav hidden-xs"><h2>Welcome, abcd</h2><ul id="user_list" class="nav nav-pills nav-stacked"></ul><br><br><div id="username" class="small_id">aa@gmail.com</div><div id="userid" class="small_id">58a8f213ce1c360a022ece54</div></div><div class="col-sm-9"><div id="buttons" class="row button_row"><button id="startButton" type="button" class="btn btn-danger">Start Session</button><button id="endButton" type="button" disabled="" class="btn btn-danger pull-right">End Session</button></div><div id="videos" class="row"><div class="col-sm-6"><video id="remoteVideo" autoplay=""></video></div><div class="col-sm-6"><video id="localVideo" autoplay="" muted=""></video></div></div><div id="textareas" class="form-group"><textarea id="dataChannelReceive" rows="10" disabled="" class="form-control"></textarea><textarea id="dataChannelSend" disabled="" placeholder="Enter some text, then press Send." class="form-control"></textarea><button id="sendButton" type="button" class="btn btn-default">Send</button></div></div><script src="/socket.io/socket.io.js"></script><script src="/web-rtc/js/lib/adapter-latest.js"></script><script src="/web-rtc/js/main.js"></script></div></body></html>

*/


'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var sendChannel;
var receiveChannel;

var pcConfig = {
  'iceServers': [{'url': 'stun:stun.l.google.com:19302'},
{url:'stun:stun1.l.google.com:19302'},
{url:'stun:stun2.l.google.com:19302'},
{url:'stun:stun3.l.google.com:19302'},
{url:'stun:stun4.l.google.com:19302'},
{
  url: 'turn:numb.viagenie.ca',
  credential: 'testviagenie123',
  username: 'kennethkwok@onwardsmg.com'
}

]
};

// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  'mandatory': {
    'OfferToReceiveAudio': true,
    'OfferToReceiveVideo': true
  }
};

/////////////////////////////////////////////

var room = '';
// Could prompt for room name:
//var room = prompt('Enter room name:');

var socket = io.connect();

//if (room !== '') {
//  joinRoom(room);
//}

socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
  getUserMedia();
  $("#startButton").html('Restart Session');
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  //console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
  getUserMedia();
});

socket.on('left', function(room, id) {
  console.log('left: '+ room + id);
  hangup();
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(room, message) {
  console.log('Client sending message: ', room, message);
  socket.emit('message', room, message);
}


// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer();
  } else if (message.type === 'answer' && isStarted) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

var dataChannelSend = document.querySelector('textarea#dataChannelSend');
var dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
var sendButton = document.querySelector('button#sendButton');
var startButton = document.querySelector('button#startButton');
var endButton = document.querySelector('button#endButton');

var constraints = {
  video: true,
  audio: false
};

sendButton.onclick = sendData;
startButton.onclick = startChat;
endButton.onclick = hangup;

loadUsers();

function loadUsers() {

  $.getJSON( "/users", function( data ) {
    var items = [];
    $.each( data, function( key, val ) {
      $('ul#user_list').append(( "<li><a href='#" + val.username + "'>"+ val.username + "</a></li>" ));
    });
  });

}

function startChat() {
  if (room !== '') {
    hangup();
  }

  room = prompt('Enter room name:');
  joinRoom(room);
}

function joinRoom(room) {
  socket.emit('create or join', room);
  console.log('Attempted to create or join room', room);
}

function getUserMedia() {
  navigator.mediaDevices.getUserMedia(constraints)
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e.name);
  });

  function gotStream(stream) {
    console.log('Adding local stream.');
    localVideo.src = window.URL.createObjectURL(stream);
    localStream = stream;
    sendMessage(room, 'got user media');
    if (isInitiator) {
      maybeStart();
    }
  }

  console.log('Getting user media with constraints', constraints);

}
//if (location.hostname !== 'localhost') {
  //requestTurn(
  //  'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
  //);
//}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && typeof localStream !== 'undefined' && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    startButton.disabled = true;
    $("#startButton").html('Start Session');

    endButton.disabled = false;

    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      doCall();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage(room, 'bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    pc.ondatachannel = receiveChannelCallback;
    console.log('Created RTCPeerConnnection');

    //dataConstraint = null;
    sendChannel = pc.createDataChannel('sendDataChannel');
    console.log('Created send data channel');
    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;

  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage(room, {
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  // Set Opus as the preferred codec in SDP if Opus is present.
  //  sessionDescription.sdp = preferOpus(sessionDescription.sdp);
  pc.setLocalDescription(sessionDescription);
  console.log('setLocalAndSendMessage sending message', sessionDescription);
  sendMessage(room, sessionDescription);
}

function onCreateSessionDescriptionError(error) {
  console.log('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].url.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  /*
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
  */
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteVideo.src = window.URL.createObjectURL(event.stream);
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  socket.emit('leave', room);
  stop();
  sendMessage(room, 'bye');
}

function handleRemoteHangup() {
  console.log('Remote Hangup - Session terminated.');
  hangup();
}

function stop() {
  console.log('Calling stop()');
  isStarted = false;
  isChannelReady = false;
  isInitiator = false;
  // isAudioMuted = false;
  // isVideoMuted = false;
  startButton.disabled = false;
  $("#startButton").html('Start Session');

  endButton.disabled = true;
  if (localStream.getVideoTracks().length > 0) {
    localStream.getVideoTracks()[0].stop();
  }
  if (localStream.getAudioTracks().length > 0) {
    localStream.getAudioTracks()[0].stop();
  }

  dataChannelReceive.value = '';

  if (pc) {
    pc.close();
  }
  pc = null;
  room = '';
}

function onSendChannelStateChange() {
  var readyState = sendChannel.readyState;
  console.log('Send channel state is: ' + readyState);
  if (readyState === 'open') {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = true;
  }
}

function sendData() {
  var data = dataChannelSend.value;

  var display_self_text = 'Self: ' + data;

  sendChannel.send(data);
  console.log('Sent Data: ' + data);
  dataChannelReceive.value = dataChannelReceive.value + 'Sent: ' + data + '\r\n';
  //dataChannelReceive.val(dataChannelReceive.val() + display_self_text + "\n");
  dataChannelSend.value = '';
}

function receiveChannelCallback(event) {
  console.log('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = onReceiveMessageCallback;
  receiveChannel.onopen = onReceiveChannelStateChange;
  receiveChannel.onclose = onReceiveChannelStateChange;
}

function onReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  console.log('Receive channel state is: ' + readyState);
}

function onReceiveMessageCallback(event) {
  console.log('Received Message');
  dataChannelReceive.value = dataChannelReceive.value + event.data + '\r\n';
}

///////////////////////////////////////////

// Set Opus as the default audio codec if it's present.
function preferOpus(sdp) {
  var sdpLines = sdp.split('\r\n');
  var mLineIndex;
  // Search for m line.
  for (var i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('m=audio') !== -1) {
      mLineIndex = i;
      break;
    }
  }
  if (mLineIndex === null) {
    return sdp;
  }

  // If Opus is available, set it as the default in m line.
  for (i = 0; i < sdpLines.length; i++) {
    if (sdpLines[i].search('opus/48000') !== -1) {
      var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
      if (opusPayload) {
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
          opusPayload);
      }
      break;
    }
  }

  // Remove CN in m line and sdp.
  sdpLines = removeCN(sdpLines, mLineIndex);

  sdp = sdpLines.join('\r\n');
  return sdp;
}

function extractSdp(sdpLine, pattern) {
  var result = sdpLine.match(pattern);
  return result && result.length === 2 ? result[1] : null;
}

// Set the selected codec to the first in m line.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');
  var newLine = [];
  var index = 0;
  for (var i = 0; i < elements.length; i++) {
    if (index === 3) { // Format of media starts from the fourth.
      newLine[index++] = payload; // Put target payload to the first.
    }
    if (elements[i] !== payload) {
      newLine[index++] = elements[i];
    }
  }
  return newLine.join(' ');
}

// Strip CN from sdp before CN constraints is ready.
function removeCN(sdpLines, mLineIndex) {
  var mLineElements = sdpLines[mLineIndex].split(' ');
  // Scan from end for the convenience of removing an item.
  for (var i = sdpLines.length - 1; i >= 0; i--) {
    var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
    if (payload) {
      var cnPos = mLineElements.indexOf(payload);
      if (cnPos !== -1) {
        // Remove CN payload from m line.
        mLineElements.splice(cnPos, 1);
      }
      // Remove CN line in sdp
      sdpLines.splice(i, 1);
    }
  }

  sdpLines[mLineIndex] = mLineElements.join(' ');
  return sdpLines;
}
