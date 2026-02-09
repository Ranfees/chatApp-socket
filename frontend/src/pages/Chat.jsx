import { useParams } from "react-router";
import "../styles/chat.css";

const Chat = () => {
  const { userId } = useParams();

  return (
    <div className="chat-window">
      <header className="chat-header">
        <h4>User {userId}</h4>
        <span>Online</span>
      </header>

      <div className="chat-messages">
        <div className="chat-bubble other">Do we need to prepare a van?</div>
        <div className="chat-bubble me">I think that's a good idea.</div>
        <div className="chat-bubble other">Now how do we get that?</div>
        <div className="chat-bubble me">We can use my dad’s van 🚐</div>
      </div>

      <footer className="chat-input">
        <input placeholder="Type a message…" />
        <button>➤</button>
      </footer>
    </div>
  );
};

export default Chat;