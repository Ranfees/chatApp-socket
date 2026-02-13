const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");

const onlineUsers = new Map();

module.exports = (io) => {

  // authentication
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId.toString();
    socket.join(userId);

    onlineUsers.set(userId, socket.id);
    io.emit("online_users", Array.from(onlineUsers.keys()));

    // send offline message
    const pending = await Message.find({ receiver: userId });

    for (let msg of pending) {
      io.to(userId).emit("receive_message", msg);
    }

    // send message
    socket.on("send_message", async ({ receiverId, encReceiver, encSender }) => {
      try {
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          encryptedForReceiver: encReceiver,
          encryptedForSender: encSender,
          status: onlineUsers.has(receiverId) ? "delivered" : "sent",
        });

        // ✅ SEND TO RECEIVER IF ONLINE
        if (onlineUsers.has(receiverId)) {
          io.to(receiverId).emit("receive_message", message);
        }

        // ✅ SEND BACK TO SENDER
        io.to(userId).emit("receive_message", message);

      } catch (err) {
        console.error("Message send error:", err);
      }
    });


    socket.on("message_stored_locally", async (messageId) => {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      msg.status = "delivered";
      await msg.save();

      io.to(msg.sender.toString()).emit("update_status", {
        messageId,
        status: "delivered",
      });

      await Message.findByIdAndDelete(messageId);
    });

    socket.on("message_seen", (id) => {
      io.emit("update_status", { messageId: id, status: "seen" });
    });

    socket.on("typing", (rid) => io.to(rid).emit("user_typing", userId));
    socket.on("stop_typing", (rid) => io.to(rid).emit("user_stop_typing", userId));

    socket.on("disconnect", async () => {
      console.log("🔴 Disconnected:", userId);

      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));

      try {
        await User.findByIdAndUpdate(userId, {
          lastSeen: new Date(),
        });
      } catch (err) {
        console.error("Last seen update error:", err);
      }
    });

  });
};
