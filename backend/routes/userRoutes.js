const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// Get all users except logged-in user
router.get("/", protect, async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select("-password");
  res.json(users);
});

// router.get("/:userId", protect, async (req, res) => {
//   const messages = await Message.find({
//     $or: [
//       { sender: req.user._id, receiver: req.params.userId },
//       { sender: req.params.userId, receiver: req.user._id },
//     ],
//   }).sort({ createdAt: 1 });

//   res.json(messages);
// });

module.exports = router;
