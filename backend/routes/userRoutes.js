const express = require("express");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const fileUploadToCloudinary = require("../utils/fileUpload");

const router = express.Router();

router.get("/", protect, async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select("-password");
  res.json(users);
});

router.put("/update-name", protect, async (req, res) => {
  const { username } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.username = username;
  await user.save();

  res.json({ username: user.username });
});

router.put("/update-email", protect, async (req, res) => {
  const { email } = req.body;

  const existing = await User.findOne({ email });
  if (existing && existing._id.toString() !== req.user._id.toString()) {
    return res.status(400).json({ message: "Email already in use" });
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.email = email;
  await user.save();

  res.json({ email: user.email });
});

router.put("/update-profile-pic", protect, async (req, res) => {
  try {
    if (!req.files || !req.files.profilePic) {
      return res.status(400).json({ message: "No image uploaded" });
    }

    const file = req.files.profilePic;

    // Use your helper
    const uploadResult = await fileUploadToCloudinary(file);

    if (!uploadResult) {
      return res.status(500).json({ message: "Image upload failed" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.profilePic = uploadResult.url;
    await user.save();

    res.json({ profilePic: uploadResult.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
