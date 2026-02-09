const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const app = express();   

app.use(express.json()); 

const connectDB=require('./config/db')

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);

const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;

connectDB();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
