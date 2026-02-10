import { useParams } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";

const Chat = () => {
  const { userId } = useParams();
  const myId = JSON.parse(localStorage.getItem("user"))?.id;

  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUser, setTypingUser] = useState(false);


  const bottomRef = useRef();

  //load history

  useEffect(() => {
    const fetchMessages = async () => {
      const res = await fetch(`http://localhost:5000/api/messages/${userId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      const data = await res.json();
      setMessages(data);
    };

    fetchMessages();
  }, [userId]);

  useEffect(() => {
    const handleReceive = (msg) => {
      if (msg.sender === userId || msg.receiver === userId) {
        setMessages((prev) => [...prev, msg]);

        if (msg.sender === userId) {
          socket.emit("message_delivered", msg._id);
          socket.emit("message_seen", msg._id);
        }
      }
    };

    const handleStatus = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === messageId ? { ...m, status } : m))
      );
    };

    const handleTyping = (uid) => {
      if (uid.toString() === userId.toString()) {
        setTypingUser(true);
      }
    };

    const handleStopTyping = (uid) => {
      if (uid.toString() === userId.toString()) {
        setTypingUser(false);
      }
    };


    socket.on("receive_message", handleReceive);
    socket.on("update_status", handleStatus);
    socket.on("user_typing", handleTyping);
    socket.on("user_stop_typing", handleStopTyping);

    return () => {
      socket.off("receive_message", handleReceive);
      socket.off("update_status", handleStatus);
      socket.off("user_typing", handleTyping);
      socket.off("user_stop_typing", handleStopTyping);
    };
  }, [userId]);

  //auto scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);


  const sendMessage = () => {
    if (!text.trim()) return;

    socket.emit("send_message", {
      receiverId: userId,
      encryptedText: text,
    });

    socket.emit("stop_typing", userId);
    setText("");
  };

  //handle typing
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
        <h4>Chat</h4>
        <span>{typingUser ? "Typing..." : "Online"}</span>

      </header>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div
            key={msg._id}
            className={`chat-bubble ${msg.sender === myId ? "me" : "other"}`}
          >
            {msg.encryptedText}
            {msg.sender === myId && msg.status === "sent" && " ✓"}
            {msg.sender === myId && msg.status === "delivered" && " ✓✓"}
            {msg.sender === myId && msg.status === "seen" && " ✓✓"}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <footer className="chat-input">
        <input
          placeholder="Type a message…"
          value={text}
          onChange={handleTyping}
        />
        <button onClick={sendMessage}>➤</button>
      </footer>
    </div>
  );
};

export default Chat;
