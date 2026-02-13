const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fileUploadToCloudinary = require('../utils/fileUpload');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

exports.registerUser = async (req, res) => {
  try {
    // 1. ADD encryptedPrivateKey to the destructured body
    const { username, email, password, publicKey, encryptedPrivateKey } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }

    let profilePicUrl = "";
    if (req.files && req.files.profilePic) {
      const uploadedImage = await fileUploadToCloudinary(req.files.profilePic);
      profilePicUrl = uploadedImage.url;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 2. SAVE the encryptedPrivateKey to the database
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      publicKey, 
      encryptedPrivateKey, // Store the locked key from frontend
      profilePic: profilePicUrl
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
      token: generateToken(user._id),
      createdAt: user.createdAt,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // 3. SEND the encryptedPrivateKey back to the frontend on login
    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      publicKey: user.publicKey,
      encryptedPrivateKey: user.encryptedPrivateKey, // Frontend uses this to unlock RSA
      profilePic: user.profilePic,
      token: generateToken(user._id),
      createdAt: user.createdAt,
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};