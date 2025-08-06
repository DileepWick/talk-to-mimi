import mongoose from "mongoose"

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI)
    console.log("MongoDB connection established.")
  } catch (error) {
    console.error("MongoDB connection error:", error)
    throw error // Re-throw to be caught in server.js
  }
}
