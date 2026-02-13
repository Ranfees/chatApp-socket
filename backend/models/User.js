const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  publicKey: {
    type: String,
    required: true,
  },

  // NEW: Stores the RSA Private Key encrypted by the user's password
  encryptedPrivateKey: {
    type: String,
    required: true,
  },

  lastSeen: {
    type: Date,
    default: null,
  },

  profilePic: {
    type: String,
    default: "",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model("User", userSchema);