import axiosInstance from "../config/axios";

//Get voice response from backend
export const getVoiceResponse = async (body) => {
  body = JSON.stringify(body);
  try {
    const response = await axiosInstance.post("/voice-query", body);
    return response;
  } catch (error) {
    console.error("Error fetching voice response:", error);
    throw error;
  }
};
