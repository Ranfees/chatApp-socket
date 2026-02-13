import React, { useEffect, useRef, useState } from 'react';
import Peer from 'peerjs';
import socket from '../socket/socket';

const VideoCall = ({ myId, remoteUserId, type, onEnd }) => {
  const [myStream, setMyStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const myVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerInstance = useRef(null);
  const callProcessed = useRef(false); // Prevents duplicate call attempts

  useEffect(() => {
    // 1. Initialize Peer with Google's STUN servers for NAT traversal
    const peer = new Peer(myId, {
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    });
    peerInstance.current = peer;

    const constraints = {
      video: type === 'video',
      audio: true,
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        setMyStream(stream);
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        // ANSWERING LOGIC: Listen for incoming calls
        peer.on('call', (incomingCall) => {
          callProcessed.current = true; // Mark as handled so we don't try to call them
          incomingCall.answer(stream);
          incomingCall.on('stream', (userStream) => {
            setRemoteStream(userStream);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = userStream;
          });
        });

        // CALLING LOGIC: Small delay to ensure the receiver's Peer is initialized
        setTimeout(() => {
          if (!callProcessed.current) {
            const call = peer.call(remoteUserId, stream);
            if (call) {
              call.on('stream', (userStream) => {
                setRemoteStream(userStream);
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = userStream;
              });
            }
          }
        }, 1500);
      })
      .catch((err) => {
        console.error("Media Error:", err);
        alert("Camera/Mic access denied.");
        onEnd();
      });

    return () => {
      peer.destroy();
      if (myStream) {
        myStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [myId, remoteUserId, type]);

  return (
    <div className="call-overlay">
      <div className="video-container">
        {/* Remote Video (Main) */}
        {remoteStream ? (
          <video playsInline ref={remoteVideoRef} autoPlay className="remote-video" />
        ) : (
          <div className="call-loading">
            <p>Connecting to Peer...</p>
            <span>Ensure the other user has accepted the call</span>
          </div>
        )}

        {/* Local Video (Small Picture-in-Picture) */}
        <video playsInline muted ref={myVideoRef} autoPlay className="local-video" />

        <div className="call-controls">
          <button onClick={onEnd} className="hangup-btn">
            Hang Up
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;