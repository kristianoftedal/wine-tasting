import type { MDXComponents } from 'mdx/types';

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ ...props }) => (
      <h1
        style={{ backgroundColor: 'red' }}
        className=""
        {...props}
      />
    ),
    h2: ({ ...props }) => (
      <h2
        className=""
        {...props}
      />
    ),
    h3: ({ ...props }) => (
      <h3
        className=""
        {...props}
      />
    ),
    h4: ({ ...props }) => (
      <h4
        className=""
        {...props}
      />
    ),
    h5: ({ ...props }) => (
      <h5
        className=""
        {...props}
      />
    ),
    h6: ({ ...props }) => (
      <h6
        className=""
        {...props}
      />
    ),
    a: ({ ...props }) => (
      <a
        className=""
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      />
    ),
    p: ({ ...props }) => (
      <p
        className=""
        {...props}
      />
    ),
    img: ({ ...props }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        alt="hei"
        {...props}
        width={1000}
        height={1000}
        className="w-full h-auto rounded-md"
      />
    ),
    ul: ({ ...props }) => (
      <ul
        className=""
        {...props}
      />
    ),
    li: ({ ...props }) => (
      <li
        className=""
        {...props}
      />
    ),
    ol: ({ ...props }) => (
      <ol
        className=""
        {...props}
      />
    ),
    ...components
  };
}
