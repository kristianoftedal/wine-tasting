import { defineDocumentType, makeSource } from "contentlayer2/source-files";

/** @type {import('contentlayer2/source-files').ComputedFields} */
const computedFields = {
  slug: {
    type: "string",
    resolve: (doc) => doc._raw.flattenedPath,
  },
};

export const Doc = defineDocumentType(() => ({
  name: "Doc",
  filePathPattern: "*.mdx",
  contentType: "mdx",
  fields: {
    title: {
      type: "string",
      required: true,
    },
    description: {
      type: "string",
      required: true,
    },
    author: {
      type: "string",
      required: true,
    },
    date: {
      type: "string",
      required: true,
    },
    keywords: {
      type: "string",
      required: true,
    },
    published: {
      type: "boolean",
      default: true,
    },
  },
  computedFields,
}));

export default makeSource({
  disableImportAliasWarning: true,
  contentDirPath: "./blog-posts",
  documentTypes: [Doc],
});
