// ==========================================
// Simple Auth System
// ==========================================

import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "./db";

const SESSION_COOKIE_NAME = "rpf_session";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

interface User {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface Session {
  sessionId: string;
  userId: string;
  email: string;
  expiresAt: Date;
}

/**
 * Check if auth is disabled via environment variable
 */
export function isAuthDisabled(): boolean {
  return process.env.AUTH_DISABLED === "true";
}

/**
 * Generate a random session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Generate a random user ID
 */
function generateUserId(): string {
  return `user_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user
 */
export async function createUser(email: string, password: string): Promise<User> {
  const db = await connectToDatabase();
  const usersCollection = db.collection("users");

  // Check if user already exists
  const existingUser = await usersCollection.findOne({ email });
  if (existingUser) {
    throw new Error("User with this email already exists");
  }

  const user: User = {
    userId: generateUserId(),
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date(),
  };

  await usersCollection.insertOne(user);
  return user;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const db = await connectToDatabase();
  const usersCollection = db.collection("users");
  const doc = await usersCollection.findOne({ email });
  if (!doc) return null;
  return {
    userId: doc.userId,
    email: doc.email,
    passwordHash: doc.passwordHash,
    createdAt: doc.createdAt,
  };
}

/**
 * Create a session for a user
 */
export async function createSession(userId: string, email: string): Promise<Session> {
  const db = await connectToDatabase();
  const sessionsCollection = db.collection("sessions");

  const session: Session = {
    sessionId: generateSessionId(),
    userId,
    email,
    expiresAt: new Date(Date.now() + SESSION_DURATION),
  };

  await sessionsCollection.insertOne(session);
  return session;
}

/**
 * Get session by ID
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  const db = await connectToDatabase();
  const sessionsCollection = db.collection("sessions");
  const doc = await sessionsCollection.findOne({ sessionId });
  
  if (!doc) return null;
  
  // Check if session is expired
  if (new Date(doc.expiresAt) < new Date()) {
    await sessionsCollection.deleteOne({ sessionId });
    return null;
  }

  return {
    sessionId: doc.sessionId,
    userId: doc.userId,
    email: doc.email,
    expiresAt: doc.expiresAt,
  };
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const db = await connectToDatabase();
  const sessionsCollection = db.collection("sessions");
  await sessionsCollection.deleteOne({ sessionId });
}

/**
 * Set session cookie
 */
export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION / 1000,
    path: "/",
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get current session from cookie
 */
export async function getCurrentSession(): Promise<Session | null> {
  // If auth is disabled, return a mock session
  if (isAuthDisabled()) {
    return {
      sessionId: "mock_session",
      userId: "mock_user",
      email: "admin@example.com",
      expiresAt: new Date(Date.now() + SESSION_DURATION),
    };
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (!sessionId) return null;
  
  return getSession(sessionId);
}

/**
 * Login user with email and password
 */
export async function login(email: string, password: string): Promise<Session> {
  const user = await getUserByEmail(email);
  
  if (!user) {
    throw new Error("Invalid email or password");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  
  if (!isValid) {
    throw new Error("Invalid email or password");
  }

  const session = await createSession(user.userId, user.email);
  await setSessionCookie(session.sessionId);
  
  return session;
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  
  if (sessionId) {
    await deleteSession(sessionId);
  }
  
  await clearSessionCookie();
}

/**
 * Require authentication for API routes
 */
export async function requireAuth(): Promise<Session> {
  const session = await getCurrentSession();
  
  if (!session) {
    throw new Error("Unauthorized");
  }
  
  return session;
}
