import BlogCard from "@/app/components/blog/BlogCard";
import { Mdx } from "@/app/components/blog/Mdx";
import { getDocFromParams, getNextBlogPost, removeEmojis } from "@/lib/blog";
import { Metadata } from "next";

export const generateMetadata = async (props: Props): Promise<Metadata> => {
  const params = await props.params;

  const { title, description, keywords } = getDocFromParams(params.slug);

  return {
    title: removeEmojis(title),
    description,
    keywords: keywords.split(", "),
  };
};

interface Props {
  params: Promise<{ slug: string }>;
}

const Page: React.FC<Props> = async (props) => {
  const { slug } = await props.params;

  const doc = getDocFromParams(slug);
  const nextDoc = getNextBlogPost(slug);

  return (
    <div className="container max-w-screen-md">
      <Mdx code={doc.body.code} />

      <p className="text-base font-medium text-textSecondary italic">
        {doc.author} - {doc.date}
      </p>

      {nextDoc && (
        <div className="pb-8">
          <h5 className="text-2xl text-textPrimary font-medium pt-8 pb-4">
            Continue reading
          </h5>
          <BlogCard
            slug={nextDoc.slug}
            title={nextDoc.title}
            description={nextDoc.description}
            meta={nextDoc.date}
          />
        </div>
      )}
    </div>
  );
};

export default Page;
