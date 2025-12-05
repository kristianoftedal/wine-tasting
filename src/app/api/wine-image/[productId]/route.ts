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
      return new NextResponse(null, { status: 404 });
    }

    const imageBuffer = await response.arrayBuffer();

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 404 });
  }
}
