// require('dotenv').config()
const dotenv = require('dotenv')
dotenv.config()
const express = require('express')
const app = express()
const PORT=process.env.PORT

app.listen(PORT,()=>{
    console.log('app is running');
})

