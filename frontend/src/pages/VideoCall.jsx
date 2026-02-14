import React, { useEffect, useRef, useState } from "react";
import Peer from "peerjs";
import socket from "../socket/socket";

const VideoCall = ({ myId, remoteUserId, type, role, onEnd }) => {
  const [remoteStream, setRemoteStream] = useState(null);

  const myVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const peerRef = useRef(null);
  const streamRef = useRef(null);
  const callRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    // =============================
    // CLEANUP FUNCTION
    // =============================
    const cleanupCall = () => {
      console.log("Cleaning up call");

      if (callRef.current) {
        callRef.current.close();
        callRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      if (peerRef.current && !peerRef.current.destroyed) {
        peerRef.current.destroy();
      }

      onEnd();
    };

    // =============================
    // 1️⃣ Create Peer (NO ID COLLISION)
    // =============================
    const peer = new Peer(undefined, {
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
        ],
      },
      debug: 2,
    });

    peerRef.current = peer;

    // =============================
    // 2️⃣ Get Camera & Mic
    // =============================
    const constraints = {
      video: type === "video",
      audio: true,
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        if (!isMounted) return;

        streamRef.current = stream;

        // show local video
        if (myVideoRef.current) {
          myVideoRef.current.srcObject = stream;
        }

        // =============================
        // 3️⃣ ANSWER INCOMING CALL (Receiver Only)
        // =============================
        peer.on("call", (incomingCall) => {
          console.log("Incoming call received");

          callRef.current = incomingCall;

          incomingCall.answer(stream);

          incomingCall.on("stream", (userStream) => {
            console.log("Receiving remote stream");

            setRemoteStream(userStream);

            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = userStream;
            }
          });

          incomingCall.on("close", cleanupCall);
          incomingCall.on("error", cleanupCall);
        });

        // =============================
        // 4️⃣ MAKE OUTGOING CALL (Caller ONLY)
        // =============================
        peer.on("open", (peerId) => {
          console.log("Peer ready:", peerId, "Role:", role);

          // Only caller initiates
          if (role !== "caller") return;

          // small delay so receiver peer initializes
          setTimeout(() => {
            console.log("Calling:", remoteUserId);

            const call = peer.call(remoteUserId, stream);

            callRef.current = call;

            call.on("stream", (userStream) => {
              console.log("Remote stream received");

              setRemoteStream(userStream);

              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = userStream;
              }
            });

            call.on("close", cleanupCall);
            call.on("error", cleanupCall);
          }, 1200);
        });
      })
      .catch((err) => {
        console.error("Media access error:", err);
        alert("Camera/Microphone permission denied");
        onEnd();
      });

    // =============================
    // UNMOUNT CLEANUP
    // =============================
    return () => {
      isMounted = false;
      cleanupCall();
    };
  }, [myId, remoteUserId, type, role, onEnd]);

  // =============================
  // UI
  // =============================
  return (
    <div className="call-overlay">
      <div className="video-container">

        {/* Remote Video */}
        {remoteStream ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="remote-video"
          />
        ) : (
          <div className="call-loading">Connecting...</div>
        )}

        {/* Local Video */}
        <video
          ref={myVideoRef}
          autoPlay
          muted
          playsInline
          className="local-video"
        />

        {/* Controls */}
        <div className="call-controls">
          <button
            className="hangup-btn"
            onClick={() => {
              if (callRef.current) callRef.current.close();
              onEnd();
            }}
          >
            Hang Up
          </button>
        </div>

      </div>
    </div>
  );
};

export default VideoCall;
