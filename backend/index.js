require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const connectCloudinary = require("./config/cloudinary");
const fileUpload = require('express-fileupload')

const app = express();
const server = http.createServer(app);


const io = new Server(server, {
  cors: {
    origin:process.env.FRONTEND_URL,
    credentials: true,
  },
});

app.use(fileUpload(
    {
    useTempFiles : true,
    tempFileDir : '/tmp/'
}
));

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

app.use(express.json());

require("./config/db")();

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

require("./sockets/socketHandler")(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  connectCloudinary();
  console.log(`Server running on port ${PORT}`)
}
);
