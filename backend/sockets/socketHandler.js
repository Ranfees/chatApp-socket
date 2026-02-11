const jwt = require("jsonwebtoken");
const Message = require("../models/Message");
const User = require("../models/User");

const onlineUsers = new Map();

module.exports = (io) => {

  /* 🔐 AUTH */
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

    console.log("🟢 Connected:", userId);

    /* =======================================================
       🔥 1️⃣ SEND MISSED (OFFLINE) MESSAGES ON CONNECT
    ======================================================== */
    try {
      const undelivered = await Message.find({
        receiver: userId,
        status: "sent", // messages sent while user was offline
      });

      for (let msg of undelivered) {
        // send message to this user
        io.to(userId).emit("receive_message", msg);

        // mark as delivered
        msg.status = "delivered";
        await msg.save();

        // update sender UI
        io.to(msg.sender.toString()).emit("update_status", {
          messageId: msg._id,
          status: "delivered",
        });
      }

      if (undelivered.length)
        console.log(`📨 Delivered ${undelivered.length} missed messages to ${userId}`);
    } catch (err) {
      console.error("Missed message sync error:", err);
    }

    /* =======================================================
       2️⃣ SEND MESSAGE (LIVE)
    ======================================================== */
    socket.on("send_message", async ({ receiverId, encryptedText }) => {
      try {
        const isOnline = onlineUsers.has(receiverId);

        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          encryptedText,
          status: isOnline ? "delivered" : "sent",
        });

        // send to receiver if online
        io.to(receiverId).emit("receive_message", message);

        // also send back to sender
        io.to(userId).emit("receive_message", message);

      } catch (err) {
        console.error("send_message error:", err);
      }
    });

    /* =======================================================
       3️⃣ DELIVERY STATUS
    ======================================================== */
    socket.on("message_delivered", async (id) => {
      const msg = await Message.findByIdAndUpdate(
        id,
        { status: "delivered" },
        { new: true }
      );
      if (msg)
        io.to(msg.sender.toString()).emit("update_status", {
          messageId: id,
          status: "delivered",
        });
    });

    /* =======================================================
       4️⃣ SEEN STATUS
    ======================================================== */
    socket.on("message_seen", async (id) => {
      const msg = await Message.findByIdAndUpdate(
        id,
        { status: "seen" },
        { new: true }
      );
      if (msg)
        io.to(msg.sender.toString()).emit("update_status", {
          messageId: id,
          status: "seen",
        });
    });

    /* =======================================================
       5️⃣ TYPING INDICATOR
    ======================================================== */
    socket.on("typing", (rid) => io.to(rid).emit("user_typing", userId));
    socket.on("stop_typing", (rid) => io.to(rid).emit("user_stop_typing", userId));

    /* =======================================================
       6️⃣ DISCONNECT
    ======================================================== */
    socket.on("disconnect", async () => {
      console.log("🔴 Disconnected:", userId);

      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));

      // 🔥 UPDATE LAST SEEN
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
