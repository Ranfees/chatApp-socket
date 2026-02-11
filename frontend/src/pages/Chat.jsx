import { useNavigate, useOutletContext, useParams } from "react-router";
import {  useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft, User, User2Icon, UserCircle, UserCircle2Icon } from "lucide-react";

const Chat = () => {
  const navigate = useNavigate()
  const { userId } = useParams();
  const myId = JSON.parse(localStorage.getItem("user"))?.id;

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const { users } = useOutletContext(); 
  const receiver = users.find((u) => u._id === userId);

  const bottomRef = useRef();
  console.log(typingUser)
  useEffect(() => {
    const local = JSON.parse(localStorage.getItem("chat_" + userId) || "[]");
    setMessages(local);

    const lastTime = local.length ? local[local.length - 1].createdAt : null;

    fetch(`http://localhost:5000/api/messages/${userId}?after=${lastTime || ""}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then(res => res.json())
      .then(newMsgs => {
        if (newMsgs.length) {
          const updated = [...local, ...newMsgs];
          setMessages(updated);
          localStorage.setItem("chat_" + userId, JSON.stringify(updated));
        }
      });
  }, [userId]);

  useEffect(() => {
    socket.on("online_users", (users) => {
      setIsOnline(users.includes(userId));
    });

    return () => socket.off("online_users");
  }, [userId]);

  useEffect(() => {
    const handleReceive = (msg) => {
      if (msg.sender === userId || msg.receiver === userId) {
        setMessages(prev => {
          const updated = [...prev, msg];
          localStorage.setItem("chat_" + userId, JSON.stringify(updated));
          return updated;
        });

        if (msg.sender === userId) {
          socket.emit("message_delivered", msg._id);
          socket.emit("message_seen", msg._id);
        }
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
  }, [userId]);

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

    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket.emit("stop_typing", userId);
    }, 1000);
  };
  

  return (
    <div className="chat-window">
      <header className="chat-header">
        <button className="mobile-back-btn " onClick={() => navigate('/')}>
          <ArrowLeft/>
        </button>
         <div className="chat-avatar">
                {receiver?.username.charAt(0).toUpperCase()}
              </div>
        <h4>{receiver ? receiver.username.charAt(0).toUpperCase()+ receiver.username.slice(1) : "Chat"}</h4>
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