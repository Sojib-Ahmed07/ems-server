import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/config/prisma.js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.SERVER_URL || "http://localhost:5000",
  basePath: "/api/auth",
  advanced: {
    disableOriginCheck: process.env.NODE_ENV !== "production",
  },
  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3000"],

  // 👇 GOOGLE OAUTH CONFIGURATION ADDED HERE
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url, token }) => {
      try {
        await resend.emails.send({
          from: "EMS Auth <onboarding@resend.dev>",
          to: user.email,
          subject: "Reset your EMS Password",
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
              <h2>Password Reset Request</h2>
              <p>Hello ${user.name || "User"},</p>
              <p>We received a request to reset your password for your Employee Management System account.</p>
              <p style="margin: 24px 0;">
                <a href="${url}" style="background-color: #000000; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
              </p>
              <p>If you did not request this, you can safely ignore this email.</p>
            </div>
          `,
        });
      } catch (error) {
        console.error(
          "❌ Failed to send password reset email via Resend:",
          error,
        );
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      try {
        await resend.emails.send({
          from: "EMS Auth <onboarding@resend.dev>",
          to: user.email,
          subject: "Verify your EMS Email Address",
          html: `
            <div style="font-family: sans-serif; padding: 20px; max-width: 600px;">
              <h2>Welcome to EMS!</h2>
              <p>Hello ${user.name || "User"},</p>
              <p>Please confirm your email address to complete your registration setup.</p>
              <p style="margin: 24px 0;">
                <a href="${url}" style="background-color: #0070f3; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Verify Email Address</a>
              </p>
              <p>Thank you!</p>
            </div>
          `,
        });
      } catch (error) {
        console.error(
          "❌ Failed to send verification email via Resend:",
          error,
        );
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
