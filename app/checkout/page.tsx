"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '../contexts/CartContext'; // Adjust path if needed
import { 
    createOrder, 
    getShippingZones, 
    validateCoupon, 
    ShippingZone, 
    AppliedDiscount,
    CartItemPublic,
} from '@/lib/api';
import { toast } from 'react-toastify'; 
import Spinner from '../Common/spinn'; // Adjust path
import './CheckoutPage.css';

interface FormData {
    customer_name: string;
    customer_phone: string;
    customer_address: string;
    shipping_governorate: string;
    customer_notes: string;
}

const ShippingIcon = () => (<svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>);
const PaymentIcon = () => (<svg stroke="currentColor" fill="none" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>);

export default function CheckoutPage() {
    const { cart, fetchCart, updateItemQuantity, removeItem, isCartLoading } = useCart();
    const router = useRouter();

    const [formData, setFormData] = useState<FormData>({
        customer_name: '', 
        customer_phone: '', 
        customer_address: '',
        shipping_governorate: '', 
        customer_notes: '',
    });

    const [shippingZones, setShippingZones] = useState<ShippingZone[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
    const [areZonesLoading, setAreZonesLoading] = useState(true);
    const [isOrderPlaced, setIsOrderPlaced] = useState(false);

    useEffect(() => {
        if (!cart && !isCartLoading) {
            fetchCart();
        }
    }, [fetchCart, cart, isCartLoading]);

    useEffect(() => {
        const fetchZones = async () => {
            try {
                const response = await getShippingZones();
                setShippingZones(response || []);
            } catch (error) {
                toast.error("Could not fetch shipping information.");
            } finally {
                setAreZonesLoading(false);
            }
        };
        fetchZones();
    }, []);

    useEffect(() => {
        if (isCartLoading || isOrderPlaced) return;

        if (!cart || cart.items.length === 0) {
            const timer = setTimeout(() => {
                if (!isOrderPlaced) { 
                    toast.info("Your cart is empty. Redirecting...");
                    router.replace('/shop');
                }
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [cart, isCartLoading, router, isOrderPlaced]);

    const { shippingCost, discountAmount, total, subtotal, originalShippingCost } = useMemo(() => {
        const sub = cart?.summary?.subtotal || 0;
        const selectedZone = shippingZones.find((z) => z.governorate === formData.shipping_governorate);
        const baseShipping = selectedZone ? parseFloat(selectedZone.shipping_cost) : 0;
        
        let displayDiscountAmount = 0;
        let subtotalDiscount = 0;
        let finalShippingCost = baseShipping;

        if (appliedDiscount) {
            if (appliedDiscount.discount_type === 'PERCENTAGE') {
                const discount = sub * (parseFloat(appliedDiscount.value) / 100);
                displayDiscountAmount = Math.min(sub, discount);
                subtotalDiscount = displayDiscountAmount;
            } else if (appliedDiscount.discount_type === 'FIXED_AMOUNT') {
                const discount = parseFloat(appliedDiscount.value);
                displayDiscountAmount = Math.min(sub, discount);
                subtotalDiscount = displayDiscountAmount;
            } else if (appliedDiscount.discount_type === 'FREE_SHIPPING') {
                finalShippingCost = 0;
                displayDiscountAmount = baseShipping;
            }
        }

        const finalTotal = sub - subtotalDiscount + finalShippingCost;

        return { 
            shippingCost: finalShippingCost,
            originalShippingCost: baseShipping,
            discountAmount: displayDiscountAmount,
            total: finalTotal,
            subtotal: sub 
        };
    }, [formData.shipping_governorate, cart, shippingZones, appliedDiscount]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    // --- UPDATED FUNCTION ---
    const handleApplyCoupon = async () => {
        if (!couponCode) { 
            toast.info("Please enter a coupon code."); 
            return; 
        }

        // Check if phone is empty before validating personalized codes
        // This prevents the error if the user types the code before their details
        if (!formData.customer_phone && couponCode.toUpperCase().startsWith('THANKS-')) {
            toast.warning("This looks like a personal code. Please enter your Phone Number first.");
            return;
        }

        setIsApplyingCoupon(true);
        try {
            // PASS THE PHONE NUMBER HERE
            const validatedCoupon = await validateCoupon(couponCode, formData.customer_phone);
            
            setAppliedDiscount(validatedCoupon);
            toast.success(`Coupon "${validatedCoupon.name}" applied!`);
        } catch (error: any) {
            setAppliedDiscount(null);
            // This will now display "This coupon is reserved for a specific customer" if phones don't match
            toast.error(error.response?.data?.message || "Failed to apply coupon.");
        } finally {
            setIsApplyingCoupon(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.customer_name || !formData.customer_phone || !formData.customer_address || !formData.shipping_governorate) {
            toast.error("Please fill in all required fields."); return;
        }
        
        setIsProcessing(true);
        
        try {
            const checkoutData = {
                ...formData,
                coupon_code: appliedDiscount ? couponCode : undefined,
                payment_method: 'CashOnDelivery' as const 
            };

            const response = await createOrder(checkoutData);
            
            setIsOrderPlaced(true); 
            await fetchCart(); 
            router.push(`/order-success/${response.orderId}`);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Checkout failed.");
            setIsProcessing(false);
        } 
    };
    
    if (isCartLoading || areZonesLoading || !cart) {
        return <div className="modern-checkout-page"><Spinner /></div>;
    }

    if (cart.items.length === 0 && !isOrderPlaced) return null;

    return (
        <div className="modern-checkout-page">
            <div className="checkout-container">
                <div className="checkout-form-column">
                    <header className="checkout-header">
                        <h2><Link className='logo' href={"/"}>nod</Link></h2>
                        <p>Complete your purchase</p>
                    </header>
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="form-section">
                            <div className="section-header"><ShippingIcon /><h3>Shipping Information</h3></div>
                            <input type="text" name="customer_name" placeholder="Full Name" required onChange={handleInputChange} value={formData.customer_name} />
                            
                            {/* Make sure this input correctly updates customer_phone state */}
                            <input type="tel" name="customer_phone" placeholder="Phone Number" required onChange={handleInputChange} value={formData.customer_phone} />
                            
                            <input type="text" name="customer_address" placeholder="Address" required onChange={handleInputChange} value={formData.customer_address} />
                            <select name="shipping_governorate" required onChange={handleInputChange} value={formData.shipping_governorate}>
                                <option value="">Select Governorate...</option>
                                {shippingZones.map(zone => <option key={zone.zone_id} value={zone.governorate}>{zone.governorate}</option>)}
                            </select>
                            <textarea name="customer_notes" placeholder="Order Notes (optional)" onChange={handleInputChange} value={formData.customer_notes}></textarea>
                        </div>

                        <div className="form-section">
                            <div className="section-header"><PaymentIcon /><h3>Payment Method</h3></div>
                            <div className="payment-option selected">
                                <input type="radio" name="payment_method" value="CashOnDelivery" checked readOnly style={{ accentColor: '#007bff' }}/>
                                <span>Cash on Delivery</span>
                            </div>
                        </div>

                        <div className="checkout-actions">
                            <Link href="/" className="return-to-cart-link"> Continue Shopping</Link>
                            <button type="submit" className="place-order-button" disabled={isProcessing}>
                                {isProcessing ? <Spinner /> : `Place Order (EGP ${total.toFixed(2)})`}
                            </button>
                        </div>
                    </form>
                </div>
                
                <div className="order-summary-column">
                    <div className="order-summary-box">
                        {cart.items.map((item: CartItemPublic) => {
                            const displayPrice = item.effective_sale_price ?? item.original_price;
                            const imageUrl = item.image_url ? `${item.image_url}` : '/placeholder.png';
                            return (
                               <div className="summary-item" key={item.cart_item_id}>
                                   <div className="summary-item-image"><img src={imageUrl} alt={item.product_name} /></div>
                                   <div className="summary-item-details">
                                       <h4>{item.product_name}</h4>
                                       <p>{[item.color_name, item.size].filter(Boolean).join(' / ')}</p>
                                       <div className="summary-item-controls">
                                           <div className="quantity-control">
                                               <button type="button" onClick={() => updateItemQuantity(item.cart_item_id, item.quantity - 1)}>-</button>
                                               <span>{item.quantity}</span>
                                               <button type="button" onClick={() => updateItemQuantity(item.cart_item_id, item.quantity + 1)}>+</button>
                                           </div>
                                           <button type="button" className="remove-item-btn" onClick={() => removeItem(item.cart_item_id)}>Remove</button>
                                       </div>
                                   </div>
                                   <div className="summary-item-price"><span>EGP {(displayPrice * item.quantity).toFixed(2)}</span></div>
                               </div>
                           );
                        })}

                        <div className="discount-section">
                            <input type="text" placeholder="Discount code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} disabled={isApplyingCoupon || appliedDiscount !== null}/>
                            <button type="button" onClick={handleApplyCoupon} disabled={isApplyingCoupon || appliedDiscount !== null}>
                                {isApplyingCoupon ? <Spinner size="small" /> : 'Apply'}
                            </button>
                        </div>
                        
                        <div className="cost-summary">
                            <div className="cost-line"><span>Subtotal</span><span>EGP {subtotal.toFixed(2)}</span></div>
                            
                            {appliedDiscount && discountAmount > 0 && (
                                <div className="cost-line discount">
                                    <span>Discount ({appliedDiscount.name})</span>
                                    <span>- EGP {discountAmount.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="cost-line">
                                <span>Shipping</span>
                                {appliedDiscount?.discount_type === 'FREE_SHIPPING' ? (
                                    <span className="free-shipping-display">
                                        <del>EGP {originalShippingCost.toFixed(2)}</del> Free
                                    </span>
                                ) : (
                                    <span>{formData.shipping_governorate ? `EGP ${shippingCost.toFixed(2)}` : 'Select governorate'}</span>
                                )}
                            </div>
                            
                            <div className="cost-line total"><span>Total</span><span className="total-price">EGP {total.toFixed(2)}</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};