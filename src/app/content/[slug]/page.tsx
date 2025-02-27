export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const { default: Post } = await import(`@/content/${slug}.mdx`);

  return <Post />;
}

export function generateStaticParams() {
  return [{ slug: 'chardonnay' }, { slug: 'pinot noir' }];
}

export const dynamicParams = false;
