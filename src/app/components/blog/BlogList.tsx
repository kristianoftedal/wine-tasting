import { blogPosts } from '@/lib/blog';
import BlogCard from './BlogCard';

interface Props {
  numberOfPosts?: number;
}

const BlogList: React.FC<Props> = ({ numberOfPosts }) => {
  const postsToShow = numberOfPosts ? blogPosts.slice(0, numberOfPosts) : blogPosts;

  return (
    <div className="grid">
      {postsToShow.map((doc, index) => (
        <div
          className="s12 m6 l3"
          key={doc.slug}>
          <BlogCard
            key={doc.slug}
            slug={doc.slug}
            title={doc.title}
            description={doc.description}
            meta={`${doc.author} - ${doc.date}`}
          />
          {index !== blogPosts.length - 1 && <div className="mt-8" />}
        </div>
      ))}
    </div>
  );
};

export default BlogList;
