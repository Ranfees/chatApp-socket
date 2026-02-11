const cloudinary = require('cloudinary').v2

const fileUploadToCloudinary = async (file) => {
    try {
        const image = await cloudinary.uploader.upload(file.tempFilePath,{folder:"ChatApp"})
        return {url:image.secure_url,public_id:image.public_id}
    } catch (error) {
        console.log("image upload failed!!!!!")
        console.log(error)
    }
}
module.exports=fileUploadToCloudinary