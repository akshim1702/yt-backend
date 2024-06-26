import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";

import { extractPublicId } from "cloudinary-build-url";

import jwt from "jsonwebtoken";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      "Something went wrong while generating refresh and access token",
      500
    );
  }
};

export const registerUser = asyncHandler(async (req, res, next) => {
  // get user details from frontend
  // validation - not empty
  // check if already exsist username,email
  // check for images
  // check for avatar
  // upload them to cloudinary , avatar
  // create user object - create entry in db
  // remove password and refresh token field from response
  // check for user creation
  // return response else error

  const { fullname, email, username, password } = req.body;

  if (
    [fullname, email, username, password].some((item) => item?.trim() === "")
  ) {
    throw new ApiError("All fields are required", 400);
  }

  const exsistedUser = await User.findOne({ $or: [{ email }, { username }] });
  if (exsistedUser) {
    throw new ApiError("User already exists", 409);
  }

  const avatarLocalPath = req.files?.avatar[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) throw new ApiError("Avtar file is required", 400);

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError("Avtar file is required", 400);

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    email,
    username: username.toLowerCase(),
    password,
    coverImage: coverImage?.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError("Something went wrong when creating a new user", 500);
  }

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

export const loginUser = asyncHandler(async (req, res, next) => {
  // req-body  --> data
  // username or email
  // find the user
  // check if password is correct
  // create token --> access token and refresh token
  // send cookie
  // return response
  // else error

  const { username, email, password } = req.body;
  if (!(username || email)) {
    throw new ApiError("username or email is required", 400);
  }
  const user = await User.findOne({ $or: [{ email }, { username }] });
  if (!user) {
    throw new ApiError("User not found", 404);
  }
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError("Invalid password", 401);
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "Logged in successfully"
      )
    );
});

export const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "Logged out successfully"));
});
export const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) throw new ApiError("unauthorized request", 401);

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id).select("-password");
    if (!user) throw new ApiError("Invalid refresh token", 401);
    if (incomingRefreshToken !== user?.refreshToken)
      throw new ApiError("Expired or Invalid refresh token", 401);

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken,
          },
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(error?.message || "Invalid refresh token", 400);
  }
});

export const changeCurrentPassword = asyncHandler(async (req, res, next) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError("User not found", 404);
  }
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) throw new ApiError("Password incorrect", 404);

  user.password = newPassword;
  await user.save({ validateBeforeSave: true });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

export const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;

  if (!fullname || !email) {
    throw new ApiError("All fields are required", 400);
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  if (!user) {
    throw new ApiError("User not found", 404);
  }
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

export const userAvatarUpdate = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  if (!avatarLocalPath) {
    new ApiError("Avatar File is missing", 400);
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  if (!avatar.url) new ApiError("Error while uploading Avatar", 400);

  const oldUserData = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  if (!oldUserData) {
    throw new ApiError("User not found", 404);
  }

  // Delete old avatar image from Cloudinary
  await deleteOnCloudinary([extractPublicId(oldUserData.avatar)]);

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

export const userCoverImageUpdate = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath) {
    new ApiError("Cover Image File is missing", 400);
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url) new ApiError("Error while uploading Cover Image", 400);

  const oldUserData = await User.findById(req.user?._id);
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  if (!oldUserData) {
    throw new ApiError("User not found", 404);
  }
  const oldAvatarUrl = user?.coverImage | undefined; // Get the old avatar URL
  if (oldAvatarUrl) {
    // Delete old avatar image from Cloudinary
    await deleteOnCloudinary([extractPublicId(oldAvatarUrl)]);
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated successfully"));
});
