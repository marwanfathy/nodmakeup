"use client";

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import {
    getCart,
    addItemToCart as apiAddItemToCart,
    updateItemQuantityInCart as apiUpdateItemQuantity,
    removeItemFromCart as apiRemoveItemFromCart,
    CartObject,
    CartItemPublic
} from '../../lib/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface CartContextType {
    cart: CartObject | null;
    isCartLoading: boolean;
    isCartOpen: boolean;
    itemCount: number;
    setIsCartOpen: (isOpen: boolean) => void;
    fetchCart: () => Promise<void>;
    addItemToCart: (variantId: number, quantity: number, options?: { openCart?: boolean }) => Promise<boolean>;
    updateItemQuantity: (cartItemId: number, newQuantity: number) => Promise<void>;
    removeItem: (cartItemId: number) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = (): CartContextType => {
    const context = useContext(CartContext);
    if (context === undefined) throw new Error('useCart must be used within a CartProvider');
    return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const [cart, setCart] = useState<CartObject | null>(null);
    const [isCartLoading, setIsCartLoading] = useState(true);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    const syncSessionId = useCallback((cartObj: CartObject) => {
        if (cartObj && cartObj.cart_session_id) {
            localStorage.setItem('fallback_cart_id', cartObj.cart_session_id);
        }
    }, []);

    const fetchCart = useCallback(async () => {
        setIsCartLoading(true);
        try {
            const fetchedCart = await getCart();
            setCart(fetchedCart);
            syncSessionId(fetchedCart);
        } catch (error: any) {
            console.error("Failed to fetch cart:", error);
            // On failure, keep an empty object but preserve the session ID if it exists
            const existingId = localStorage.getItem('fallback_cart_id') || '';
            setCart({ cart_session_id: existingId, items: [], summary: { subtotal: 0, itemCount: 0 } } as any);
        } finally {
            setIsCartLoading(false);
        }
    }, [syncSessionId]);

    useEffect(() => {
        setIsHydrated(true);
        fetchCart();
    }, [fetchCart]);

    const addItemToCart = async (variantId: number, quantity: number, options?: { openCart?: boolean }): Promise<boolean> => {
        try {
            const updatedCart = await apiAddItemToCart(variantId, quantity);
            setCart(updatedCart);
            syncSessionId(updatedCart);
            toast.success("Item added to your bag!");
            if (options?.openCart !== false) setIsCartOpen(true);
            return true;
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Could not add item.");
            return false;
        }
    };

    const updateItemQuantity = async (cartItemId: number, newQuantity: number) => {
        if (newQuantity <= 0) return removeItem(cartItemId);
        const originalCart = cart;
        try {
            const updatedCartFromServer = await apiUpdateItemQuantity(cartItemId, newQuantity);
            setCart(updatedCartFromServer);
            syncSessionId(updatedCartFromServer);
        } catch (error: any) {
            toast.error("Could not update quantity.");
            setCart(originalCart);
        }
    };

    const removeItem = async (cartItemId: number) => {
        const originalCart = cart;
        try {
            const updatedCartFromServer = await apiRemoveItemFromCart(cartItemId);
            toast.info("Item removed.");
            setCart(updatedCartFromServer);
            syncSessionId(updatedCartFromServer);
        } catch (error: any) {
            toast.error("Could not remove item.");
            setCart(originalCart);
        }
    };

    if (!isHydrated) return null;

    return (
        <CartContext.Provider value={{
            cart, isCartLoading, isCartOpen, setIsCartOpen,
            itemCount: cart?.summary?.itemCount || 0,
            fetchCart, addItemToCart, updateItemQuantity, removeItem
        }}>
            <ToastContainer position="bottom-right" autoClose={2000} theme="light" />
            {children}
        </CartContext.Provider>
    );
};
