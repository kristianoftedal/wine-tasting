import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params
  const size = request.nextUrl.searchParams.get("size") || "100x100"

  try {
    const imageUrl = `https://bilder.vinmonopolet.no/cache/${size}-0/${productId}-1.jpg`

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://www.vinmonopolet.no/",
      },
    })

    if (!response.ok) {
      // Return placeholder if image fails
      return new NextResponse(null, { status: 404 })
    }

    const imageBuffer = await response.arrayBuffer()

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours
      },
    })
  } catch (error) {
    console.error("[v0] Wine image proxy error:", error)
    return new NextResponse(null, { status: 404 })
  }
}
