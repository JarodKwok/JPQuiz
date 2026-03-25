"use client";

import type { AISettings } from "@/types";

const SETTINGS_STORAGE_KEY = "jpquiz-ai-settings";
const LEGACY_STORAGE_KEY = "jpquiz-ai-settings";
const KEY_DB_NAME = "jpquiz-secure-storage";
const KEY_STORE_NAME = "keys";
const KEY_RECORD_ID = "ai-settings";
const ENCRYPTION_VERSION = 1;
let latestSaveSequence = 0;

interface EncryptedPayload {
  version: number;
  encrypted: true;
  algorithm: "AES-GCM";
  iv: string;
  cipherText: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isEncryptedPayload(value: unknown): value is EncryptedPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    "encrypted" in value &&
    value.encrypted === true &&
    "iv" in value &&
    typeof value.iv === "string" &&
    "cipherText" in value &&
    typeof value.cipherText === "string"
  );
}

function openKeyDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE_NAME)) {
        db.createObjectStore(KEY_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("安全存储初始化失败。"));
  });
}

async function readKeyFromDb() {
  const db = await openKeyDatabase();

  return new Promise<CryptoKey | null>((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE_NAME, "readonly");
    const store = transaction.objectStore(KEY_STORE_NAME);
    const request = store.get(KEY_RECORD_ID);

    request.onsuccess = () => resolve((request.result as CryptoKey | undefined) || null);
    request.onerror = () =>
      reject(request.error || new Error("读取安全密钥失败。"));
  });
}

async function writeKeyToDb(key: CryptoKey) {
  const db = await openKeyDatabase();

  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KEY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(KEY_STORE_NAME);
    const request = store.put(key, KEY_RECORD_ID);

    request.onsuccess = () => resolve();
    request.onerror = () =>
      reject(request.error || new Error("保存安全密钥失败。"));
  });
}

async function getOrCreateEncryptionKey() {
  const existing = await readKeyFromDb();
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  await writeKeyToDb(key);
  return key;
}

async function encryptSettings(settings: AISettings): Promise<EncryptedPayload> {
  const key = await getOrCreateEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(settings));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    version: ENCRYPTION_VERSION,
    encrypted: true,
    algorithm: "AES-GCM",
    iv: arrayBufferToBase64(iv.buffer),
    cipherText: arrayBufferToBase64(cipherBuffer),
  };
}

async function decryptSettings(payload: EncryptedPayload): Promise<AISettings | null> {
  const key = await readKeyFromDb();
  if (!key) return null;

  try {
    const plainBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToUint8Array(payload.iv),
      },
      key,
      base64ToUint8Array(payload.cipherText)
    );

    return JSON.parse(new TextDecoder().decode(plainBuffer)) as AISettings;
  } catch {
    return null;
  }
}

export async function saveSecureAISettings(settings: AISettings) {
  if (typeof window === "undefined") return;

  const currentSequence = ++latestSaveSequence;
  const encrypted = await encryptSettings(settings);
  if (currentSequence !== latestSaveSequence) return;
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(encrypted));
}

export async function loadSecureAISettings(): Promise<AISettings | null> {
  if (typeof window === "undefined") return null;

  const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);

    if (isEncryptedPayload(parsed)) {
      const decrypted = await decryptSettings(parsed);
      if (!decrypted) {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
      }
      return decrypted;
    }

    const legacy = parsed as AISettings;
    await saveSecureAISettings(legacy);
    if (LEGACY_STORAGE_KEY !== SETTINGS_STORAGE_KEY) {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    return legacy;
  } catch {
    localStorage.removeItem(SETTINGS_STORAGE_KEY);
    return null;
  }
}
