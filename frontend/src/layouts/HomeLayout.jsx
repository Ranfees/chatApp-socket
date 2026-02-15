import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../socket/socket";
import "../styles/layout.css";
import { LogOut, MessagesSquare, User } from "lucide-react";
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
  const [unreadCounts, setUnreadCounts] = useState({}); // Track unread per user
  const [totalUnread, setTotalUnread] = useState(0);

  // Load unread counts from localStorage on mount
  useEffect(() => {
    const savedUnread = JSON.parse(localStorage.getItem("unreadCounts") || "{}");
    setUnreadCounts(savedUnread);
    const total = Object.values(savedUnread).reduce((sum, count) => sum + count, 0);
    setTotalUnread(total);
  }, []);

  // Save unread counts to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("unreadCounts", JSON.stringify(unreadCounts));
    const total = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    setTotalUnread(total);
  }, [unreadCounts]);


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

  useEffect(() => {
    const handleReceiveMessage = (msg) => {
      // Only count unread if it's for current user and NOT in the current chat
      if (msg.receiver === currentUser?.id && msg.sender !== userId) {
        setUnreadCounts(prev => {
          const updated = { ...prev };
          updated[msg.sender] = (updated[msg.sender] || 0) + 1;
          return updated;
        });
      }
    };

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [currentUser?.id, userId]);

  // Clear unread count when user opens a chat
  useEffect(() => {
    if (userId) {
      setUnreadCounts(prev => {
        const updated = { ...prev };
        delete updated[userId]; // Remove unread count for this user
        return updated;
      });
    }
  }, [userId]);

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
    localStorage.removeItem("unreadCounts");
    navigate("/login");
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      <div className="app-shell">

        <nav className="nav-rail desktop-only">
          <div className="nav-top">
            {/* WRAP IN CONTAINER FOR BADGE POSITIONING */}
            <div className="nav-icon-container" onClick={() => navigate("/")}>
              <div className="nav-icon active">💬</div>
              {totalUnread > 0 && (
                <span className="nav-badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
              )}
            </div>
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
               const unreadCount = unreadCounts[user._id] || 0;

              return (
                <div
                  key={user._id}
                  className={`chat-item ${userId === user._id ? "active" : ""} ${unreadCount > 0 ? "has-unread" : ""}`}
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
                      <span className={`chat-name ${unreadCount > 0 ? "unread-text" : ""}`}>{user.username}</span>
                      <span className="chat-time">
                        {isOnline ? "Online" : formatLastSeen(user.lastSeen)}
                      </span>
                    </div>
                  </div>
                  {/* Show unread badge in sidebar */}
                  {unreadCount > 0 && (
                    <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </div>
              );
            })}
          </div>


        </aside>

        <main className={`main-content ${(!userId && !isProfile) ? "mobile-hidden" : ""}`}>
          <Outlet context={{ onlineUsers, users }} />
        </main>

        {/* 2. Mobile Bottom Tab Bar (Visible only on mobile "/" route) */}
        {!userId && (
          <nav className="mobile-bottom-nav">
            <div className={`mobile-nav-item ${!isProfile ? "active" : ""}`} onClick={() => navigate("/")}>
              <div className="nav-badge-container">
                {/* 💬 */}
                <MessagesSquare size={23} />
                {/* Show total unread badge */}
                {totalUnread > 0 && (
                  <span className="badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
                )}                </div>
              {/* <span>Chats</span> */}
            </div>
            <div className={`mobile-nav-item ${isProfile ? "active" : ""}`} onClick={() => navigate("/profile")}>
              <div className="mobile-avatar-icon">
                {/* <img src={currentUser?.profilePic || defaultAvatar} alt="Me" /> */}
                <User size={27} />
              </div>
              {/* <span>Profile</span> */}
            </div>
            <div className="mobile-nav-item" onClick={handleLogout}>
              <LogOut size={24} />
              {/* <span>Logout</span> */}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

export default HomeLayout;