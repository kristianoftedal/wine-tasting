export const Grape: React.FC<Props> = ({ grape }) => {
  const [MDXContent, setMDXContent] = useState(null);

  const slug = grape.match(/[a-zA-Z]+/)[0];

  const loadMDX = async () => {
    const MDXComponent = dynamic(() => import(slug));
    setMDXContent(MDXComponent);
  };
  return (
    <button
      className="chip round large"
      onClick={async () => await loadMDX()}>
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
