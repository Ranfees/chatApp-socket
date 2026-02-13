import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { registerUser } from "../api/route";
import "../styles/auth.css";
import defaultAvatar from "../assets/avatar.jpg";

const Signup = () => {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  // 🔐 Safe ArrayBuffer → Base64
  const bufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return window.btoa(binary);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // ==========================
      // 1️⃣ Generate RSA Key Pair
      // ==========================
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

      // ==========================
      // 2️⃣ Export Public Key
      // ==========================
      const publicKeyBuffer = await window.crypto.subtle.exportKey(
        "spki",
        keyPair.publicKey
      );

      const publicKeyBase64 = bufferToBase64(publicKeyBuffer);

      // ==========================
      // 3️⃣ Export Private Key
      // ==========================
      const privateKeyBuffer = await window.crypto.subtle.exportKey(
        "pkcs8",
        keyPair.privateKey
      );

      const privateKeyBase64 = bufferToBase64(privateKeyBuffer);

      // ⚠️ Store private key locally ONLY
      localStorage.setItem("privateKey", privateKeyBase64);

      // ==========================
      // 4️⃣ Send Registration Data
      // ==========================
      const formData = new FormData();
      formData.append("username", form.username);
      formData.append("email", form.email);
      formData.append("password", form.password);
      formData.append("publicKey", publicKeyBase64);

      if (profilePic) {
        formData.append("profilePic", profilePic);
      }

      const { data } = await registerUser(formData);

      // Store token only (private key already stored)
      localStorage.setItem("token", data.token);

      navigate("/login");

    } catch (err) {
      console.error("Signup error:", err);
      alert(err.response?.data?.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-glow" />

      <form
        className="auth-card"
        method="post"
        onSubmit={handleSubmit}
        encType="multipart/form-data"
      >
        <h2>Create account</h2>
        <p>Secure end-to-end encrypted chat</p>

        {/* Avatar Upload */}
        <div className="avatar-upload">
          <label htmlFor="profilePicInput" className="avatar-label">
            <img
              src={preview || defaultAvatar}
              alt="Profile"
              className="avatar-preview"
            />
            <div className="avatar-overlay">Change</div>
          </label>

          <input
            id="profilePicInput"
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                setProfilePic(file);
                setPreview(URL.createObjectURL(file));
              }
            }}
          />
        </div>

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
          {loading ? "Generating keys..." : "Create account"}
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
