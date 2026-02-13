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

  // 🔐 AES-GCM encrypted message (Base64)
  encryptedText: {
    type: String,
    required: true,
  },

  // 🔐 AES key encrypted with RECEIVER'S RSA public key
  encryptedKeyForReceiver: {
    type: String,
    required: true,
  },

  // 🔐 AES key encrypted with SENDER'S RSA public key
  encryptedKeyForSender: {
    type: String,
    required: true,
  },

  // 🔐 AES-GCM Initialization Vector (Base64)
  iv: {
    type: String,
    required: true,
  },

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

// Optional but recommended for chat apps
messageSchema.index({ sender: 1, receiver: 1, createdAt: 1 });

module.exports = mongoose.model("Message", messageSchema);
