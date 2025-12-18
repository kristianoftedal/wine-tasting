import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join } from 'path'

// Manually load environment variables from .env.local
function loadEnvFile() {
	try {
		const envPath = join(process.cwd(), '.env.local')
		const envContent = readFileSync(envPath, 'utf-8')

		envContent.split('\n').forEach(line => {
			const trimmedLine = line.trim()
			if (trimmedLine && !trimmedLine.startsWith('#')) {
				const [key, ...valueParts] = trimmedLine.split('=')
				const value = valueParts.join('=').trim()
				if (key && value) {
					process.env[key.trim()] = value
				}
			}
		})
	} catch (error) {
		console.error('Error reading .env.local file:', error.message)
		process.exit(1)
	}
}

loadEnvFile()

async function vacuumWinesTable() {
	console.log('Starting VACUUM FULL operation on wines table...')

	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
	const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

	if (!supabaseUrl || !serviceRoleKey) {
		console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env.local')
		console.error('Please ensure your .env.local file contains these Supabase environment variables')
		process.exit(1)
	}

	const supabase = createClient(supabaseUrl, serviceRoleKey, {
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	})

	try {
		console.log('Connecting to database...')

		// Check if wines table exists
		const { data: tableCheck, error: tableError } = await supabase
			.rpc('check_table_exists', { table_name: 'wines' })
			.single()

		// If the RPC doesn't exist, try a simple query instead
		const { data: testData, error: testError } = await supabase
			.from('wines')
			.select('id')
			.limit(1)

		if (testError && testError.code !== 'PGRST116') {
			console.error('Error: Unable to access wines table:', testError.message)
			process.exit(1)
		}

		console.log('wines table found')

		console.log('Running VACUUM FULL on wines table...')
		console.log('Note: This requires a direct database connection with appropriate privileges')

		// VACUUM FULL requires a direct PostgreSQL connection with superuser or table owner privileges
		// Supabase's REST API cannot execute VACUUM commands
		// You'll need to use the PostgreSQL connection string directly

		const { error: vacuumError } = await supabase.rpc('vacuum_wines_table')

		if (vacuumError) {
			console.error('Error: Cannot execute VACUUM FULL through Supabase client')
			console.error('VACUUM FULL requires direct PostgreSQL connection with elevated privileges')
			console.error('Please use psql or pg client with connection string:')
			const projectRef = supabaseUrl.replace('https://', '').replace('.supabase.co', '')
			console.error(`postgresql://postgres:[YOUR_DB_PASSWORD]@db.${projectRef}.supabase.co:5432/postgres`)
			process.exit(1)
		}

		console.log('✅ VACUUM FULL operation completed successfully')

	} catch (error) {
		console.error('Error during VACUUM operation:', error)
		console.error('\nNote: VACUUM FULL cannot be executed through Supabase REST API')
		console.error('You need to connect directly to PostgreSQL using:')
		console.error('1. Your database password (not service role key)')
		console.error('2. psql or a PostgreSQL client library like pg')
		process.exit(1)
	}
}

// Run the vacuum operation
vacuumWinesTable()
