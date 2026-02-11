const cloudinary = require('cloudinary').v2

function connectCloudinary(){
    try {
        cloudinary.config({
            cloud_name:process.env.C_name,
            api_key:process.env.C_key,
            api_secret:process.env.C_secret
        })
        console.log('cloudinary connected!!')
    } catch (error) {
        console.log('cloudinary connection failed!!')
        console.log(error)
    }
}

module.exports=connectCloudinary