import mongoose from "mongoose";

const foodSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // 🍕 Food name
    type: {
      type: String,
      enum: ["pizza", "burger", "wrap", "snack"],
    },
    spicy: { type: Boolean },
    vegetarian: { type: Boolean },
    calories: { type: Number },
    price: { type: Number },
    pictureUrl: { type: String }, // 🖼️ Image URL
    description: { type: String }, // 📄 Detailed description
    preparationTime: { type: Number }, // ⏱️ Time in minutes
  },
  { timestamps: true }
);

export default mongoose.model("Food", foodSchema);
