import {
  Category,
  Flavor,
  SelectedFlavor,
  Subcategory,
} from "../../models/flavorModel";

// Accordion Component to render Category and Subcategories
type SelectedFlavorsProps = {
  selectedFlavors: SelectedFlavor[];
  onFlavorClick: (
    category: Category,
    subcategory: Subcategory,
    flavor: Flavor,
  ) => void;
};

export const SelectedFlavors: React.FC<SelectedFlavorsProps> = ({
  selectedFlavors,
  onFlavorClick,
}) => {
  if (selectedFlavors.length === 0) return <></>;
  const categories = Object.groupBy(selectedFlavors, (x) => x.category.name);
  const list = Object.entries(categories);
  return (
    <div className="beer-section">
      <h6>Valgt:</h6>
      {list.map((x) => (
        <div key={x[0]}>
          <div
            style={{
              marginBottom: "10px",
              paddingBottom: "10px",
              marginTop: "10px",
            }}
          >
            <h6>{x[0]}</h6>
            <div className="beer-badge-group">
              {x[1]?.map((y) => (
                <button
                  key={y.flavor.name + y.category.name + y.category.name}
                  className="chip"
                  onClick={() =>
                    onFlavorClick(y.category, y.subcategory, y.flavor)
                  }
                >
                  {y.flavor.icon} {y.flavor.name} ({y.subcategory.name})
                </button>
              ))}
            </div>
          </div>
          <hr />
        </div>
      ))}
    </div>
  );
};
