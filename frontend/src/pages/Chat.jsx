import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft, Phone, Video, MoreVertical, User as UserIcon } from "lucide-react"; // Added icons
import { decryptWith, encryptFor } from "../utils/crypto";
import VideoCall from "./VideoCall"; // Make sure to create this file

const Chat = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { users, onlineUsers } = useOutletContext();

  // Call States
  const [isCalling, setIsCalling] = useState(false);
  const [callType, setCallType] = useState(null);

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

  const [showMenu, setShowMenu] = useState(false);

  const bottomRef = useRef();

  /* LOAD LOCAL CHAT */
  useEffect(() => {
    const local = JSON.parse(localStorage.getItem("chat_" + chatKey) || "[]");
    const unique = Array.from(
      new Map(local.map(m => [m._id?.toString(), m])).values()
    );
    setMessages(unique);
    localStorage.setItem("chat_" + chatKey, JSON.stringify(unique));

    // NEW: Mark this user's unread messages as read when entering chat
    const unreadCounts = JSON.parse(localStorage.getItem("unreadCounts") || "{}");
    if (unreadCounts[userId]) {
      delete unreadCounts[userId];
      localStorage.setItem("unreadCounts", JSON.stringify(unreadCounts));
    }
  }, [userId, chatKey]);

  /* SOCKET LISTENERS (Messages & Calls) */
  useEffect(() => {
    const handleReceive = (msg) => {
      const otherPartyId = msg.sender === myId ? msg.receiver : msg.sender;
      const targetChatKey = [myId, otherPartyId].sort().join("_");
      const isCurrentChat = (msg.sender === userId || msg.receiver === userId);

      const localData = JSON.parse(localStorage.getItem("chat_" + targetChatKey) || "[]");
      if (!localData.find(m => m._id === msg._id)) {
        const updatedLocal = [...localData, msg];
        localStorage.setItem("chat_" + targetChatKey, JSON.stringify(updatedLocal));
      }

      if (isCurrentChat) {
        setMessages(prev => {
          if (prev.find(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }

      if (msg.receiver === myId) {
        socket.emit("message_stored_locally", msg._id);
      }
    };

    const handleIncomingCall = ({ from, type, fromName }) => {
      const accept = window.confirm(`Incoming ${type} call from ${fromName}. Accept?`);
      if (accept) {
        // This click interaction is crucial for audio to play
        setCallType(type);
        setIsCalling(true);
      } else {
        socket.emit("end-call", { to: from });
      }
    };

    socket.on("receive_message", handleReceive);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-ended", () => {
      setIsCalling(false);
      setCallType(null);
    });

    return () => {
      socket.off("receive_message", handleReceive);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-ended");
    };
  }, [userId, myId]);

  /* AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  /* CALL FUNCTIONS */
  const startCall = (type) => {
    if (!isOnline) {
      alert("User is offline and cannot be called.");
      return;
    }
    setCallType(type);
    setIsCalling(true);
    socket.emit("call-user", {
      to: userId,
      type,
      fromName: currentUser?.username || "Someone"
    });
  };

  /* MESSAGE FUNCTIONS */
  const sendMessage = async () => {
    if (!text.trim()) return;
    const myPubKey = currentUser?.publicKey;

    if (!receiver?.publicKey || !myPubKey) {
      alert("Security keys missing. Cannot send encrypted message.");
      return;
    }

    try {
      const encReceiver = await encryptFor(text, receiver.publicKey);
      const encSender = await encryptFor(text, myPubKey);

      socket.emit("send_message", {
        receiverId: userId,
        encReceiver,
        encSender
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

  /* DECRYPTION LOGIC */
  useEffect(() => {
    const decryptAll = async () => {
      const myPrivKey = localStorage.getItem("privateKey");
      if (!userString || !myPrivKey) return;

      const processed = await Promise.all(messages.map(async (msg) => {
        try {
          let textToDecrypt = (msg.sender === myId)
            ? (msg.encryptedForSender || msg.encryptedText)
            : (msg.encryptedForReceiver || msg.encryptedText);

          if (!textToDecrypt) return { ...msg, clearText: "[Empty]" };
          const clearText = await decryptWith(textToDecrypt, myPrivKey);
          return { ...msg, clearText };
        } catch (err) {
          return { ...msg, clearText: "[Decryption Failed]" };
        }
      }));
      setDisplayMessages(processed);
    };

    if (messages.length > 0) decryptAll();
    else setDisplayMessages([]);
  }, [messages]);

  const handleLogout = () => {
    socket.disconnect();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("unreadCounts");
    navigate("/login");
  };

  return (
    <div className="chat-window">
      <header className="chat-header">
        <div className="header-left">
          <button className="mobile-back-btn" onClick={() => navigate("/")}>
            <ArrowLeft />
          </button>

          <div className="chat-avatar">
            {receiver?.profilePic ? (
              <img src={receiver.profilePic} alt="" className="chat-avatar-img" />
            ) : (
              <span className="chat-avatar-letter">{receiver?.username?.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="header-info">
            <h4>{receiver?.username ? receiver.username.charAt(0).toUpperCase() + receiver.username.slice(1) : "Chat"}</h4>
            <span className="status-text">{typingUser ? "Typing..." : isOnline ? "Online" : "Offline"}</span>
          </div>
        </div>

        {/* Ensure this div is OUTSIDE header-left but INSIDE chat-header */}
        <div className="call-actions">
          <button className="call-btn" onClick={() => startCall('audio')}>
            <Phone size={20} />
          </button>
          <button className="call-btn" onClick={() => startCall('video')}>
            <Video size={20} />
          </button>

          <div className="menu-container">
            <button className="menu-trigger" onClick={() => setShowMenu(!showMenu)}>
              <MoreVertical size={20} />
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                <div className="menu-item" onClick={() => navigate("/")}>Chats</div>
                <div className="menu-item" onClick={() => navigate("/profile")}>Profile</div>
                <div className="menu-item logout" onClick={handleLogout}>Logout</div>
              </div>
            )}
          </div>
        </div>

      </header>

      <div className="chat-messages">
        {displayMessages.map((msg) => (
          <div key={msg._id || Math.random()} className={`chat-bubble ${msg.sender === myId ? "me" : "other"}`}>
            <div className="message-text">{msg.clearText || "..."}</div>
            {msg.sender === myId && <div className="message-status">{msg.status === "seen" || msg.status === "delivered" ? " ✓✓" : " ✓"}</div>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className="chat-input">
        <input value={text} onChange={handleTyping} placeholder="Type a message…" onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
        <button onClick={sendMessage}>➤</button>
      </footer>

      {/* CALL OVERLAY */}
      {isCalling && (
        <VideoCall
          myId={myId}
          remoteUserId={userId}
          type={callType}
          onEnd={() => {
            setIsCalling(false);
            setCallType(null);
            socket.emit("end-call", { to: userId });
          }}
        />
      )}
    </div>
  );
};

export default Chat;