import { Outlet, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import api from "../api/axios";
import "../styles/layout.css";
import { LogOut } from 'lucide-react';

const HomeLayout = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    api.get("/api/users").then(res => setUsers(res.data));
  }, []);
  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };
  return (
    <div className="app-container">
      <div className="app-shell">
        {/* 1. ICON NAVIGATION BAR (WhatsApp Web Style) */}
        <nav className="nav-rail">
          <div className="nav-top">
            <div className="nav-icon active">💬</div>
            <div className="nav-icon">📞</div>
            <div className="nav-icon">⭕</div>
          </div>
          <div className="nav-bottom">
            {/* <div className="nav-icon">⚙️</div> */}
            <div className="nav-avatar-small" onClick={handleLogout}><LogOut/></div>
          </div>
        </nav>

        {/* 2. CHAT LIST SIDEBAR */}
        <aside className="sidebar">
          <header className="sidebar-header">
            <h1>Chats</h1>
            {/* <div className="header-actions">
              <button className="icon-btn">➕</button>
              <button className="icon-btn">⋮</button>
            </div> */}
          </header>

          <div className="search-container">
            <input className="search-input" placeholder="Search or start new chat" />
          </div>

          <div className="chat-list">
            {users.map(user => (
              <div
                key={user._id}
                className={`chat-item ${userId === user._id ? 'active' : ''}`}
                onClick={() => navigate(`/chat/${user._id}`)}
              >
                <div className="chat-avatar">
                  {user.username[0].toUpperCase()}
                </div>
                <div className="chat-meta">
                  <div className="chat-row">
                    <span className="chat-name">{user.username}</span>
                    <span className="chat-time">12:45 PM</span>
                  </div>
                  <div className="chat-preview">Tap to start conversation...</div>
                </div>
              </div>
            ))}
          </div>
         
        </aside>

        {/* 3. MAIN CHAT AREA */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;