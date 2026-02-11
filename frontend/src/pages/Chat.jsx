import { useNavigate, useOutletContext, useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft } from "lucide-react";

const Chat = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { users } = useOutletContext(); // from layout
  const myId = JSON.parse(localStorage.getItem("user"))?.id;

  const receiver = users?.find((u) => u._id === userId);

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  const bottomRef = useRef();

  /* ⚡ LOAD LOCAL CHAT ONLY */
  useEffect(() => {
    const local = JSON.parse(localStorage.getItem("chat_" + userId) || "[]");
    setMessages(local);
  }, [userId]);

  /* 🟢 ONLINE STATUS */
  useEffect(() => {
    const handleOnline = (onlineList) => setIsOnline(onlineList.includes(userId));
    socket.on("online_users", handleOnline);
    return () => socket.off("online_users", handleOnline);
  }, [userId]);

  /* 🔥 RECEIVE MESSAGE */
  useEffect(() => {
    const handleReceive = (msg) => {
      if (msg.sender !== userId && msg.receiver !== userId) return;

      setMessages(prev => {
        if (prev.some(m => m._id === msg._id)) return prev;

        const updated = [...prev, msg];
        localStorage.setItem("chat_" + userId, JSON.stringify(updated));
        return updated;
      });

      // Confirm local save to server (for offline → online sync)
      if (msg.receiver === myId) {
        socket.emit("message_stored_locally", msg._id);
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

  /* 📜 AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  const sendMessage = () => {
    if (!text.trim()) return;
    socket.emit("send_message", { receiverId: userId, encryptedText: text });
    socket.emit("stop_typing", userId);
    setText("");
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
          {receiver?.username?.charAt(0).toUpperCase()}
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
            {msg.encryptedText}
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
