"use client";

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useCart } from "../../../contexts/CartContext";
import CartSidebar from "./CartSidebar"; // <--- Import the separated component
import { mediaUrl } from "../../../lib/api";
import { useI18n } from "../../../lib/i18n/client";
import { localePath, switchLocalePath } from "../../../lib/i18n/paths";
import "./NavBar.css";

// Icons reference relative media paths — resolved via mediaUrl() at render time.
const cartIconPath = mediaUrl("/uploads/assets/icons/shopping-bag.png");
const flagIconPath = mediaUrl("/uploads/assets/icons/flag-egypt.svg");
const logo = mediaUrl("/uploads/images/l(dark).png")
// --- Icons ---
// TEMPORARY (2026-09-27): MenuIcon is commented out along with the hamburger
// button that was its only caller, so the drawer can be restored by
// uncommenting two blocks. Left in place it would be a symbol no build or lint
// step is able to justify.
/*
const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);
*/

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const Nav = () => {
  const pathname = usePathname();
  const { locale, t } = useI18n();
  // We only need basic cart state here to toggle the sidebar and show the badge
  const { isCartOpen, setIsCartOpen, itemCount } = useCart();
  
  // --- Language switch target (same page, other locale) ---
  const nextLocale = locale === 'en' ? 'ar' : 'en';
  const switchHref = switchLocalePath(pathname, nextLocale);

  // Full document navigation on locale change. A soft <Link> swap keeps the
  // current locale's DOM (and direction) on screen until the new RSC payload
  // arrives, which reads as a half-reloaded page. Assigning the location loads
  // the target locale's document — fresh HTML, correct dir/lang — right away.
  const goToLocale = (target: string, e?: React.MouseEvent) => {
    e?.preventDefault(); // keep cmd/ctrl+click and "open in new tab" working
    if (target === locale) return;
    window.location.assign(switchLocalePath(pathname, target));
  };
  
  // --- Mobile Menu State ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Lock body scroll only for MOBILE MENU (CartSidebar handles its own locking)
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else if (!isCartOpen) {
      // Only release scroll if cart is ALSO closed
      document.body.style.overflow = 'unset';
    }
    return () => { 
        if(!isCartOpen) document.body.style.overflow = 'unset'; 
    };
  }, [isMobileMenuOpen, isCartOpen]);

  // Close mobile menu when route changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: close the drawer on navigation
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header>
        <div className="navbar">
          <div className="navbar-top">
            <div className="navbar-top-left">

              {/* --- Hamburger Button (Visible on Mobile) ---
                  TEMPORARY (2026-09-27): disabled at the operator's request —
                  the phone view ships without the drawer, and the region prefix
                  below ("Egypt | English") takes the left slot instead.
                  To restore: uncomment this button and MenuIcon above, then
                  re-enable `.hamburger-btn { display: block }` in the <=768px
                  query at the end of NavBar.css. The drawer itself, and the
                  language buttons in its footer, are untouched. */}
              {/*
              <button
                className="hamburger-btn"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label={t('nav.openMenu')}
              >
                <MenuIcon />
              </button>
              */}

              {/* Region Display → hard-navigates to the other locale (EN ↔ AR).
                  TEMPORARY: this used to be desktop-only, with the drawer
                  carrying the language switch on phones. With the drawer off it
                  is the only way to change locale, so the <=768px query now
                  shows it on phones too — the same "Egypt | English" prefix as
                  the desktop bar, not a button pair. */}
              <a
                className="region-display"
                href={switchHref}
                title={t('nav.switchLang')}
                onClick={(e) => goToLocale(nextLocale, e)}
              >
                <img className="flag-icon" src={flagIconPath} alt={t('nav.regionAlt')} />
                <span>{t('nav.region')}</span>
              </a>

            </div>
            
            <div className="navbar-logo">
              <Link id="logo-link" href={localePath('/', locale)}>
                <Image
                  className="logo-font"
                  src={logo}
                  alt={t('nav.homeAlt')}
                  width={1774}
                  height={887}
                  sizes="100px"
                />
              </Link>
            </div>
            
            <div className="navbar-top-right">
              <div className="cart-container">
                <button className="cart-button" onClick={() => setIsCartOpen(!isCartOpen)} aria-label={t('nav.openBag')}>
                  <Image className="cart-icon" src={cartIconPath} alt={t('nav.cartAlt')} width={512} height={512} sizes="22px" />
                  {itemCount > 0 && <span className="cart-badge">{itemCount}</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- MOBILE MENU SIDEBAR --- */}
      <div className={`mobile-menu-container ${isMobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-overlay" onClick={() => setIsMobileMenuOpen(false)}></div>
        <div className="mobile-menu-sidebar">
          <div className="mobile-menu-header">
            <span className="mobile-menu-title">{t('nav.menuTitle')}</span>
            <button className="close-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          <nav className="mobile-nav-links">
            <Link href={localePath('/', locale)} className="mobile-link">{t('nav.home')}</Link>
            <Link href={localePath('/bestsellers', locale)} className="mobile-link">{t('nav.onDemand')}</Link>
            <Link href={localePath('/shop', locale)} className="mobile-link">{t('nav.shop')}</Link>
            <Link href={localePath('/AboutUs', locale)} className="mobile-link">{t('nav.story')}</Link>
          </nav>
          <div className="mobile-menu-footer">
            <span className="mobile-menu-footer-label">{t('nav.switchLang')}</span>
            <div className="lang-toggle" role="group" aria-label={t('nav.switchLang')}>
              <button
                type="button"
                className={`lang-toggle__btn ${locale === 'en' ? 'is-active' : ''}`}
                lang="en"
                aria-current={locale === 'en' ? 'true' : undefined}
                onClick={(e) => goToLocale('en', e)}
              >
                English
              </button>
              <button
                type="button"
                className={`lang-toggle__btn ${locale === 'ar' ? 'is-active' : ''}`}
                lang="ar"
                aria-current={locale === 'ar' ? 'true' : undefined}
                onClick={(e) => goToLocale('ar', e)}
              >
                العربية
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- CART SIDEBAR COMPONENT --- */}
      {/* Logic for this is now handled inside CartSidebar.tsx */}
      <CartSidebar /> 
    </>
  );
};

export default Nav;