'use client';

import type { Category, Flavor, Subcategory } from '@/lib/types';
import type React from 'react';
import { memo, useState } from 'react';
import styles from './FlavorAccordion.module.css';

type AccordionProps = {
  category: Category;
  subcategories: Subcategory[];
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void;
  selectedFlavors?: Flavor[];
};

export const Accordion: React.FC<AccordionProps> = memo(
  ({ category, subcategories, onFlavorClick, selectedFlavors = [] }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [openSub, setOpenSub] = useState<string | null>(subcategories.length === 1 ? subcategories[0].name : null);

    const isFlavorSelected = (flavor: Flavor) => selectedFlavors.some(f => f.name === flavor.name);

    return (
      <div className={styles.flavorAccordion}>
        {/* Category header */}
        <button
          type="button"
          className={styles.flavorCategorySummary}
          onClick={() => setIsOpen(prev => !prev)}
          aria-expanded={isOpen}>
          <div className={styles.categoryTitle}>
            <div>{category.name}</div>
            <div className={styles.categoryDescription}>{category.description}</div>
          </div>
          <span>{category.icon}</span>
        </button>

        {isOpen && (
          <div className={styles.flavorSubcategories}>
            {subcategories.map(subcategory => {
              const subOpen = openSub === subcategory.name;

              return (
                <div
                  key={subcategory.name}
                  className={styles.flavorSubcategory}>
                  {/* Subcategory header */}
                  <button
                    type="button"
                    className={styles.subcategorySummary}
                    onClick={() => setOpenSub(subOpen ? null : subcategory.name)}
                    aria-expanded={subOpen}>
                    <div>
                      {subcategory.name}
                      <span className={styles.subcategoryDescription}>{subcategory.description}</span>
                    </div>
                    <span>{subcategory.icon}</span>
                  </button>

                  {subOpen && (
                    <div className={styles.flavorPills}>
                      {subcategory.flavors.map(flavor => (
                        <button
                          key={flavor.name}
                          type="button"
                          className={`${styles.flavorPill} ${isFlavorSelected(flavor) ? styles.selected : ''}`}
                          onClick={() => onFlavorClick(category, subcategory, flavor)}>
                          {flavor.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

Accordion.displayName = 'Accordion';
