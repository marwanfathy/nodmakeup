"use client";

import React from "react";
import { useRouter } from 'next/navigation';
import { useCart } from "../contexts/CartContext";
import { CartItemPublic } from "../../lib/api"; 
import "./NavBar.css"; 

// --- Configuration ---
const apiBaseUrl = process.env.NEXT_PUBLIC_MEDIA_URL || "http://localhost:5002";

const CartSidebar: React.FC = () => {
  const router = useRouter();
  const { cart, isCartOpen, setIsCartOpen, updateItemQuantity, removeItem, itemCount } = useCart();

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
    router.push('/checkout');
  };

  // --- Calculate Progress Bar Data ---
  // Default to 2000 if not provided by backend yet to avoid NaN errors
  const threshold = cart?.summary?.freeShippingThreshold || 2000;
  const subtotal = cart?.summary?.subtotal || 0;
  const amountLeft = Math.max(0, threshold - subtotal);
  // Calculate percentage (capped at 100%)
  const progressPercentage = Math.min(100, (subtotal / threshold) * 100);

  return (
    <div className={`cart-sidebar-container ${isCartOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Shopping Bag">
      <div className="cart-overlay" onClick={() => setIsCartOpen(false)}></div>
      <div className="cart-sidebar">
        <div className="cart-sidebar-header">
          <h4>Shopping Bag</h4>
          <button className="close-cart-btn" onClick={() => setIsCartOpen(false)}>×</button>
        </div>
        <div className="cart-sidebar-body">
          {cart && cart.items.length > 0 ? (
              <ul className="cart-item-list">
                {cart.items.map((item: CartItemPublic) => {
                  const displayPrice = item.effective_sale_price ?? item.original_price;
                  const variantDetails = [item.color_name, item.size].filter(Boolean).join(' / ');
                  
                  let imageUrl = '/placeholder.png';
                  if (item.image_url) {
                      imageUrl = item.image_url.startsWith('http') 
                        ? item.image_url 
                        : `${item.image_url}`; 
                  }

                  return (
                    <li key={item.cart_item_id} className="cart-item">
                       <img src={imageUrl} alt={item.product_name} className="cart-item-image"/>
                       <div className="cart-item-details">
                          <p className="cart-item-name">{item.product_name}</p>
                          {variantDetails && <p className="cart-item-variant">{variantDetails}</p>}
                          <div className="cart-item-actions">
                              <div className="quantity-control">
                                  <button onClick={() => updateItemQuantity(item.cart_item_id, item.quantity - 1)}>-</button>
                                  <span>{item.quantity}</span>
                                  <button onClick={() => updateItemQuantity(item.cart_item_id, item.quantity + 1)}>+</button>
                              </div>
                              <span className="cart-item-price-total">EGP {(displayPrice * item.quantity).toFixed(2)}</span>
                          </div>
                       </div>
                       <button className="cart-item-remove-btn" onClick={() => removeItem(item.cart_item_id)} title="Remove item">×</button>
                    </li>
                  );
                })}
              </ul>
          ) : (
              <p className="cart-empty-message">Your bag is empty.</p>
          )}
        </div>
                  {/* --- NEW: Free Shipping Progress Bar --- */}
        {/* <div className="cart-shipping-progress">
            {amountLeft > 0 ? (
                <p className="shipping-message">
                    Spend <strong>EGP {amountLeft.toFixed(0)}</strong> more for free shipping!
                </p>
            ) : (
                <p className="shipping-message success">
                    🎉 You have unlocked <strong>Free Shipping!</strong>
                </p>
            )}
            <div className="progress-bar-bg">
                <div 
                    className="progress-bar-fill" 
                    style={{ width: `${progressPercentage}%` }}
                ></div>
            </div>
        </div> */}

        {itemCount > 0 && cart && (
          <div className="cart-sidebar-footer">
            <div className="cart-subtotal">
              <span>Subtotal</span>
              <span>EGP {cart.summary.subtotal.toFixed(2)}</span>
            </div>
            <button className="checkout-btn" onClick={handleCheckout}>
              Go to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartSidebar;