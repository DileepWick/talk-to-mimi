import Food from "../models/Food.js";
import levenshtein from "fast-levenshtein";

// Add new food item
export const addFood = async (req, res) => {
  try {
    const newFood = new Food(req.body);
    await newFood.save();
    res.status(201).json(newFood);
  } catch (err) {
    res.status(400).json({ error: "Failed to add food", details: err.message });
  }
};

// Get all food items
export const getAllFoods = async (req, res) => {
  try {
    const foods = await Food.find();
    res.json(foods);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch foods" });
  }
};

// Get food item by ID
export const getFoodById = async (req, res) => {
  try {
    const food = await Food.findById(req.params.id);
    if (!food) return res.status(404).json({ error: "Food not found" });
    res.json(food);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch food" });
  }
};

// Filter food items
export const filterFoods = async (req, res) => {
  try {
    const filters = {};
    const { spicy, vegetarian, type, maxCalories, maxPrice } = req.body;

    if (spicy !== undefined) filters.spicy = spicy;
    if (vegetarian !== undefined) filters.vegetarian = vegetarian;
    if (type) filters.type = type;
    if (maxCalories) filters.calories = { $lte: maxCalories };
    if (maxPrice) filters.price = { $lte: maxPrice };

    const results = await Food.find(filters);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Failed to filter food items." });
  }
};


// Reusable function you can call from voiceController
export const getFilteredFoods = async (filtersFromAI) => {
  try {
    const filters = {};

    const {
      spicy,
      vegetarian,
      type,
      maxCalories,
      maxPrice
    } = filtersFromAI;

    if (spicy !== undefined && spicy !== null) filters.spicy = spicy === true;
    if (vegetarian !== undefined && vegetarian !== null) filters.vegetarian = vegetarian === true;
    if (type) filters.type = type;
    if (maxCalories) filters.calories = { $lte: parseInt(maxCalories) };
    if (maxPrice) filters.price = { $lte: parseFloat(maxPrice) };

    const results = await Food.find(filters);
    return results;
  } catch (err) {
    console.error("Error filtering foods:", err);
    throw err;
  }
};

// Resuable function to get all foods
export const getAllFoods2 = async () => {
  try {
    const foods = await Food.find();
    return foods;
  } catch (err) {
    console.error("Error fetching all foods:", err);
    throw err;
  }
};

// Get a food by a name 
export const getFoodByName = async (name) => {
  try {
    if (!name || typeof name !== "string") return [];

    // Normalize: lowercase, trim, remove extra spaces
    const normalized = name.trim().toLowerCase().replace(/\s+/g, " ");

    // Create a broad fuzzy regex pattern
    const regex = new RegExp(normalized.split(" ").join(".*"), "i");

    // Initial candidate search
    const candidates = await Food.find({ name: { $regex: regex } });

    if (!candidates.length) return [];

    // Rank by similarity score
    const scored = candidates.map((food) => {
      const foodName = food.name.toLowerCase();
      const distance = levenshtein.get(normalized, foodName); // Levenshtein distance
      const score = 1 - distance / Math.max(normalized.length, foodName.length); // Normalized similarity
      return { food, score };
    });

    // Sort by highest score first
    scored.sort((a, b) => b.score - a.score);

    // Return sorted foods (you can limit if needed)
    return scored.map((entry) => entry.food);
  } catch (err) {
    console.error("Error fetching food by name:", err);
    throw err;
  }
};
