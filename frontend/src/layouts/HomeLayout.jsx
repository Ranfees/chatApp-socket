import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useEffect, useState } from "react";
import api from "../api/axios";
import socket from "../socket/socket";
import "../styles/layout.css";
import { LogOut, MessagesSquare, User, Phone, X, Check } from "lucide-react";
import defaultAvatar from '../assets/avatar.jpg';

const HomeLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userId } = useParams();

  const isProfile = location.pathname === "/profile";

  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [unreadCounts, setUnreadCounts] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);

  // Modal State for WebRTC
  const [incomingCall, setIncomingCall] = useState(null);

  // --- Unread Messages Logic ---
  useEffect(() => {
    const savedUnread = JSON.parse(localStorage.getItem("unreadCounts") || "{}");
    setUnreadCounts(savedUnread);
    const total = Object.values(savedUnread).reduce((sum, count) => sum + count, 0);
    setTotalUnread(total);
  }, []);

  useEffect(() => {
    localStorage.setItem("unreadCounts", JSON.stringify(unreadCounts));
    const total = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
    setTotalUnread(total);
  }, [unreadCounts]);

  const currentUser = JSON.parse(localStorage.getItem("user"));

  // --- Fetch Users ---
  useEffect(() => {
    api.get("/api/users").then((res) => setUsers(res.data));
  }, []);

  // --- Socket: Online Status ---
  useEffect(() => {
    const handleOnlineUsers = (users) => {
      setOnlineUsers(users);
    };
    socket.on("online_users", handleOnlineUsers);
    return () => {
      socket.off("online_users", handleOnlineUsers);
    };
  }, []);

  // --- Socket: Receive Messages & Update Unread ---
  useEffect(() => {
    const handleReceiveMessage = async (msg) => {
      const myId = currentUser?.id;
      if (!myId) return;

      const otherPartyId = msg.sender === myId ? msg.receiver : msg.sender;
      const chatKey = [myId, otherPartyId].sort().join("_");

      const localData = JSON.parse(localStorage.getItem("chat_" + chatKey) || "[]");

      if (!localData.find((m) => m._id === msg._id)) {
        const updated = [...localData, msg];
        localStorage.setItem("chat_" + chatKey, JSON.stringify(updated));
        window.dispatchEvent(new Event("chat_updated"));
      }

      if (msg.receiver === myId && msg.sender !== userId) {
        setUnreadCounts(prev => ({
          ...prev,
          [msg.sender]: (prev[msg.sender] || 0) + 1
        }));
      }

      if (msg.receiver === myId) {
        socket.emit("message_stored_locally", msg._id);
      }
    };

    socket.on("receive_message", handleReceiveMessage);
    return () => {
      socket.off("receive_message", handleReceiveMessage);
    };
  }, [currentUser?.id, userId]);

  // Clear unread when entering a specific chat
  useEffect(() => {
    if (userId) {
      setUnreadCounts(prev => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    }
  }, [userId]);

  // --- Global Call Handling ---
  useEffect(() => {
    const handleIncomingCallGlobal = (data) => {
      // Show modal instead of navigating automatically
      setIncomingCall(data);
    };

    const handleCallEndedGlobal = () => {
      setIncomingCall(null);
    };

    socket.on("incoming-call", handleIncomingCallGlobal);
    socket.on("call-ended", handleCallEndedGlobal);

    return () => {
      socket.off("incoming-call", handleIncomingCallGlobal);
      socket.off("call-ended", handleCallEndedGlobal);
    };
  }, []);

  const acceptCall = () => {
    const callerId = incomingCall.from;
    const callData = { ...incomingCall };
    setIncomingCall(null);
    // Navigate to chat and pass the WebRTC data via state
    navigate(`/chat/${callerId}`, { state: { autoAccept: callData } });
  };

  const declineCall = () => {
    socket.emit("end-call", { to: incomingCall.from });
    setIncomingCall(null);
  };

  // --- Formatting Helpers ---
  const formatLastSeen = (date) => {
    if (!date) return "Offline";
    const now = new Date();
    const last = new Date(date);
    if (isNaN(last.getTime()) || last.getTime() === 0) return "Offline";

    const isToday = now.toDateString() === last.toDateString();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = yesterday.toDateString() === last.toDateString();

    if (isToday) {
      return `Last seen ${last.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    if (isYesterday) return "Last seen yesterday";
    return `Last seen ${last.toLocaleDateString()}`;
  };

  const handleLogout = () => {
    socket.disconnect();
    localStorage.clear();
    navigate("/login");
  };

  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-container">
      {/* Global Call Modal Overlay */}
      {incomingCall && (
        <div className="call-modal-overlay">
          <div className="call-modal">
            <div className="call-modal-avatar pulse">
               <User size={40} />
            </div>
            <h3>Incoming {incomingCall.type} Call</h3>
            <p>{users.find(u => u._id === incomingCall.from)?.username || "Someone"} is calling...</p>
            <div className="modal-actions">
              <button className="accept-call" onClick={acceptCall}>
                <Check size={28} />
              </button>
              <button className="decline-call" onClick={declineCall}>
                <X size={28} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="app-shell">
        {/* Desktop Navigation Rail */}
        <nav className="nav-rail desktop-only">
          <div className="nav-top">
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
                src={currentUser?.profilePic || defaultAvatar}
                alt="Profile"
                className="nav-profile-img"
              />
            </div>
            <div className="nav-avatar-small logout-btn" onClick={handleLogout}>
              <LogOut size={18} />
            </div>
          </div>
        </nav>

        {/* Sidebar: Chat List */}
        <aside className={`sidebar ${userId || isProfile ? "mobile-hidden" : ""} ${isProfile ? "desktop-hidden" : ""}`}>
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
                      <img src={user.profilePic} alt={user.username} className="chat-avatar-img" />
                    ) : (
                      <span className="chat-avatar-letter">{user.username[0].toUpperCase()}</span>
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
                  {unreadCount > 0 && (
                    <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`main-content ${(!userId && !isProfile) ? "mobile-hidden" : ""}`}>
          <Outlet context={{ onlineUsers, users }} />
        </main>

        {/* Mobile Bottom Navigation */}
        {!userId && (
          <nav className="mobile-bottom-nav">
            <div className={`mobile-nav-item ${!isProfile ? "active" : ""}`} onClick={() => navigate("/")}>
              <div className="nav-badge-container">
                <MessagesSquare size={23} />
                {totalUnread > 0 && (
                  <span className="badge">{totalUnread > 99 ? '99+' : totalUnread}</span>
                )}
              </div>
            </div>
            <div className={`mobile-nav-item ${isProfile ? "active" : ""}`} onClick={() => navigate("/profile")}>
              <div className="mobile-avatar-icon">
                <User size={27} />
              </div>
            </div>
            <div className="mobile-nav-item" onClick={handleLogout}>
              <LogOut size={24} />
            </div>
          </nav>
        )}
      </div>
    </div>
  );
};

export default HomeLayout;