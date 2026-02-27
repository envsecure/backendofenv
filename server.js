import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import apiRoutes from "./routes/api.js";

dotenv.config();

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json({ limit: "2mb" }));
app.use("/api", apiRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT,"0.0.0.0", () => console.log(`EnvShare API → http://localhost:${PORT}`));