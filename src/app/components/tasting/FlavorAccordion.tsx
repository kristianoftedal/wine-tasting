'use client';

import type React from 'react';
import type { Category, Flavor, Subcategory } from '../../models/flavorModel';
import styles from './FlavorAccordion.module.css';

type AccordionProps = {
  category: Category;
  subcategories: Subcategory[];
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void;
  selectedFlavors?: Flavor[];
};

export const Accordion: React.FC<AccordionProps> = ({
  category,
  subcategories,
  onFlavorClick,
  selectedFlavors = []
}) => {
  const isFlavorSelected = (flavor: Flavor) => {
    return selectedFlavors.some(f => f.name === flavor.name);
  };

  return (
    <details className={styles.flavorAccordion}>
      <summary className={styles.flavorCategorySummary}>
        <div className={styles.categoryTitle}>
          <div>{category.name}</div>
          <div className={styles.categoryDescription}>{category.description}</div>
        </div>
        <span>{category.icon}</span>
      </summary>
      <div className={styles.flavorSubcategories}>
        {subcategories.map((subcategory: Subcategory, index: number) => (
          <div
            key={subcategory.name + index}
            className={styles.flavorSubcategory}>
            <details open={subcategories.length === 1}>
              <summary className={styles.subcategorySummary}>
                <div>
                  {subcategory.name}
                  <span className={styles.subcategoryDescription}>{subcategory.description}</span>
                </div>
                <span>{subcategory.icon}</span>
              </summary>
              <div className={styles.flavorPills}>
                {subcategory.flavors.map((flavor: Flavor) => (
                  <button
                    key={flavor.name}
                    className={`${styles.flavorPill} ${isFlavorSelected(flavor) ? styles.selected : ''}`}
                    onClick={() => onFlavorClick(category, subcategory, flavor)}>
                    {flavor.name}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
    </details>
  );
};
