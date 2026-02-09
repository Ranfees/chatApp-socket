import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { registerUser } from "../api/route";
import "../styles/auth.css";

const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    publicKey: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data } = await registerUser(form);
      localStorage.setItem("token", data.token);
      navigate("/login");
    } catch (err) {
      alert(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Create Account</h2>
        <p>Secure end-to-end encrypted chat</p>

        <input
          className="auth-input"
          name="username"
          placeholder="Username"
          value={form.username}
          onChange={handleChange}
          required
        />

        <input
          className="auth-input"
          name="email"
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <input
          className="auth-input"
          name="password"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <input
          className="auth-input"
          name="publicKey"
          placeholder="Public Encryption Key"
          value={form.publicKey}
          onChange={handleChange}
          required
        />

        <button className="auth-btn" disabled={loading}>
          {loading ? "Creating..." : "Sign Up"}
        </button>

        <div className="auth-footer">
          Already have an account?
          <Link to="/login"> Login</Link>
        </div>
      </form>
    </div>
  );
};

export default Signup;
