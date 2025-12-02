import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { consumeStream, convertToModelMessages, streamText, type UIMessage } from 'ai';

export const maxDuration = 30;

async function generateEmbedding(text: string) {
  console.log('[v0] Generating embedding for:', text.slice(0, 100));

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[v0] Embedding error:', errorText);
    throw new Error('Failed to generate embedding');
  }

  const data = await response.json();
  return data.data[0].embedding;
}

async function findRelevantArticles(query: string, limit = 3) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[v0] Missing Supabase credentials');
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_wine_articles', {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit
    });

    if (error) {
      console.error('[v0] Error searching articles:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Error in findRelevantArticles:', error);
    return [];
  }
}

async function findRelevantWines(query: string, limit = 12) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[v0] Missing Supabase credentials');
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const queryEmbedding = await generateEmbedding(query);

    const { data, error } = await supabase.rpc('match_wines', {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit
    });

    if (error) {
      console.error('[v0] Error searching wines:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('[v0] Error in findRelevantWines:', error);
    return [];
  }
}

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();

    console.log('[v0] Received messages:', JSON.stringify(messages, null, 2));

    const prompt = convertToModelMessages(messages);

    // Get the latest user message content from UI messages
    const latestUserMessage = messages.filter(m => m.role === 'user').pop();
    let latestUserText = '';
    if (latestUserMessage) {
      // Handle parts array structure from UIMessage
      if (Array.isArray(latestUserMessage.parts)) {
        const textPart = latestUserMessage.parts.find(p => p.type === 'text');
        if (textPart && 'text' in textPart) {
          latestUserText = textPart.text;
        }
      }
    }

    console.log('[v0] Latest user text:', latestUserText);

    // Only search if we have a user message
    let relevantArticles: any[] = [];
    let relevantWines: any[] = [];

    if (latestUserText) {
      try {
        [relevantArticles, relevantWines] = await Promise.all([
          findRelevantArticles(latestUserText),
          findRelevantWines(latestUserText)
        ]);
        console.log('[v0] Found articles:', relevantArticles.length);
        console.log('[v0] Found wines:', relevantWines.length);
      } catch (error) {
        console.error('[v0] Error fetching context:', error);
      }
    }

    let articlesContext = '';
    if (relevantArticles.length > 0) {
      articlesContext = '\n\nRelevant informasjon fra Vinmonopolet:\n\n';
      relevantArticles.forEach((article: any, index: number) => {
        articlesContext += `[Kilde ${index + 1}: ${article.title}]\n${article.content?.slice(0, 1000) || ''}...\n\n`;
      });
    }

    let winesContext = '';
    if (relevantWines.length > 0) {
      // Sort wines by price for better recommendations
      const winesWithPrice = relevantWines
        .map((wine: any) => ({
          ...wine,
          priceValue: wine.price?.value || 0
        }))
        .sort((a: any, b: any) => a.priceValue - b.priceValue);

      winesContext = '\n\n=== TILGJENGELIGE VINER FRA VINMONOPOLET ===\n';
      winesContext +=
        'Bruk disse vinene for å gi konkrete anbefalinger. Prisene varierer fra rimelig til eksklusiv.\n\n';

      winesWithPrice.forEach((wine: any, index: number) => {
        const price =
          wine.price?.formattedValue || wine.price?.value ? `${wine.price.value} kr` : 'Pris ikke tilgjengelig';
        const category = wine.main_category?.name || '';
        const country = wine.main_country?.name || '';
        const foodPairings = wine.content?.isGoodFor?.map((item: any) => item.name).join(', ') || '';
        const grapes = wine.content?.ingredients?.map((item: any) => item.readableValue).join(', ') || '';
        const characteristics =
          wine.content?.characteristics?.map((item: any) => `${item.name}: ${item.readableValue}`).join(', ') || '';
        const vinmonopoletUrl = wine.url || `https://www.vinmonopolet.no/p/${wine.product_id}`;

        winesContext += `**Vin ${index + 1}: ${wine.name}**\n`;
        winesContext += `- Type: ${category}${country ? ` fra ${country}` : ''}\n`;
        winesContext += `- Pris: ${price}\n`;
        winesContext += `- Produktnummer: ${wine.product_id}\n`;
        winesContext += `- Link: ${vinmonopoletUrl}\n`;
        if (grapes) winesContext += `- Druer: ${grapes}\n`;
        if (characteristics) winesContext += `- Egenskaper: ${characteristics}\n`;
        if (foodPairings) winesContext += `- Passer til: ${foodPairings}\n`;
        if (wine.description) winesContext += `- Beskrivelse: ${wine.description}\n`;
        if (wine.summary) winesContext += `- Smaksnotat: ${wine.summary}\n`;
        winesContext += `\n`;
      });
    }

    const systemPrompt = `Du er en ekspert sommelier og vin-rådgiver som hjelper brukere med alle spørsmål relatert til vin.

Dine ekspertiseområder inkluderer:
- Vinparing til mat (både norsk og internasjonal mat)
- Informasjon om druesorter, vinregioner og produsenter
- Anbefaling av viner basert på smaksprofiler
- Lagring, servering og dekanting av vin
- Vinifikasjonsprosesser og vinproduksjon
- Vinetikette og hvordan nyte vin

## INSTRUKSJONER FOR VINANBEFALING

Når brukeren spør om vinanbefaling til mat eller en anledning, følg denne strukturen:

### 1. FORKLAR FØRST hvilke vinstiler som passer
Start med å forklare HVORFOR visse vinstiler fungerer godt. For eksempel:
- Hvilke smaksprofiler i maten påvirker valget?
- Hva slags syre, tanniner, eller fruktighet balanserer maten?
- Klassiske kombinasjoner og hvorfor de fungerer

### 2. ANBEFAL TRE ULIKE STILER
Gi alltid tre forskjellige vinalternativer med ulik stil, for eksempel:
- En klassisk/trygg anbefaling
- Et spennende/alternativt valg
- En budsjettvenlig mulighet ELLER en premium-opplevelse

### 3. TA HENSYN TIL PRIS
- Nevn alltid prisen og gi alternativer i ulike prisklasser
- Hvis brukeren nevner budsjett, prioriter viner i det prisområdet
- Forklar om prisen gjenspeiler kvalitet eller om det finnes gode kupp

### 4. FORMAT FOR HVER VIN
For hver anbefalt vin, inkluder:
- **Navn:** Vinens fulle navn
- **Type:** Druetype og region
- **Pris:** Prisen i NOK
- **Hvorfor den passer:** 2-3 setninger om hvorfor denne vinen fungerer
- **Link:** Alltid inkluder Vinmonopolet-lenken så brukeren kan kjøpe den

VIKTIG: Bruk KUN vinene fra listen nedenfor. Ikke finn på viner som ikke er i listen.

Svar alltid på norsk med en vennlig og profesjonell tone. Vær konkret og gi praktiske råd.${articlesContext}${winesContext}`;

    console.log('[v0] Starting streamText...');

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt,
      abortSignal: req.signal
    });

    return result.toUIMessageStreamResponse({
      consumeSseStream: consumeStream
    });
  } catch (error) {
    console.error('[v0] API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
