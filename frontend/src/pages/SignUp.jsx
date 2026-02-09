import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { registerUser } from "../api/route";
import "../styles/auth.css";

const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

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
      <div className="auth-glow" />

      <form className="auth-card" onSubmit={handleSubmit}>
        <h2>Create account</h2>
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
          placeholder="Email address"
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

        <button className="auth-btn" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>

        <div className="auth-footer">
          Already have an account?
          <Link to="/login"> Sign in</Link>
        </div>
      </form>
    </div>
  );
};

export default Signup;