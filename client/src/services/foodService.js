import axiosInstance from "../config/axios";

// Get all foods from the backend
export const getAllFoods = async () => {
  try {
    const response = await axiosInstance.get("/foods");
    return response.data; // assuming backend sends JSON list of foods
  } catch (error) {
    console.error("Error fetching foods:", error);
    throw error;
  }
};
