import { Outlet, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../socket/socket";
import "../styles/layout.css";
import { LogOut } from "lucide-react";

const HomeLayout = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);

  /* 🧠 LOAD USERS */
  useEffect(() => {
    api.get("/api/users").then((res) => setUsers(res.data));
  }, []);

  /* 🟢 ONLINE USERS LISTENER */
  useEffect(() => {
    const handleOnlineUsers = (users) => {
      setOnlineUsers(users);
    };

    socket.on("online_users", handleOnlineUsers);

    return () => {
      socket.off("online_users", handleOnlineUsers);
    };
  }, []);

  
  const handleLogout = () => {
    socket.disconnect();
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="app-container">
      <div className="app-shell">

        {/* NAV RAIL */}
        <nav className="nav-rail">
          <div className="nav-top">
            <div className="nav-icon active">💬</div>
            {/* <div className="nav-icon">📞</div>
            <div className="nav-icon">⭕</div> */}
          </div>
          <div className="nav-bottom">
            <div className="nav-avatar-small" onClick={handleLogout}>
              <LogOut />
            </div>
          </div>
        </nav>

        {/* CHAT LIST */}
        <aside className={`sidebar ${userId ? "mobile-hidden" : ""}`}>
          <header className="sidebar-header">
            <h1>Chats</h1>
          </header>

          <div className="search-container">
            <input
              className="search-input"
              placeholder="Search or start new chat"
            />
          </div>

          <div className="chat-list">
            {users.map((user) => {
              const isOnline = onlineUsers.includes(user._id);

              return (
                <div
                  key={user._id}
                  className={`chat-item ${userId === user._id ? "active" : ""}`}
                  onClick={() => navigate(`/chat/${user._id}`)}
                >
                  <div className="chat-avatar">
                    {user.username[0].toUpperCase()}
                    {isOnline && <span className="online-dot"></span>}
                  </div>

                  <div className="chat-meta">
                    <div className="chat-row">
                      <span className="chat-name">{user.username}</span>
                      <span className="chat-time">12:45 PM</span>
                    </div>

                    {/* <div className="chat-preview">
                      {isOnline ? "🟢 Online" : "⚫ Offline"}
                    </div> */}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* MAIN CHAT */}
       <main className={`main-content ${!userId ? "mobile-hidden" : ""}`}>
          <Outlet context={{ onlineUsers,users }} />
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;
