// require('dotenv').config();

// const express = require('express');
// const app = express();   

// const cors = require("cors");

// app.use(express.json()); 

// const connectDB=require('./config/db')

// const authRoutes = require("./routes/authRoutes");
// app.use("/api/auth", authRoutes);

// const userRoutes = require("./routes/userRoutes");
// app.use("/api/users", userRoutes);

// app.use(cors({
//   origin: "http://localhost:5173",
//   credentials: true, // 🔥 REQUIRED
//   methods: ["GET", "POST", "PUT", "DELETE"],
//   allowedHeaders: ["Content-Type", "Authorization"],
// }));

// const PORT = process.env.PORT || 5000;

// connectDB();

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({
  origin: "http://localhost:5173",
  credentials: true,
}));

app.use(express.json()); 

const connectDB = require('./config/db');
connectDB();

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
