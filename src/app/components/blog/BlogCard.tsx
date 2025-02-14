"use client";

import { redirect } from "next/navigation";

const BlogCard = ({ slug, title, description, meta }) => {
  return (
    <article className="no-padding border round">
      {/* <Image
        width={200}
        height={200}
        alt="blog post img"
        className="responsive small top-round"
        src="..images/wineclub.jpg"
      /> */}
      <div className="padding">
        <h5>{title}</h5>

        <p className="text-gray-600 mb-4">{description}</p>
        <p className="text-sm text-gray-500">{meta}</p>
        <nav>
          <button onClick={() => redirect(`/blog/${slug}`)}>Les mer</button>
        </nav>
      </div>
    </article>
  );
};

export default BlogCard;
