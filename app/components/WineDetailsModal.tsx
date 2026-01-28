"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import he from "he"
import Link from "next/link"
import type { Wine } from "@/lib/types"
import styles from "./WineDetailsModal.module.css"

interface WineDetailsModalProps {
  wine: Wine | null
  isOpen: boolean
  onClose: () => void
}

function getCharacteristic(wine: Wine, name: string): string | null {
  const char = wine.content?.characteristics?.find((c) => c.name.toLowerCase() === name.toLowerCase())
  return char?.readableValue || null
}

export function WineDetailsModal({ wine, isOpen, onClose }: WineDetailsModalProps) {
  if (!wine) return null

  const alcohol = getCharacteristic(wine, "Alkohol")
  const sugar = getCharacteristic(wine, "Sukker")
  const bitterness = getCharacteristic(wine, "Bitterhet")
  const tannin = getCharacteristic(wine, "Tannin")

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content}>
          {/* Close Button */}
          <Dialog.Close className={styles.closeButton}>
            <X size={20} />
          </Dialog.Close>

          {/* Header */}
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>{he.decode(wine.name)}</Dialog.Title>
            <Dialog.Description className={styles.subtitle}>
              {wine.year && <span className={styles.year}>{wine.year}</span>}
              {wine.main_category && <span className={styles.categoryBadge}>{wine.main_category}</span>}
            </Dialog.Description>
          </div>

          <div className={styles.modalBody}>
            {/* Wine Image */}
            {wine.product_id && (
              <div className={styles.imageSection}>
                <img
                  src={`/api/wine-image/${wine.product_id}?size=250x250`}
                  alt={he.decode(wine.name)}
                  className={styles.wineImage}
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                  }}
                />
              </div>
            )}

            {/* Basic Info Section */}
            <div className={styles.infoSection}>
              <h3 className={styles.sectionTitle}>Grunnleggende informasjon</h3>
              <div className={styles.infoGrid}>
                {wine.main_producer && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Produsent</span>
                    <span className={styles.infoValue}>{wine.main_producer}</span>
                  </div>
                )}

                {wine.main_country && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Land</span>
                    <span className={styles.infoValue}>{wine.main_country}</span>
                  </div>
                )}

                {wine.district && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Distrikt</span>
                    <span className={styles.infoValue}>{wine.district}</span>
                  </div>
                )}

                {wine.sub_district && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Under-distrikt</span>
                    <span className={styles.infoValue}>{wine.sub_district}</span>
                  </div>
                )}

                {wine.price && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Pris</span>
                    <span className={styles.infoValue}>Kr {wine.price}</span>
                  </div>
                )}

                {wine.volume && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Volum</span>
                    <span className={styles.infoValue}>{wine.volume} cl</span>
                  </div>
                )}

                {wine.color && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Farge</span>
                    <span className={styles.infoValue}>{wine.color}</span>
                  </div>
                )}

                {wine.content?.style?.name && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Stil</span>
                    <span className={styles.infoValue}>{wine.content.style.name}</span>
                  </div>
                )}

                {alcohol && (
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>Alkohol</span>
                    <span className={styles.infoValue}>{alcohol}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Ingredients */}
            {wine.content?.ingredients && wine.content.ingredients.length > 0 && (
              <>
                <div className={styles.separator} />
                <div className={styles.infoSection}>
                  <h3 className={styles.sectionTitle}>Ingredienser</h3>
                  <p className={styles.ingredientsList}>
                    {wine.content.ingredients.map((i) => i.formattedValue).join(", ")}
                  </p>
                </div>
              </>
            )}

            {/* Characteristics Section */}
            {(wine.friskhet !== null ||
              wine.fylde !== null ||
              wine.sodme !== null ||
              wine.garvestoff !== null ||
              bitterness) && (
              <>
                <div className={styles.separator} />
                <div className={styles.infoSection}>
                  <h3 className={styles.sectionTitle}>Karakteristikker</h3>
                  <div className={styles.characteristicsGrid}>
                    {wine.friskhet !== null && (
                      <div className={styles.characteristic}>
                        <span className={styles.characteristicLabel}>Friskhet</span>
                        <span className={styles.characteristicValue}>{wine.friskhet}</span>
                      </div>
                    )}

                    {wine.fylde !== null && (
                      <div className={styles.characteristic}>
                        <span className={styles.characteristicLabel}>Fylde</span>
                        <span className={styles.characteristicValue}>{wine.fylde}</span>
                      </div>
                    )}

                    {wine.sodme !== null && (
                      <div className={styles.characteristic}>
                        <span className={styles.characteristicLabel}>Sødme</span>
                        <span className={styles.characteristicValue}>{wine.sodme}</span>
                      </div>
                    )}

                    {(wine.garvestoff !== null || tannin) && (
                      <div className={styles.characteristic}>
                        <span className={styles.characteristicLabel}>Garvestoff</span>
                        <span className={styles.characteristicValue}>
                          {wine.garvestoff !== null ? wine.garvestoff : tannin}
                        </span>
                      </div>
                    )}

                    {bitterness && (
                      <div className={styles.characteristic}>
                        <span className={styles.characteristicLabel}>Bitterhet</span>
                        <span className={styles.characteristicValue}>{bitterness}</span>
                      </div>
                    )}

                    {sugar && (
                      <div className={styles.characteristic}>
                        <span className={styles.characteristicLabel}>Sukker</span>
                        <span className={styles.characteristicValue}>{sugar}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Smell & Taste Descriptions */}
            {(wine.smell || wine.taste) && (
              <>
                <div className={styles.separator} />
                <div className={styles.infoSection}>
                  {wine.smell && (
                    <div className={styles.descriptionBlock}>
                      <h3 className={styles.sectionTitle}>Lukt</h3>
                      <p className={styles.descriptionText}>{wine.smell}</p>
                    </div>
                  )}

                  {wine.taste && (
                    <div className={styles.descriptionBlock}>
                      <h3 className={styles.sectionTitle}>Smak</h3>
                      <p className={styles.descriptionText}>{wine.taste}</p>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className={styles.separator} />
            <div className={styles.actionButtons}>
              <Link
                href={`/smaking/${wine.product_id}${wine.year ? `?year=${wine.year}` : ""}`}
                className={styles.linkButton}
              >
                <button className={styles.primaryButton}>Start smaking</button>
              </Link>
              <button onClick={onClose} className={styles.secondaryButton}>
                Lukk
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export default WineDetailsModal
