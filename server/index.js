import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import voiceRoutes from "./routes/voiceRoutes.js";
import foodRoutes from "./routes/foodRoutes.js";
import { connectDB } from "./config/db.js";
import { initWebSocketServer } from "./services/websocket.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Connect to MongoDB and then start the server and WebSocket
connectDB()
  .then(() => {
    // Start Express server
    const server = app.listen(PORT, () => {
      console.log(`----------------------------------------------`);
      console.log(`Database Connected Successfully ✅`);
      console.log(`Server Running on http://localhost:${PORT}✅`);
    });

    // Initialize WebSocket server attached to the same HTTP server
    initWebSocketServer(server);
    console.log(`🌐 WebSocket server initialized`);
  })
  .catch((err) => {
    console.error("Failed to connect to database or start server:", err);
    process.exit(1); // Exit process if DB connection fails
  });

// Basic route to check server status
app.get("/", (req, res) => {
  res.send("Mimi Backend Working Fine 😋");
});

// API Routes
app.use("/api", voiceRoutes);
app.use("/api/foods", foodRoutes);
