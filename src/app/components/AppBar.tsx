'use client';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import styles from './AppBar.module.css';

export default function AppBar() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      const {
        data: { user }
      } = await supabase.auth.getUser();
      setIsAuthenticated(!!user);
      setLoading(false);
    };

    checkAuth();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setIsMenuOpen(false);
    router.push('/');
    router.refresh();
  };

  const navigateTo = (path: string) => {
    setIsMenuOpen(false);
    router.push(path);
  };

  const authButtons = () => {
    if (loading) {
      return null;
    }

    if (isAuthenticated) {
      return (
        <>
          <button
            onClick={() => navigateTo('/profil')}
            className={`${styles.button} ${styles.buttonOutline}`}>
            Profil
          </button>
          <button
            className={`${styles.button} ${styles.buttonOutline}`}
            onClick={handleSignOut}>
            Logg ut
          </button>
        </>
      );
    } else {
      return (
        <>
          <button
            onClick={() => navigateTo('/login')}
            className={`${styles.button} ${styles.buttonOutline}`}>
            Logg inn
          </button>
          <button
            onClick={() => navigateTo('/register')}
            className={`${styles.button} ${styles.buttonPrimary}`}>
            Registrer deg
          </button>
        </>
      );
    }
  };

  return (
    <header className={styles.appBar}>
      <div className={styles.container}>
        <div
          className={styles.logo}
          onClick={() => navigateTo('/')}
          style={{ cursor: 'pointer' }}>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="M8 22h8M12 11v11M12 11c3.5 0 6-3 6-7H6c0 4 2.5 7 6 7z" />
            <line
              x1="9"
              y1="9"
              x2="15"
              y2="9"
            />
          </svg>
          <span>Smak Vin!</span>
        </div>

        <button
          className={styles.hamburger}
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={isMenuOpen}>
          <span className={`${styles.hamburgerLine} ${isMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${isMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${isMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
        </button>

        <div className={styles.actions}>
          <button
            onClick={() => router.push('/toppliste')}
            className={`${styles.button} ${styles.buttonOutline}`}>
            Toppliste
          </button>
          <button
            onClick={() => router.push('/sommailer')}
            className={`${styles.button} ${styles.buttonOutline}`}>
            Sommailer
          </button>
          {authButtons()}
        </div>

        <div className={`${styles.mobileMenu} ${isMenuOpen ? styles.mobileMenuOpen : ''}`}>
          <nav className={styles.mobileNav}>
            <button
              onClick={() => navigateTo('/toppliste')}
              className={styles.mobileNavItem}>
              Toppliste
            </button>
            <button
              onClick={() => navigateTo('/sommailer')}
              className={styles.mobileNavItem}>
              Sommailer
            </button>
            {!loading && isAuthenticated && (
              <>
                <button
                  onClick={() => navigateTo('/profil')}
                  className={styles.mobileNavItem}>
                  Profil
                </button>
                <button
                  onClick={handleSignOut}
                  className={styles.mobileNavItem}>
                  Logg ut
                </button>
              </>
            )}
            {!loading && !isAuthenticated && (
              <>
                <button
                  onClick={() => navigateTo('/login')}
                  className={styles.mobileNavItem}>
                  Logg inn
                </button>
                <button
                  onClick={() => navigateTo('/register')}
                  className={`${styles.mobileNavItem} ${styles.mobileNavItemPrimary}`}>
                  Registrer deg
                </button>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
