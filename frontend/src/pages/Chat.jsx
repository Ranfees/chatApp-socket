import { useNavigate, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft } from "lucide-react";

const Chat = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const myId = JSON.parse(localStorage.getItem("user"))?.id;

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const bottomRef = useRef();

  /* =======================================================
     ⚡ LOAD LOCAL + FETCH ONLY NEW MESSAGES
  ======================================================= */
  useEffect(() => {
    const local = JSON.parse(localStorage.getItem("chat_" + userId) || "[]");
    setMessages(local);

    const lastId = local.length ? local[local.length - 1]._id : "";

    fetch(`http://localhost:5000/api/messages/${userId}?lastId=${lastId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(res => res.json())
      .then(newMsgs => {
        if (!newMsgs.length) return;

        setMessages(prev => {
          const updated = [...prev, ...newMsgs];
          localStorage.setItem("chat_" + userId, JSON.stringify(updated));
          return updated;
        });
      })
      .catch(() => {}); // fail silently
  }, [userId]);

  /* =======================================================
     🟢 ONLINE STATUS
  ======================================================= */
  useEffect(() => {
    const handleOnline = (users) => setIsOnline(users.includes(userId));
    socket.on("online_users", handleOnline);
    return () => socket.off("online_users", handleOnline);
  }, [userId]);

  /* =======================================================
     📩 RECEIVE MESSAGES (REALTIME)
  ======================================================= */
  useEffect(() => {
    const handleReceive = (msg) => {
      if (msg.sender !== userId && msg.receiver !== userId) return;

      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;

        const updated = [...prev, msg];
        localStorage.setItem("chat_" + userId, JSON.stringify(updated));
        return updated;
      });

      // If I am receiver, confirm delivery
      if (msg.receiver === myId) {
        socket.emit("message_delivered", msg._id);
        socket.emit("message_seen", msg._id);
      }
    };

    const handleStatus = ({ messageId, status }) => {
      setMessages(prev => {
        const updated = prev.map(m =>
          m._id === messageId ? { ...m, status } : m
        );
        localStorage.setItem("chat_" + userId, JSON.stringify(updated));
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

  /* =======================================================
     📜 AUTO SCROLL
  ======================================================= */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  /* =======================================================
     ✉ SEND MESSAGE
  ======================================================= */
  const sendMessage = () => {
    if (!text.trim()) return;

    socket.emit("send_message", { receiverId: userId, encryptedText: text });
    socket.emit("stop_typing", userId);
    setText("");
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    socket.emit("typing", userId);

    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket.emit("stop_typing", userId);
    }, 1000);
  };

  return (
    <div className="chat-window">
      <header className="chat-header">
        <button className="mobile-back-btn" onClick={() => navigate("/")}>
          <ArrowLeft />
        </button>
        <h4>Chat</h4>
        <span>{typingUser ? "Typing..." : isOnline ? "Online" : "Offline"}</span>
      </header>

      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg._id} className={`chat-bubble ${msg.sender === myId ? "me" : "other"}`}>
            {msg.encryptedText}
            {msg.sender === myId && msg.status === "sent" && " ✓"}
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
