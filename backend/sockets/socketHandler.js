const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");

const onlineUsers = new Map();
const activeCalls = new Map();

module.exports = (io) => {

  /* ================= AUTH ================= */
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

  /* ================= CONNECTION ================= */
  io.on("connection", async (socket) => {
    const userId = socket.userId.toString();

    socket.join(userId);
    onlineUsers.set(userId, socket.id);

    io.emit("online_users", Array.from(onlineUsers.keys()));

    /* ===== SEND PENDING MESSAGES ===== */
    const pending = await Message.find({ receiver: userId });

    for (let msg of pending) {
      io.to(userId).emit("receive_message", msg);
    }

    /* ================= MESSAGES ================= */

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

    socket.on("typing", (rid) =>
      io.to(rid).emit("user_typing", userId)
    );

    socket.on("stop_typing", (rid) =>
      io.to(rid).emit("user_stop_typing", userId)
    );

    /* ================= CALLING ================= */

    // 🔥 START CALL
    socket.on("call-user", ({ to, offer, type }) => {

      // user offline
      if (!onlineUsers.has(to)) {
        io.to(userId).emit("user-offline");
        return;
      }

      // caller already in call
      if (activeCalls.has(userId)) {
        io.to(userId).emit("call-busy");
        return;
      }

      // receiver busy
      if (activeCalls.has(to)) {
        io.to(userId).emit("call-busy");
        return;
      }

      // mark both users busy
      activeCalls.set(userId, to);
      activeCalls.set(to, userId);

      io.to(to).emit("incoming-call", {
        from: userId,
        offer,
        type,
      });
    });

    // 🔥 ANSWER CALL
    socket.on("answer-call", ({ to, answer }) => {
      io.to(to).emit("call-answered", {
        from: userId,
        answer,
      });
    });

    // 🔥 ICE CANDIDATES
    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", {
        from: userId,
        candidate,
      });
    });

    // 🔥 CALL REJECTED
    socket.on("call-rejected", ({ to }) => {

      const partner = activeCalls.get(userId);

      if (partner) {
        activeCalls.delete(partner);
        io.to(partner).emit("call-rejected-by-user");
      }

      activeCalls.delete(userId);
    });

    // 🔥 END CALL (FIXED VERSION)
    socket.on("end-call", () => {

      const partnerId = activeCalls.get(userId);

      if (partnerId) {
        io.to(partnerId).emit("call-ended");

        // remove BOTH SIDES safely
        activeCalls.delete(partnerId);
      }

      activeCalls.delete(userId);
    });

    /* ================= DISCONNECT ================= */

    socket.on("disconnect", async () => {

      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));

      // cleanup active call if user disconnects
      const partner = activeCalls.get(userId);

      if (partner) {
        activeCalls.delete(userId);
        activeCalls.delete(partner);
        io.to(partner).emit("call-ended");
      }

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
