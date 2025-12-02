import { createClient } from '@supabase/supabase-js'
import { embed } from 'ai'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function getEmbedding(text) {
  const response = await fetch('http://localhost:3000/api/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    throw new Error(`Failed to generate embedding: ${response.statusText}`)
  }

  const { embedding } = await response.json()
  return embedding
}

// Mock scraper - you'll need to implement actual web scraping
// Using cheerio or puppeteer based on the site structure
async function scrapeVinmonopoletArticles() {
  const articleUrls = [
    // Main knowledge articles from /fag/artikler
    'https://www.vinmonopolet.no/fag/artikler/tips-til-drinkmiksingen',
    'https://www.vinmonopolet.no/fag/artikler/alkohol-helse-graviditet-og-amming',
    'https://www.vinmonopolet.no/fag/artikler/alkoholfri-afterski',
    'https://www.vinmonopolet.no/fag/artikler/alkoholfrie-alternativer-til-champagne',
    'https://www.vinmonopolet.no/fag/artikler/alkoholfritt-trygt-promille-gravid',
    'https://www.vinmonopolet.no/fag/artikler/aminosyrer-vin',
    'https://www.vinmonopolet.no/fag/artikler/brettanomyces-i-ol',
    'https://www.vinmonopolet.no/fag/artikler/akevitt-cocktail',
    'https://www.vinmonopolet.no/fag/artikler/nye-og-gamle-vinverden',
    'https://www.vinmonopolet.no/fag/artikler/start-vinklubb',
    'https://www.vinmonopolet.no/fag/artikler/diacetyl-ol-vin',
    'https://www.vinmonopolet.no/fag/artikler/maltwhisky',
    'https://www.vinmonopolet.no/fag/artikler/engelsk-musserende-vin',
    'https://www.vinmonopolet.no/fag/artikler/feil-i-ol',
    'https://www.vinmonopolet.no/fag/artikler/filtrering-av-vin',
    'https://www.vinmonopolet.no/fag/artikler/volatilitet-flyktige-viner',
    'https://www.vinmonopolet.no/fag/artikler/glass-og-utstyr-drinkmiksing',
    'https://www.vinmonopolet.no/fag/artikler/glassmesterskapet',
    'https://www.vinmonopolet.no/fag/artikler/humle-neipa',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-amarone',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-beaujolais-nouveau',
    'https://www.vinmonopolet.no/fag/artikler/en-god-argang',
    'https://www.vinmonopolet.no/fag/artikler/forskjell-musserende-vinstiler',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-naturvin',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-oransjevin',
    'https://www.vinmonopolet.no/fag/artikler/slorvin-med-snerk',
    'https://www.vinmonopolet.no/fag/artikler/supertoscanere',
    'https://www.vinmonopolet.no/fag/artikler/kostnad-vinproduksjon',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-brennevin',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-hvitvin',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-musserende-vin',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-oransjevin',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-rosevin',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-rodvin',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-ol',
    'https://www.vinmonopolet.no/fag/artikler/vinfeil',
    'https://www.vinmonopolet.no/fag/artikler/innovativ-whisky-produksjon',
    'https://www.vinmonopolet.no/fag/artikler/japansk-whisky',
    'https://www.vinmonopolet.no/fag/artikler/klimaendringer-i-vinverden',
    'https://www.vinmonopolet.no/fag/artikler/klosterol-trappist',
    'https://www.vinmonopolet.no/fag/artikler/koji',
    'https://www.vinmonopolet.no/fag/artikler/kva-er-okologisk-biodynamisk-og-naturvin',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-i-vinen',
    'https://www.vinmonopolet.no/fag/artikler/kvalitet-i-ol',
    'https://www.vinmonopolet.no/fag/artikler/kveik-ol',
    'https://www.vinmonopolet.no/fag/artikler/lagring-av-vin',
    'https://www.vinmonopolet.no/fag/artikler/lufting-av-vin',
    'https://www.vinmonopolet.no/fag/artikler/pils-bokkol-weissbier',
    'https://www.vinmonopolet.no/fag/artikler/malting-og-mesking',
    'https://www.vinmonopolet.no/fag/artikler/norsk-whisky',
    'https://www.vinmonopolet.no/fag/artikler/praktisk-om-vin',
    'https://www.vinmonopolet.no/fag/artikler/reduktiv-vin',
    'https://www.vinmonopolet.no/fag/artikler/ratt-kokt-stekt',
    'https://www.vinmonopolet.no/fag/artikler/lov-og-rett-i-hardanger-sider',
    'https://www.vinmonopolet.no/fag/artikler/skandinavia-nyeste-vinregionen',
    'https://www.vinmonopolet.no/fag/artikler/skrukork-naturkork',
    'https://www.vinmonopolet.no/fag/artikler/beregne-drikke',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-whisky',
    'https://www.vinmonopolet.no/fag/artikler/slik-lages-sake',
    'https://www.vinmonopolet.no/fag/artikler/slik-lager-man-sider',
    'https://www.vinmonopolet.no/fag/artikler/sake-til-mat',
    'https://www.vinmonopolet.no/fag/artikler/vin-til-mat',
    'https://www.vinmonopolet.no/fag/artikler/valg-av-ol-til-mat',
    'https://www.vinmonopolet.no/fag/artikler/sukker-og-kalorier-i-vin',
    'https://www.vinmonopolet.no/fag/artikler/sirup-sukkerlake-oppskrifter',
    'https://www.vinmonopolet.no/fag/artikler/tannin-garvestoff-snerp',
    'https://www.vinmonopolet.no/fag/artikler/tyske-vindruer',
    'https://www.vinmonopolet.no/fag/artikler/alkoholfrie-produkter',
    'https://www.vinmonopolet.no/fag/artikler/akevitt',
    'https://www.vinmonopolet.no/fag/artikler/amaretto',
    'https://www.vinmonopolet.no/fag/artikler/belgisk-ol',
    'https://www.vinmonopolet.no/fag/artikler/verdt-a-vite-bourbon',
    'https://www.vinmonopolet.no/fag/artikler/britisk-ol',
    'https://www.vinmonopolet.no/fag/artikler/calvados',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-cava',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-champagne',
    'https://www.vinmonopolet.no/fag/artikler/verdt-a-vite-om-cognac',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-cremant',
    'https://www.vinmonopolet.no/fag/artikler/dessertvin',
    'https://www.vinmonopolet.no/fag/artikler/ekte-handverksider',
    'https://www.vinmonopolet.no/fag/artikler/fatlagret-brennevin',
    'https://www.vinmonopolet.no/fag/artikler/fatlagret-ol',
    'https://www.vinmonopolet.no/fag/artikler/garnacha-grenache',
    'https://www.vinmonopolet.no/fag/artikler/geuze-framboise',
    'https://www.vinmonopolet.no/fag/artikler/gin',
    'https://www.vinmonopolet.no/fag/artikler/grappa',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-helklasefermentering',
    'https://www.vinmonopolet.no/fag/artikler/juleol',
    'https://www.vinmonopolet.no/fag/artikler/lambic',
    'https://www.vinmonopolet.no/fag/artikler/lambrusco-emilia-romagna',
    'https://www.vinmonopolet.no/fag/artikler/madeira-sterkvin',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-mjod',
    'https://www.vinmonopolet.no/fag/artikler/portvin',
    'https://www.vinmonopolet.no/fag/artikler/hva-er-prosecco',
    'https://www.vinmonopolet.no/fag/artikler/verdt-a-vite-om-pet-nat',
    'https://www.vinmonopolet.no/fag/artikler/riesling',
    'https://www.vinmonopolet.no/fag/artikler/rom',
    'https://www.vinmonopolet.no/fag/artikler/sake',
    'https://www.vinmonopolet.no/fag/artikler/sangiovese',
    'https://www.vinmonopolet.no/fag/artikler/sauvignon-blanc',
    'https://www.vinmonopolet.no/fag/artikler/sherry',
    'https://www.vinmonopolet.no/fag/artikler/tempranillo',
    'https://www.vinmonopolet.no/fag/artikler/tequila-mezcal',
    'https://www.vinmonopolet.no/fag/artikler/vermouth',
    'https://www.vinmonopolet.no/fag/artikler/pinot-grigio-pinot-gris',
    'https://www.vinmonopolet.no/fag/artikler/drikkelek',
    'https://www.vinmonopolet.no/fag/artikler/vinsmak',
    'https://www.vinmonopolet.no/fag/artikler/syrah-shiraz',
    'https://www.vinmonopolet.no/fag/artikler/cabernet-sauvignon',
    'https://www.vinmonopolet.no/fag/artikler/chardonnay',
    'https://www.vinmonopolet.no/fag/artikler/malbec',
    'https://www.vinmonopolet.no/fag/artikler/pinot-noir',
    
    // Wine regions from /fag/vinland
    'https://www.vinmonopolet.no/fag/vinland/argentina',
    'https://www.vinmonopolet.no/fag/vinland/australia',
    'https://www.vinmonopolet.no/fag/vinland/canada',
    'https://www.vinmonopolet.no/fag/vinland/chile',
    'https://www.vinmonopolet.no/fag/vinland/england',
    'https://www.vinmonopolet.no/fag/vinland/frankrike',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/savoie',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/languedoc-roussillon',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/korsika',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/alsace',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/muscadet',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/provence',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/burgund',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/burgund/beaujolais',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/burgund/chablis',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/burgund/cote-chalonnaise',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/burgund/maconnais',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/bordeaux',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/bordeaux/ostsiden',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/bordeaux/vestsiden',
    'https://www.vinmonopolet.no/fag/vinland/frankrike/jura',
    'https://www.vinmonopolet.no/fag/vinland/georgia',
    'https://www.vinmonopolet.no/fag/vinland/hellas',
    'https://www.vinmonopolet.no/fag/vinland/italia',
    'https://www.vinmonopolet.no/fag/vinland/italia/lombardia',
    'https://www.vinmonopolet.no/fag/vinland/italia/liguria',
    'https://www.vinmonopolet.no/fag/vinland/italia/friuli-venezia-giulia',
    'https://www.vinmonopolet.no/fag/vinland/italia/toscana',
    'https://www.vinmonopolet.no/fag/vinland/italia/piemonte',
    'https://www.vinmonopolet.no/fag/vinland/italia/piemonte/alto-piemonte',
    'https://www.vinmonopolet.no/fag/vinland/italia/piemonte/barolo-og-barbaresco',
    'https://www.vinmonopolet.no/fag/vinland/italia/campania',
    'https://www.vinmonopolet.no/fag/vinland/libanon',
    'https://www.vinmonopolet.no/fag/vinland/luxemburg',
    'https://www.vinmonopolet.no/fag/vinland/new-zealand',
    'https://www.vinmonopolet.no/fag/vinland/portugal',
    'https://www.vinmonopolet.no/fag/vinland/portugal/colares',
    'https://www.vinmonopolet.no/fag/vinland/spania',
    'https://www.vinmonopolet.no/fag/vinland/spania/galicia',
    'https://www.vinmonopolet.no/fag/vinland/sveits',
    'https://www.vinmonopolet.no/fag/vinland/sor-afrika',
    'https://www.vinmonopolet.no/fag/vinland/tyskland',
    'https://www.vinmonopolet.no/fag/vinland/tyskland/baden',
    'https://www.vinmonopolet.no/fag/vinland/tyskland/mosel',
    'https://www.vinmonopolet.no/fag/vinland/usa',
    'https://www.vinmonopolet.no/fag/vinland/usa/california',
    'https://www.vinmonopolet.no/fag/vinland/uruguay',
    'https://www.vinmonopolet.no/fag/vinland/osterrike',
    
    // Vintage reports from /fag/arganger
    'https://www.vinmonopolet.no/fag/arganger/barolo-2018',
    'https://www.vinmonopolet.no/fag/arganger/barolo-2019',
    'https://www.vinmonopolet.no/fag/arganger/bordeaux-2016',
    'https://www.vinmonopolet.no/fag/arganger/bordeaux-2017',
    'https://www.vinmonopolet.no/fag/arganger/bordeaux-2018',
    'https://www.vinmonopolet.no/fag/arganger/bordeaux-2019',
    'https://www.vinmonopolet.no/fag/arganger/bordeaux-2020',
    'https://www.vinmonopolet.no/fag/arganger/bordeaux-2021',
    'https://www.vinmonopolet.no/fag/arganger/brunello-di-montalcino-2016',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2013',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2014',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2017',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2018',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2019',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2020',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2021',
    'https://www.vinmonopolet.no/fag/arganger/burgund-2022',
    'https://www.vinmonopolet.no/fag/arganger/loire-2014',
    'https://www.vinmonopolet.no/fag/arganger/loire-2015',
    'https://www.vinmonopolet.no/fag/arganger/loire-2017',
    'https://www.vinmonopolet.no/fag/arganger/loire-2018',
    'https://www.vinmonopolet.no/fag/arganger/rhone-2017',
    'https://www.vinmonopolet.no/fag/arganger/rhone-2018',
    'https://www.vinmonopolet.no/fag/arganger/rhone-2019',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2014',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2015',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2018',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2019',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2020',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2021',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2022',
    'https://www.vinmonopolet.no/fag/arganger/tyskland-2023',
    
    // Main sections
    'https://www.vinmonopolet.no/fag/drueleksikon',
    'https://www.vinmonopolet.no/fag/ordliste',
  ]

  console.log(`Starting to scrape ${articleUrls.length} pages from Vinmonopolet...`)

  for (const url of articleUrls) {
    try {
      console.log(`Fetching: ${url}`)
      
      // Fetch the page
      const response = await fetch(url)
      if (!response.ok) {
        console.error(`Failed to fetch ${url}: ${response.statusText}`)
        continue
      }

      const html = await response.text()
      
      // Basic HTML parsing (you'll want to use cheerio for better parsing)
      const titleMatch = html.match(/<title>(.*?)<\/title>/i)
      const title = titleMatch ? titleMatch[1].replace(' - Vinmonopolet', '').trim() : 'Untitled'
      
      // Extract main content (this is simplified - adjust based on actual HTML structure)
      const contentMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                          html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
      
      if (!contentMatch) {
        console.error(`Could not extract content from ${url}`)
        continue
      }
      
      // Remove HTML tags
      const content = contentMatch[1]
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (content.length < 100) {
        console.error(`Content too short for ${url}`)
        continue
      }

      // Create summary (first 200 chars)
      const summary = content.slice(0, 200) + '...'

      // Determine category from URL
      const categoryMatch = url.match(/\/fag\/([^\/]+)/)
      const category = categoryMatch ? categoryMatch[1] : 'general'

      console.log(`Generating embedding for: ${title}`)
      
      // Generate embedding
      const embedding = await getEmbedding(content)

      // Insert into database
      const { error } = await supabase
        .from('wine_articles')
        .upsert({
          url,
          title,
          content,
          summary,
          category,
          embedding,
          scraped_at: new Date().toISOString(),
        }, {
          onConflict: 'url'
        })

      if (error) {
        console.error(`Error inserting article ${url}:`, error)
      } else {
        console.log(`Successfully stored: ${title}`)
      }

      // Rate limiting - wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`Error processing ${url}:`, error)
    }
  }

  console.log('Scraping complete!')
}

// Run the scraper
scrapeVinmonopoletArticles()
  .then(() => {
    console.log('All articles processed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
