import { type NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;

  if (!productId || productId === 'undefined' || productId === 'null') {
    return new NextResponse(null, { status: 400 });
  }

  const size = request?.nextUrl?.searchParams?.get('size') || '100x100';

  try {
    const imageUrl = `https://bilder.vinmonopolet.no/cache/${size}-0/${productId}-1.jpg`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Referer: 'https://www.vinmonopolet.no/',
        Accept: 'image/webp,image/jpeg,image/*'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Cache misses as well: without this, a wine with no product shot costs a
      // fresh upstream fetch on every single render of the dropdown.
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400' }
      });
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        // Product shots never change for a given product id, so this is safe to
        // treat as immutable. Each miss costs a server-side round trip to
        // vinmonopolet, and the search dropdown renders up to 20 of these.
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable'
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 404 });
  }
}
