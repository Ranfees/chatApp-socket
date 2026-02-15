import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft, Phone, Video } from "lucide-react";
import { decryptWith, encryptFor } from "../utils/crypto";

const Chat = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { users, onlineUsers } = useOutletContext();

  const userString = localStorage.getItem("user");
  const currentUser = JSON.parse(userString);
  const myId = currentUser?.id;

  const chatKey = [myId, userId].sort().join("_");
  const receiver = users?.find((u) => u._id === userId);
  const isOnline = onlineUsers.includes(userId);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(false);
  const [displayMessages, setDisplayMessages] = useState([]);

  // CALL STATES
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const pendingCandidates = useRef([]);
  const bottomRef = useRef();

  /* ===========================
        WEBRTC CORE
  ============================ */

  const createPeer = (targetId) => {
    // const peer = new RTCPeerConnection({
    //   iceServers: [
    //     { urls: "stun:stun.l.google.com:19302" },
    //     { urls: "stun:stun1.l.google.com:19302" },
    //     { urls: "stun:stun2.l.google.com:19302" },
    //   ],
    // });

    const peer = new RTCPeerConnection({
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
});

    // Send ICE to other peer
    peer.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: targetId,
          candidate: event.candidate,
        });
      }
    };

    // Remote track handler (stable version)
    peer.ontrack = (event) => {
      if (!remoteVideoRef.current) return;

      const remoteStream = new MediaStream();
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });

      remoteVideoRef.current.srcObject = remoteStream;
    };

    return peer;
  };

  /* ===========================
        START CALL
  ============================ */

  const startCall = async (type) => {
    try {
      setCallType(type);
      setIsCalling(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const peer = createPeer(userId);
      peerRef.current = peer;

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("call-user", {
        to: userId,
        offer,
        type,
      });
    } catch (err) {
      console.error("Call start error:", err);
    }
  };

  /* ===========================
        END CALL
  ============================ */

  const endCall = () => {
    setIsCalling(false);
    setCallType(null);

    peerRef.current?.close();
    peerRef.current = null;

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    socket.emit("end-call", { to: userId });
  };

  /* ===========================
        SOCKET LISTENERS
  ============================ */

  useEffect(() => {
    /* ------------------ RECEIVE MESSAGE ------------------ */
    const handleReceive = (msg) => {
      const otherPartyId =
        msg.sender === myId ? msg.receiver : msg.sender;

      const targetChatKey = [myId, otherPartyId].sort().join("_");
      const isCurrentChat =
        msg.sender === userId || msg.receiver === userId;

      const localData = JSON.parse(
        localStorage.getItem("chat_" + targetChatKey) || "[]"
      );

      if (!localData.find((m) => m._id === msg._id)) {
        const updatedLocal = [...localData, msg];
        localStorage.setItem(
          "chat_" + targetChatKey,
          JSON.stringify(updatedLocal)
        );
      }

      if (isCurrentChat) {
        setMessages((prev) => {
          if (prev.find((m) => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }

      if (msg.receiver === myId) {
        socket.emit("message_stored_locally", msg._id);
      }
    };

    /* ------------------ INCOMING CALL ------------------ */
    const handleIncomingCall = async ({ from, offer, type }) => {
      setCallType(type);
      setIsCalling(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: type === "video",
        audio: true,
      });

      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const peer = createPeer(from);
      peerRef.current = peer;

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      await peer.setRemoteDescription(
        new RTCSessionDescription(offer)
      );

      // 🔥 Apply buffered ICE
      for (let c of pendingCandidates.current) {
        await peer.addIceCandidate(new RTCIceCandidate(c));
      }
      pendingCandidates.current = [];

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);

      socket.emit("answer-call", {
        to: from,
        answer,
      });
    };

    /* ------------------ CALL ANSWERED ------------------ */
    const handleCallAnswered = async ({ answer }) => {
      await peerRef.current?.setRemoteDescription(
        new RTCSessionDescription(answer)
      );

      // 🔥 Apply buffered ICE
      for (let c of pendingCandidates.current) {
        await peerRef.current.addIceCandidate(
          new RTCIceCandidate(c)
        );
      }
      pendingCandidates.current = [];
    };

    /* ------------------ ICE CANDIDATE ------------------ */
    const handleIce = async ({ candidate }) => {
      try {
        if (peerRef.current?.remoteDescription) {
          await peerRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } else {
          pendingCandidates.current.push(candidate);
        }
      } catch (err) {
        console.error("ICE error:", err);
      }
    };

    socket.on("receive_message", handleReceive);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAnswered);
    socket.on("ice-candidate", handleIce);
    socket.on("call-ended", endCall);

    return () => {
      socket.off("receive_message", handleReceive);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-answered", handleCallAnswered);
      socket.off("ice-candidate", handleIce);
      socket.off("call-ended", endCall);
    };
  }, [userId, myId]);

  /* AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  /* ===========================
        SEND MESSAGE
  ============================ */

  const sendMessage = async () => {
    if (!text.trim()) return;

    const myPubKey = currentUser?.publicKey;

    if (!receiver?.publicKey || !myPubKey) {
      alert("Security keys missing.");
      return;
    }

    try {
      const encReceiver = await encryptFor(text, receiver.publicKey);
      const encSender = await encryptFor(text, myPubKey);

      socket.emit("send_message", {
        receiverId: userId,
        encReceiver,
        encSender,
      });

      setText("");
    } catch (err) {
      console.error("Encryption failed", err);
    }
  };

  /* ===========================
        UI
  ============================ */

  return (
    <div className="chat-window">
      <header className="chat-header">
        <div className="header-left">
          <button onClick={() => navigate("/")}>
            <ArrowLeft />
          </button>
          <h4>{receiver?.username}</h4>
        </div>

        <div className="call-actions">
          <button onClick={() => startCall("audio")}>
            <Phone size={20} />
          </button>
          <button onClick={() => startCall("video")}>
            <Video size={20} />
          </button>
        </div>
      </header>

      {isCalling && (
        <div className="call-container">
          <video ref={localVideoRef} autoPlay muted playsInline />
          <video ref={remoteVideoRef} autoPlay playsInline />
          <button onClick={endCall}>End Call</button>
        </div>
      )}

      <div className="chat-messages">
        {displayMessages.map((msg) => (
          <div
            key={msg._id}
            className={`chat-bubble ${
              msg.sender === myId ? "me" : "other"
            }`}
          >
            {msg.clearText || "..."}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className="chat-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type message..."
        />
        <button onClick={sendMessage}>➤</button>
      </footer>
    </div>
  );
};

export default Chat;
