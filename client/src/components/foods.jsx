"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import mimi from "../assets/mimi2.jpg";
import {
  X,
  Flame,
  Leaf,
  BarChart3,
  DollarSign,
  Filter,
  Clock,
  Search,
} from "lucide-react";
import { getAllFoods } from "../services/foodService";
import Mimi from "./EnhancedVoiceTester";

const AllFoods = () => {
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);

  // Function to handle filters from Voice Agent
  const handleFiltersFromVoiceAgent = (filtersData) => {
    console.log("Received filters from Chat component:", filtersData);

    // Show filter loading
    setFilterLoading(true);

    setTimeout(() => {
      // Show modal if the intent is to get food by name
      if (filtersData.intent === "get_food_by_name" && filtersData.name) {
        const foundFood = foods.find((food) =>
          food.name.toLowerCase().includes(filtersData.name.toLowerCase())
        );

        if (foundFood) {
          setSelectedFood(foundFood);
          setShowModal(true);
        }
      } else if (filtersData.intent === "vague_query") {
        // Reset the filters for vague queries
        setFilters(null);
      } else {
        setFilters(filtersData);
      }
      setFilterLoading(false);
    }, 800);
  };

  useEffect(() => {
    const fetchFoods = async () => {
      try {
        const data = await getAllFoods();
        setFoods(data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading foods:", err);
        setLoading(false);
      }
    };

    fetchFoods();
  }, []);

  // Filter foods based on the received filters
  const filteredFoods = React.useMemo(() => {
    if (!filters || !foods.length) return foods;

    return foods.filter((food) => {
      // Filter by type (e.g., "pizza")
      if (
        filters.type &&
        food.type.toLowerCase() !== filters.type.toLowerCase()
      ) {
        return false;
      }

      // Filter by spicy (boolean)
      if (filters.spicy !== null && food.spicy !== filters.spicy) {
        // Corrected: food.spicy !== filters.spicy
        return false;
      }

      // Filter by vegetarian (boolean)
      if (
        filters.vegetarian !== null &&
        food.vegetarian !== filters.vegetarian
      ) {
        return false;
      }

      // Filter by max calories
      if (filters.maxCalories !== null && food.calories > filters.maxCalories) {
        return false;
      }

      // Filter by max price
      if (filters.maxPrice !== null && food.price > filters.maxPrice) {
        return false;
      }

      return true;
    });
  }, [foods, filters]);

  // Close modal when filters change
  React.useEffect(() => {
    if (filters && showModal) {
      setShowModal(false);
      setSelectedFood(null);
    }
  }, [filters]);

  const closeModal = () => {
    setShowModal(false);
    setSelectedFood(null);
  };

  const resetFilters = () => {
    setFilters(null);
  };

  const hasActiveFilters =
    filters &&
    Object.values(filters).some(
      (value) => value !== null && value !== undefined && value !== false
    );

  if (loading)
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full mx-auto mb-4"
            animate={{ rotate: 360 }}
            transition={{
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }}
          />
          <p className="text-gray-700 text-lg font-medium font-f1">
            Loading delicious foods...
          </p>
        </motion.div>
      </div>
    );

  return (
    <div className="min-h-screen font-f1 bg-gradient-to-br from-gray-100 via-white to-gray-200">
      {/* Filter Loading Overlay */}
      <AnimatePresence>
        {filterLoading && (
          <motion.div
            className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="text-center bg-white rounded-2xl p-8 shadow-xl border border-gray-200"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="w-10 h-10 border-3 border-gray-200 border-t-gray-900 rounded-full mx-auto mb-4"
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Number.POSITIVE_INFINITY,
                  ease: "linear",
                }}
              />
              <p className="text-gray-900 text-lg font-semibold font-f1">
                Mimi is thinking...
              </p>
              <p className="text-gray-700 text-sm mt-1 font-f1">
                Finding the perfect dishes for you
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Food Modal */}
      <AnimatePresence>
        {showModal && selectedFood && (
          <motion.div
            className="fixed inset-0 bg-white/50 backdrop-blur-sm z-40 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="bg-white rounded-3xl max-w-2xl w-full p-0 relative overflow-hidden shadow-2xl border border-gray-200"
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 w-10 h-10 bg-gray-100/90 backdrop-blur-sm hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-700 hover:text-gray-900 transition-all z-10 shadow-lg"
              >
                <X size={20} />
              </button>

              {/* Food Image Header */}
              <div className="relative h-48 bg-gradient-to-br from-gray-100 to-gray-200">
                <img
                  src={selectedFood.pictureUrl || "/placeholder.svg"}
                  alt={selectedFood.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.nextSibling.style.display = "flex";
                  }}
                />
                <div
                  className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-700 text-lg font-medium absolute inset-0 font-f1"
                  style={{ display: "none" }}
                >
                  🍽️ {selectedFood.name}
                </div>

                {/* Floating badges */}
                <div className="absolute top-4 left-4 flex gap-2">
                  {selectedFood.spicy && (
                    <span className="bg-gray-200 text-gray-800 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                      <Flame size={12} />
                      Spicy
                    </span>
                  )}
                  {selectedFood.vegetarian && (
                    <span className="bg-gray-200 text-gray-800 text-xs px-3 py-1 rounded-full font-medium flex items-center gap-1">
                      <Leaf size={12} />
                      Vegetarian
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-1 font-f1">
                      {selectedFood.name}
                    </h2>
                    <p className="text-gray-800 font-medium uppercase tracking-wide text-sm font-f1">
                      {selectedFood.type} Special
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-gray-900 font-f1">
                      ${selectedFood.price.toFixed(2)}
                    </p>
                    <p className="text-sm text-gray-700 font-f1">
                      {selectedFood.calories} calories
                    </p>
                  </div>
                </div>

                {selectedFood.description && (
                  <p className="text-gray-700 mb-6 leading-relaxed font-f1">
                    {selectedFood.description}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-100 rounded-xl p-4 text-center">
                    <BarChart3 className="w-6 h-6 text-gray-800 mx-auto mb-2" />
                    <p className="text-sm text-gray-700 font-f1">Calories</p>
                    <p className="font-bold text-gray-900 font-f1">
                      {selectedFood.calories}
                    </p>
                  </div>
                  <div className="bg-gray-100 rounded-xl p-4 text-center">
                    <DollarSign className="w-6 h-6 text-gray-800 mx-auto mb-2" />
                    <p className="text-sm text-gray-700 font-f1">Price</p>
                    <p className="font-bold text-gray-900 font-f1">
                      ${selectedFood.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Section */}
      {/* Header Section */}
      <motion.div
        className="bg-white border-b border-gray-200 shadow-lg"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Information */}
            <motion.div
              className="text-left"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
              >
                <h1 className="text-5xl md:text-6xl text-gray-900 mb-6 font-f1">
                  Just Ask Mimi
                </h1>
                <p className="text-gray-700 text-xl font-f1 leading-relaxed">
                  No buttons. No scrolling. Just tell Mimi what you're in the mood for, and she'll serve up the perfect dish all by voice.
                </p>
              </motion.div>
            </motion.div>

            {/* Right Column - Image */}
            <motion.div
              className="flex justify-center lg:justify-end"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <div className="relative">
                <img
                  src={mimi}
                  alt="Mimi"
                  className="w-full max-w-md h-50 object-cover rounded-2xl shadow-2xl"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-2xl"></div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
      {/* Voice Component */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        <Mimi onDataReceived={handleFiltersFromVoiceAgent} />
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Results Counter */}
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          <div className="inline-flex items-center space-x-3 bg-white rounded-full px-6 py-4 shadow-sm border border-gray-200">
            <Search className="w-5 h-5 text-gray-800" />
            <span className="text-gray-800 font-medium font-f1">
              Showing {filteredFoods.length} of {foods.length} dishes
            </span>
            {filteredFoods.length > 0 && (
              <motion.div
                className="w-2 h-2 bg-gray-800 rounded-full"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, duration: 0.3 }}
              />
            )}
          </div>

          {/* No Results Message */}
          <AnimatePresence>
            {filteredFoods.length === 0 && filters && (
              <motion.div
                className="mt-6 p-6 bg-white border border-gray-200 rounded-2xl shadow-sm"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2 font-f1">
                  No dishes match your criteria
                </h3>
                <p className="text-gray-700 font-f1">
                  Try asking for different preferences from MIMI or browse all
                  our delicious options
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Filter Display Area */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              className="mb-6 p-3 bg-gray-100 rounded-lg border border-gray-200 shadow-sm flex flex-wrap items-center justify-center gap-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <Filter className="w-4 h-4 text-gray-700 flex-shrink-0" />
              <span className="text-gray-800 font-medium font-f1 text-sm mr-1">
                Active Filters:
              </span>
              {filters.type && (
                <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  Type: {filters.type}
                </span>
              )}
              {filters.spicy !== null && (
                <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  Spicy: {filters.spicy ? "Yes" : "No"}
                </span>
              )}
              {filters.vegetarian !== null && (
                <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  Vegetarian: {filters.vegetarian ? "Yes" : "No"}
                </span>
              )}
              {filters.maxCalories !== null && (
                <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  Max Calories: {filters.maxCalories}
                </span>
              )}
              {filters.maxPrice !== null && (
                <span className="bg-gray-200 text-gray-800 text-xs px-2 py-1 rounded-full font-medium">
                  Max Price: ${filters.maxPrice.toFixed(2)}
                </span>
              )}
              <button
                onClick={resetFilters}
                className="ml-2 bg-gray-900 hover:bg-black text-white text-xs px-3 py-1.5 rounded-full font-semibold transition-colors"
              >
                Reset
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Food Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
        >
          <AnimatePresence>
            {filteredFoods.map((food, index) => (
              <motion.div
                key={food._id}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover: transition-all duration-300 flex font-f1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{
                  duration: 0.4,
                  delay: index * 0.1,
                  ease: "easeOut",
                }}
                whileHover={{ y: -8, scale: 1.02 }}
                layout
              >
                {/* Food Image */}
                <div className="relative w-45 h-full flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
                  <img
                    src={
                      food.pictureUrl ||
                      "/placeholder.svg?height=192&width=128&query=food-portrait"
                    }
                    alt={food.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    onError={(e) => {
                      e.target.style.display = "none";
                      e.target.nextSibling.style.display = "flex";
                    }}
                  />
                  <div
                    className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center text-gray-400 text-4xl absolute inset-0"
                    style={{ display: "none" }}
                  >
                    🍽️
                  </div>

                  {/* Floating badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    {food.spicy && (
                      <span className="bg-gray-200/90 backdrop-blur-sm text-gray-800 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <Flame size={10} />
                        Spicy
                      </span>
                    )}
                    {food.vegetarian && (
                      <span className="bg-gray-200/90 backdrop-blur-sm text-gray-800 text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1">
                        <Leaf size={10} />
                        Veg
                      </span>
                    )}
                  </div>

                  {/* Price badge */}
                  <div className="absolute bottom-3 right-3">
                    <span className="bg-gray-100/95 backdrop-blur-sm text-gray-900 text-lg px-3 py-1 rounded-full font-f1 shadow-sm border border-gray-300 font-f1">
                      ${food.price.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 flex flex-col justify-between flex-grow h-full">
                  <div>
                    {/* Header */}
                    <div className="mb-3">
                      <p className="text-xs text-gray-800 uppercase tracking-wide font-semibold mb-1 font-f1">
                        {food.type.toUpperCase()} SPECIAL
                      </p>
                      <h3 className="text-xl font-f1 text-gray-900 mb-2 group-hover:text-black transition-colors font-f1">
                        {food.name}
                      </h3>
                    </div>

                    {/* Description */}
                    {food.description && (
                      <p className="text-gray-700 text-sm mb-4 line-clamp-2 leading-relaxed font-f1">
                        {food.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-gray-700 font-f1">
                          <BarChart3 size={14} />
                          {food.calories} cal
                        </span>
                        <span className="flex items-center gap-1 text-gray-700 font-f1">
                          <Clock size={14} />
                          {food.preparationTime} min
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <motion.button
                    className="w-full mt-4 bg-gray-900 hover:bg-black text-white py-2 px-4 text-sm rounded-xl font-semibold transition-colors font-f1"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedFood(food);
                      setShowModal(true);
                    }}
                  >
                    View Details
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Empty State */}
        <AnimatePresence>
          {filteredFoods.length === 0 && !filters && (
            <motion.div
              className="text-center py-20"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
            >
              <div className="text-8xl mb-6">🍽️</div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">
                No dishes available
              </h3>
              <p className="text-gray-700 text-lg max-w-md mx-auto leading-relaxed">
                Check back later for delicious options! Our chefs are always
                creating something amazing.
              </p>
              <motion.button
                className="mt-6 bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-semibold transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Refresh Menu
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AllFoods;
