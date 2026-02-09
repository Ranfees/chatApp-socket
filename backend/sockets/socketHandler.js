const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = await User.findById(decoded.id);
      next();
    } catch (err) {
      next(new Error("Not authorized"));
    }
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.user.username);

    socket.join(socket.user._id.toString()); // personal room

    socket.on("disconnect", () => {
      console.log("User disconnected");
    });
  });
};
