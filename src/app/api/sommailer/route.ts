import { convertToModelMessages, streamText, type UIMessage } from "ai"

export const maxDuration = 30

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const prompt = convertToModelMessages(messages)

  const systemPrompt = `Du er en ekspert sommelier og vin-rådgiver som hjelper brukere med alle spørsmål relatert til vin.

Dine ekspertiseområder inkluderer:
- Vinparing til mat (både norsk og internasjonal mat)
- Informasjon om druesorter, vinregioner og produsenter
- Anbefaling av viner basert på smaksprofiler
- Lagring, servering og dekanting av vin
- Vinifikasjonsprosesser og vinproduksjon
- Vinetikette og hvordan nyte vin

Svar alltid på norsk med en vennlig og profesjonell tone. Vær konkret og gi praktiske råd. Hvis brukeren spør om noe utenfor vin-relaterte emner, led samtalen høflig tilbake til vin.`

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
