import Image from "next/image";
import React from "react";
import { Category, Flavor, Subcategory } from "../models/flavorModel";

type AccordionProps = {
  category: Category;
  subcategories: Subcategory[];
  onFlavorClick: (
    category: Category,
    subcategory: Subcategory,
    flavor: Flavor
  ) => void;
};

export const Accordion: React.FC<AccordionProps> = ({
  category,
  subcategories,
  onFlavorClick,
}) => {
  return (
    <>
      <details style={{ border: "1px solid " + category.backgroundColor }}>
        <summary
          className="padding"
          style={{
            cursor: "pointer",
            border: "1px solid " + category.backgroundColor,
          }}
        >
          {category.name} |<label> {category.description}</label>
          {category.image ? (
            <Image
              width={400}
              height={40}
              alt="image"
              src={`/images/${category.image}`}
            />
          ) : (
            category.icon
          )}
        </summary>
        <div key={category.name} style={{ marginLeft: "16px" }}>
          {subcategories.map((subcategory: Subcategory, index: number) => (
            <div key={subcategory.name + index * 0.4243}>
              <details className="padding">
                <summary className="padding">
                  {subcategory.name} |
                  <label>
                    {" "}
                    {subcategory.description} - {subcategory.icon}
                  </label>
                </summary>
                <div style={{ marginLeft: "16px" }}>
                  {subcategory.flavors.map((flavor: Flavor) => (
                    <div key={flavor.name}>
                      <div className="row padding">
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            onClick={() =>
                              onFlavorClick(category, subcategory, flavor)
                            }
                          />
                          <span>
                            {flavor.name} {flavor.icon}
                          </span>
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
      </details>
      <hr />
    </>
  );
};
