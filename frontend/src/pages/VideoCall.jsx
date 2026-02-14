import React, { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";

const ICE = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

const VideoCall = ({ myId, remoteUserId, type, onEnd }) => {
  const [remoteStream, setRemoteStream] = useState(null);
  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const streamRef = useRef(null);

  // Generate the same chatKey used in Chat.jsx
  const chatKey = [myId, remoteUserId].sort().join("_");

  useEffect(() => {
    const startWebRTC = async () => {
      try {
        // 1. Get Media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: type === "video",
          audio: true,
        });
        streamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;

        // 2. Join the Socket Room
        socket.emit("call:join", chatKey);

        // 3. Handle when the OTHER person joins (Caller logic)
        socket.on("call:user-joined", async ({ socketId }) => {
          const pc = createPeer(socketId, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("call:signal", { to: socketId, signal: { sdp: offer }, chatKey });
        });

        // 4. Handle incoming Signals (Offer/Answer/ICE)
        socket.on("call:signal", async ({ from, signal }) => {
          if (!pcRef.current) createPeer(from, streamRef.current);
          const pc = pcRef.current;

          if (signal.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            if (signal.sdp.type === "offer") {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              socket.emit("call:signal", { to: from, signal: { sdp: answer }, chatKey });
            }
          } else if (signal.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        });

        socket.on("call:user-left", onEnd);

      } catch (err) {
        console.error("WebRTC Error:", err);
        onEnd();
      }
    };

    const createPeer = (targetSocketId, stream) => {
      const pc = new RTCPeerConnection(ICE);
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (e) => {
        setRemoteStream(e.streams[0]);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit("call:signal", { to: targetSocketId, signal: { candidate: e.candidate }, chatKey });
        }
      };
      return pc;
    };

    startWebRTC();

    return () => {
      socket.emit("call:leave", chatKey);
      socket.off("call:user-joined");
      socket.off("call:signal");
      socket.off("call:user-left");
      streamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    };
  }, []);

  return (
    <div className="call-overlay">
      <div className="video-container">
        {remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
        ) : (
          <div className="call-loading">Ringing...</div>
        )}
        <video ref={myVideoRef} autoPlay muted playsInline className="local-video" />
        <div className="call-controls">
          <button className="hangup-btn" onClick={onEnd}>Hang Up</button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;