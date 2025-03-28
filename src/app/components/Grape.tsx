// import { MDXProvider } from "@mdx-js/react";
// import dynamic from "next/dynamic";
// import React, { useState } from "react";

// export const Grape: React.FC<Props> = ({ grape }) => {
//   const [MDXContent, setMDXContent] = useState(null);

//   const slug = grape.match(/[a-zA-Z]+/)[0];

//   const loadMDX = async () => {
//     const <MDXComponent></MDXComponent> = dynamic(() => import(slug));
//     setMDXContent(MDXComponent);
//   };
//   return (
//     <button
//       className="chip round large"
//       onClick={async () => await loadMDX()}>
//       <p>{grape}</p>
//       <div className="tooltip bottom max large-space">
//         {MDXContent && (
//           <MDXProvider>
//             <MDXContent />
//           </MDXProvider>
//         )}
//       </div>
//     </button>
//   );
// };
