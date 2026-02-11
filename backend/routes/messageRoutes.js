const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const { protect } = require("../middleware/authMiddleware");

router.get("/:userId", protect, async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.userId;
    const { lastId } = req.query;

    const query = {
      $or: [
        { sender: myId, receiver: otherId },
        { sender: otherId, receiver: myId }
      ]
    };

    // Only fetch newer messages
    if (lastId) {
      query._id = { $gt: lastId };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(50); // safety limit

    res.json(messages);

  } catch (err) {
    console.error("Message fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
