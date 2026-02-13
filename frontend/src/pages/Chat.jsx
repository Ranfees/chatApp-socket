import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft } from "lucide-react";
import { encryptMessage, decryptMessage } from "../utils/crypto";

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


  const bottomRef = useRef();

  /* ⚡ LOAD LOCAL CHAT ONLY */
 useEffect(() => {
  const local = JSON.parse(localStorage.getItem("chat_" + chatKey) || "[]");

  // 🔥 Remove duplicates by _id
  const unique = Array.from(
    new Map(local.map(m => [m._id?.toString(), m])).values()
  );

  setMessages(unique);
  localStorage.setItem("chat_" + chatKey, JSON.stringify(unique));
}, [userId]);


  /* 🔥 RECEIVE MESSAGE */
  useEffect(() => {
const handleReceive = async (msg) => {
  const isMyMessage =
    (msg.sender === myId && msg.receiver === userId) ||
    (msg.sender === userId && msg.receiver === myId);

  if (!isMyMessage) return;

  try {
    const myPrivateKey = localStorage.getItem("privateKey");
    if (!myPrivateKey) return;

    let decryptedText;

    // 🔐 Choose correct encrypted key
    if (msg.receiver === myId) {
      decryptedText = await decryptMessage(
        {
          ...msg,
          encryptedKey: msg.encryptedKeyForReceiver,
        },
        myPrivateKey
      );
    } else {
      decryptedText = await decryptMessage(
        {
          ...msg,
          encryptedKey: msg.encryptedKeyForSender,
        },
        myPrivateKey
      );
    }

    const finalMessage = {
      ...msg,
      decryptedText,
    };

    setMessages((prev) => {
      if (prev.find((m) => m._id === msg._id)) return prev;

      const updated = [...prev, finalMessage];
      localStorage.setItem("chat_" + chatKey, JSON.stringify(updated));
      return updated;
    });

    if (msg.receiver === myId) {
      socket.emit("message_stored_locally", msg._id);
    }

  } catch (err) {
    console.error("Decryption failed:", err);
  }
};




    const handleStatus = ({ messageId, status }) => {
      setMessages(prev => {
        const updated = prev.map(m =>
          m._id === messageId ? { ...m, status } : m
        );
        localStorage.setItem("chat_" + chatKey, JSON.stringify(updated));
        return updated;
      });
    };

    socket.on("receive_message", handleReceive);
    socket.on("update_status", handleStatus);
    socket.on("user_typing", (uid) => uid === userId && setTypingUser(true));
    socket.on("user_stop_typing", (uid) => uid === userId && setTypingUser(false));

    return () => {
      socket.off("receive_message", handleReceive);
      socket.off("update_status", handleStatus);
      socket.off("user_typing");
      socket.off("user_stop_typing");
    };
  }, [userId, myId]);

  
  /* 📜 AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

const sendMessage = async () => {
  if (!text.trim()) return;

  try {
    const currentUser = JSON.parse(localStorage.getItem("user"));
    const myPublicKey = currentUser?.publicKey;
    const receiverPublicKey = receiver?.publicKey;

    console.log("Receiver Public Key:", receiverPublicKey);
    console.log("My Public Key:", myPublicKey);

    if (!receiverPublicKey || !myPublicKey) {
      console.error("Missing public keys");
      return;
    }

    const encrypted = await encryptMessage(
      text,
      receiverPublicKey,
      myPublicKey
    );

    socket.emit("send_message", {
      receiverId: userId,
      encryptedText: encrypted.encryptedText,
      encryptedKeyForReceiver: encrypted.encryptedKeyForReceiver,
      encryptedKeyForSender: encrypted.encryptedKeyForSender,
      iv: encrypted.iv,
    });

    socket.emit("stop_typing", userId);
    setText("");

  } catch (err) {
    console.error("Encryption failed:", err);
  }
};



  const handleTyping = (e) => {
    setText(e.target.value);
    socket.emit("typing", userId);
  };

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
        {messages.map(msg => (
          <div key={msg._id} className={`chat-bubble ${msg.sender === myId ? "me" : "other"}`}>
            {msg.decryptedText || msg.encryptedText}
            {msg.sender === myId && msg.status === "delivered" && " ✓✓"}
            {msg.sender === myId && msg.status === "seen" && " ✓✓"}
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
