export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const { default: Post } = await import(`content/druer/${slug}.mdx`);

  return <Post />;
}
