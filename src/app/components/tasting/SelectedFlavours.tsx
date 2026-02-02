"use client"

import type { Category, Flavor, SelectedFlavor, Subcategory } from "@/lib/types"
import styles from "./SelectedFlavours.module.css"

type SelectedFlavorsProps = {
  selectedFlavors: SelectedFlavor[]
  onFlavorClick: (category: Category, subcategory: Subcategory, flavor: Flavor) => void
}

// Polyfill for Object.groupBy - not supported on older Safari (< 17.4)
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((result, item) => {
    const key = keyFn(item)
    if (!result[key]) {
      result[key] = []
    }
    result[key].push(item)
    return result
  }, {} as Record<string, T[]>)
}

export const SelectedFlavors = ({ selectedFlavors, onFlavorClick }: SelectedFlavorsProps) => {
  if (!selectedFlavors || selectedFlavors.length === 0) return null

  const categories = groupBy(selectedFlavors, x => x.category.name)
  const list = Object.entries(categories)

  return (
    <div className={styles.selectedFlavorsSection}>
      <h6 className={styles.selectedFlavorsTitle}>Valgte smaker:</h6>
      {list.map(([categoryName, flavors], index) => (
        <div key={categoryName}>
          <div className={styles.selectedCategory}>
            <div className={styles.selectedCategoryName}>{categoryName}</div>
            <div className={styles.selectedFlavorPills}>
              {flavors?.map(y => (
                <button
                  key={y.flavor.name + y.category.name + y.subcategory.name}
                  className={styles.selectedFlavorPill}
                  onClick={() => onFlavorClick(y.category, y.subcategory, y.flavor)}
                >
                  {y.flavor.name}
                  <span className={styles.subcategoryLabel}>({y.subcategory.name})</span>
                </button>
              ))}
            </div>
          </div>
          {index < list.length - 1 && <div className={styles.selectedDivider} />}
        </div>
      ))}
    </div>
  )
}
