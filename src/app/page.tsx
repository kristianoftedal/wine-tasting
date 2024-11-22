'use client'

import { useState } from "react";

import wineFlavorsData from './data/flavor.json'

// Define the Flavor type as a type alias
type Flavor = {
  name: string;   // Name of the flavor
  icon: string;   // Icon representing the flavor (e.g., emoji)
  description: string;
};

// Define the Subcategory type as a type alias
type Subcategory = {
  name: string;   // Name of the subcategory
  description: string;   // Description of the subcategory
  flavors: Flavor[];     // List of flavors in this subcategory
};

// Define the Category type as a type alias
type Category = {
  name: string;       // Name of the category
  description: string;    // Description of the category
  subcategories: Subcategory[];   // List of subcategories in this category
};

type SelectedFlavor = {
  category: Category,
  subcategory: Subcategory,
  flavor: Flavor
}

export default function Home() {
    const [selectedFlavors, setSelectedFlavors] = useState<SelectedFlavor[]>([]);

  const handleFlavorClick = (category: Category, subcategory: Subcategory, flavor: Flavor) => {
    setSelectedFlavors((prev) => {
      debugger;
      const categoryFlavors = prev.length === 0 ? [] : prev
      const updatedFlavors = categoryFlavors.some((x) => x.flavor.name == flavor.name)
        ? categoryFlavors.filter((x) => x.flavor.name !== flavor.name)
        : [...categoryFlavors, { category, subcategory, flavor}];
      return updatedFlavors;
    });
  };

  return (
   <main className="responsive max">
      <header className="beer-header">
        <h1>🍷 Wine Flavor Selector</h1>
      </header>
      <SelectedFlavors selectedFlavors={selectedFlavors} onFlavorClick={handleFlavorClick} />

      {wineFlavorsData.map((categoryItem) => (
        <Accordion
          key={categoryItem.name}
          category={categoryItem}
          subcategories={categoryItem.subcategories}
          selectedFlavors={selectedFlavors[categoryItem.name] || []}
          onFlavorClick={handleFlavorClick}
        />
      ))}
    </main>
  );
};

// Accordion Component to render Category and Subcategories
type AccordionProps = {
  category: Category;
  subcategories: Subcategory[];
  selectedFlavors: string[];
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void;
};


const Accordion: React.FC<AccordionProps> = ({ category, subcategories, selectedFlavors, onFlavorClick }) => {
  const [isOpen, setIsOpen] = useState(false);


  return (
    <details className="padding secondary-border no-elevate">
      <summary
        className="none"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer" }}
      >
        <article className="">
          <nav>
            <div className="max">
            {category.name}
            <p>{category.description}</p></div>
            {isOpen ? <i>expand_less</i> : <i>expand_more</i>}
          </nav>
        </article>
      </summary>
      {isOpen && (
        <div>
          {subcategories.map((subcategory: Subcategory) => (
            <details key={subcategory.name} style={{ marginBottom: "10px" }} className="padding secondary-border no-elevate">
              <summary className="none">
              <article className="">
          <nav>
            <div className="max">
            {subcategory.name}
            <p>{subcategory.description}</p></div>
            {isOpen ? <i>expand_less</i> : <i>expand_more</i>}
          </nav>
        </article>
              </summary>
              <div className="grid large-space">
                {subcategory.flavors.map((flavor: Flavor) => (
                  <article className="s12 m6 l3 round" key={flavor.name}>
                    <div className="row">
                      <div className="max">
                        <h5>{flavor.name} {flavor.icon}</h5>
                        <p>{flavor.description} </p>
                      </div>
                    </div>
                      <button
                        onClick={() => onFlavorClick(category, subcategory, flavor)}
                        className={`beer-button ${
                          selectedFlavors.includes(flavor.name) ? "beer-button-primary" : ""
                        }`}
                        style={{ margin: "5px" }}
                      >
                        add
                      </button>
                  </article>
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </details>
  );
};

// Accordion Component to render Category and Subcategories
type SelectedFlavorsProps = {
  selectedFlavors: SelectedFlavor[];
  onFlavorClick: (selectedFlavor: SelectedFlavor) => void;
};

const SelectedFlavors: React.FC<SelectedFlavorsProps> = ({ selectedFlavors, onFlavorClick }) => {
  debugger;
  const categories = Object.groupBy(selectedFlavors, x => x.category.name);
  const list = Object.entries(categories);
  return (
  <div className="beer-section">
    <h4>Selected Flavors</h4>
    {list.map(x => (
      <>
      <div key={x[0]} style={{ marginBottom: "10px", paddingBottom: "10px" }}>
        <h6>{x[0]}</h6>
        <div className="beer-badge-group">
          {x[1]?.map((y) => (
            <button key={y.flavor.name} className="chip" onClick={() => onFlavorClick(y)}>
              {y.flavor.icon} {y.flavor.name}
            </button>
          ))}
        </div>
      </div>
      <hr/>
      </>
    ))}
  </div>
);
}

