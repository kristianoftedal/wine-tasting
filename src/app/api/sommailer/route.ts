import { convertToModelMessages, streamText, type UIMessage } from "ai"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 30

async function generateEmbedding(text: string) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
    }),
  })

  if (!response.ok) {
    throw new Error("Failed to generate embedding")
  }

  const data = await response.json()
  return data.data[0].embedding
}

async function findRelevantArticles(query: string, limit = 3) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials")
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const queryEmbedding = await generateEmbedding(query)

    const { data, error } = await supabase.rpc("match_wine_articles", {
      query_embedding: queryEmbedding,
      match_threshold: 0.7,
      match_count: limit,
    })

    if (error) {
      console.error("[v0] Error searching articles:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("[v0] Error in findRelevantArticles:", error)
    return []
  }
}

async function findRelevantWines(query: string, limit = 5) {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("[v0] Missing Supabase credentials")
    return []
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const queryEmbedding = await generateEmbedding(query)

    const { data, error } = await supabase.rpc("match_wines", {
      query_embedding: queryEmbedding,
      match_threshold: 0.75,
      match_count: limit,
    })

    if (error) {
      console.error("[v0] Error searching wines:", error)
      return []
    }

    return data || []
  } catch (error) {
    console.error("[v0] Error in findRelevantWines:", error)
    return []
  }
}

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const prompt = convertToModelMessages(messages)

  const latestUserMessage = messages.filter((m) => m.role === "user").pop()

  const getMessageText = (message: UIMessage): string => {
    if (!message.parts) return ""
    return message.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { type: "text"; text: string }).text)
      .join(" ")
  }

  const latestUserText = latestUserMessage ? getMessageText(latestUserMessage) : ""

  const [relevantArticles, relevantWines] = latestUserText
    ? await Promise.all([findRelevantArticles(latestUserText), findRelevantWines(latestUserText)])
    : [[], []]

  let articlesContext = ""
  if (relevantArticles.length > 0) {
    articlesContext = "\n\nRelevant informasjon fra Vinmonopolet:\n\n"
    relevantArticles.forEach((article: any, index: number) => {
      articlesContext += `[Kilde ${index + 1}: ${article.title}]\n${article.content.slice(0, 1000)}...\n\n`
    })
  }

  let winesContext = ""
  if (relevantWines.length > 0) {
    winesContext = "\n\nAnbefalte viner fra Vinmonopolet:\n\n"
    relevantWines.forEach((wine: any, index: number) => {
      const price = wine.price?.formattedValue || "Pris ikke tilgjengelig"
      const category = wine.main_category?.name || ""
      const country = wine.main_country?.name || ""

      // Extract food pairings
      const foodPairings = wine.content?.isGoodFor?.map((item: any) => item.name).join(", ") || ""

      // Extract grape varieties
      const grapes = wine.content?.ingredients?.map((item: any) => item.readableValue).join(", ") || ""

      winesContext += `[Vin ${index + 1}: ${wine.name}]\n`
      winesContext += `Type: ${category}${country ? `, ${country}` : ""}\n`
      winesContext += `Pris: ${price}\n`
      if (grapes) winesContext += `Druer: ${grapes}\n`
      if (foodPairings) winesContext += `Passer til: ${foodPairings}\n`
      if (wine.description) winesContext += `${wine.description}\n`
      winesContext += `\n`
    })
    winesContext += "\nDu kan anbefale disse vinene til brukeren hvis de passer til spørsmålet.\n"
  }

  const systemPrompt = `Du er en ekspert sommelier og vin-rådgiver som hjelper brukere med alle spørsmål relatert til vin.

Dine ekspertiseområder inkluderer:
- Vinparing til mat (både norsk og internasjonal mat)
- Informasjon om druesorter, vinregioner og produsenter
- Anbefaling av viner basert på smaksprofiler
- Lagring, servering og dekanting av vin
- Vinifikasjonsprosesser og vinproduksjon
- Vinetikette og hvordan nyte vin

Svar alltid på norsk med en vennlig og profesjonell tone. Vær konkret og gi praktiske råd. Hvis brukeren spør om noe utenfor vin-relaterte emner, led samtalen høflig tilbake til vin.${articlesContext}${winesContext}`

  const result = streamText({
    model: "openai/gpt-5",
    system: systemPrompt,
    prompt,
    abortSignal: req.signal,
    maxOutputTokens: 2000,
    temperature: 0.7,
  })

  return result.toUIMessageStreamResponse()
}
