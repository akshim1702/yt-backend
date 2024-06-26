import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // upload on cloudinary

    const res = await cloudinary.uploader.upload(
      localFilePath,
      { resource_type: "auto" },
      function (error, result) {
        console.log(result);
      }
    );

    // file upload on cloudinary
    // console.log("File upload on cloudinary", res.url);
    fs.unlink(localFilePath);
    return res;
  } catch (error) {
    console.log(error);
    fs.unlinkSync(localFilePath); // Remove temporary file
    return null;
  }
};

const deleteOnCloudinary = async (file) => {
  try {
    const res = await cloudinary.v2.api
      .delete_resources(file, { type: "upload", resource_type: "image" })
      .then(console.log);
    console.log(res);
    return res;
  } catch (error) {
    console.log(error);
    return null;
  }
};

export { uploadOnCloudinary , deleteOnCloudinary };
