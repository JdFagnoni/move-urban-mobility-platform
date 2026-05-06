import "dotenv/config";
import express from "express";
import { categorizerRouter } from "./router";

const app = express();
const PORT = process.env["PORT"] ?? "3003";

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "categorizer-service" });
});

app.use("/categorize", categorizerRouter);

app.listen(Number(PORT), () => {
  console.log(`categorizer-service running on port ${PORT}`);
});
