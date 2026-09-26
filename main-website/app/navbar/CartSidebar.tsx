"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useCart } from "../contexts/CartContext";
import { CartItemPublic, mediaUrl } from "../../lib/api"; 
import { useI18n } from "../i18n/client";
import { localePath } from "../i18n/paths";
import { formatPrice } from "../../lib/format";
import "./NavBar.css";

const CartSidebar: React.FC = () => {
  const router = useRouter();
  const { cart, isCartOpen, setIsCartOpen, updateItemQuantity, removeItem, itemCount } = useCart();
  const { locale, t } = useI18n();

  React.useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isCartOpen]);

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push(localePath('/checkout', locale));
  };

  // --- Calculate Progress Bar Data ---
  // Default to 2000 if not provided by backend yet to avoid NaN errors
  const threshold = cart?.summary?.freeShippingThreshold || 2000;
  const subtotal = cart?.summary?.subtotal || 0;
  const amountLeft = Math.max(0, threshold - subtotal);
  // Calculate percentage (capped at 100%)
  const progressPercentage = Math.min(100, (subtotal / threshold) * 100);

  return (
    <div className={`cart-sidebar-container ${isCartOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={t('cart.title')}>
      <div className="cart-overlay" onClick={() => setIsCartOpen(false)}></div>
      <div className="cart-sidebar">
        <div className="cart-sidebar-header">
          <h4>{t('cart.title')}</h4>
          <button className="close-cart-btn" onClick={() => setIsCartOpen(false)}>×</button>
        </div>
        <div className="cart-sidebar-body">
          {cart && cart.items.length > 0 ? (
              <ul className="cart-item-list">
                {cart.items.map((item: CartItemPublic) => {
                  const displayPrice = item.effectiveSalePrice ?? item.originalPrice;
                  const variantDetails = [item.colorName, item.size].filter(Boolean).join(' / ');
                  const imageUrl = mediaUrl(item.imageUrl) || '/default-image.png';
                  const itemName = locale === 'ar' ? (item.productNameAr || item.productName) : item.productName;

                  return (
                    <li key={item.id} className="cart-item">
                       <Image
                          src={imageUrl}
                          alt={itemName}
                          className="cart-item-image"
                          width={90}
                          height={150}
                          sizes="90px"
                        />
                       <div className="cart-item-details">
                          <div className="cart-item-text">
                             <p className="cart-item-name">{itemName}</p>
                             {variantDetails && <p className="cart-item-variant">{variantDetails}</p>}
                          </div>
                          {/* Price on its own line: below the name, above the quantity */}
                          <p className="cart-item-price-total">{formatPrice(displayPrice * item.quantity, locale)}</p>
                          <div className="quantity-control">
                              <button onClick={() => updateItemQuantity(item.id, item.quantity - 1)} aria-label="Decrease quantity">−</button>
                              <span>{item.quantity}</span>
                              <button onClick={() => updateItemQuantity(item.id, item.quantity + 1)} aria-label="Increase quantity">+</button>
                          </div>
                       </div>
                       <button className="cart-item-remove-btn" onClick={() => removeItem(item.id)} title={t('cart.removeItem')}>×</button>
                    </li>
                  );
                })}
              </ul>
          ) : (
              <p className="cart-empty-message">{t('cart.empty')}</p>
          )}
        </div>

        {/* --- Free Shipping Progress Bar (hidden for now, restore later) --- */}
        {/* {cart && cart.items.length > 0 && (
          <div className="cart-shipping-progress">
            {amountLeft > 0 ? (
              <p className="shipping-message">
                Spend <strong>EGP {amountLeft.toFixed(0)}</strong> more for free shipping
              </p>
            ) : (
              <p className="shipping-message success">You have unlocked <strong>Free Shipping!</strong></p>
            )}
            <div className="progress-bar-bg" aria-hidden="true">
              <div className="progress-bar-fill" style={{ width: `${progressPercentage}%` }} />
            </div>
          </div>
        )} */}

        {itemCount > 0 && cart && (
          <div className="cart-sidebar-footer">
            <div className="cart-subtotal">
              <span>{t('cart.subtotal')}</span>
              <span>{formatPrice(cart.summary.subtotal, locale)}</span>
            </div>
            <button className="checkout-btn" onClick={handleCheckout}>
              {t('cart.checkout')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartSidebar;