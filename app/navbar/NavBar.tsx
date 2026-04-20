"use client";

import React, { useState, useEffect } from "react";
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useCart } from "../contexts/CartContext";
import CartSidebar from "./CartSidebar"; // <--- Import the separated component
import "./NavBar.css";

// --- Configuration ---
const apiBaseUrl = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:5002";
const cartIconPath = "/uploads/assets/icons/shopping-bag.png";
const flagIconPath = "/uploads/assets/icons/flag-egypt.svg";
const logo = "/uploads/images/image(1).png"
// --- Icons ---
const MenuIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const Nav = React.forwardRef<HTMLElement>(function Nav(props, ref) {
  const router = useRouter();
  const pathname = usePathname();
  // We only need basic cart state here to toggle the sidebar and show the badge
  const { isCartOpen, setIsCartOpen, itemCount } = useCart();
  
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
    setIsMobileMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header>
        <div className="navbar">
          <div className="navbar-top">
            <div className="navbar-top-left">
              
              {/* --- Hamburger Button (Visible on Mobile) --- */}
              <button 
                className="hamburger-btn" 
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Open Menu"
              >
                <MenuIcon />
              </button>

              {/* Region Display */}
              <div className="region-display" title="Region">
                <img className="flag-icon" src={`${apiBaseUrl}${flagIconPath}`} alt="Egypt" />
                <span>Egypt | English</span>
              </div>

            </div>
            
            <div className="navbar-logo">
              <Link id="logo-link" href="/">
                <img className="logo-font" src={`${apiBaseUrl}${logo}`}></img>
              </Link>
            </div>
            
            <div className="navbar-top-right">
              <div className="cart-container">
                <button className="cart-button" onClick={() => setIsCartOpen(!isCartOpen)} aria-label="Open Shopping Bag">
                  <img className="cart-icon" src={`${apiBaseUrl}${cartIconPath}`} alt="Cart" />
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
            <span className="mobile-menu-title">Menu</span>
            <button className="close-menu-btn" onClick={() => setIsMobileMenuOpen(false)}>
              <CloseIcon />
            </button>
          </div>
          <nav className="mobile-nav-links">
            <Link href="/" className="mobile-link">Home</Link>
            <Link href="/bestsellers" className="mobile-link">On Demand</Link>
            <Link href="/shop" className="mobile-link">Shop</Link>
            <Link href="/AboutUs" className="mobile-link">The Story</Link>
          </nav>
          <div className="mobile-menu-footer">
             <div className="region-display-mobile">
                <img className="flag-icon" src={`${apiBaseUrl}${flagIconPath}`} alt="Egypt" />
                <span>Egypt | English</span>
             </div>
          </div>
        </div>
      </div>

      {/* --- CART SIDEBAR COMPONENT --- */}
      {/* Logic for this is now handled inside CartSidebar.tsx */}
      <CartSidebar /> 
    </>
  );
});

export default Nav;