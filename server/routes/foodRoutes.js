import express from "express";
import {
  addFood,
  getAllFoods,
  getFoodById,
  filterFoods,
} from "../controllers/foodController.js";

const router = express.Router();

router.post("/add", addFood);             // ➕ Add food
router.get("/", getAllFoods);             // 📜 List all
router.get("/:id", getFoodById);          // 🔗 Get food by MongoDB ID
router.post("/filter", filterFoods);      // 🔍 Filter foods

export default router;
