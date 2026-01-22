import { MongoClient, Db, Collection, ObjectId } from "mongodb";
import type {
  Merchant,
  Transaction,
  MerchantFeatures,
  Alert,
  Explanation,
  RagDocument,
} from "./types";

// ==========================================
// MongoDB Connection
// ==========================================

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017";
const DB_NAME = "recurring_payment_firewall";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
  if (db) return db;

  if (!client) {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
  }

  db = client.db(DB_NAME);
  
  // Ensure indexes are created
  await createIndexes(db);
  
  return db;
}

async function createIndexes(database: Db): Promise<void> {
  // Merchant indexes
  await database.collection("merchants").createIndex({ merchantId: 1 }, { unique: true });
  await database.collection("merchants").createIndex({ riskLevel: 1 });
  await database.collection("merchants").createIndex({ currentTrustScore: 1 });

  // Transaction indexes
  await database.collection("transactions").createIndex({ transactionId: 1 }, { unique: true });
  await database.collection("transactions").createIndex({ merchantId: 1 });
  await database.collection("transactions").createIndex({ timestamp: -1 });
  await database.collection("transactions").createIndex({ decision: 1 });

  // MerchantFeatures indexes
  await database.collection("merchantFeatures").createIndex({ merchantId: 1, windowEnd: -1 });

  // Alert indexes
  await database.collection("alerts").createIndex({ alertId: 1 }, { unique: true });
  await database.collection("alerts").createIndex({ merchantId: 1 });
  await database.collection("alerts").createIndex({ status: 1 });
  await database.collection("alerts").createIndex({ severity: 1 });
  await database.collection("alerts").createIndex({ createdAt: -1 });

  // Explanation indexes
  await database.collection("explanations").createIndex({ explanationId: 1 }, { unique: true });
  await database.collection("explanations").createIndex({ merchantId: 1 });
  await database.collection("explanations").createIndex({ alertId: 1 });

  // RagDocument indexes
  await database.collection("ragDocuments").createIndex({ docId: 1 }, { unique: true });
  await database.collection("ragDocuments").createIndex({ tags: 1 });
}

// ==========================================
// Collection Helpers
// ==========================================

export async function getMerchantsCollection(): Promise<Collection<Merchant & { _id?: ObjectId }>> {
  const database = await connectToDatabase();
  return database.collection("merchants");
}

export async function getTransactionsCollection(): Promise<Collection<Transaction & { _id?: ObjectId }>> {
  const database = await connectToDatabase();
  return database.collection("transactions");
}

export async function getMerchantFeaturesCollection(): Promise<Collection<MerchantFeatures & { _id?: ObjectId }>> {
  const database = await connectToDatabase();
  return database.collection("merchantFeatures");
}

export async function getAlertsCollection(): Promise<Collection<Alert & { _id?: ObjectId }>> {
  const database = await connectToDatabase();
  return database.collection("alerts");
}

export async function getExplanationsCollection(): Promise<Collection<Explanation & { _id?: ObjectId }>> {
  const database = await connectToDatabase();
  return database.collection("explanations");
}

export async function getRagDocumentsCollection(): Promise<Collection<RagDocument & { _id?: ObjectId }>> {
  const database = await connectToDatabase();
  return database.collection("ragDocuments");
}

// ==========================================
// CRUD Operations - Merchants
// ==========================================

export async function getMerchantById(merchantId: string): Promise<Merchant | null> {
  const collection = await getMerchantsCollection();
  const doc = await collection.findOne({ merchantId });
  if (!doc) return null;
  const { _id, ...merchant } = doc;
  return merchant as Merchant;
}

export async function upsertMerchant(merchant: Merchant): Promise<void> {
  const collection = await getMerchantsCollection();
  await collection.updateOne(
    { merchantId: merchant.merchantId },
    { $set: merchant },
    { upsert: true }
  );
}

export async function getMerchants(options: {
  page?: number;
  limit?: number;
  riskLevel?: string;
  search?: string;
}): Promise<{ merchants: Merchant[]; total: number }> {
  const collection = await getMerchantsCollection();
  const { page = 1, limit = 20, riskLevel, search } = options;
  
  const filter: Record<string, unknown> = {};
  if (riskLevel) filter.riskLevel = riskLevel;
  if (search) {
    filter.$or = [
      { merchantId: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
    ];
  }

  const [docs, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ currentTrustScore: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    merchants: docs.map(({ _id, ...m }) => m as Merchant),
    total,
  };
}

// ==========================================
// CRUD Operations - Transactions
// ==========================================

export async function insertTransaction(transaction: Transaction): Promise<void> {
  const collection = await getTransactionsCollection();
  await collection.insertOne(transaction);
}

export async function getTransactions(options: {
  page?: number;
  limit?: number;
  merchantId?: string;
  decision?: string;
}): Promise<{ transactions: Transaction[]; total: number }> {
  const collection = await getTransactionsCollection();
  const { page = 1, limit = 20, merchantId, decision } = options;
  
  const filter: Record<string, unknown> = {};
  if (merchantId) filter.merchantId = merchantId;
  if (decision) filter.decision = decision;

  const [docs, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    transactions: docs.map(({ _id, ...t }) => t as Transaction),
    total,
  };
}

export async function getTransactionStats(): Promise<{
  total: number;
  allow: number;
  review: number;
  block: number;
}> {
  const collection = await getTransactionsCollection();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [total, allow, review, block] = await Promise.all([
    collection.countDocuments({ timestamp: { $gte: today } }),
    collection.countDocuments({ timestamp: { $gte: today }, decision: "ALLOW" }),
    collection.countDocuments({ timestamp: { $gte: today }, decision: "REVIEW" }),
    collection.countDocuments({ timestamp: { $gte: today }, decision: "BLOCK" }),
  ]);

  return { total, allow, review, block };
}

// ==========================================
// CRUD Operations - Merchant Features
// ==========================================

export async function getLatestMerchantFeatures(merchantId: string): Promise<MerchantFeatures | null> {
  const collection = await getMerchantFeaturesCollection();
  const doc = await collection.findOne(
    { merchantId },
    { sort: { windowEnd: -1 } }
  );
  if (!doc) return null;
  const { _id, ...features } = doc;
  return features as MerchantFeatures;
}

export async function upsertMerchantFeatures(features: MerchantFeatures): Promise<void> {
  const collection = await getMerchantFeaturesCollection();
  await collection.updateOne(
    { merchantId: features.merchantId, windowEnd: features.windowEnd },
    { $set: features },
    { upsert: true }
  );
}

// ==========================================
// CRUD Operations - Alerts
// ==========================================

export async function insertAlert(alert: Alert): Promise<void> {
  const collection = await getAlertsCollection();
  await collection.insertOne(alert);
}

export async function getAlerts(options: {
  page?: number;
  limit?: number;
  status?: string;
  severity?: string;
  merchantId?: string;
}): Promise<{ alerts: Alert[]; total: number }> {
  const collection = await getAlertsCollection();
  const { page = 1, limit = 20, status, severity, merchantId } = options;
  
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  if (merchantId) filter.merchantId = merchantId;

  const [docs, total] = await Promise.all([
    collection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray(),
    collection.countDocuments(filter),
  ]);

  return {
    alerts: docs.map(({ _id, ...a }) => a as Alert),
    total,
  };
}

export async function getAlertById(alertId: string): Promise<Alert | null> {
  const collection = await getAlertsCollection();
  const doc = await collection.findOne({ alertId });
  if (!doc) return null;
  const { _id, ...alert } = doc;
  return alert as Alert;
}

export async function resolveAlert(alertId: string): Promise<void> {
  const collection = await getAlertsCollection();
  await collection.updateOne(
    { alertId },
    { $set: { status: "RESOLVED", resolvedAt: new Date() } }
  );
}

export async function getOpenAlertsCount(): Promise<number> {
  const collection = await getAlertsCollection();
  return collection.countDocuments({ status: "OPEN" });
}

// ==========================================
// CRUD Operations - Explanations
// ==========================================

export async function insertExplanation(explanation: Explanation): Promise<void> {
  const collection = await getExplanationsCollection();
  await collection.insertOne(explanation);
}

export async function getLatestExplanation(merchantId: string): Promise<Explanation | null> {
  const collection = await getExplanationsCollection();
  const doc = await collection.findOne(
    { merchantId },
    { sort: { createdAt: -1 } }
  );
  if (!doc) return null;
  const { _id, ...explanation } = doc;
  return explanation as Explanation;
}

// ==========================================
// CRUD Operations - RAG Documents
// ==========================================

export async function upsertRagDocument(doc: RagDocument): Promise<void> {
  const collection = await getRagDocumentsCollection();
  await collection.updateOne(
    { docId: doc.docId },
    { $set: doc },
    { upsert: true }
  );
}

export async function getAllRagDocuments(): Promise<RagDocument[]> {
  const collection = await getRagDocumentsCollection();
  const docs = await collection.find({}).toArray();
  return docs.map(({ _id, ...d }) => d as RagDocument);
}
