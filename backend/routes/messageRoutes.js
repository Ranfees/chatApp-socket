const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { protect } = require("../middleware/authMiddleware");

router.get("/:userId", protect, async (req, res) => {
  const myId = req.user.id;
  const otherId = req.params.userId;

  const messages = await Message.find({
    $or: [
      { sender: myId, receiver: otherId },
      { sender: otherId, receiver: myId }
    ]
  }).sort({ createdAt: 1 });

  res.json(messages);
});

module.exports = router;
