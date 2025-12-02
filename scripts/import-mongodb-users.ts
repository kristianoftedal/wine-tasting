/**
 * MongoDB Users to Supabase Migration Script
 *
 * This script migrates users from MongoDB to Supabase Auth.
 *
 * Usage:
 * 1. Export your MongoDB users collection to JSON
 * 2. Place the file at mongodb-exports/users.json
 * 3. Run: npx ts-node scripts/import-mongodb-users.ts
 *
 * Options:
 * - MIGRATE_PASSWORDS=true: Attempt to migrate bcrypt password hashes (if compatible)
 * - MIGRATE_PASSWORDS=false: Users will need to reset their passwords
 */

import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

// Initialize Supabase Admin client (requires service role key)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Configuration
const MIGRATE_PASSWORDS = process.env.MIGRATE_PASSWORDS === "true"
const EXPORTS_DIR = path.join(process.cwd(), "mongodb-exports")

interface MongoDBUser {
  _id: { $oid: string } | string
  email: string
  name?: string
  password?: string // bcrypt hash
  createdAt?: { $date: string } | string
  updatedAt?: { $date: string } | string
}

interface MigrationResult {
  success: number
  failed: number
  skipped: number
  errors: Array<{ email: string; error: string }>
  idMapping: Map<string, string> // MongoDB _id -> Supabase user id
}

function extractId(id: { $oid: string } | string): string {
  return typeof id === "object" && "$oid" in id ? id.$oid : String(id)
}

function extractDate(date: { $date: string } | string | undefined): string | undefined {
  if (!date) return undefined
  return typeof date === "object" && "$date" in date ? date.$date : String(date)
}

async function importUsers(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    idMapping: new Map(),
  }

  // Read MongoDB users export
  const usersFile = path.join(EXPORTS_DIR, "users.json")

  if (!fs.existsSync(usersFile)) {
    console.error(`Users file not found: ${usersFile}`)
    console.log("\nPlease export your MongoDB users collection:")
    console.log("  mongoexport --db yourdb --collection users --out mongodb-exports/users.json")
    process.exit(1)
  }

  const fileContent = fs.readFileSync(usersFile, "utf-8")

  // Handle both JSON array and newline-delimited JSON (mongoexport format)
  let users: MongoDBUser[]
  try {
    users = JSON.parse(fileContent)
    if (!Array.isArray(users)) {
      users = [users]
    }
  } catch {
    // Try newline-delimited JSON
    users = fileContent
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line))
  }

  console.log(`Found ${users.length} users to migrate`)
  console.log(`Password migration: ${MIGRATE_PASSWORDS ? "ENABLED" : "DISABLED (users will need to reset passwords)"}`)
  console.log("")

  for (const mongoUser of users) {
    const mongoId = extractId(mongoUser._id)
    const email = mongoUser.email?.toLowerCase()

    if (!email) {
      console.log(`⚠ Skipping user ${mongoId}: No email address`)
      result.skipped++
      continue
    }

    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find((u) => u.email?.toLowerCase() === email)

      if (existingUser) {
        console.log(`⚠ Skipping ${email}: Already exists in Supabase`)
        result.idMapping.set(mongoId, existingUser.id)
        result.skipped++
        continue
      }

      // Create user in Supabase Auth
      const createUserOptions: any = {
        email,
        email_confirm: true, // Auto-confirm since they were already verified in MongoDB
        user_metadata: {
          name: mongoUser.name || email.split("@")[0],
          migrated_from_mongodb: true,
          mongodb_id: mongoId,
        },
      }

      if (MIGRATE_PASSWORDS && mongoUser.password) {
        // Supabase supports bcrypt hashes directly
        // The hash must be in the format: $2a$..., $2b$..., or $2y$...
        if (mongoUser.password.startsWith("$2")) {
          createUserOptions.password_hash = mongoUser.password
        } else {
          console.log(`⚠ ${email}: Password hash format not supported, user will need to reset password`)
        }
      } else {
        // Generate a random password - user will need to reset it
        createUserOptions.password = crypto.randomUUID() + crypto.randomUUID()
      }

      const { data: newUser, error } = await supabase.auth.admin.createUser(createUserOptions)

      if (error) {
        throw error
      }

      if (newUser?.user) {
        result.idMapping.set(mongoId, newUser.user.id)
        result.success++
        console.log(`✓ Migrated: ${email}`)

        // Update the profile with additional data if needed
        // The profile is auto-created by our trigger, but we can update it
        if (mongoUser.name) {
          await supabase
            .from("profiles")
            .update({
              name: mongoUser.name,
              updated_at: extractDate(mongoUser.updatedAt) || new Date().toISOString(),
            })
            .eq("id", newUser.user.id)
        }
      }
    } catch (error: any) {
      result.failed++
      result.errors.push({ email, error: error.message || String(error) })
      console.log(`✗ Failed: ${email} - ${error.message}`)
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  return result
}

async function sendPasswordResetEmails(idMapping: Map<string, string>) {
  if (MIGRATE_PASSWORDS) {
    console.log("\nPasswords were migrated, no reset emails needed.")
    return
  }

  console.log("\n--- Sending Password Reset Emails ---")
  console.log("Since passwords were not migrated, users need to reset their passwords.")

  const readline = await import("readline")
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const answer = await new Promise<string>((resolve) => {
    rl.question("Send password reset emails to all migrated users? (yes/no): ", resolve)
  })
  rl.close()

  if (answer.toLowerCase() !== "yes") {
    console.log("Skipping password reset emails.")
    console.log("Users can reset their passwords manually at your login page.")
    return
  }

  let sent = 0
  let failed = 0

  for (const [, supabaseId] of idMapping) {
    const { data: user } = await supabase.auth.admin.getUserById(supabaseId)

    if (user?.user?.email) {
      const { error } = await supabase.auth.resetPasswordForEmail(user.user.email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/reset-password`,
      })

      if (error) {
        console.log(`✗ Failed to send reset email to ${user.user.email}: ${error.message}`)
        failed++
      } else {
        console.log(`✓ Sent reset email to ${user.user.email}`)
        sent++
      }

      // Delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }

  console.log(`\nPassword reset emails: ${sent} sent, ${failed} failed`)
}

async function saveIdMapping(idMapping: Map<string, string>) {
  const mappingFile = path.join(EXPORTS_DIR, "user-id-mapping.json")
  const mapping = Object.fromEntries(idMapping)
  fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2))
  console.log(`\nID mapping saved to: ${mappingFile}`)
  console.log("Use this file when migrating tastings and other user-related data.")
}

async function main() {
  console.log("=== MongoDB to Supabase User Migration ===\n")

  const result = await importUsers()

  console.log("\n--- Migration Summary ---")
  console.log(`✓ Success: ${result.success}`)
  console.log(`⚠ Skipped: ${result.skipped}`)
  console.log(`✗ Failed: ${result.failed}`)

  if (result.errors.length > 0) {
    console.log("\nErrors:")
    result.errors.forEach(({ email, error }) => {
      console.log(`  - ${email}: ${error}`)
    })
  }

  // Save the ID mapping for use in other migrations
  await saveIdMapping(result.idMapping)

  // Optionally send password reset emails
  if (result.success > 0) {
    await sendPasswordResetEmails(result.idMapping)
  }

  console.log("\n=== Migration Complete ===")
}

main().catch(console.error)
