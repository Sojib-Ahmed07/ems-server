import express, { Application, Request, Response } from "express";
import cors from "cors";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./config/auth";
import employeeRoutes from "./routes/employee.routes";
import departmentRoutes from "./routes/department.routes";
import attendanceRoutes from "./routes/attendance.routes";
import leaveRoutes from "./routes/leave.routes";
import analyticsRoutes from "./routes/analytics.routes";

const app: Application = express();
const PORT = process.env.PORT || 5000;

// ✅ Explicit CORS management to allow credentials from localhost
app.use(
  cors({
    origin: ["http://localhost:3000", "https://ems-server-dsh5.onrender.com"],
    credentials: true,
  }),
);

// ✅ Auth middleware MUST run BEFORE express.json()
app.all("/api/auth/*splat", toNodeHandler(auth));

// ✅ Body parser active only for subsequent custom endpoints
app.use(express.json());

app.use("/api/employees", employeeRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/leaves", leaveRoutes);
app.use("/api/analytics", analyticsRoutes);

app.get("/", (req: Request, res: Response) => {
  res
    .status(200)
    .json({ status: "UP", message: "EMS Server is running smoothly" });
});

app.listen(PORT, () => {
  console.log(`🚀 Server is blasting off on http://localhost:${PORT}`);
});
