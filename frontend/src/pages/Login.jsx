import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { loginUser } from "../api/route";
import { unlockPrivateKey } from "../utils/crypto"; // Import the unlock function
import socket from "../socket/socket";
import "../styles/auth.css";

const Login = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await loginUser(form);

      // 1. UNLOCK the private key using the password from the login form
      if (data.encryptedPrivateKey) {
        try {
          const decryptedPrivKey = await unlockPrivateKey(data.encryptedPrivateKey, form.password);
          localStorage.setItem("privateKey", decryptedPrivKey);
        } catch (cryptoErr) {
          console.error("Decryption failed:", cryptoErr);
          alert("Security Error: Could not recover your chat keys.");
          return;
        }
      }

      // 2. Standard Login Procedure
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify({
        id: data._id,
        username: data.username,
        email: data.email,
        publicKey: data.publicKey,
        profilePic: data.profilePic,
        createdAt: data.createdAt,
      }));

      socket.auth = { token: data.token };
      socket.connect();
      navigate("/");
    } catch (err) {
      alert(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Welcome Back</h2>
        <input className="auth-input" name="email" type="email" placeholder="Email" value={form.email} onChange={handleChange} required />
        <input className="auth-input" name="password" type="password" placeholder="Password" value={form.password} onChange={handleChange} required />
        <button className="auth-btn" disabled={loading}>{loading ? "Logging in..." : "Login"}</button>
        <div className="auth-footer">Don’t have an account? <Link to="/signup"> Sign up</Link></div>
      </form>
    </div>
  );
};

export default Login;