import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../config/prisma.js";
import { BrevoClient } from "@getbrevo/brevo";

// Modern Brevo SDK initialization using the new unified BrevoClient wrapper
const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY as string,
});

const BREVO_SENDER = {
  name: "EMS Administration",
  email: "menarebrave7878@gmail.com",
};

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  baseURL: process.env.SERVER_URL || "http://localhost:5000",
  basePath: "/api/auth",

  advanced: {
    disableOriginCheck: process.env.NODE_ENV !== "production",
    // ⚠️ CRITICAL STEP 1: Forces cookies to be flagged as Secure across all environments
    // so modern browsers accept SameSite=None tracking properties.
    useSecureCookies: true,

    // ⚠️ CRITICAL STEP 2: Explicitly overrides Better-Auth defaults to let cookies travel
    // cross-site from localhost to your live Render backend.
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      partitioned: true, // Follows modern cookie isolation paradigms mandated by modern browsers
    },
  },

  trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3000"],

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
        await brevo.transactionalEmails.sendTransacEmail({
          subject: "Reset your EMS Password",
          htmlContent: `
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
          sender: BREVO_SENDER,
          to: [{ email: user.email, name: user.name || "User" }],
        });

        console.log(
          `✉️ Password reset link cleanly dispatched via Brevo to: ${user.email}`,
        );
      } catch (error) {
        console.error(
          "❌ Failed to send password reset email via Brevo:",
          error,
        );
      }
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }) => {
      try {
        await brevo.transactionalEmails.sendTransacEmail({
          subject: "Verify your EMS Email Address",
          htmlContent: `
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
          sender: BREVO_SENDER,
          to: [{ email: user.email, name: user.name || "User" }],
        });

        console.log(
          `✉️ Email verification packet dispatched via Brevo to: ${user.email}`,
        );
      } catch (error) {
        console.error("❌ Failed to send verification email via Brevo:", error);
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
