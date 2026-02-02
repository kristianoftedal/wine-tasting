'use client';

import type { Category, Flavor, Subcategory } from '@/lib/types';
import { memo, useState } from 'react';
import styles from './FlavorAccordion.module.css';

type AccordionProps = {
  category: Category;
  subcategories: Subcategory[];
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void;
  selectedFlavors?: Flavor[];
};

function AccordionComponent({ category, subcategories, onFlavorClick, selectedFlavors }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSub, setOpenSub] = useState<string | null>(function () {
    return subcategories && subcategories.length === 1 ? subcategories[0].name : null;
  });

  const flavors = selectedFlavors || [];

  function isFlavorSelected(flavor: Flavor) {
    return flavors.some(function (f) { return f.name === flavor.name; });
  }

  function toggleOpen() {
    setIsOpen(function (prev) { return !prev; });
  }

  function toggleSubcategory(name: string, currentlyOpen: boolean) {
    setOpenSub(currentlyOpen ? null : name);
  }

  return (
    <div className={styles.flavorAccordion}>
      {/* Category header */}
      <button
        type="button"
        className={styles.flavorCategorySummary}
        onClick={toggleOpen}
        aria-expanded={isOpen}>
        <div className={styles.categoryTitle}>
          <div>{category.name}</div>
          <div className={styles.categoryDescription}>{category.description}</div>
        </div>
        <span>{category.icon}</span>
      </button>

      {isOpen && (
        <div className={styles.flavorSubcategories}>
          {subcategories.map(function (subcategory) {
            var subOpen = openSub === subcategory.name;

            return (
              <div
                key={subcategory.name}
                className={styles.flavorSubcategory}>
                {/* Subcategory header */}
                <button
                  type="button"
                  className={styles.subcategorySummary}
                  onClick={function () { toggleSubcategory(subcategory.name, subOpen); }}
                  aria-expanded={subOpen}>
                  <div>
                    {subcategory.name}
                    <span className={styles.subcategoryDescription}>{subcategory.description}</span>
                  </div>
                  <span>{subcategory.icon}</span>
                </button>

                {subOpen && (
                  <div className={styles.flavorPills}>
                    {subcategory.flavors.map(function (flavor) {
                      return (
                        <button
                          key={flavor.name}
                          type="button"
                          className={styles.flavorPill + ' ' + (isFlavorSelected(flavor) ? styles.selected : '')}
                          onClick={function () { onFlavorClick(category, subcategory, flavor); }}>
                          {flavor.name}
                        </button>
                      );
                    })}
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

export const Accordion = memo(AccordionComponent);
Accordion.displayName = 'Accordion';
