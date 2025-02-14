import Image from "next/image";
import { useMDXComponent } from "next-contentlayer2/hooks";

const components = {
  h1: ({ className, ...props }) => (
    <h1
      className={`text-4xl leading-tight font-medium text-textPrimary pb-4 ${className}`}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={`text-3xl font-medium text-textPrimary pb-2 ${className}`}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={`text-2xl font-medium text-textPrimary pb-2 ${className}`}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={`text-xl font-medium text-textPrimary pb-2 ${className}`}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={`text-lg font-medium text-textPrimary pb-2 ${className}`}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={`text-base font-medium text-textPrimary pb-2 ${className}`}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={`text-textSecondary underline ${className}`}
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p className={`text-base text-textPrimary pb-4 ${className}`} {...props} />
  ),
  img: (props) => (
    <Image
      alt="hei"
      {...props}
      width={1000}
      height={1000}
      className="w-full h-auto rounded-md"
    />
  ),
  ul: ({ className, ...props }) => (
    <ul className={`list-disc pl-4 pb-2 m-0 ${className}`} {...props} />
  ),
  li: ({ className, ...props }) => (
    <li className={`pb-2 text-textPrimary ${className}`} {...props} />
  ),
  ol: ({ className, ...props }) => (
    <ol className={`list-decimal pl-8 pb-2 m-0 ${className}`} {...props} />
  ),
};

export type MdxProps = {
  code: string;
};

export const Mdx = ({ code }: MdxProps) => {
  const Component = useMDXComponent(code);
  return (
    <div className="mdx">
      <Component components={components} />
    </div>
  );
};
