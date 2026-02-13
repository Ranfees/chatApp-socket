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
    // 1. Initialize Peer
    const peer = new Peer(myId);
    peerInstance.current = peer;

    // 2. Get Media (Video or Audio only)
    const constraints = { 
      video: type === 'video', 
      audio: true 
    };

    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      setMyStream(stream);
      if (myVideoRef.current) myVideoRef.current.srcObject = stream;

      // Handle Incoming Call inside the Peer session
      peer.on('call', (call) => {
        call.answer(stream);
        call.on('stream', (userStream) => {
          setRemoteStream(userStream);
          if (remoteVideoRef.current) remoteVideoRef.current.srcObject = userStream;
        });
      });
    });

    return () => {
      peer.destroy();
      myStream?.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startCall = (targetPeerId) => {
    const call = peerInstance.current.call(targetPeerId, myStream);
    call.on('stream', (userStream) => {
      setRemoteStream(userStream);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = userStream;
    });
  };

  return (
    <div className="call-overlay">
      <div className="video-grid">
        <video playsInline muted ref={myVideoRef} autoPlay className="small-video" />
        {remoteStream && <video playsInline ref={remoteVideoRef} autoPlay className="main-video" />}
      </div>
      <button onClick={onEnd} className="end-call-btn">Hang Up</button>
    </div>
  );
};