'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Wine } from '@/lib/types';
import he from 'he';
import Link from 'next/link';
import styles from './WineDetailsModal.module.css';

interface WineDetailsModalProps {
  wine: Wine | null;
  isOpen: boolean;
  onClose: () => void;
}

function getCharacteristic(wine: Wine, name: string): string | null {
  const char = wine.content?.characteristics?.find(c => c.name.toLowerCase() === name.toLowerCase());
  return char?.readableValue || null;
}

export function WineDetailsModal({ wine, isOpen, onClose }: WineDetailsModalProps) {
  if (!wine) return null;

  const alcohol = getCharacteristic(wine, 'Alkohol');
  const sugar = getCharacteristic(wine, 'Sukker');
  const freshness = getCharacteristic(wine, 'Friskhet');
  const fullness = getCharacteristic(wine, 'Fylde');
  const bitterness = getCharacteristic(wine, 'Bitterhet');
  const sweetness = getCharacteristic(wine, 'Sødme');
  const tannin = getCharacteristic(wine, 'Tannin') || getCharacteristic(wine, 'Garvestoffer');

  return (
    <Dialog
      open={isOpen}
      onOpenChange={onClose}>
      <DialogContent className={styles.dialogContent}>
        <DialogHeader>
          <DialogTitle>{he.decode(wine.name)}</DialogTitle>
          <DialogDescription>
            {wine.year && <span>{wine.year} • </span>}
            {wine.main_category}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.contentGrid}>
          {/* Wine Image */}
          <div className={styles.imageContainer}>
            <img
              src={`/api/wine-image/${wine.product_id}?size=200x200`}
              alt={he.decode(wine.name)}
              className={styles.wineImage}
              onError={e => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Wine Details Grid */}
          <div className={styles.detailsGrid}>
            {wine.main_producer && (
              <div>
                <h4 className={styles.label}>Produsent</h4>
                <p>{wine.main_producer}</p>
              </div>
            )}

            {wine.main_country && (
              <div>
                <h4 className={styles.label}>Land</h4>
                <p>{wine.main_country}</p>
              </div>
            )}

            {wine.district && (
              <div>
                <h4 className={styles.label}>Distrikt</h4>
                <p>{wine.district}</p>
              </div>
            )}

            {wine.sub_district && (
              <div>
                <h4 className={styles.label}>Under-distrikt</h4>
                <p>{wine.sub_district}</p>
              </div>
            )}

            {wine.content?.ingredients && wine.content.ingredients.length > 0 && (
              <div className={styles.fullWidth}>
                <h4 className={styles.label}>Ingredienser</h4>
                <p>{wine.content.ingredients.map(i => i.formattedValue).join(', ')}</p>
              </div>
            )}

            {wine.price && (
              <div>
                <h4 className={styles.label}>Pris</h4>
                <p>Kr {wine.price}</p>
              </div>
            )}

            {wine.volume && (
              <div>
                <h4 className={styles.label}>Volum</h4>
                <p>{wine.volume} cl</p>
              </div>
            )}

            {wine.color && (
              <div>
                <h4 className={styles.label}>Farge</h4>
                <p>{wine.color}</p>
              </div>
            )}

            {wine.content?.style?.name && (
              <div>
                <h4 className={styles.label}>Stil</h4>
                <p>{wine.content.style.name}</p>
              </div>
            )}

            {freshness && (
              <div>
                <h4 className={styles.label}>Friskhet</h4>
                <p>{freshness}</p>
              </div>
            )}

            {fullness && (
              <div>
                <h4 className={styles.label}>Fylde</h4>
                <p>{fullness}</p>
              </div>
            )}

            {bitterness && (
              <div>
                <h4 className={styles.label}>Bitterhet</h4>
                <p>{bitterness}</p>
              </div>
            )}

            {sweetness && (
              <div>
                <h4 className={styles.label}>Sødme</h4>
                <p>{sweetness}</p>
              </div>
            )}

            {tannin && (
              <div>
                <h4 className={styles.label}>Tannin</h4>
                <p>{tannin}</p>
              </div>
            )}
          </div>

          {wine.smell && (
            <div>
              <h4 className={styles.descriptionLabel}>Lukt</h4>
              <p className={styles.descriptionText}>{wine.smell}</p>
            </div>
          )}

          {wine.taste && (
            <div>
              <h4 className={styles.descriptionLabel}>Smak</h4>
              <p className={styles.descriptionText}>{wine.taste}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className={styles.actionButtons}>
            <Link
              href={`/smaking/${wine.product_id}${wine.year ? `?year=${wine.year}` : ''}`}
              className={styles.linkButton}>
              <Button className={styles.fullWidthButton}>Start smaking</Button>
            </Link>
            <Button
              variant="outline"
              onClick={onClose}>
              Lukk
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WineDetailsModal;
