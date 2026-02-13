import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { registerUser } from "../api/route";
import { protectPrivateKey } from "../utils/crypto"; 
import "../styles/auth.css";
import defaultAvatar from '../assets/avatar.jpg'

const Signup = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {

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

      const pubBuf = await window.crypto.subtle.exportKey("spki", keyPair.publicKey);
      const publicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(pubBuf)));

      const privBuf = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
      const privateKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(privBuf)));

      const encryptedPrivKey = await protectPrivateKey(privateKeyBase64, form.password);

      localStorage.setItem("privateKey", privateKeyBase64);

      const formData = new FormData();
      formData.append("username", form.username);
      formData.append("email", form.email);
      formData.append("password", form.password);
      formData.append("publicKey", publicKeyBase64);
      formData.append("encryptedPrivateKey", encryptedPrivKey); 

      if (profilePic) formData.append("profilePic", profilePic);

      await registerUser(formData);
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
        <h2>Create account</h2>
        <div className="avatar-upload">
          <label htmlFor="profilePicInput"><img src={preview || defaultAvatar} className="avatar-preview" alt="avatar" /></label>
          <input id="profilePicInput" type="file" accept="image/*" hidden onChange={(e) => {
            const file = e.target.files[0];
            if (file) { setProfilePic(file); setPreview(URL.createObjectURL(file)); }
          }} />
        </div>
        <input className="auth-input" name="username" placeholder="Username" onChange={handleChange} required />
        <input className="auth-input" name="email" type="email" placeholder="Email" onChange={handleChange} required />
        <input className="auth-input" name="password" type="password" placeholder="Password" onChange={handleChange} required />
        <button className="auth-btn" disabled={loading}>{loading ? "Creating..." : "Create account"}</button>
        <div className="auth-footer">Already have an account? <Link to="/login">Sign in</Link></div>
      </form>
    </div>
  );
};

export default Signup;