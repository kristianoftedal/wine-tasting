/**
 * MongoDB to Supabase Migration Script
 *
 * Usage:
 * 1. FIRST: Run import-mongodb-users.mjs to import users
 * 2. Export your MongoDB collections using mongoexport or MongoDB Compass
 * 3. Place the JSON files in a folder (e.g., ./mongodb-exports/)
 * 4. Set environment variables:
 *    export SUPABASE_URL="https://your-project.supabase.co"
 *    export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
 * 5. Run this script: node scripts/import-mongodb-to-supabase.mjs
 *
 * Expected files:
 * - groups.json
 * - wines.json
 * - events.json
 * - tastings.json
 *
 * NOTE: Users are imported separately via import-mongodb-users.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  if (!supabaseUrl) console.error("- SUPABASE_URL");
  if (!supabaseServiceKey) console.error("- SUPABASE_SERVICE_ROLE_KEY");
  console.error("\nUsage:");
  console.error(
    'SUPABASE_URL="https://xxx.supabase.co" SUPABASE_SERVICE_ROLE_KEY="xxx" node scripts/import-mongodb-to-supabase.mjs'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Map MongoDB ObjectIds to Supabase UUIDs
const idMap = {
  users: {}, // Loaded from user-id-mapping.json (from import-mongodb-users.mjs)
  groups: {},
  wines: {},
  events: {},
  tastings: {},
};

// Helper to generate UUID
function generateUUID() {
  return crypto.randomUUID();
}

// Helper to read JSON file
function readJsonFile(filename) {
  const filePath = path.join(process.cwd(), "mongodb-exports", filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Warning: File not found: ${filename}, skipping...`);
    return [];
  }
  const data = fs.readFileSync(filePath, "utf-8");
  // Handle both array format and newline-delimited JSON
  if (data.trim().startsWith("[")) {
    return JSON.parse(data);
  }
  // Newline-delimited JSON (mongoexport default)
  return data
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// Get ObjectId string from MongoDB _id
function getMongoId(id) {
  if (!id) return null;
  if (typeof id === "string") return id;
  if (id?.$oid) return id.$oid;
  if (id?.toString) return id.toString();
  return String(id);
}

// Convert MongoDB date to ISO string
function convertDate(date) {
  if (!date) return null;
  if (typeof date === "string") return new Date(date).toISOString();
  if (date?.$date) {
    if (typeof date.$date === "string")
      return new Date(date.$date).toISOString();
    if (date.$date?.$numberLong)
      return new Date(parseInt(date.$date.$numberLong)).toISOString();
  }
  if (date instanceof Date) return date.toISOString();
  return null;
}

function loadUserIdMapping() {
  const mappingPath = path.join(process.cwd(), "mongodb-exports", "user-id-mapping.json");
  if (fs.existsSync(mappingPath)) {
    const mapping = JSON.parse(fs.readFileSync(mappingPath, "utf-8"));
    idMap.users = mapping;
    console.log(`Loaded ${Object.keys(mapping).length} user ID mappings from user-id-mapping.json`);
    return true;
  }
  
  // Try alternate location
  const altPath = path.join(process.cwd(), "mongodb-exports", "id-mapping.json");
  if (fs.existsSync(altPath)) {
    const mapping = JSON.parse(fs.readFileSync(altPath, "utf-8"));
    if (mapping.users) {
      idMap.users = mapping.users;
      console.log(`Loaded ${Object.keys(mapping.users).length} user ID mappings from id-mapping.json`);
      return true;
    }
  }
  
  console.warn("Warning: No user ID mapping found. Run import-mongodb-users.mjs first!");
  console.warn("Group members and tastings may fail to import without user mappings.\n");
  return false;
}

async function importGroups() {
  console.log("\nImporting groups...");
  const groups = readJsonFile("groups.json");

  let imported = 0;
  for (const group of groups) {
    const mongoId = getMongoId(group._id);
    const newId = generateUUID();
    idMap.groups[mongoId] = newId;

    const { error } = await supabase.from("groups").upsert({
      id: newId,
      name: group.name,
      description: group.description || null,
      created_at: convertDate(group.createdAt) || new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      console.error(`  Failed to import group ${group.name}:`, error.message);
    } else {
      console.log(`  Imported group: ${group.name}`);
      imported++;
    }

    // Import group members
    const members = group.members || [];
    for (const member of members) {
      if (!member) {
        console.warn(`    Warning: Skipping null member in group ${group.name}`);
        continue;
      }

      const memberMongoId = getMongoId(member.user || member._id || member);
      
      if (!memberMongoId) {
        console.warn(`    Warning: Could not extract member ID from:`, member);
        continue;
      }

      const memberId = idMap.users[memberMongoId];

      if (memberId) {
        const { error: memberError } = await supabase
          .from("group_members")
          .upsert({
            group_id: newId,
            user_id: memberId,
            joined_at: convertDate(member.joinedAt) || new Date().toISOString(),
          });

        if (memberError && !memberError.message.includes("duplicate")) {
          console.error(`    Failed to add member:`, memberError.message);
        }
      } else {
        console.warn(`    Warning: Could not find user mapping for member ${memberMongoId}`);
      }
    }
  }

  console.log(`Imported ${imported}/${groups.length} groups`);
}

async function importWines() {
  console.log("\nImporting wines...");
  const wines = readJsonFile("wines.json");

  let imported = 0;
  let skipped = 0;
  
  if (wines.length > 0) {
    console.log("Sample wine structure (first record):");
    console.log("  Top-level keys:", Object.keys(wines[0]).join(", "));
    if (wines[0].basic) {
      console.log("  basic keys:", Object.keys(wines[0].basic).join(", "));
    }
    if (wines[0].Basic) {
      console.log("  Basic keys:", Object.keys(wines[0].Basic).join(", "));
    }
  }
  
  for (let i = 0; i < wines.length; i++) {
    const wine = wines[i];
    const mongoId = getMongoId(wine._id);
    const newId = generateUUID();
    
    const productId = 
      wine.product_id ||
      wine.Product_id ||
      wine.code || 
      wine.Code ||
      wine.productId || 
      wine.ProductId ||
      wine.varenummer ||
      wine.Varenummer ||
      wine.sku ||
      wine.SKU ||
      wine.id ||
      wine.basic?.productId ||
      wine.basic?.ProductId ||
      wine.basic?.product_id ||
      wine.basic?.code ||
      wine.basic?.varenummer ||
      wine.basic?.sku ||
      wine.Basic?.ProductId ||
      wine.Basic?.Code ||
      wine.Basic?.Varenummer;
    
    const name = 
      wine.name || 
      wine.Name ||
      wine.basic?.productShortName ||
      wine.basic?.ProductShortName ||
      wine.basic?.name ||
      wine.basic?.productLongName ||
      wine.Basic?.ProductShortName ||
      wine.Basic?.Name ||
      wine.Basic?.ProductLongName ||
      wine.title ||
      wine.Title;
    
    if (!productId) {
      if (i < 5) {
        console.warn(`  Skipping wine "${name || 'unknown'}" - missing product_id. Keys:`, Object.keys(wine).join(", "));
      }
      skipped++;
      continue;
    }

    idMap.wines[mongoId] = newId;

    const { error } = await supabase.from("wines").upsert({
      product_id: String(productId),
      name: name || String(productId),
      description: wine.description || wine.Description || null,
      summary: wine.summary || wine.Summary || null,
      color: wine.color || wine.Color || null,
      smell: wine.smell || wine.Smell || null,
      taste: wine.taste || wine.Taste || null,
      year: wine.year || wine.Year || wine.basic?.year?.toString() || wine.Basic?.Year?.toString() || null,
      price: wine.price || wine.Price || wine.basic?.price || wine.Basic?.Price || null,
      volume: wine.volume || wine.Volume || wine.basic?.volume || wine.Basic?.Volume || null,
      litre_price: wine.litrePrice || wine.LitrePrice || wine.litre_price || wine.basic?.litrePrice || wine.Basic?.LitrePrice || null,
      age_limit: wine.ageLimit || wine.AgeLimit || wine.age_limit || wine.basic?.ageLimit || wine.Basic?.AgeLimit || null,
      allergens: wine.allergens || wine.Allergens || null,
      bio_dynamic: wine.bioDynamic || wine.BioDynamic || wine.bio_dynamic || false,
      buyable: wine.buyable ?? wine.Buyable ?? true,
      cork: wine.cork || wine.Cork || null,
      distributor: wine.distributor || wine.Distributor || wine.logistics?.distributor || wine.Logistics?.Distributor || null,
      distributor_id: wine.distributorId || wine.DistributorId || wine.distributor_id || wine.logistics?.distributorId || wine.Logistics?.DistributorId || null,
      district: wine.district || wine.District || wine.origins?.district || wine.Origins?.District || null,
      eco: wine.eco || wine.Eco || false,
      environmental_packaging: wine.environmentalPackaging || wine.EnvironmentalPackaging || wine.environmental_packaging || false,
      expired: wine.expired || wine.Expired || false,
      main_category: wine.mainCategory || wine.MainCategory || wine.main_category || wine.classification?.mainCategory || wine.Classification?.MainCategory || null,
      main_country: wine.mainCountry || wine.MainCountry || wine.main_country || wine.origins?.origin?.country || wine.Origins?.Origin?.Country || null,
      main_producer: wine.mainProducer || wine.MainProducer || wine.main_producer || wine.origins?.producer || wine.Origins?.Producer || null,
      sub_district: wine.subDistrict || wine.SubDistrict || wine.sub_district || wine.origins?.subDistrict || wine.Origins?.SubDistrict || null,
      package_type: wine.packageType || wine.PackageType || wine.package_type || null,
      status: wine.status || wine.Status || null,
      sustainable: wine.sustainable || wine.Sustainable || false,
      url: wine.url || wine.Url || wine.URL || null,
      whole_saler: wine.wholeSaler || wine.WholeSaler || wine.whole_saler || wine.logistics?.wholeSaler || wine.Logistics?.WholeSaler || null,
      content: wine.content || wine.Content || wine.ingredients || wine.Ingredients || null,
      created_at: convertDate(wine.createdAt || wine.CreatedAt) || new Date().toISOString(),
    }, { onConflict: 'product_id' });

    if (error) {
      console.error(`  Failed to import wine ${name}:`, error.message);
    } else {
      imported++;
      if (imported % 1000 === 0) {
        console.log(`  Imported ${imported}/${wines.length} wines (${skipped} skipped)...`);
      }
    }
  }

  console.log(`Imported ${imported}/${wines.length} wines (${skipped} skipped - missing product_id)`);
}

async function importEvents() {
  console.log("\nImporting events...");
  const events = readJsonFile("events.json");

  let imported = 0;
  for (const event of events) {
    const mongoId = getMongoId(event._id);
    const newId = generateUUID();
    idMap.events[mongoId] = newId;

    const groupMongoId = getMongoId(event.group || event.groupId);
    const groupId = idMap.groups[groupMongoId];

    // Map wine codes (stored as strings in events.wines array)
    const winesCodes = event.wines || [];

    const { error } = await supabase.from("events").upsert({
      id: newId,
      name: event.name || event.title,
      description: event.description || null,
      date: convertDate(event.date) || new Date().toISOString(),
      group_id: groupId || null,
      wines: winesCodes,
      created_at: convertDate(event.createdAt) || new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      console.error(`  Failed to import event ${event.name}:`, error.message);
    } else {
      console.log(`  Imported event: ${event.name}`);
      imported++;
    }
  }

  console.log(`Imported ${imported}/${events.length} events`);
}

async function withRetry(fn, maxRetries = 3, delayMs = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`    Retry attempt ${attempt}/${maxRetries} after ${delayMs}ms...`);
      await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
    }
  }
}

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function importTastings() {
  console.log("\nImporting tastings...");
  const tastings = readJsonFile("tastings.json");

  let imported = 0;
  let skipped = 0;
  let failed = 0;
  
  for (let i = 0; i < tastings.length; i++) {
    const tasting = tastings[i];
    const mongoId = getMongoId(tasting._id);
    const newId = generateUUID();
    idMap.tastings[mongoId] = newId;

    const userMongoId = getMongoId(tasting.user || tasting.userId);
    const userId = idMap.users[userMongoId];

    const eventMongoId = getMongoId(tasting.event || tasting.eventId);
    const eventId = eventMongoId ? idMap.events[eventMongoId] : null;

    if (!userId) {
      console.error(`  Skipping tasting - missing user reference for ${userMongoId}`);
      skipped++;
      continue;
    }

    try {
      const { error } = await withRetry(async () => {
        return await supabase.from("tastings").upsert({
          id: newId,
          user_id: userId,
          product_id: tasting.productId || tasting.product_id || tasting.wineCode,
          event_id: eventId,
          farge: tasting.farge || null,
          lukt: tasting.lukt || null,
          smak: tasting.smak || null,
          friskhet: tasting.friskhet || null,
          fylde: tasting.fylde || null,
          sodme: tasting.sodme || null,
          snaerp: tasting.snaerp || null,
          karakter: tasting.karakter || null,
          egenskaper: tasting.egenskaper || null,
          selected_flavors_lukt: tasting.selectedFlavorsLukt || tasting.selected_flavors_lukt || [],
          selected_flavors_smak: tasting.selectedFlavorsSmak || tasting.selected_flavors_smak || [],
          lukt_intensitet: tasting.luktIntensitet || tasting.lukt_intensitet || null,
          smaks_intensitet: tasting.smaksIntensitet || tasting.smaks_intensitet || null,
          alkohol: tasting.alkohol || null,
          pris: tasting.pris || null,
          farge_score: tasting.fargeScore || tasting.farge_score || null,
          lukt_score: tasting.luktScore || tasting.lukt_score || null,
          smak_friskhet_score: tasting.smakPiggScore || tasting.smakFriskhetScore || tasting.smak_pigg_score || tasting.smak_friskhet_score || null,
          smak_sott_score: tasting.smakSottScore || tasting.smak_sott_score || null,
          smak_fylde_score: tasting.smakFyldeScore || tasting.smak_fylde_score || null,
          smak_score: tasting.smakScore || tasting.smak_score || null,
          finish_score: tasting.finishScore || tasting.finish_score || null,
          balance_score: tasting.balanceScore || tasting.balance_score || null,
          overall_score: tasting.overallScore || tasting.overall_score || null,
          vmp_quality_score: tasting.vmpQualityScore || tasting.vmp_quality_score || null,
          vmp_price_score: tasting.vmpPriceScore || tasting.vmp_price_score || null,
          vmp_alcohol_score: tasting.vmpAlcoholScore || tasting.vmp_alcohol_score || null,
          vmp_total_score: tasting.vmpTotalScore || tasting.vmp_total_score || null,
          tasted_at: convertDate(tasting.tastedAt || tasting.tasted_at) || new Date().toISOString(),
          created_at: convertDate(tasting.createdAt) || new Date().toISOString(),
        }, { onConflict: 'id' });
      });

      if (error) {
        console.error(`  Failed to import tasting:`, error.message);
        failed++;
      } else {
        console.log(`  [${i + 1}/${tastings.length}] Imported tasting for product: ${tasting.productId || tasting.wineCode}`);
        imported++;
      }
    } catch (error) {
      console.error(`  Failed to import tasting after retries:`, error.message);
      failed++;
    }

    if (i % 10 === 0 && i > 0) {
      await delay(100);
    }
  }

  console.log(`Imported ${imported}/${tastings.length} tastings (${skipped} skipped, ${failed} failed)`);
}

async function main() {
  console.log("Starting MongoDB to Supabase migration...\n");
  console.log("Make sure your JSON files are in ./mongodb-exports/\n");
  console.log("NOTE: Run import-mongodb-users.mjs FIRST to import users!\n");

  const exportsDir = path.join(process.cwd(), "mongodb-exports");
  if (!fs.existsSync(exportsDir)) {
    console.error(`Directory not found: ${exportsDir}`);
    console.error("\nPlease create the directory and add your MongoDB exports:");
    console.error("  mkdir mongodb-exports");
    console.error('  mongoexport --uri="your-mongo-uri" --collection groups --out mongodb-exports/groups.json --jsonArray');
    process.exit(1);
  }

  try {
    loadUserIdMapping();

    // Import in order of dependencies (users already imported separately)
    await importGroups();
    await importWines();
    await importEvents();
    await importTastings();

    console.log("\nMigration complete!");
    console.log("\nID Mapping summary:");
    console.log(`  - Users: ${Object.keys(idMap.users).length} (loaded from previous import)`);
    console.log(`  - Groups: ${Object.keys(idMap.groups).length}`);
    console.log(`  - Wines: ${Object.keys(idMap.wines).length}`);
    console.log(`  - Events: ${Object.keys(idMap.events).length}`);
    console.log(`  - Tastings: ${Object.keys(idMap.tastings).length}`);

    // Save the ID mapping for future reference
    const mappingPath = path.join(exportsDir, "id-mapping.json");
    fs.writeFileSync(mappingPath, JSON.stringify(idMap, null, 2));
    console.log(`\nID mapping saved to ${mappingPath}`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
