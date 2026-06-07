import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../config/prisma.js";
import { BrevoClient } from "@getbrevo/brevo";

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY as string,
});

const BREVO_SENDER = {
  name: "EMS Administration",
  email: "menarebrave7878@gmail.com",
};

// Explicit Production Constants
const PROD_CLIENT = "https://ems-client-sable-three.vercel.app";
const PROD_SERVER = "https://ems-server-dsh5.onrender.com";

const isProd = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Use explicit environment variables with production fallbacks
  baseURL: process.env.SERVER_URL || PROD_SERVER,
  basePath: "/api/auth",

  advanced: {
    disableOriginCheck: !isProd,
    useSecureCookies: isProd,

    defaultCookieAttributes: isProd
      ? {
          sameSite: "none",
          secure: true,
          partitioned: true,
        }
      : {
          sameSite: "lax",
          secure: false,
        },
  },

  // Ensure these match your actual deployment URLs exactly
  trustedOrigins: [
    process.env.CLIENT_URL || PROD_CLIENT,
    "http://localhost:3000",
  ],

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  // Added Callback Validation to stop "undefined/dashboard" errors
  callbacks: {
    onCallback: (url) => {
      const allowedOrigins = [
        process.env.CLIENT_URL || PROD_CLIENT,
        "http://localhost:3000",
      ];
      if (!allowedOrigins.some((origin) => url.startsWith(origin))) {
        return {
          redirect: `${process.env.CLIENT_URL || PROD_CLIENT}/dashboard`,
        };
      }
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      try {
        await brevo.transactionalEmails.sendTransacEmail({
          subject: "Reset your EMS Password",
          htmlContent: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
              <h2>Password Reset Request</h2>
              <p>Hello ${user.name || "User"},</p>
              <p>We received a request to reset your password.</p>
              <p><a href="${url}">Reset Password</a></p>
            </div>
          `,
          sender: BREVO_SENDER,
          to: [{ email: user.email, name: user.name || "User" }],
        });
      } catch (error) {
        console.error("❌ Failed to send reset email:", error);
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      try {
        await brevo.transactionalEmails.sendTransacEmail({
          subject: "Verify your EMS Email",
          htmlContent: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
              <h2>Welcome to EMS!</h2>
              <p>Please confirm your email address.</p>
              <p><a href="${url}">Verify Email</a></p>
            </div>
          `,
          sender: BREVO_SENDER,
          to: [{ email: user.email, name: user.name || "User" }],
        });
      } catch (error) {
        console.error("❌ Failed to send verification email:", error);
      }
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "EMPLOYEE", input: false },
      departmentId: { type: "string", required: false },
    },
  },
});
