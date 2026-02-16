import { useNavigate, useOutletContext, useParams, useLocation } from "react-router";
import { useEffect, useRef, useState } from "react";
import socket from "../socket/socket";
import "../styles/chat.css";
import { ArrowLeft, Phone, Video, MoreVertical, User as UserIcon, X, Check } from "lucide-react";
import { decryptWith, encryptFor } from "../utils/crypto";

const Chat = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useParams();
    const { users, onlineUsers } = useOutletContext();

    const userString = localStorage.getItem("user");
    const currentUser = JSON.parse(userString);
    const myId = currentUser?.id;
    const chatKey = [myId, userId].sort().join("_");
    const receiver = users?.find((u) => u._id === userId);
    const isOnline = onlineUsers.includes(userId);

    const [text, setText] = useState("");
    const [messages, setMessages] = useState([]);
    const [typingUser, setTypingUser] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    // Call States
    const [isCalling, setIsCalling] = useState(false);
    const [callType, setCallType] = useState(null);
    const [incomingCall, setIncomingCall] = useState(null);
    const [activeCallPartner, setActiveCallPartner] = useState(null);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const pendingOfferRef = useRef(null);

    const peerRef = useRef(null);
    const localStreamRef = useRef(null);
    const pendingCandidates = useRef([]);
    const bottomRef = useRef();
    const activePartnerRef = useRef(null);
    // --- 1. REF FOR STALE CLOSURE FIX ---
    const endCallRef = useRef();

    const remoteStreamRef = useRef(null);

    // --- Message Decryption Logic ---
    const loadAndDecryptMessages = async () => {
        const local = JSON.parse(localStorage.getItem("chat_" + chatKey) || "[]");
        const unique = Array.from(
            new Map(local.map(m => [m._id?.toString(), m])).values()
        );

        const decrypted = await Promise.all(
            unique.map(async (msg) => {
                try {
                    const privateKey = localStorage.getItem("privateKey");
                    const encryptedText = msg.sender === myId
                        ? msg.encryptedForSender
                        : msg.encryptedForReceiver;

                    const clearText = await decryptWith(encryptedText, privateKey);
                    return { ...msg, clearText };
                } catch (err) {
                    console.error("Decryption error:", msg._id, err);
                    return { ...msg, clearText: "[Decryption Error]" };
                }
            })
        );

        setMessages(decrypted);
        localStorage.setItem("chat_" + chatKey, JSON.stringify(decrypted));
    };

    useEffect(() => {
        loadAndDecryptMessages();
        const unreadCounts = JSON.parse(localStorage.getItem("unreadCounts") || "{}");
        if (unreadCounts[userId]) {
            delete unreadCounts[userId];
            localStorage.setItem("unreadCounts", JSON.stringify(unreadCounts));
        }
    }, [userId, chatKey, myId]);

    useEffect(() => {
        const handleChatUpdate = () => loadAndDecryptMessages();
        window.addEventListener("chat_updated", handleChatUpdate);
        return () => window.removeEventListener("chat_updated", handleChatUpdate);
    }, [chatKey, myId]);

    // --- WebRTC Core Logic ---
    const createPeer = (targetId) => {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
                { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
            ],
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit("ice-candidate", { to: targetId, candidate: event.candidate });
            }
        };

        peer.ontrack = (event) => {
            if (!remoteVideoRef.current) return;

            if (!remoteStreamRef.current) {
                remoteStreamRef.current = new MediaStream();
                remoteVideoRef.current.srcObject = remoteStreamRef.current;
            }

            remoteStreamRef.current.addTrack(event.track);
        };

        return peer;
    };

    const startCall = async (type) => {
        if (isCalling || peerRef.current) return;
        try {
            setCallType(type);
            setIsCalling(true);
            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === "video",
                audio: true,
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const peer = createPeer(userId);
            peerRef.current = peer;
            stream.getTracks().forEach((track) => peer.addTrack(track, stream));

            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);
            setActiveCallPartner(userId);
            socket.emit("call-user", { to: userId, offer, type });
        } catch (err) {
            console.error("Call start error:", err);
            setIsCalling(false);
        }
    };

    const handleIncomingCall = async ({ from, offer, type }) => {
        setCallType(type);
        setIsCalling(true);
        setActiveCallPartner(from);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: type === "video",
                audio: true,
            });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;

            const peer = createPeer(from);
            peerRef.current = peer;
            stream.getTracks().forEach((track) => peer.addTrack(track, stream));

            await peer.setRemoteDescription(new RTCSessionDescription(offer));
            for (let c of pendingCandidates.current) {
                await peer.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidates.current = [];

            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("answer-call", { to: from, answer });
        } catch (err) {
            console.error("Error accepting call:", err);
        }
    };

    const endCall = () => {
        const target = activePartnerRef.current || userId;

        setIsCalling(false);
        setCallType(null);
        setIncomingCall(null);
        setActiveCallPartner(null);
        remoteStreamRef.current = null;
        pendingOfferRef.current = null;


        if (peerRef.current) {
            peerRef.current.onicecandidate = null;
            peerRef.current.ontrack = null;
            peerRef.current.close();
            peerRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((track) => track.stop());
            localStreamRef.current = null;
        }

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

        pendingCandidates.current = [];
        socket.emit("end-call", { to: target });
    };

    endCallRef.current = endCall;

    useEffect(() => {
        return () => {
            if (peerRef.current || localStreamRef.current) {
                endCallRef.current?.();
            }
        };
    }, []);

    useEffect(() => {
        if (location.state?.autoAccept) {
            handleIncomingCall(location.state.autoAccept);
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    useEffect(() => {
        activePartnerRef.current = activeCallPartner;
    }, [activeCallPartner]);

    useEffect(() => {
        const handleCallAnswered = async ({ answer }) => {
            await peerRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
            for (let c of pendingCandidates.current) {
                await peerRef.current.addIceCandidate(new RTCIceCandidate(c));
            }
            pendingCandidates.current = [];
        };

        const handleIce = async ({ candidate }) => {
            try {
                if (peerRef.current?.remoteDescription) {
                    await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                    pendingCandidates.current.push(candidate);
                }
            } catch (err) { console.error("ICE error:", err); }
        };

        socket.on("incoming-call", async (data) => {
            pendingOfferRef.current = data;
            setIncomingCall(data);
        });
        socket.on("call-answered", handleCallAnswered);
        socket.on("ice-candidate", handleIce);
        socket.on("call-ended", () => endCallRef.current?.());

        // --- Added Busy/Offline Listeners ---
        socket.on("call-busy", () => {
            alert("User is currently on another call.");
            endCallRef.current?.();
        });
        socket.on("user-offline", () => {
            alert("User is offline.");
            endCallRef.current?.();
        });

        return () => {
            socket.off("incoming-call");
            socket.off("call-answered", handleCallAnswered);
            socket.off("ice-candidate", handleIce);
            socket.off("call-ended");
            socket.off("call-busy");
            socket.off("user-offline");
        };
    }, [userId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, typingUser]);

    const sendMessage = async () => {
        if (!text.trim()) return;
        const myPubKey = currentUser?.publicKey;
        if (!receiver?.publicKey || !myPubKey) {
            alert("Security keys missing.");
            return;
        }
        try {
            const encReceiver = await encryptFor(text, receiver.publicKey);
            const encSender = await encryptFor(text, myPubKey);
            socket.emit("send_message", { receiverId: userId, encReceiver, encSender });
            setText("");
        } catch (err) { console.error("Encryption failed", err); }
    };

    const handleLogout = () => {
        socket.disconnect();
        localStorage.clear();
        navigate("/login");
    };

    return (
        <div className="chat-window">
            <header className="chat-header">
                <div className="header-left">
                    <button className="mobile-back-btn" onClick={() => navigate("/")}>
                        <ArrowLeft />
                    </button>
                    <div className="chat-avatar">
                        {receiver?.profilePic ? (
                            <img src={receiver.profilePic} alt="" className="chat-avatar-img" />
                        ) : (
                            <span className="chat-avatar-letter">{receiver?.username?.charAt(0).toUpperCase()}</span>
                        )}
                    </div>
                    <div className="header-info">
                        <h4>{receiver?.username ? receiver.username.charAt(0).toUpperCase() + receiver.username.slice(1) : "Chat"}</h4>
                        <span className="status-text">{typingUser ? "Typing..." : isOnline ? "Online" : "Offline"}</span>
                    </div>
                </div>

                <div className="call-actions">
                    <button className="call-btn" onClick={() => startCall('audio')}><Phone size={20} /></button>
                    <button className="call-btn" onClick={() => startCall('video')}><Video size={20} /></button>
                    <div className="menu-container">
                        <button className="menu-trigger" onClick={() => setShowMenu(!showMenu)}><MoreVertical size={20} /></button>
                        {showMenu && (
                            <div className="dropdown-menu">
                                <div className="menu-item" onClick={() => navigate("/")}>Chats</div>
                                <div className="menu-item" onClick={() => navigate("/profile")}>Profile</div>
                                <div className="menu-item logout" onClick={handleLogout}>Logout</div>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {isCalling && (
                <div className={`call-container ${callType === 'audio' ? 'audio-mode' : 'video-mode'}`}>
                    {callType === 'video' ? (
                        <>
                            <video ref={localVideoRef} autoPlay muted playsInline className="local-video" />
                            <video ref={remoteVideoRef} autoPlay playsInline className="remote-video" />
                        </>
                    ) : (
                        <div className="audio-call-ui">
                            <div className="audio-bg-blur" style={{ backgroundImage: `url(${receiver?.profilePic})` }}></div>
                            <div className="audio-call-content">
                                <div className="caller-avatar-wrapper">
                                    {receiver?.profilePic ? (
                                        <img src={receiver.profilePic} alt="" className="audio-avatar" />
                                    ) : (
                                        <div className="audio-avatar-placeholder">
                                            <UserIcon size={60} />
                                        </div>
                                    )}
                                    <div className="pulse-waves"></div>
                                </div>
                                <h2 className="caller-name">{receiver?.username}</h2>
                                <p className="call-status">On {callType} call...</p>
                            </div>
                            <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
                            <video ref={localVideoRef} autoPlay muted playsInline style={{ display: 'none' }} />
                        </div>
                    )}

                    <div className="call-controls-bar">
                        <button className="end-call-btn-round" onClick={endCall}>
                            <Phone size={28} style={{ transform: 'rotate(135deg)' }} />
                        </button>
                    </div>
                </div>
            )}

            {incomingCall && (
                <div className="call-modal-overlay">
                    <div className="call-modal">
                        <div className="call-modal-avatar pulse">
                            <UserIcon size={40} />
                        </div>
                        <h3>Incoming {incomingCall.type} Call</h3>
                        <p>{receiver?.username} is calling...</p>
                        <div className="modal-actions">
                            <button className="accept-call" onClick={() => {
                                handleIncomingCall(pendingOfferRef.current);
                                setIncomingCall(null);
                            }}><Check size={28} /></button>
                            <button className="decline-call" onClick={() => {
                                socket.emit("end-call", { to: incomingCall.from });
                                setIncomingCall(null);
                            }}><X size={28} /></button>
                        </div>
                    </div>
                </div>
            )}

            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg._id} className={`chat-bubble ${msg.sender === myId ? "me" : "other"}`}>
                        {msg.clearText || "..."}
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            <footer className="chat-input">
                <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type message..."
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button onClick={sendMessage}>➤</button>
            </footer>
        </div>
    );
};

export default Chat;