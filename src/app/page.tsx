'use client'

import { useState } from "react";

import wineFlavorsData from './data/flavor.json'

// Define the Flavor type as a type alias
type Flavor = {
  name: string;   // Name of the flavor
  icon: string;   // Icon representing the flavor (e.g., emoji)
  description?: string;
};

// Define the Subcategory type as a type alias
type Subcategory = {
  name: string;   // Name of the subcategory
  description?: string;   // Description of the subcategory
  flavors: Flavor[];     // List of flavors in this subcategory
  backgroundColor?: string;
};

// Define the Category type as a type alias
type Category = {
  name: string;       // Name of the category
  description?: string;    // Description of the category
  subcategories: Subcategory[];   // List of subcategories in this category
  backgroundColor?: string;
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
      ;
      const categoryFlavors = prev.length === 0 ? [] : prev
      const updatedFlavors = categoryFlavors.some((x) => x.flavor.name == flavor.name)
        ? categoryFlavors.filter((x) => x.flavor.name !== flavor.name)
        : [...categoryFlavors, { category, subcategory, flavor}];
      return updatedFlavors;
    });
  };

  return (
    <>
      <header>
        <nav>
          <button className="circle transparent">
            <i>arrow_back</i>
          </button>
          <h5 className="max">Title</h5>
          <button className="circle transparent">
            <i>attach_file</i>
          </button>
          <button className="circle transparent">
            <i>today</i>
          </button>
          <button className="circle transparent">
            <i>more_vert</i>
          </button>
        </nav>
      </header>
   <main className="responsive max">
      <SelectedFlavors selectedFlavors={selectedFlavors} onFlavorClick={handleFlavorClick} />

      {wineFlavorsData.map((categoryItem) => (
        <Accordion
          key={categoryItem.name}
          category={categoryItem}
          subcategories={categoryItem.subcategories}
          onFlavorClick={handleFlavorClick}
        />
      ))}
    </main>
    </>
  );
};

// Accordion Component to render Category and Subcategories
type AccordionProps = {
  category: Category;
  subcategories: Subcategory[];
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void;
};


const Accordion: React.FC<AccordionProps> = ({ category, subcategories, onFlavorClick }) => {
  const [isOpen, setIsOpen] = useState(false);


  return (
    <>
    <details style={{ border: '1px solid' + category.backgroundColor}}>
      <summary
      className="padding"
        onClick={() => setIsOpen(!isOpen)}
        style={{ cursor: "pointer", color: '#FFF', backgroundColor: category.backgroundColor }}
      >
            {category.name}   | 
            <label>  {category.description}</label>
      </summary>
      {isOpen && (
        <div className="" key={category.name} style={{ marginLeft: '16px'}}>
          {subcategories.map((subcategory: Subcategory) => (
            <>
            <details key={subcategory.name} className="padding">
              <summary>
                  {subcategory.name}   |
                  <label>  {subcategory.description}</label>
              </summary>
              <div style={{marginLeft: "16px"}}>
                {subcategory.flavors.map((flavor: Flavor) => (
                  <div className="row padding surface-container" key={flavor.name}>
                  <label className="checkbox" key={flavor.name}>
                    <input type="checkbox" onClick={() => onFlavorClick(category, subcategory, flavor)} />
                    <span>{flavor.name} {flavor.icon}</span>
                  </label>
                  </div>
                ))}
              </div>
            </details>
            <hr />
            </>
          ))}
        </div>
      )}
    </details>
    <hr />
    </>
  );
};

// Accordion Component to render Category and Subcategories
type SelectedFlavorsProps = {
  selectedFlavors: SelectedFlavor[];
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void;
};

const SelectedFlavors: React.FC<SelectedFlavorsProps> = ({ selectedFlavors, onFlavorClick }) => {
  ;
  if (selectedFlavors.length === 0) return (<></>)
  const categories = Object.groupBy(selectedFlavors, x => x.category.name);
  const list = Object.entries(categories);
  return (
  <div className="beer-section">
    <h6>Selected Flavors</h6>
    {list.map(x => (
      <div key={x[0]}>
        <div style={{ marginBottom: "10px", paddingBottom: "10px", marginTop: "10px" }}>
          <h6>{x[0]}</h6>
          <div className="beer-badge-group">
            {x[1]?.map((y) => (
              <button key={y.flavor.name + y.category.name + y.category.name} className="chip" onClick={() => onFlavorClick(y.category, y.subcategory, y.flavor)}>
                {y.flavor.icon} {y.flavor.name} ({y.subcategory.name})
              </button>
            ))}
          </div>
        </div>
      <hr/>
      </div>
    ))}
  </div>
);
}

