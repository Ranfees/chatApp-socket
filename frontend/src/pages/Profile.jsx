import { useState, useEffect } from "react";
import defaultAvatar from "../assets/avatar.jpg";
import { Edit2, Copy, Smartphone, User, Info } from "lucide-react";
import "../styles/profile.css";
import api from "../api/axios";

const Profile = () => {
    const [user, setUser] = useState(JSON.parse(localStorage.getItem("user")));
    const [preview, setPreview] = useState(user?.profilePic || "");
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(user?.username || "");
    const [isEditingEmail, setIsEditingEmail] = useState(false);
    const [newEmail, setNewEmail] = useState(user?.email || "");

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem("user"));
        if (storedUser) {
            setUser(storedUser);
            setPreview(storedUser.profilePic);
        }
    }, []);

    const handleSaveName = async () => {
        try {
            const res = await api.put("/api/users/update-name", {
                username: newName,
            });

            const updatedUser = { ...user, username: res.data.username };

            localStorage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);
            setIsEditing(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSaveEmail = async () => {
        try {
            const res = await api.put("/api/users/update-email", {
                email: newEmail,
            });

            const updatedUser = { ...user, email: res.data.email };

            localStorage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);
            setIsEditingEmail(false);
        } catch (err) {
            console.error(err);
        }
    };

    const handleImageChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const formData = new FormData();
            formData.append("profilePic", file);

            const res = await api.put("/api/users/update-profile-pic", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            const updatedUser = {
                ...user,
                profilePic: res.data.profilePic,
            };

            localStorage.setItem("user", JSON.stringify(updatedUser));
            setUser(updatedUser);
            setPreview(res.data.profilePic);
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="profile-page-wrapper">
            <div className="profile-details-sidebar">
                <h2 className="profile-header-title">Profile</h2>

                <div className="profile-avatar-center">
                    <label htmlFor="profile-upload" className="profile-img-container">
                        <img src={preview || defaultAvatar} alt="Profile" />
                        <div className="img-overlay">
                            <span>CHANGE PHOTO</span>
                        </div>
                    </label>
                    <input id="profile-upload" type="file" hidden onChange={handleImageChange} />
                </div>

                <div className="info-section">
                    <label><User size={14} /> Name</label>
                    <div className="info-row">
                        {isEditing ? (
                            <>
                                <input
                                    className="edit-input"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                                />
                                <button className="save-btn" onClick={handleSaveName}>
                                    Save
                                </button>
                            </>
                        ) : (
                            <>
                                <span>{user?.username || "Guest"}</span>
                                <Edit2
                                    size={16}
                                    className="edit-icon"
                                    onClick={() => setIsEditing(true)}
                                />
                            </>
                        )}
                    </div>

                </div>

                <div className="info-section">
                    <label><Smartphone size={14} /> Email</label>

                    <div className="info-row">
                        {isEditingEmail ? (
                            <>
                                <input
                                    className="edit-input"
                                    value={newEmail}
                                    onChange={(e) => setNewEmail(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSaveEmail()}
                                />
                                <button className="save-btn" onClick={handleSaveEmail}>
                                    Save
                                </button>
                            </>
                        ) : (
                            <>
                                <span>{user?.email}</span>
                                <Edit2
                                    size={16}
                                    className="edit-icon"
                                    onClick={() => setIsEditingEmail(true)}
                                />
                            </>
                        )}
                    </div>
                </div>

            </div>

            <div className="profile-preview-pane">
                <div className="preview-content">
                    <div className="placeholder-circle">
                        {user?.profilePic ? (
                            <img
                                src={user.profilePic}
                                alt="Profile"
                                className="preview-profile-img"
                            />
                        ) : (
                            <div className="user-icon-large">
                                {user?.username?.charAt(0).toUpperCase() || "U"}
                            </div>
                        )}
                    </div>

                    <h1>{user?.username}</h1>
                    <p className="joined-date">
                        {user?.createdAt
                            ? `Member since ${new Date(user.createdAt).toLocaleDateString('en-US', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                            })}`
                            : ""}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Profile;