import crypto from "crypto"
import bcrypt from "bcryptjs"
import { APP_BASE_URL } from "@/lib/utils"

/**
 * Generates a cryptographically secure 256-bit random token (64 hex characters)
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

/**
 * Generates a secure 4-digit PIN password.
 */
export function generateSecurePassword(): string {
  // Generates a random integer between 0 and 9999, securely padded to 4 digits
  const pin = crypto.randomInt(0, 10000)
  return pin.toString().padStart(4, "0")
}

/**
 * Hashes a plaintext password using bcrypt with standard cost factor
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password.trim(), 10)
}

/**
 * Verifies a plaintext password against a stored bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password.trim(), hash)
}

const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.NEXTAUTH_SECRET || "customer_confirmation_session_secret_2026")
  .digest()

/**
 * Reversibly encrypts a password using AES-256-GCM so authorized admins can view and copy credentials
 * without persisting plaintext in the database.
 */
export function encryptPassword(password: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv)
  let encrypted = cipher.update(password.trim(), "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")
  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

/**
 * Decrypts an AES-256-GCM encrypted password string.
 */
export function decryptPassword(cipherText: string | null | undefined): string | null {
  if (!cipherText || typeof cipherText !== "string") return null
  try {
    const parts = cipherText.split(":")
    if (parts.length !== 3) return null
    const [ivHex, authTagHex, encryptedHex] = parts
    const iv = Buffer.from(ivHex, "hex")
    const authTag = Buffer.from(authTagHex, "hex")
    const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv)
    decipher.setAuthTag(authTag)
    let decrypted = decipher.update(encryptedHex, "hex", "utf8")
    decrypted += decipher.final("utf8")
    return decrypted
  } catch {
    return null
  }
}

/**
 * Customer session payload
 */
interface CustomerSessionPayload {
  token: string
  linkId: string
  iat: number
  exp: number
}

const SESSION_SECRET = process.env.NEXTAUTH_SECRET || "customer_confirmation_session_secret_2026"

/**
 * Creates a signed HMAC-SHA256 customer session token for HttpOnly cookie
 */
export function createCustomerSessionToken(
  token: string,
  linkId: string,
  durationHours = 24
): string {
  const now = Date.now()
  const payload: CustomerSessionPayload = {
    token,
    linkId,
    iat: now,
    exp: now + durationHours * 60 * 60 * 1000,
  }

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const hmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url")

  return `${payloadB64}.${hmac}`
}

/**
 * Validates a customer session token against expected link and revocation/password updates/expiration
 */
export function verifyCustomerSessionToken(
  sessionString: string | null | undefined,
  expectedToken: string,
  expectedLinkId: string,
  passwordUpdatedAt?: Date | null,
  passwordExpiresAt?: Date | null
): boolean {
  if (!sessionString || typeof sessionString !== "string") return false

  const parts = sessionString.split(".")
  if (parts.length !== 2) return false

  const [payloadB64, hmac] = parts

  // 1. Verify HMAC signature
  const expectedHmac = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(payloadB64)
    .digest("base64url")

  if (hmac !== expectedHmac) return false

  // 2. Decode payload
  try {
    const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8")
    const payload: CustomerSessionPayload = JSON.parse(payloadJson)

    // 3. Verify association
    if (payload.token !== expectedToken || payload.linkId !== expectedLinkId) {
      return false
    }

    // 4. Verify expiration
    if (Date.now() > payload.exp) {
      return false
    }

    // 5. Invalidate if password was regenerated after session was issued
    if (passwordUpdatedAt && passwordUpdatedAt.getTime() > payload.iat) {
      return false
    }

    // 6. Invalidate if password expiration date has passed
    if (passwordExpiresAt && Date.now() > passwordExpiresAt.getTime()) {
      return false
    }

    return true
  } catch {
    return false
  }
}

/**
 * Calculates link expiration date from preset or custom date
 */
export function calculateExpirationDate(
  preset?: string | null,
  customDate?: string | Date | null,
  defaultDays = 30
): Date {
  const now = Date.now()
  if (!preset || preset === "30d") {
    return new Date(now + 30 * 24 * 60 * 60 * 1000)
  }
  if (preset === "1d") {
    return new Date(now + 1 * 24 * 60 * 60 * 1000)
  }
  if (preset === "7d") {
    return new Date(now + 7 * 24 * 60 * 60 * 1000)
  }
  if (preset === "custom" && customDate) {
    const d = new Date(customDate)
    if (!isNaN(d.getTime())) {
      return d
    }
  }
  return new Date(now + defaultDays * 24 * 60 * 60 * 1000)
}

/**
 * Calculates password expiration date (separate from link expiration)
 */
export function calculatePasswordExpirationDate(
  preset: string | null | undefined,
  linkExpiresAt: Date | null,
  customDate?: string | Date | null
): Date | null {
  const now = Date.now()
  if (!preset || preset === "same") {
    return linkExpiresAt
  }
  if (preset === "1d") {
    return new Date(now + 1 * 24 * 60 * 60 * 1000)
  }
  if (preset === "7d") {
    return new Date(now + 7 * 24 * 60 * 60 * 1000)
  }
  if (preset === "30d") {
    return new Date(now + 30 * 24 * 60 * 60 * 1000)
  }
  if (preset === "custom" && customDate) {
    const d = new Date(customDate)
    if (!isNaN(d.getTime())) {
      return d
    }
  }
  return linkExpiresAt
}

/**
 * Formats a date into a clean, human-readable string: e.g. "24 October 2026, 11:59 PM"
 */
export function formatReadableDate(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "No expiration set"
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput
  if (isNaN(date.getTime())) return "Invalid Date"

  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).replace(/\b(am|pm)\b/g, (match) => match.toUpperCase())
}

/**
 * Cookie name helper
 */
export function getCustomerSessionCookieName(token: string): string {
  // Use a hash of the token to prevent any header-name issues
  const hash = crypto.createHash("md5").update(token).digest("hex").slice(0, 12)
  return `confirm_auth_${hash}`
}

/**
 * Resolves the base URL for the customer confirmation subdomain.
 */
export function getConfirmBaseUrl(requestOrigin?: string | null): string {
  const envShareBase =
    process.env.NEXT_PUBLIC_SHARE_BASE_URL ||
    process.env.SHARE_BASE_URL ||
    process.env.NEXT_PUBLIC_CONFIRM_BASE_URL ||
    process.env.CONFIRM_BASE_URL
  if (envShareBase && envShareBase.trim() !== "") {
    return envShareBase.trim().replace(/\/+$/, "")
  }

  const rawBase = requestOrigin || APP_BASE_URL

  try {
    const url = new URL(rawBase)
    const hostname = url.hostname.toLowerCase()

    if (hostname.startsWith("share.")) {
      return url.origin
    }

    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return url.origin
    }

    if (hostname.startsWith("automation.")) {
      url.hostname = hostname.replace(/^automation\./, "share.")
      return url.origin
    }

    const parts = hostname.split(".")
    if (parts.length > 2) {
      parts[0] = "share"
      url.hostname = parts.join(".")
    } else {
      url.hostname = `share.${hostname}`
    }

    return url.origin
  } catch {
    // APP_BASE_URL could not be parsed as a URL, which is a configuration fault, not
    // something to paper over with a guessed hostname. Set SHARE_BASE_URL.
    throw new Error(
      "Cannot derive the share URL: set SHARE_BASE_URL (or a valid NEXT_PUBLIC_BASE_URL)",
    )
  }
}

/**
 * Builds the full customer share URL given a token.
 */
export function buildConfirmationUrl(token: string, requestOrigin?: string | null): string {
  const baseUrl = getConfirmBaseUrl(requestOrigin)
  try {
    const url = new URL(baseUrl)
    if (url.hostname.startsWith("share.")) {
      return `${baseUrl}/${token}`
    }
  } catch { }
  return `${baseUrl}/share/${token}`
}

const MONTH_NAMES_LIST = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

function formatReadableDateTime(dateInput: Date | string | null | undefined): string {
  if (!dateInput) return "N/A"
  const d = new Date(dateInput)
  if (isNaN(d.getTime())) return "N/A"
  const day = d.getDate()
  const month = MONTH_NAMES_LIST[d.getMonth() + 1]
  const year = d.getFullYear()
  let hours = d.getHours()
  const minutes = d.getMinutes().toString().padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12 || 12
  return `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`
}

/**
 * Formats standardized credentials text for copying and sharing per specifications
 */
export function formatCustomerCredentials(options: {
  projectName: string
  confirmationUrl: string
  password?: string | null
  linkExpiresAt?: Date | string | null
  passwordExpiresAt?: Date | string | null
  month?: number | null
  year?: number | null
}): string {
  const { projectName, confirmationUrl, password, linkExpiresAt, passwordExpiresAt, month, year } = options
  const monthYearText = month && year ? `${MONTH_NAMES_LIST[month]} ${year}` : ""
  const linkExp = formatReadableDateTime(linkExpiresAt)
  const pwdExp = formatReadableDateTime(passwordExpiresAt || linkExpiresAt)

  return `${projectName}\n${monthYearText ? `${monthYearText}\n\n` : "\n"}Share Link:\n${confirmationUrl}\n\nPassword:\n${password || "••••••••••"}\n\nLink Expires:\n${linkExp}\n\nPassword Expires:\n${pwdExp}`
}
