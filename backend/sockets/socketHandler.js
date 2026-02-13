const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");

const onlineUsers = new Map();

module.exports = (io) => {

  // 🔐 Socket Authentication
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId.toString();

    socket.join(userId);
    onlineUsers.set(userId, socket.id);

    io.emit("online_users", Array.from(onlineUsers.keys()));

    try {
      // 📩 Send pending messages
      const pending = await Message.find({
        $or: [{ receiver: userId }, { sender: userId }]
      }).sort({ createdAt: 1 });

      for (let msg of pending) {
        io.to(userId).emit("receive_message", msg);
      }
    } catch (err) {
      console.error("Error fetching pending messages:", err);
    }

    // 🔐 SEND ENCRYPTED MESSAGE (DUAL KEY E2EE)
    socket.on("send_message", async (payload) => {
      try {
        const {
          receiverId,
          encryptedText,
          encryptedKeyForSender,
          encryptedKeyForReceiver,
          iv
        } = payload;

        if (
          !receiverId ||
          !encryptedText ||
          !encryptedKeyForSender ||
          !encryptedKeyForReceiver ||
          !iv
        ) {
          return;
        }

        // 🛑 Server NEVER decrypts
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          encryptedText,
          encryptedKeyForSender,
          encryptedKeyForReceiver,
          iv,
          status: onlineUsers.has(receiverId) ? "delivered" : "sent",
        });

        // Send to receiver if online
        if (onlineUsers.has(receiverId)) {
          io.to(receiverId).emit("receive_message", message);
        }

        // Send back to sender (important for decrypt with sender key)
        io.to(userId).emit("receive_message", message);

      } catch (err) {
        console.error("Message send error:", err);
      }
    });

    // ✅ Message delivered acknowledgment
    socket.on("message_stored_locally", async (messageId) => {
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;

        msg.status = "delivered";
        await msg.save();

        io.to(msg.sender.toString()).emit("update_status", {
          messageId,
          status: "delivered",
        });

      } catch (err) {
        console.error("Delivery update error:", err);
      }
    });

    // 👁 Seen status
    socket.on("message_seen", async (messageId) => {
      try {
        const msg = await Message.findById(messageId);
        if (!msg) return;

        msg.status = "seen";
        await msg.save();

        io.to(msg.sender.toString()).emit("update_status", {
          messageId,
          status: "seen",
        });

      } catch (err) {
        console.error("Seen update error:", err);
      }
    });

    // ⌨ Typing indicators
    socket.on("typing", (receiverId) => {
      io.to(receiverId).emit("user_typing", userId);
    });

    socket.on("stop_typing", (receiverId) => {
      io.to(receiverId).emit("user_stop_typing", userId);
    });

    // 🔴 Disconnect
    socket.on("disconnect", async () => {
      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));

      try {
        await User.findByIdAndUpdate(userId, {
          lastSeen: new Date(),
        });
      } catch (err) {
        console.error("Last seen update error:", err);
      }

      console.log("🔴 Disconnected:", userId);
    });
  });
};
