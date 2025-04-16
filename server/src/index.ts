import path from "path";
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { connectDB } from "./db";
import app from "./app";

const PORT: number = Number(process.env.PORT);

// Connect to PostgresDB
connectDB();

app.listen(PORT, () => {
  console.info(`🚀 server running at port ${PORT}`);
});
