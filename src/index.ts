import express, { Application, Request, Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth";
import employeeRoutes from "./routes/employee.routes";
import departmentRoutes from "./routes/department.routes"
import attendanceRoutes from "./routes/attendance.routes";
import leaveRoutes from "./routes/leave.routes";

const app: Application = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:3000", credentials: true }));

app.use("/api/auth", (req, _res, next) => {
  console.log(`[Auth] ${req.method} ${req.originalUrl}`);
  next();
});

app.all("/api/auth/*splat", toNodeHandler(auth));

// ✅ Auth BEFORE express.json() — toNodeHandler reads the raw stream
app.all("/api/auth/*splat", toNodeHandler(auth));

// ✅ express.json() only for your own routes
app.use(express.json());

app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);

app.get("/", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "UP", message: "EMS Server is running smoothly" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is blasting off on http://localhost:${PORT}`);
});
