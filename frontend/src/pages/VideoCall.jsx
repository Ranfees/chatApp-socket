import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import socket from '../socket/socket';

const VideoCall = ({ myId, remoteUserId, type, onEnd }) => {
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const myVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerInstance = useRef(null);

  useEffect(() => {
    // 1. Initialize Peer with your MongoDB ID as the Peer ID
    const peer = new Peer(myId);
    peerInstance.current = peer;

    const constraints = { 
      video: type === 'video', 
      audio: true 
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      setMyStream(stream);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      // Listen for incoming PeerJS calls
      peer.on('call', (call) => {
        call.answer(stream);
        call.on('stream', (userStream) => {
          setRemoteStream(userStream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = userStream;
        });
      });

      // 2. IMPORTANT: Automatically trigger the call to the remote user
      // We only do this if we are the "caller"
      const call = peer.call(remoteUserId, stream);
      if (call) {
        call.on('stream', (userStream) => {
          setRemoteStream(userStream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = userStream;
        });
      }
    }).catch(err => {
      console.error("Failed to get local stream", err);
      alert("Please allow camera/microphone access");
    });

    return () => {
      peer.destroy();
      // Stop the camera/mic tracks when the component unmounts
      if (myStream) {
        myStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [myId, remoteUserId]); // Depend on these IDs

  return (
    <div className="call-overlay">
      <div className="video-grid">
        <video playsInline muted ref={myVideoRef} autoPlay className="small-video" />
        {remoteStream ? (
           <video playsInline ref={remoteVideoRef} autoPlay className="main-video" />
        ) : (
           <div className="call-loading">Connecting...</div>
        )}
      </div>
      <button onClick={onEnd} className="end-call-btn">Hang Up</button>
    </div>
  );
};

// This line is what your error message was looking for!
export default VideoCall;