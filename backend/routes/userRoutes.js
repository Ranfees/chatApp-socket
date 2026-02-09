const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Get all users except logged-in user
router.get("/", protect, async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select("-password");
  res.json(users);
});

module.exports = router;
