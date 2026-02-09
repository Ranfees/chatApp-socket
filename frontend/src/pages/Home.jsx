import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import api from "../api/axios";

const Home = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/login");
  }, [navigate]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const { data } = await api.get("/api/users");
        setUsers(data);
      } catch (err) {
        console.error(err.response?.data?.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  if (loading) return <div style={styles.center}><h2>Loading stylishly...</h2></div>;

  return (
    <div style={styles.container}>
      {/* Header Section */}
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Messages</h1>
          <p style={styles.subtitle}>Connect with your team</p>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </header>

      {/* User List */}
      <div style={styles.listContainer}>
        {users.length === 0 ? (
          <p style={styles.emptyState}>No users online yet.</p>
        ) : (
          users.map((user) => (
            <div
              key={user._id}
              onMouseEnter={() => setHoveredId(user._id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => alert(`Opening chat with ${user.username}...`)}
              style={{
                ...styles.userCard,
                ...(hoveredId === user._id ? styles.userCardHover : {}),
              }}
            >
              <div style={styles.avatar}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div style={styles.userInfo}>
                <span style={styles.userName}>{user.username}</span>
                <span style={styles.userEmail}>{user.email}</span>
              </div>
              <div style={styles.statusIndicator} />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- Styles Object ---
const styles = {
  container: {
    maxWidth: "600px",
    margin: "40px auto",
    padding: "20px",
    fontFamily: "'Inter', system-ui, sans-serif",
    backgroundColor: "#f8f9fa",
    borderRadius: "24px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
    minHeight: "80vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
    paddingBottom: "20px",
    borderBottom: "1px solid #eee",
  },
  title: {
    fontSize: "28px",
    fontWeight: "800",
    margin: 0,
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: "14px",
    color: "#888",
    margin: "4px 0 0 0",
  },
  logoutBtn: {
    padding: "10px 20px",
    background: "#fff",
    color: "#ff4d4d",
    border: "1px solid #ff4d4d",
    borderRadius: "12px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  listContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  userCard: {
    display: "flex",
    alignItems: "center",
    padding: "16px",
    backgroundColor: "#fff",
    borderRadius: "16px",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
    border: "1px solid transparent",
  },
  userCardHover: {
    transform: "translateY(-2px)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
    borderColor: "#e0e0e0",
  },
  avatar: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #6e8efb, #a777e3)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "bold",
    marginRight: "15px",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
  },
  userName: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#333",
  },
  userEmail: {
    fontSize: "13px",
    color: "#999",
  },
  statusIndicator: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    backgroundColor: "#4cd137",
    marginLeft: "10px",
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh",
    color: "#666",
  },
  emptyState: {
    textAlign: "center",
    color: "#aaa",
    marginTop: "40px",
  }
};

export default Home;