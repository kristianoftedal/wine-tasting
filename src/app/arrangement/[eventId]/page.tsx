import { createClient } from '@/lib/supabase/server';
import type { Event, Group, Wine } from '@/lib/types';
import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import he from 'he';
import Image from 'next/image';
import Link from 'next/link';
import NavButton from './NavButton';
import styles from './page.module.css';

export default async function Arrangement({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single<Event>();

  if (!event) {
    return (
      <div className={styles.container}>
        <p>Arrangement ikke funnet</p>
      </div>
    );
  }

  const { data: group } = await supabase.from('groups').select('*').eq('id', event.group_id).single<Group>();

  const { data: wines } = await supabase
    .from('wines')
    .select('*')
    .in('id', event.wines.length > 0 ? event.wines : ['']);

  const { data: userTastings } = user
    ? await supabase.from('tastings').select('wine_id').eq('user_id', user.id).eq('event_id', eventId)
    : { data: [] };

  const tastedWineIds = new Set(userTastings?.map(t => t.wine_id) || []);

  const sortedWines = wines?.sort((a, b) => event.wines.indexOf(a.id) - event.wines.indexOf(b.id)) || [];

  const nextSuggestedWine = sortedWines.find(wine => !tastedWineIds.has(wine.id));

  const formattedDate = format(new Date(event.date), 'EEEE dd. MMMM yyyy', { locale: nb });

  const getWineImage = (wine: Wine) => {
    if (wine.images && wine.images.length > 0) {
      return wine.images[0];
    }
    return null;
  };

  const getCategoryColor = (category: string | undefined | null) => {
    if (!category) return { bg: '#f3f4f6', text: '#6b7280' };
    const lowerCategory = category.toLowerCase();
    if (lowerCategory.includes('rød')) return { bg: '#fef2f2', text: '#991b1b' };
    if (lowerCategory.includes('hvit')) return { bg: '#fefce8', text: '#854d0e' };
    if (lowerCategory.includes('musserende') || lowerCategory.includes('champagne'))
      return { bg: '#f0fdfa', text: '#0f766e' };
    if (lowerCategory.includes('rosé')) return { bg: '#fdf2f8', text: '#9d174d' };
    return { bg: '#f3f4f6', text: '#6b7280' };
  };

  const formatPrice = (price: unknown): string | null => {
    if (price === null || price === undefined) return null;
    const numPrice = typeof price === 'number' ? price : Number.parseFloat(String(price));
    if (Number.isNaN(numPrice)) return null;
    return numPrice.toFixed(2);
  };

  return (
    <div className={styles.container}>
      <Link
        href="/"
        className={styles.backButton}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Tilbake til oversikt
      </Link>

      <header className={styles.header}>
        <div className={styles.headerAccent} />
        <div className={styles.headerContent}>
          <h1 className={styles.title}>{event.name}</h1>
          <div className={styles.meta}>
            <div className={styles.metaItem}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <rect
                  x="3"
                  y="4"
                  width="18"
                  height="18"
                  rx="2"
                  ry="2"
                />
                <line
                  x1="16"
                  y1="2"
                  x2="16"
                  y2="6"
                />
                <line
                  x1="8"
                  y1="2"
                  x2="8"
                  y2="6"
                />
                <line
                  x1="3"
                  y1="10"
                  x2="21"
                  y2="10"
                />
              </svg>
              <span>{formattedDate}</span>
            </div>
            <div className={styles.metaItem}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle
                  cx="9"
                  cy="7"
                  r="4"
                />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>{group?.name}</span>
            </div>
          </div>
          {event.description && <p className={styles.description}>{event.description}</p>}
        </div>
      </header>

      <Link
        href={`/arrangement/${eventId}/resultater`}
        className={styles.resultsLink}>
        <div className={styles.resultsLinkContent}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="M18 20V10M12 20V4M6 20v-6" />
          </svg>
          <div className={styles.resultsLinkText}>
            <span className={styles.resultsLinkTitle}>Se live resultater</span>
            <span className={styles.resultsLinkSubtitle}>Se hva andre har stemt</span>
          </div>
        </div>
        <span className={styles.liveBadge}>
          <span className={styles.liveDot} />
          Live
        </span>
      </Link>

      <div className={styles.progressSection}>
        <div className={styles.progressHeader}>
          <span className={styles.progressLabel}>Din fremgang</span>
          <span className={styles.progressCount}>
            <strong>{tastedWineIds.size}</strong> av <strong>{sortedWines.length}</strong> viner smakt
          </span>
        </div>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${sortedWines.length > 0 ? (tastedWineIds.size / sortedWines.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <section className={styles.winesSection}>
        <h2 className={styles.sectionTitle}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="M8 22h8M12 22v-7M12 15a7 7 0 0 0 7-7V2H5v6a7 7 0 0 0 7 7z" />
          </svg>
          Viner for kvelden
        </h2>

        <div className={styles.winesList}>
          {sortedWines.map((wine: Wine, index: number) => {
            const isTasted = tastedWineIds.has(wine.id);
            const isNextSuggested = nextSuggestedWine?.id === wine.id;
            const wineImage = getWineImage(wine);
            const categoryColors = getCategoryColor(wine.main_category);
            const formattedPrice = formatPrice(wine.price);

            return (
              <NavButton
                wineId={wine.id}
                eventId={eventId}
                year={wine.year}
                key={`${wine.id}-${wine.year || index}`}>
                <article
                  className={`${styles.wineCard} ${isTasted ? styles.wineCardTasted : ''} ${
                    isNextSuggested ? styles.wineCardSuggested : ''
                  }`}
                  style={{
                    background: isTasted ? 'linear-gradient(135deg, #f0fdf4 0%, #f9fafb 100%)' : 'white',
                    borderRadius: '20px',
                    boxShadow: isNextSuggested
                      ? '0 0 0 2px #667eea, 0 4px 20px rgba(102, 126, 234, 0.2)'
                      : '0 2px 12px rgba(0, 0, 0, 0.06)',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'pointer'
                  }}>
                  {/* Wine number badge */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: '16px',
                      width: '32px',
                      height: '32px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      fontWeight: 700,
                      boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
                      zIndex: 2
                    }}>
                    {index + 1}
                  </div>

                  {/* Status indicator */}
                  {isTasted && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: '#dcfce7',
                        color: '#166534',
                        zIndex: 2
                      }}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Smakt
                    </div>
                  )}
                  {isNextSuggested && !isTasted && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '6px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        zIndex: 2
                      }}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                      Neste
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '20px',
                      paddingLeft: '60px',
                      gap: '20px'
                    }}>
                    {/* Wine image section */}
                    <div
                      style={{
                        flexShrink: 0,
                        width: '80px',
                        height: '120px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                      {wineImage ? (
                        <Image
                          src={wineImage || '/placeholder.svg'}
                          alt={he.decode(wine.name)}
                          width={80}
                          height={120}
                          style={{
                            objectFit: 'contain',
                            maxHeight: '120px',
                            maxWidth: '80px',
                            filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15))'
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: '70px',
                            height: '100px',
                            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#9ca3af'
                          }}>
                          <svg
                            width="40"
                            height="40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5">
                            <path d="M8 22h8M12 22v-7M12 15a7 7 0 0 0 7-7V2H5v6a7 7 0 0 0 7 7z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Wine info section */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3
                        style={{
                          fontSize: '17px',
                          fontWeight: 600,
                          color: '#1f2937',
                          margin: '0 0 10px 0',
                          lineHeight: 1.35
                        }}>
                        {he.decode(wine.name)}
                      </h3>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '8px',
                          marginBottom: '8px'
                        }}>
                        {wine.year && (
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#667eea',
                              background: 'rgba(102, 126, 234, 0.1)',
                              padding: '3px 10px',
                              borderRadius: '6px'
                            }}>
                            {wine.year}
                          </span>
                        )}
                        {wine.main_category && (
                          <span
                            style={{
                              fontSize: '12px',
                              fontWeight: 500,
                              padding: '4px 10px',
                              borderRadius: '6px',
                              backgroundColor: categoryColors.bg,
                              color: categoryColors.text
                            }}>
                            {wine.main_category}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                        {wine.main_country && (
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              fontSize: '13px',
                              color: '#6b7280'
                            }}>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#9ca3af"
                              strokeWidth="2">
                              <circle
                                cx="12"
                                cy="7"
                                r="10"
                              />
                              <line
                                x1="2"
                                y1="12"
                                x2="22"
                                y2="12"
                              />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                            {wine.main_country}
                          </span>
                        )}
                        {formattedPrice && (
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                            Kr {formattedPrice}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action section */}
                    <div style={{ flexShrink: 0, marginLeft: 'auto' }}>
                      {isTasted ? (
                        <div
                          style={{
                            width: '52px',
                            height: '52px',
                            background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                          }}>
                          <svg
                            width="28"
                            height="28"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2">
                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                            <polyline points="22 4 12 14.01 9 11.01" />
                          </svg>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '14px 20px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '14px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: 600,
                            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                          }}>
                          <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2">
                            <path d="M8 22h8M12 22v-7M12 15a7 7 0 0 0 7-7V2H5v6a7 7 0 0 0 7 7z" />
                          </svg>
                          <span>Smak vin</span>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              </NavButton>
            );
          })}
        </div>
      </section>
    </div>
  );
}
