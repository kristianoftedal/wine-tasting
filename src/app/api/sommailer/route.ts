import { openai } from '@ai-sdk/openai';
import { createClient } from '@supabase/supabase-js';
import { consumeStream, convertToModelMessages, streamText, type UIMessage } from 'ai';

export const maxDuration = 30;

async function generateEmbedding(text: string) {
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

    const prompt = convertToModelMessages(messages);

    // Get the latest user message content from UI messages
    const latestUserMessage = messages.filter(m => m.role === 'user').pop();
    let latestUserText = '';
    if (latestUserMessage) {
      if (Array.isArray(latestUserMessage.parts)) {
        const textPart = latestUserMessage.parts.find(p => p.type === 'text');
        if (textPart && 'text' in textPart) {
          latestUserText = textPart.text;
        }
      }
    }

    const lowerCaseMessage = latestUserText.toLowerCase();
    const isProductRequest = /anbefal|foreslå|tips|vin til|hvilken vin|hva passer|kjøpe|handle|produkt|flaske/.test(
      lowerCaseMessage
    );
    const isFoodPairingRequest =
      /mat|middag|lunsj|frokost|passer til|servere med|mat og vin|matparing|pairing|tilbehør/.test(lowerCaseMessage);
    const hasPriceMentioned =
      /kr|kroner|nok|pris|budsjett|billig|rimelig|dyr|eksklusiv|under \d|over \d|\d+\s*(kr|kroner)/.test(
        lowerCaseMessage
      );
    const hasStyleMentioned = /lett|fyldig|tørr|søt|fruktig|krydret|tannin|syre|frisk|myk|kraftig|elegant|robust/.test(
      lowerCaseMessage
    );

    // Only search if we have a user message
    let relevantArticles: any[] = [];
    let relevantWines: any[] = [];

    if (latestUserText) {
      try {
        [relevantArticles, relevantWines] = await Promise.all([
          findRelevantArticles(latestUserText),
          findRelevantWines(latestUserText)
        ]);
      } catch (error) {
        console.error('Error fetching context:', error);
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
    const hasRelevantWines = relevantWines.length > 0;

    if (hasRelevantWines) {
      // Sort wines by price for better recommendations
      const winesWithPrice = relevantWines
        .map((wine: any) => ({
          ...wine,
          priceValue: wine.price ? Number.parseFloat(wine.price) : 0
        }))
        .sort((a: any, b: any) => a.priceValue - b.priceValue);

      winesContext = '\n\n=== TILGJENGELIGE VINER FRA VINMONOPOLET ===\n';
      winesContext +=
        'Bruk disse vinene for å gi konkrete anbefalinger. Prisene varierer fra rimelig til eksklusiv.\n\n';

      winesWithPrice.forEach((wine: any, index: number) => {
        const price = wine.price ? `${wine.price} kr` : 'Pris ikke tilgjengelig';
        const category = wine.main_category || '';
        const country = wine.main_country || '';
        const foodPairings = wine.content?.isGoodFor?.map((item: any) => item.name).join(', ') || '';
        const grapes = wine.content?.ingredients?.map((item: any) => item.readableValue).join(', ') || '';
        const characteristics =
          wine.content?.characteristics?.map((item: any) => `${item.name}: ${item.readableValue}`).join(', ') || '';
        const vinmonopoletUrl = wine.url || `https://www.vinmonopolet.no/vmp/p/productId/${wine.product_id}`;

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

    let followUpInstructions = '';

    if (isProductRequest && !hasPriceMentioned) {
      followUpInstructions += `
## VIKTIG: SPØR OM PRIS/BUDSJETT
Brukeren ser ut til å be om produktanbefalinger, men har IKKE oppgitt et budsjett eller prisklasse.
DU MÅ spørre om brukerens prisforventning FØR du gir spesifikke anbefalinger.
Eksempel: "Hva slags prisklasse ser du for deg? For eksempel: under 200 kr, 200-400 kr, eller over 400 kr?"
`;
    }

    if (isFoodPairingRequest && !hasStyleMentioned) {
      followUpInstructions += `
## VIKTIG: SPØR OM STILPREFERANSER
Brukeren ser ut til å be om matparing, men har IKKE oppgitt stilpreferanser.
DU MÅ spørre om brukerens stilpreferanser FØR du gir spesifikke anbefalinger.
Eksempel: "Har du noen preferanser for vinstil? Foretrekker du for eksempel lett og frisk, eller mer fyldig og kraftig? Liker du tørre viner eller noe med litt restsødme?"
`;
    }

    if (isProductRequest && !hasPriceMentioned && isFoodPairingRequest && !hasStyleMentioned) {
      followUpInstructions = `
## VIKTIG: SPØR OM PRIS OG STILPREFERANSER
Brukeren ser ut til å be om vinanbefalinger til mat, men mangler viktig informasjon.
DU MÅ spørre om BÅDE prisforventning OG stilpreferanser FØR du gir spesifikke anbefalinger.
Eksempel: "For å gi deg de beste anbefalingene, trenger jeg litt mer info:
1. Hva slags prisklasse ser du for deg? (f.eks. under 200 kr, 200-400 kr, eller over 400 kr)
2. Har du noen stilpreferanser? (f.eks. lett og frisk vs fyldig og kraftig, tørr vs søt)"
`;
    }

    const systemPrompt = `Du er en ekspert sommelier og vin-rådgiver som hjelper brukere med spørsmål relatert til vin.

## VIKTIG: BRUK KUN DATA FRA DATABASEN

Du har BARE tilgang til viner og informasjon fra Vinmonopolets database som er gitt nedenfor.

**ABSOLUTTE REGLER:**
1. Du skal ALDRI finne på eller nevne viner som IKKE er listet nedenfor
2. Du skal ALDRI hallusinere om vinprodusenter, regioner eller viner du ikke har data om
3. Hvis ingen relevante viner finnes i listen nedenfor, MÅ du si klart og tydelig at du ikke fant noen passende viner i databasen
4. Du kan gi generelle vin-tips og teori, men ALLE konkrete vinanbefalinger MÅ komme fra listen nedenfor
${followUpInstructions}
${
  !hasRelevantWines
    ? `
## INGEN VINER FUNNET

Det ble IKKE funnet noen relevante viner i databasen for dette søket.

Du MÅ svare brukeren med noe lignende:
"Beklager, jeg fant ingen viner i Vinmonopolets database som passer til dette søket. Dette kan være fordi:
- Vinene du leter etter ikke er tilgjengelige hos Vinmonopolet
- Søket er for spesifikt (prøv å søke bredere)
- Produsentene eller regionene du nevner ikke er representert i vår database

Jeg anbefaler å:
- Besøke Vinmonopolet.no direkte for å søke
- Kontakte din lokale Vinmonopol-butikk for hjelp
- Prøve å stille spørsmålet på en annen måte"

Du kan IKKE anbefale spesifikke viner når ingen er funnet i databasen.
`
    : ''
}

Dine ekspertiseområder inkluderer:
- Vinparing til mat (både norsk og internasjonal mat)
- Informasjon om druesorter, vinregioner og produsenter
- Anbefaling av viner basert på smaksprofiler
- Lagring, servering og dekanting av vin
- Vinifikasjonsprosesser og vinproduksjon
- Vinetikette og hvordan nyte vin

## INSTRUKSJONER FOR VINANBEFALING (KUN NÅR VINER ER FUNNET)

Når brukeren spør om vinanbefaling og du har relevante viner i listen nedenfor:

### 0. SAMLE INFORMASJON FØRST
Før du gir konkrete anbefalinger, sørg for at du har:
- **Budsjett/prisklasse:** Hvis ikke oppgitt, spør brukeren
- **Stilpreferanser (for matparing):** Hvis ikke oppgitt, spør brukeren

### 1. FORKLAR FØRST hvilke vinstiler som passer
Start med å forklare HVORFOR visse vinstiler fungerer godt.

### 2. ANBEFAL KUN VINER FRA LISTEN NEDENFOR
Gi alternativer i ulike prisklasser fra vinlisten. ALDRI nevn viner som ikke er i listen.
Filtrer anbefalingene basert på brukerens oppgitte budsjett og stilpreferanser.

### 3. FORMAT FOR HVER VIN
For hver anbefalt vin, inkluder:
- **Navn:** Vinens fulle navn (MÅ være fra listen)
- **Type:** Druetype og region
- **Pris:** Prisen i NOK
- **Hvorfor den passer:** 2-3 setninger
- **Link:** Vinmonopolet-lenken fra listen

Svar alltid på norsk med en vennlig og profesjonell tone.`;

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
    console.error('API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
