const jwt = require("jsonwebtoken");
const Message = require("../models/Message");

const onlineUsers = new Map(); // 🟢 TRACK ONLINE USERS

module.exports = (io) => {

  // 🔐 SOCKET AUTH
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId.toString();
    console.log("Connected:", userId);

    socket.join(userId);

    /* 🟢 MARK USER ONLINE */
    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));

    /* 📤 SEND MESSAGE */
    socket.on("send_message", async ({ receiverId, encryptedText }) => {
      try {
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          encryptedText,
          status: "sent",
        });

        io.to(receiverId).emit("receive_message", message);
        io.to(userId).emit("receive_message", message);

      } catch (err) {
        console.error("send_message error:", err);
      }
    });

    /* ✅ DELIVERED */
    socket.on("message_delivered", async (messageId) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "delivered" },
          { new: true }
        );

        if (!msg) return;

        io.to(msg.sender.toString()).emit("update_status", {
          messageId,
          status: "delivered",
        });

      } catch (err) {
        console.error("message_delivered error:", err);
      }
    });

    socket.on("typing", (receiverId) => {
      io.to(receiverId).emit("user_typing", socket.userId);
    });

    socket.on("stop_typing", (receiverId) => {
      io.to(receiverId).emit("user_stop_typing", socket.userId);
    });

    /* 👁️ SEEN */
    socket.on("message_seen", async (messageId) => {
      try {
        const msg = await Message.findByIdAndUpdate(
          messageId,
          { status: "seen" },
          { new: true }
        );

        if (!msg) return;

        io.to(msg.sender.toString()).emit("update_status", {
          messageId: msg._id,
          status: "seen",
        });

      } catch (err) {
        console.error("message_seen error:", err);
      }
    });

    /* 🔌 DISCONNECT */
    socket.on("disconnect", () => {
      console.log("Disconnected:", userId);
      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));
    });
  });
};
