"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import type { Wine } from "@/lib/types"

interface WineDetailsModalProps {
  wine: Wine | null
  isOpen: boolean
  onClose: () => void
}

export function WineDetailsModal({ wine, isOpen, onClose }: WineDetailsModalProps) {
  if (!wine) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{wine.name}</DialogTitle>
          <DialogDescription>
            {wine.year && <span>{wine.year} • </span>}
            {wine.main_category?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6">
          {/* Wine Image */}
          <div className="flex justify-center">
            <img
              src={`/api/wine-image/${wine.product_id}?size=200x200`}
              alt={wine.name}
              className="max-w-[200px] h-auto"
              onError={(e) => {
                e.currentTarget.style.display = "none"
              }}
            />
          </div>

          {/* Wine Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {wine.main_producer?.name && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Produsent</h4>
                <p>{wine.main_producer.name}</p>
              </div>
            )}

            {wine.main_country?.name && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Land</h4>
                <p>{wine.main_country.name}</p>
              </div>
            )}

            {wine.district && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Distrikt</h4>
                <p>{wine.district}</p>
              </div>
            )}

            {wine.sub_district && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Under-distrikt</h4>
                <p>{wine.sub_district}</p>
              </div>
            )}

            {wine.grapes && wine.grapes.length > 0 && (
              <div className="col-span-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Druer</h4>
                <p>{wine.grapes.map((g) => g.grape.name).join(", ")}</p>
              </div>
            )}

            {wine.price && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Pris</h4>
                <p>{wine.price.formattedValue}</p>
              </div>
            )}

            {wine.volume && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Volum</h4>
                <p>{wine.volume.formattedValue}</p>
              </div>
            )}

            {wine.content?.alcohol?.formattedValue && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Alkohol</h4>
                <p>{wine.content.alcohol.formattedValue}</p>
              </div>
            )}

            {wine.content?.sugar?.formattedValue && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Sukker</h4>
                <p>{wine.content.sugar.formattedValue}</p>
              </div>
            )}

            {wine.content?.color && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Farge</h4>
                <p>{wine.content.color}</p>
              </div>
            )}

            {wine.content?.style?.name && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Stil</h4>
                <p>{wine.content.style.name}</p>
              </div>
            )}

            {wine.content?.freshness && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Friskhet</h4>
                <p>{wine.content.freshness}</p>
              </div>
            )}

            {wine.content?.fullness && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Fylde</h4>
                <p>{wine.content.fullness}</p>
              </div>
            )}

            {wine.content?.bitterness && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Bitterhet</h4>
                <p>{wine.content.bitterness}</p>
              </div>
            )}

            {wine.content?.sweetness && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Sødme</h4>
                <p>{wine.content.sweetness}</p>
              </div>
            )}

            {wine.content?.tannin && (
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground">Tannin</h4>
                <p>{wine.content.tannin}</p>
              </div>
            )}
          </div>

          {/* Descriptions */}
          {wine.content?.smell && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Lukt</h4>
              <p className="text-sm">{wine.content.smell}</p>
            </div>
          )}

          {wine.content?.taste && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">Smak</h4>
              <p className="text-sm">{wine.content.taste}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Link href={`/smaking/${wine.product_id}`} className="flex-1">
              <Button className="w-full">Start smaking</Button>
            </Link>
            <Button variant="outline" onClick={onClose}>
              Lukk
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
