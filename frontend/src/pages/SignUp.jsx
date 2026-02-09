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
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    // 1️⃣ Generate RSA key pair
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"]
    );

    // 2️⃣ Export public key (send to server)
    const publicKeyBuffer = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );
    const publicKeyBase64 = btoa(
      String.fromCharCode(...new Uint8Array(publicKeyBuffer))
    );

    // 3️⃣ Export private key (store in browser)
    const privateKeyBuffer = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );
    const privateKeyBase64 = btoa(
      String.fromCharCode(...new Uint8Array(privateKeyBuffer))
    );

    localStorage.setItem("privateKey", privateKeyBase64);

    // 4️⃣ Send to backend
    const { data } = await registerUser({
      username: form.username,
      email: form.email,
      password: form.password,
      publicKey: publicKeyBase64,
    });

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
