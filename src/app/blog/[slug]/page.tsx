export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const { default: Post } = await import(`blog-posts/${slug}.mdx`);

  return <Post />;
}
