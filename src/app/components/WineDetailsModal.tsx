'use client';

import type { Wine } from '@/lib/types';
import * as Dialog from '@radix-ui/react-dialog';
import he from 'he';
import { X } from 'lucide-react';
import Link from 'next/link';
import { useRef } from 'react';
import styles from './WineDetailsModal.module.css';

interface WineDetailsModalProps {
  wine: Wine | null;
  isOpen: boolean;
  onClose: () => void;
  /** Render the sheet/dialog shell while the wine record is still being fetched. */
  isLoading?: boolean;
  /**
   * Takes over the "Start smaking" button. Callers that need to run something
   * before navigating (resetting the tasting form, say) pass this instead of
   * letting the button be a plain link.
   */
  onStartTasting?: (wine: Wine) => void;
}

/** Below this width the dialog is presented as a bottom sheet. Matches the CSS breakpoint. */
const SHEET_BREAKPOINT = '(max-width: 640px)';

/** Drag distance, in px, past which releasing the sheet dismisses it. */
const DISMISS_THRESHOLD = 100;

export function WineDetailsModal({ wine, isOpen, onClose, isLoading = false, onStartTasting }: WineDetailsModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragOffset = useRef(0);

  /**
   * Swipe-to-dismiss for the mobile sheet. The listeners live on the grab
   * handle only — putting them on the whole sheet would fight the body scroll.
   * On desktop the handle is hidden and .content carries a centring transform
   * we must not overwrite, so the gesture is a no-op there.
   */
  const isSheet = () => typeof window !== 'undefined' && window.matchMedia(SHEET_BREAKPOINT).matches;

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isSheet()) return;
    dragStartY.current = e.clientY;
    dragOffset.current = 0;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStartY.current === null || !contentRef.current) return;
    dragOffset.current = Math.max(0, e.clientY - dragStartY.current);
    contentRef.current.style.transition = 'none';
    contentRef.current.style.transform = `translateY(${dragOffset.current}px)`;
  };

  const handleDragEnd = () => {
    if (dragStartY.current === null || !contentRef.current) return;
    const shouldClose = dragOffset.current > DISMISS_THRESHOLD;

    contentRef.current.style.transition = 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)';
    contentRef.current.style.transform = '';
    dragStartY.current = null;
    dragOffset.current = 0;

    if (shouldClose) onClose();
  };

  if (!wine && !isLoading) return null;

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content
          ref={contentRef}
          className={styles.content}>
          {/* Grab handle — visible (and draggable) only in the mobile sheet */}
          <div
            className={styles.grabberArea}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}>
            <div className={styles.grabber} />
          </div>

          {/* Close Button */}
          <Dialog.Close
            className={styles.closeButton}
            aria-label="Lukk">
            <X size={20} />
          </Dialog.Close>

          {!wine ? (
            <>
              <div className={styles.header}>
                <Dialog.Title className={styles.title}>Laster vin…</Dialog.Title>
                <Dialog.Description className={styles.subtitle}>Henter detaljer om vinen</Dialog.Description>
              </div>
              <div className={styles.modalBody}>
                <div className={`${styles.skeleton} ${styles.skeletonImage}`} />
                <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
                <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
                <div className={`${styles.skeleton} ${styles.skeletonLine}`} />
              </div>
            </>
          ) : (
            <>
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
                      onError={e => {
                        e.currentTarget.style.display = 'none';
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
                        <span className={styles.infoValue}>{wine.price}</span>
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

                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Alkohol</span>
                      <span className={styles.infoValue}>{wine.alcohol}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Syre</span>
                      <span className={styles.infoValue}>{wine.acidity}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Sukker</span>
                      <span className={styles.infoValue}>{wine.sugar}</span>
                    </div>
                  </div>
                </div>

                {/* Ingredients */}
                {wine.grapes && wine.grapes.length > 0 && (
                  <>
                    <div className={styles.separator} />
                    <div className={styles.infoSection}>
                      <h3 className={styles.sectionTitle}>Druer</h3>
                      <p className={styles.ingredientsList}>{wine.grapes.join(', ')}</p>
                    </div>
                  </>
                )}

                {/* Characteristics Section */}
                {(wine.friskhet !== null || wine.fylde !== null || wine.sodme !== null || wine.garvestoff !== null) && (
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
                        {wine.garvestoff !== null && (
                          <div className={styles.characteristic}>
                            <span className={styles.characteristicLabel}>Garvestoff</span>
                            <span className={styles.characteristicValue}>{wine.garvestoff}</span>
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
                  {onStartTasting ? (
                    <button
                      onClick={() => onStartTasting(wine)}
                      className={`${styles.primaryButton} ${styles.actionSlot}`}>
                      Start smaking
                    </button>
                  ) : (
                    <Link
                      href={`/smaking/${wine.id}`}
                      className={styles.linkButton}>
                      <button className={styles.primaryButton}>Start smaking</button>
                    </Link>
                  )}
                  <button
                    onClick={onClose}
                    className={styles.secondaryButton}>
                    Lukk
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default WineDetailsModal;
