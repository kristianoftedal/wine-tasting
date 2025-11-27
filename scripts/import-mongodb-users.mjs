/**
 * MongoDB to Supabase User Migration Script
 * 
 * Usage:
 * 1. Export your MongoDB users: mongoexport --db yourdb --collection users --out mongodb-exports/users.json
 * 2. Set environment variables:
 *    - SUPABASE_URL (your Supabase project URL)
 *    - SUPABASE_SERVICE_ROLE_KEY (from Supabase dashboard > Settings > API)
 * 3. Run: node scripts/import-mongodb-users.mjs
 *    Or with password migration: MIGRATE_PASSWORDS=true node scripts/import-mongodb-users.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MIGRATE_PASSWORDS = process.env.MIGRATE_PASSWORDS === 'true';
const SEND_PASSWORD_RESET = process.env.SEND_PASSWORD_RESET === 'true';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables:');
  console.error('- SUPABASE_URL');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase Admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function importUsers() {
  // Read MongoDB export
  const usersPath = 'mongodb-exports/users.json';
  
  if (!existsSync(usersPath)) {
    console.error(`File not found: ${usersPath}`);
    console.error('Please export your MongoDB users first:');
    console.error('mongoexport --db yourdb --collection users --out mongodb-exports/users.json');
    process.exit(1);
  }

  const fileContent = readFileSync(usersPath, 'utf-8');
  
  // Handle both JSON array and newline-delimited JSON (mongoexport default)
  let mongoUsers;
  try {
    mongoUsers = JSON.parse(fileContent);
    if (!Array.isArray(mongoUsers)) {
      mongoUsers = [mongoUsers];
    }
  } catch {
    // Try parsing as newline-delimited JSON
    mongoUsers = fileContent
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  console.log(`Found ${mongoUsers.length} users to migrate`);

  const idMapping = {};
  const results = {
    success: [],
    failed: [],
    skipped: []
  };

  for (const mongoUser of mongoUsers) {
    const email = mongoUser.email;
    const mongoId = mongoUser._id?.$oid || mongoUser._id;
    
    if (!email) {
      console.log(`Skipping user without email: ${mongoId}`);
      results.skipped.push({ mongoId, reason: 'No email' });
      continue;
    }

    console.log(`Processing: ${email}`);

    try {
      // Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === email);

      if (existingUser) {
        console.log(`  User already exists, mapping ID`);
        idMapping[mongoId] = existingUser.id;
        results.skipped.push({ email, mongoId, supabaseId: existingUser.id, reason: 'Already exists' });
        continue;
      }

      // Prepare user data for Supabase
      const userData = {
        email: email,
        email_confirm: true, // Skip email verification for migrated users
        user_metadata: {
          name: mongoUser.name || mongoUser.username || email.split('@')[0],
          migrated_from_mongodb: true,
          mongodb_id: mongoId
        }
      };

      // Handle password migration
      if (MIGRATE_PASSWORDS && mongoUser.password) {
        // Check if password is bcrypt hashed
        if (mongoUser.password.startsWith('$2a$') || 
            mongoUser.password.startsWith('$2b$') || 
            mongoUser.password.startsWith('$2y$')) {
          userData.password_hash = mongoUser.password;
        } else {
          // Password is in unknown format, user will need to reset
          userData.password = crypto.randomUUID(); // Temporary password
        }
      } else {
        // Generate random password, user will need to reset
        userData.password = crypto.randomUUID();
      }

      // Create user in Supabase
      const { data: newUser, error } = await supabase.auth.admin.createUser(userData);

      if (error) {
        console.error(`  Failed: ${error.message}`);
        results.failed.push({ email, mongoId, error: error.message });
        continue;
      }

      console.log(`  Created user: ${newUser.user.id}`);
      idMapping[mongoId] = newUser.user.id;
      results.success.push({ email, mongoId, supabaseId: newUser.user.id });

      // Update profile with additional data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: mongoUser.name || mongoUser.username || email.split('@')[0]
        })
        .eq('id', newUser.user.id);

      if (profileError) {
        console.log(`  Warning: Could not update profile: ${profileError.message}`);
      }

      // Send password reset email if requested
      if (SEND_PASSWORD_RESET && !MIGRATE_PASSWORDS) {
        const { error: resetError } = await supabase.auth.admin.generateLink({
          type: 'recovery',
          email: email
        });
        
        if (resetError) {
          console.log(`  Warning: Could not send reset email: ${resetError.message}`);
        } else {
          console.log(`  Password reset email sent`);
        }
      }

    } catch (err) {
      console.error(`  Error: ${err.message}`);
      results.failed.push({ email, mongoId, error: err.message });
    }
  }

  // Save ID mapping for other migrations
  writeFileSync('mongodb-exports/user-id-mapping.json', JSON.stringify(idMapping, null, 2));

  // Print summary
  console.log('\n=== Migration Summary ===');
  console.log(`Success: ${results.success.length}`);
  console.log(`Failed: ${results.failed.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`\nID mapping saved to: mongodb-exports/user-id-mapping.json`);

  if (results.failed.length > 0) {
    console.log('\nFailed users:');
    results.failed.forEach(f => console.log(`  - ${f.email}: ${f.error}`));
  }

  if (!MIGRATE_PASSWORDS) {
    console.log('\nNote: Users will need to use "Forgot Password" to set their passwords.');
    console.log('To send reset emails automatically, run with: SEND_PASSWORD_RESET=true');
  }
}

importUsers().catch(console.error);
