const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");

const onlineUsers = new Map();

module.exports = (io) => {

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

    const pending = await Message.find({ receiver: userId });

    for (let msg of pending) {
      io.to(userId).emit("receive_message", msg);
    }

    socket.on("send_message", async ({ receiverId, encReceiver, encSender }) => {
      try {
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          encryptedForReceiver: encReceiver,
          encryptedForSender: encSender,
          status: onlineUsers.has(receiverId) ? "delivered" : "sent",
        });

        if (onlineUsers.has(receiverId)) {
          io.to(receiverId).emit("receive_message", message);
        }
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

// Inside socket/handler.js module.exports = (io) => { ... }

// 1. Join a specific call room based on the chat key (unique to the two users)
socket.on("call:join", (chatKey) => {
  socket.join(`call-${chatKey}`);
  socket.to(`call-${chatKey}`).emit("call:user-joined", {
    socketId: socket.id,
    userId: socket.userId // Helpful for identifying who joined
  });
});

// 2. Direct Signaling (The manual Offer/Answer exchange)
socket.on("call:signal", ({ to, signal }) => {
 
  const targetId = onlineUsers.get(to) || to; 

  io.to(targetId).emit("call:signal", {
    from: socket.id, // We send the sender's SOCKET ID so the receiver can reply
    signal,
  });
});

// 3. Leaving
socket.on("call:leave", (chatKey) => {
  socket.leave(`call-${chatKey}`);
  socket.to(`call-${chatKey}`).emit("call:user-left", socket.id);
});

// Keep your existing "call-user" for the initial ring/notification
socket.on("call-user", ({ to, fromName, type }) => {
   io.to(to).emit("incoming-call", { from: socket.userId, fromName, type });
});

    socket.on("typing", (rid) => io.to(rid).emit("user_typing", userId));
    socket.on("stop_typing", (rid) => io.to(rid).emit("user_stop_typing", userId));

    socket.on("disconnect", async () => {
      console.log(" Disconnected:", userId);

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
