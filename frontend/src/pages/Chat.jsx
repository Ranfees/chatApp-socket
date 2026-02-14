import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft, Phone, Video } from "lucide-react";
import { decryptWith, encryptFor } from "../utils/crypto";
import VideoCall from "./VideoCall";

const Chat = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { users, onlineUsers } = useOutletContext();

  const userString = localStorage.getItem("user");
  const currentUser = userString ? JSON.parse(userString) : null;
  const myId = currentUser?.id;

  const receiver = users?.find((u) => u._id === userId);
  const isOnline = onlineUsers.includes(userId);

  const chatKey = [myId, userId].sort().join("_");

  const [callRole, setCallRole] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState(null);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [displayMessages, setDisplayMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(false);

  const bottomRef = useRef();

  /* =========================
     LOAD LOCAL CHAT
  ========================= */
  useEffect(() => {
    try {
      const local =
        JSON.parse(localStorage.getItem("chat_" + chatKey)) || [];

      const unique = Array.from(
        new Map(local.map((m) => [m._id, m])).values()
      );

      setMessages(unique);
      localStorage.setItem("chat_" + chatKey, JSON.stringify(unique));
    } catch {
      setMessages([]);
    }
  }, [chatKey]);

  /* =========================
     SOCKET LISTENERS
  ========================= */
  useEffect(() => {
    if (!myId) return;

    const handleReceive = (msg) => {
      const otherPartyId =
        msg.sender === myId ? msg.receiver : msg.sender;

      const targetChatKey = [myId, otherPartyId].sort().join("_");
      const isCurrentChat =
        msg.sender === userId || msg.receiver === userId;

      const localData =
        JSON.parse(localStorage.getItem("chat_" + targetChatKey)) || [];

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

    /* ---------- Incoming Call ---------- */
    const handleIncomingCall = ({ from, type, fromName }) => {
      // safety: ignore calls from other chats
      if (from !== userId) return;

      const accept = window.confirm(
        `Incoming ${type} call from ${fromName}. Accept?`
      );

      if (accept) {
        setCallRole("receiver");
        setCallType(type);
        setIsCalling(true);
      } else {
        socket.emit("end-call", { to: from });
      }
    };

    const handleCallEnded = () => {
      setIsCalling(false);
      setCallType(null);
      setCallRole(null); // ⭐ important reset
    };

    socket.on("receive_message", handleReceive);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-ended", handleCallEnded);

    return () => {
      socket.off("receive_message", handleReceive);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-ended", handleCallEnded);
    };
  }, [userId, myId]);

  /* =========================
     AUTO SCROLL
  ========================= */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, typingUser]);

  /* =========================
     START CALL
  ========================= */
  const startCall = (type) => {
    if (!isOnline) {
      alert("User is offline.");
      return;
    }

    setCallRole("caller");
    setCallType(type);
    setIsCalling(true);

    socket.emit("call-user", {
      to: userId,
      type,
      fromName: currentUser.username,
    });
  };

  /* =========================
     SEND MESSAGE
  ========================= */
  const sendMessage = async () => {
    if (!text.trim()) return;

    if (!receiver?.publicKey || !currentUser?.publicKey) {
      alert("Security keys missing.");
      return;
    }

    try {
      const encReceiver = await encryptFor(
        text,
        receiver.publicKey
      );
      const encSender = await encryptFor(
        text,
        currentUser.publicKey
      );

      socket.emit("send_message", {
        receiverId: userId,
        encReceiver,
        encSender,
      });

      socket.emit("stop_typing", userId);
      setText("");
    } catch (err) {
      console.error("Encryption failed", err);
    }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socket.emit("typing", userId);
  };

  /* =========================
     DECRYPT MESSAGES
  ========================= */
  useEffect(() => {
    const decryptAll = async () => {
      const myPrivKey = localStorage.getItem("privateKey");
      if (!myPrivKey || !messages.length) {
        setDisplayMessages([]);
        return;
      }

      const processed = await Promise.all(
        messages.map(async (msg) => {
          try {
            const textToDecrypt =
              msg.sender === myId
                ? msg.encryptedForSender || msg.encryptedText
                : msg.encryptedForReceiver || msg.encryptedText;

            if (!textToDecrypt)
              return { ...msg, clearText: "[Empty]" };

            const clearText = await decryptWith(
              textToDecrypt,
              myPrivKey
            );

            return { ...msg, clearText };
          } catch {
            return { ...msg, clearText: "[Decryption Failed]" };
          }
        })
      );

      setDisplayMessages(processed);
    };

    decryptAll();
  }, [messages, myId]);

  /* =========================
     UI
  ========================= */
  return (
    <div className="chat-window">
      {/* HEADER */}
      <header className="chat-header">
        <div className="header-left">
          <button
            className="mobile-back-btn"
            onClick={() => navigate("/")}
          >
            <ArrowLeft />
          </button>

          <div className="chat-avatar">
            {receiver?.profilePic ? (
              <img
                src={receiver.profilePic}
                alt=""
                className="chat-avatar-img"
              />
            ) : (
              <span className="chat-avatar-letter">
                {receiver?.username?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div className="header-info">
            <h4>
              {receiver?.username
                ? receiver.username.charAt(0).toUpperCase() +
                  receiver.username.slice(1)
                : "Chat"}
            </h4>
            <span className="status-text">
              {typingUser
                ? "Typing..."
                : isOnline
                ? "Online"
                : "Offline"}
            </span>
          </div>
        </div>

        <div className="call-actions">
          <button
            className="call-btn"
            onClick={() => startCall("audio")}
          >
            <Phone size={20} />
          </button>

          <button
            className="call-btn"
            onClick={() => startCall("video")}
          >
            <Video size={20} />
          </button>
        </div>
      </header>

      {/* MESSAGES */}
      <div className="chat-messages">
        {displayMessages.map((msg) => (
          <div
            key={msg._id}
            className={`chat-bubble ${
              msg.sender === myId ? "me" : "other"
            }`}
          >
            <div className="message-text">
              {msg.clearText || "..."}
            </div>

            {msg.sender === myId && (
              <div className="message-status">
                {msg.status === "seen" ||
                msg.status === "delivered"
                  ? " ✓✓"
                  : " ✓"}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* INPUT */}
      <footer className="chat-input">
        <input
          value={text}
          onChange={handleTyping}
          placeholder="Type a message…"
        />
        <button onClick={sendMessage}>➤</button>
      </footer>

      {/* VIDEO CALL */}
      {isCalling && (
        <VideoCall
          myId={myId}
          remoteUserId={userId}
          type={callType}
          role={callRole}
          onEnd={() => {
            setIsCalling(false);
            setCallType(null);
            setCallRole(null);
            socket.emit("end-call", { to: userId });
          }}
        />
      )}
    </div>
  );
};

export default Chat;
