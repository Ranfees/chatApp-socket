import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../socket/socket";
import "../styles/layout.css";
import { LogOut } from "lucide-react";
import defaultAvatar from '../assets/avatar.jpg'

const HomeLayout = () => {
  const location = useLocation();
  const isProfile = location.pathname === "/profile";
  const navigate = useNavigate();
  const { userId } = useParams();
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const currentUser = JSON.parse(localStorage.getItem("user"));
  const [search, setSearch] = useState("");

  useEffect(() => {
    api.get("/api/users").then((res) => setUsers(res.data));
  }, []);

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

    if (!date) return "Offline";

    const now = new Date();
    const last = new Date(date);

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

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      <div className="app-shell">

        <nav className="nav-rail">
          <div className="nav-top">
            <div className="nav-icon active" onClick={() => navigate("/")}>💬</div>
          </div>
          <div className="nav-bottom">

            <div className="nav-profile" onClick={() => navigate("/profile")}>
              <img
                src={
                  currentUser?.profilePic
                    ? `${currentUser.profilePic}`
                    : defaultAvatar
                }
                alt="Profile"
                className="nav-profile-img"
              />
            </div>

            <div className="nav-avatar-small logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
            </div>
          </div>
        </nav>

        <aside className={`sidebar ${(userId || isProfile) ? "mobile-hidden" : ""} ${isProfile ? "desktop-hidden" : ""}`}>
          <header className="sidebar-header">
            <h1>Chats</h1>
          </header>

          <div className="search-container">
            <input
              className="search-input"
              placeholder="Search or start new chat"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="chat-list">
            {filteredUsers.map((user) => {
              const isOnline = onlineUsers.includes(user._id);

              return (
                <div
                  key={user._id}
                  className={`chat-item ${userId === user._id ? "active" : ""}`}
                  onClick={() => navigate(`/chat/${user._id}`)}
                >
                  <div className="chat-avatar">
                    {user.profilePic ? (
                      <img
                        src={user.profilePic}
                        alt={user.username}
                        className="chat-avatar-img"
                      />
                    ) : (
                      <span className="chat-avatar-letter">
                        {user.username[0].toUpperCase()}
                      </span>
                    )}

                    {isOnline && <span className="online-dot"></span>}
                  </div>


                  <div className="chat-meta">
                    <div className="chat-row">
                      <span className="chat-name">{user.username}</span>
                      <span className="chat-time">
                        {isOnline ? "Online" : formatLastSeen(user.lastSeen)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

       <main className={`main-content ${(!userId && !isProfile) ? "mobile-hidden" : ""}`}>
          <Outlet context={{ onlineUsers, users }} />
        </main>
      </div>
    </div>
  );
};

export default HomeLayout;