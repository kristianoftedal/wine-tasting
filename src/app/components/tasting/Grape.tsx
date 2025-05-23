import { MDXProvider } from '@mdx-js/react';
import dynamic from 'next/dynamic';
import React, { useEffect, useState } from 'react';

interface Props {
  grape: string;
}

export const Grape: React.FC<Props> = ({ grape }) => {
  debugger;
  const [MDXContent, setMDXContent] = useState(null);

  const slug = grape.match(/[A-Za-z\s]+/)[0];

  useEffect(() => {
    (async function () {
      const MDXComponent = dynamic(() => import(`@/app/druer/${slug.trim()}`));
      setMDXContent(MDXComponent);
    })();
  }, [slug]);

  return (
    <button className="chip round">
      <p>{grape}</p>
      <div className="tooltip bottom max large-space">
        {MDXContent && (
          <MDXProvider>
            <MDXContent />
          </MDXProvider>
        )}
      </div>
    </button>
  );
};
