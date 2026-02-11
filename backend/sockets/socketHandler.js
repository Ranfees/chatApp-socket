const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Message = require("../models/Message");

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
       1️⃣ SEND OFFLINE MESSAGES (DO NOT DELETE YET)
    ======================================================== */
    const pending = await Message.find({ receiver: userId });

    for (let msg of pending) {
      io.to(userId).emit("receive_message", msg);
    }

    /* =======================================================
       2️⃣ SEND MESSAGE
    ======================================================== */
    socket.on("send_message", async ({ receiverId, encryptedText }) => {
      const receiverOnline = onlineUsers.has(receiverId);

      // 🟢 BOTH ONLINE → TEMP MESSAGE (NO DB)
      if (receiverOnline) {
        const message = {
          _id: new mongoose.Types.ObjectId(),
          sender: userId,
          receiver: receiverId,
          encryptedText,
          status: "delivered",
          createdAt: new Date(),
        };

        io.to(receiverId).emit("receive_message", message);
        io.to(userId).emit("receive_message", message);
      }

      // 🔴 RECEIVER OFFLINE → STORE IN DB
      else {
        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          encryptedText,
          status: "sent",
        });

        io.to(userId).emit("receive_message", message);
      }
    });

    /* =======================================================
       3️⃣ 🔥 DEVICE CONFIRMATION (THE FIX)
    ======================================================== */
    socket.on("message_stored_locally", async (messageId) => {
      const msg = await Message.findById(messageId);
      if (!msg) return;

      // mark delivered
      msg.status = "delivered";
      await msg.save();

      // notify sender UI
      io.to(msg.sender.toString()).emit("update_status", {
        messageId,
        status: "delivered",
      });

      // NOW SAFE TO DELETE
      await Message.findByIdAndDelete(messageId);

      console.log("✅ Message stored on device & removed from DB:", messageId);
    });

    /* =======================================================
       4️⃣ SEEN STATUS
    ======================================================== */
    socket.on("message_seen", (id) => {
      io.emit("update_status", { messageId: id, status: "seen" });
    });

    /* =======================================================
       5️⃣ TYPING
    ======================================================== */
    socket.on("typing", (rid) => io.to(rid).emit("user_typing", userId));
    socket.on("stop_typing", (rid) => io.to(rid).emit("user_stop_typing", userId));

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("online_users", Array.from(onlineUsers.keys()));
      console.log("🔴 Disconnected:", userId);
    });
  });
};
