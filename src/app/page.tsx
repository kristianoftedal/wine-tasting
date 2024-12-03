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

type Step = {
  title: string
}

export default function Home() {
    const [selectedFlavors, setSelectedFlavors] = useState<SelectedFlavor[]>([]);
    const [index, setIndex] = useState<number>(0);
    const [steps] = useState<Step[]>([{title: 'Aroma' }, {title: 'Smak'}]);

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
    <header className="primary-container">
  <nav>
    <button className="circle transparent">
      <i>arrow_back</i>
    </button>
    <h5 className="max">{steps[index].title}</h5>
  </nav>
</header>
   <main className="responsive max" key={"unique"}>      
      {index === 0 && wineFlavorsData.map((categoryItem) => (
        <div key={categoryItem.name}>
          <Accordion
            key={categoryItem.name}
            category={categoryItem}
            subcategories={categoryItem.subcategories}
            onFlavorClick={handleFlavorClick}
          />
          <SelectedFlavors selectedFlavors={selectedFlavors} onFlavorClick={handleFlavorClick} />
        </div>
      ))}
      {index === 1 && wineFlavorsData.map((categoryItem) => (
        <div key={categoryItem.name}>
          <Accordion
            key={categoryItem.name}
            category={categoryItem}
            subcategories={categoryItem.subcategories}
            onFlavorClick={handleFlavorClick}
          />
          <SelectedFlavors selectedFlavors={selectedFlavors} onFlavorClick={handleFlavorClick} />
        </div>
      ))}
    </main>
    <footer>
  <nav>
    <button className="circle transparent" onClick={() => setIndex(index > 0 ? index - 1 : 0)}>
      <i>arrow_back</i>
    </button>
      <div className="max"></div>
    <button className="circle transparent" onClick={() => setIndex(index + 1 < steps.length ? index + 1 : index)}>
      <i>arrow_forward</i>
    </button>
  </nav>
</footer>
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
    <details style={{ border: '1px solid ' + category.backgroundColor}}>
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
          {subcategories.map((subcategory: Subcategory, index: number) => (
            <div key={subcategory.name + (index * 0.4243)}>
              <details  className="padding">
                <summary className="padding">
                    {subcategory.name}   |
                    <label>  {subcategory.description}</label>
                </summary>
                <div style={{marginLeft: "16px"}}>
                  {subcategory.flavors.map((flavor: Flavor) => (
                    <div key={flavor.name}>
                    <div className="row padding">
                    <label className="checkbox">
                      <input type="checkbox" onClick={() => onFlavorClick(category, subcategory, flavor)} />
                      <span>{flavor.name} {flavor.icon}</span>
                    </label>
                    </div>
                    <hr />
                    </div>
                  ))}
                </div>
              </details>
            <hr />
            </div>
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
