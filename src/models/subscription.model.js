import mongoose, { Schema } from "mongoose";

const schema = Schema(
  {
    subscriber: {
      type: Schema.Types.ObjectId, // ONe who is subscribing
      ref: "User",
    },
    channel: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

export const Subscription = mongoose.model("Subscription", schema);
