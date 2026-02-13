import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft } from "lucide-react";
import { decryptWith, encryptFor } from "../utils/crypto";

const Chat = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { users, onlineUsers } = useOutletContext();

  const myId = JSON.parse(localStorage.getItem("user"))?.id;

  const chatKey = [myId, userId].sort().join("_");

  const receiver = users?.find((u) => u._id === userId);

  const isOnline = onlineUsers.includes(userId);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(false);
  const [displayMessages, setDisplayMessages] = useState([]);

  const bottomRef = useRef();

  /*  LOAD LOCAL CHAT ONLY */
  useEffect(() => {
    const local = JSON.parse(localStorage.getItem("chat_" + chatKey) || "[]");

    //  Remove duplicates by _id
    const unique = Array.from(
      new Map(local.map(m => [m._id?.toString(), m])).values()
    );

    setMessages(unique);
    localStorage.setItem("chat_" + chatKey, JSON.stringify(unique));
  }, [userId, chatKey]);



useEffect(() => {
  const handleReceive = (msg) => {
    // Determine the chat key for this incoming message
    const otherPartyId = msg.sender === myId ? msg.receiver : msg.sender;
    const targetChatKey = [myId, otherPartyId].sort().join("_");

    // 1. Perspective check: Is this message for the chat I'm looking at?
    const isCurrentChat = (msg.sender === userId || msg.receiver === userId);

    // 2. Update Local Storage for persistence
    const localData = JSON.parse(localStorage.getItem("chat_" + targetChatKey) || "[]");
    if (!localData.find(m => m._id === msg._id)) {
      const updatedLocal = [...localData, msg];
      localStorage.setItem("chat_" + targetChatKey, JSON.stringify(updatedLocal));
    }

    // 3. CRITICAL: Update state if it's the current active chat
    if (isCurrentChat) {
      setMessages(prev => {
        // Avoid duplicates if the socket fires twice
        if (prev.find(m => m._id === msg._id)) return prev;
        return [...prev, msg];
      });
    }

    // 4. Send Ack if I am the receiver
    if (msg.receiver === myId) {
      socket.emit("message_stored_locally", msg._id);
    }
  };

  socket.on("receive_message", handleReceive);
  // ... rest of your listeners
  
  return () => {
    socket.off("receive_message", handleReceive);
    // ... rest of your cleanups
  };
}, [userId, myId]); // Ensure these are in the dependency array

  /*  AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const sendMessage = async () => {
    if (!text.trim()) return;

    // 1. Get current user data safely
    const userData = JSON.parse(localStorage.getItem("user"));
    const myPubKey = userData?.publicKey;

    // 2. Validate keys exist before calling crypto functions
    if (!receiver?.publicKey) {
      console.error("Receiver public key is missing");
      return;
    }

    if (!myPubKey) {
      console.error("Sender (your) public key is missing from local storage");
      return;
    }

    try {

      // Encrypt twice: once for them, once for me
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
      alert("Could not encrypt message. Security keys may be invalid.");
    }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socket.emit("typing", userId);
  };

  useEffect(() => {
    const decryptAll = async () => {
      const myPrivKey = localStorage.getItem("privateKey");
      const userString = localStorage.getItem("user");
      if (!userString || !myPrivKey) return;

      const myId = JSON.parse(userString).id;

      const processed = await Promise.all(messages.map(async (msg) => {
        try {
          // PRODUCTION FIX: Handle transition from old 'encryptedText' to new fields
          let textToDecrypt = "";

          if (msg.encryptedForSender || msg.encryptedForReceiver) {
            textToDecrypt = (msg.sender === myId)
              ? msg.encryptedForSender
              : msg.encryptedForReceiver;
          } else {
            // Fallback for legacy messages if you want to keep them visible (they will look scrambled)
            textToDecrypt = msg.encryptedText || "";
          }

          if (!textToDecrypt) return { ...msg, clearText: "[Empty Message]" };

          const clearText = await decryptWith(textToDecrypt, myPrivKey);
          return { ...msg, clearText };
        } catch (err) {
          return { ...msg, clearText: "[Decryption Failed]" };
        }
      }));
      setDisplayMessages(processed);
    };

    if (messages.length > 0) {
      decryptAll();
    } else {
      setDisplayMessages([]); // Clear if no messages
    }
  }, [messages]);

  return (
    <div className="chat-window">
      <header className="chat-header">
        <button className="mobile-back-btn" onClick={() => navigate("/")}>
          <ArrowLeft />
        </button>

        <div className="chat-avatar">
          {receiver?.profilePic ? (
            <img
              src={receiver.profilePic}
              alt={receiver.username}
              className="chat-avatar-img"
            />
          ) : (
            <span className="chat-avatar-letter">
              {receiver?.username?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>


        <h4>
          {receiver
            ? receiver.username.charAt(0).toUpperCase() + receiver.username.slice(1)
            : "Chat"}
        </h4>

        <span>{typingUser ? "Typing..." : isOnline ? "Online" : "Offline"}</span>
      </header>

      <div className="chat-messages">
        {displayMessages.map((msg) => (
          <div key={msg._id || Math.random()} className={`chat-bubble ${msg.sender === myId ? "me" : "other"}`}>
            <div className="message-text">
              {msg.clearText || "..."}
            </div>
            <div className="message-status">
              {msg.sender === myId && msg.status === "delivered" && " ✓✓"}
              {msg.sender === myId && msg.status === "seen" && " ✓✓"}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className="chat-input">
        <input value={text} onChange={handleTyping} placeholder="Type a message…" />
        <button onClick={sendMessage}>➤</button>
      </footer>
    </div>
  );
};

export default Chat;