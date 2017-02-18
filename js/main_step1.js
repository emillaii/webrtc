'use strict';

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

var constraints = {
    audio: false,
    video: true
};
var video = document.querySelector('video');
var stopButton  = document.querySelector('#stopButton');

function trace(arg) {
  var now = (window.performance.now() / 1000).toFixed(3);
  console.log(now + ': ', arg);
}

function successCallback(stream) {
    window.stream = stream; //Stream available to console.

    if (window.URL) {
        trace('Print window URL', window.URL);
        video.src = window.URL.createObjectURL(stream);
    }else {
        video.src = stream;
    }
}

function errorCallback(error) {
    trace('Error: ', error);
}

stopButton.onclick = function() {
    trace('Stop video button is clicked');
    window.stream.getVideoTracks()[0].stop();
}

trace('Start');

navigator.getUserMedia(constraints, successCallback, errorCallback);
