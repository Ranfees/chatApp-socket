import { useEffect, useState } from "react";
import { useNavigate, Outlet } from "react-router";
import api from "../api/axios";
import "../styles/home.css";

const Home = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/api/users").then(res => setUsers(res.data));
  }, []);

  return (
    <div className="home-page">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <h2>Chats</h2>

        <input
          className="search-input"
          placeholder="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="chat-list">
          {users.map(user => (
            <div
              key={user._id}
              className="chat-item"
              onClick={() => navigate(`/home/chat/${user._id}`)}
            >
              <div className="chat-avatar">
                {user.username[0].toUpperCase()}
              </div>
              <div>
                <strong>{user.username}</strong>
                <p>Tap to chat</p>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="chat-area">
        <Outlet />
      </main>
    </div>
  );
};

export default Home;