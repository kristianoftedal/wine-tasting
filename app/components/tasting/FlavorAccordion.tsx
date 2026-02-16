"use client"

import type React from "react"
import type { Category, Flavor, Subcategory } from "@/lib/types"
import styles from "./FlavorAccordion.module.css"

type AccordionProps = {
  category: Category
  subcategories: Subcategory[]
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void
  selectedFlavors?: Flavor[]
}

export const Accordion: React.FC<AccordionProps> = ({
  category,
  subcategories,
  onFlavorClick,
  selectedFlavors = [],
}) => {
  const isFlavorSelected = (flavor: Flavor) => {
    return selectedFlavors.some((f) => f.name === flavor.name)
  }

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
          <div key={subcategory.name + index} className={styles.flavorSubcategory}>
            <details open={subcategories.length === 1}>
              <summary className={styles.subcategorySummary}>
                <div className={styles.subcategoryHeader}>
                  <div className={styles.subcategoryName}>{subcategory.name}</div>
                  {subcategory.description && (
                    <div className={styles.subcategoryDescription}>{subcategory.description}</div>
                  )}
                </div>
                <span className={styles.subcategoryChevron}>▶</span>
              </summary>
              <div className={styles.flavorPills}>
                {subcategory.flavors.map((flavor: Flavor) => (
                  <button
                    key={flavor.name}
                    className={`${styles.flavorPill} ${isFlavorSelected(flavor) ? styles.selected : ""}`}
                    onClick={() => onFlavorClick(category, subcategory, flavor)}
                  >
                    {flavor.name}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
    </details>
  )
}
