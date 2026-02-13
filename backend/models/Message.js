const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  // Version encrypted with Receiver's Public Key
  encryptedForReceiver: { type: String, required: true },
  // Version encrypted with Sender's Public Key (your history)
  encryptedForSender: { type: String, required: true },
  status: {
    type: String,
    enum: ["sent", "delivered", "seen"],
    default: "sent",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Message", messageSchema);
