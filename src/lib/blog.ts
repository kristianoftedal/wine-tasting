import { allDocs } from "contentlayer/generated";
import { notFound } from "next/navigation";

export const getDocFromParams = (slug: string) => {
  const doc = blogPosts.find((doc) => doc.slug === slug);
  if (!doc) notFound();
  return doc;
};

export const blogPosts = allDocs.sort((a, b) => {
  const aDate = a.date.split("/").reverse().join("/");
  const bDate = b.date.split("/").reverse().join("/");
  return new Date(bDate).getTime() - new Date(aDate).getTime();
});

export const getNextBlogPost = (slug: string) => {
  const currentIndex = blogPosts.findIndex((items) => items.slug === slug);
  const nextIndex = (currentIndex + 1) % blogPosts.length;
  return blogPosts[nextIndex];
};

export const removeEmojis = (str: string) => {
  return str
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu,
      ""
    )
    .trimStart();
};
