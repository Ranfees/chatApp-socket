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

  const formatLastSeen = (date) => {
    // 1. Check if date is missing or null
    if (!date) return "Offline";

    const now = new Date();
    const last = new Date(date);

    // 2. Check if the date is invalid (e.g., "0" or invalid string)
    if (isNaN(last.getTime()) || last.getTime() === 0) {
      return "Offline";
    }

    const isToday = now.toDateString() === last.toDateString();

    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    const isYesterday = yesterday.toDateString() === last.toDateString();

    if (isToday) {
      return `Last seen ${last.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }

    if (isYesterday) return "Last seen yesterday";

    return `Last seen ${last.toLocaleDateString()}`;
  };


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
                      <span className="chat-time">
                        {isOnline ? "Online" : formatLastSeen(user.lastSeen)}
                      </span>

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
          <Outlet context={{ onlineUsers, users }} />
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;