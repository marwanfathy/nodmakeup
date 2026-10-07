"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from 'next/navigation';
import { useCart } from "../../../contexts/CartContext";
import { CartItemPublic, mediaUrl } from "../../../lib/api"; 
import { useI18n } from "../../../lib/i18n/client";
import { localePath } from "../../../lib/i18n/paths";
import { formatPrice } from "../../../lib/format";
import "./NavBar.css";

const CartSidebar: React.FC = () => {
  const router = useRouter();
  const { cart, isCartOpen, setIsCartOpen, updateItemQuantity, removeItem, itemCount, mutationError, dismissMutationError, busyItemIds } = useCart();
  const { locale, t } = useI18n();

  // A quantity change leaves no visible trace once the number settles and the
  // row keeps its position, so it is announced here. Polite, because it reports
  // something the shopper just asked for and nothing needs doing about it.
  // This replaces the old "Item removed." toast, which was the only signal that
  // a removal had happened at all.
  const [announcement, setAnnouncement] = React.useState('');
  const lastCount = React.useRef(itemCount);
  React.useEffect(() => {
    if (itemCount === lastCount.current) return;
    const delta = itemCount - lastCount.current;
    lastCount.current = itemCount;
    setAnnouncement(
      delta > 0
        ? t('cart.announcedAdded', { count: delta })
        : t('cart.announcedRemoved', { count: Math.abs(delta) })
    );
  }, [itemCount, t]);

  React.useEffect(() => {
    if (isCartOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      // A reason for a refusal stops being true once the drawer is closed — the
      // cart may have been emptied from another tab — so it does not survive to
      // greet the shopper next time they open the bag.
      dismissMutationError();
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isCartOpen, dismissMutationError]);

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push(localePath('/checkout', locale));
  };

  /** The way out of an empty bag. Without it the empty state is a dead end. */
  const handleBrowse = () => {
    setIsCartOpen(false);
    router.push(localePath('/shop', locale));
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
          <button className="close-cart-btn" onClick={() => setIsCartOpen(false)} aria-label={t('cart.close')}>×</button>
        </div>
        <div className="cart-sidebar-body">
          {cart && cart.items.length > 0 ? (
              <ul className="cart-item-list">
                {cart.items.map((item: CartItemPublic) => {
                  const displayPrice = item.effectiveSalePrice ?? item.originalPrice;
                  const variantDetails = [item.colorName, item.size].filter(Boolean).join(' / ');
                  const imageUrl = mediaUrl(item.imageUrl) || '/default-image.png';
                  const itemName = locale === 'ar' ? (item.productNameAr || item.productName) : item.productName;
                  // A line with a request in flight dims and disables its
                  // controls, so a second tap cannot queue a change against a
                  // response that has not landed.
                  const busy = busyItemIds.has(item.id);
                  // Only this row's own failure, so two lines failing at once
                  // each explain themselves on the right line.
                  const rowError = mutationError?.itemId === item.id ? mutationError.message : null;

                  return (
                    <li key={item.id} className={`cart-item ${busy ? 'is-busy' : ''}`} aria-busy={busy}>
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
                              <button
                                onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                aria-label={t('cart.decreaseQuantity')}
                                disabled={busy || item.quantity <= 1}
                              >−</button>
                              <span>{item.quantity}</span>
                              <button
                                onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                aria-label={t('cart.increaseQuantity')}
                                disabled={busy}
                              >+</button>
                          </div>
                          {/* Why a change was refused, on the line it belongs to.
                              Assertive because it is the direct answer to a
                              button just pressed and nothing else moves. */}
                          {rowError && <p className="cart-item-error" role="alert">{rowError}</p>}
                       </div>
                       <button
                         className="cart-item-remove-btn"
                         onClick={() => removeItem(item.id)}
                         title={t('cart.removeItem')}
                         aria-label={`${t('cart.removeItem')}: ${itemName}`}
                         disabled={busy}
                       >×</button>
                    </li>
                  );
                })}
              </ul>
          ) : (
              <div className="cart-empty">
                <p className="cart-empty-message">{t('cart.empty')}</p>
                {/* An empty bag is a dead end unless it offers the way out, so
                    the state itself carries the action. */}
                <button className="cart-empty-cta" onClick={handleBrowse}>
                  {t('cart.continueShopping')}
                </button>
              </div>
          )}
        </div>

        {/* Quantity and removal are announced here for screen readers; the
            visible feedback is the number and the row itself. */}
        <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>

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
