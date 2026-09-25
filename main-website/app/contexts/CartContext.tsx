"use client";

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import {
    getCart,
    addItemToCart as apiAddItemToCart,
    updateItemQuantityInCart as apiUpdateItemQuantity,
    removeItemFromCart as apiRemoveItemFromCart,
    CartObject,
} from '../../lib/api';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const getApiErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string } } }).response;
        if (response?.data?.message) return response.data.message;
    }
    return fallback;
};

const emptyCartSummary = {
    subtotal: 0,
    discountAmount: 0,
    total: 0,
    itemCount: 0,
    freeShippingThreshold: 0,
    amountLeftForFreeShipping: 0,
};

interface CartContextType {
    cart: CartObject | null;
    isCartLoading: boolean;
    isCartOpen: boolean;
    itemCount: number;
    setIsCartOpen: (isOpen: boolean) => void;
    fetchCart: () => Promise<void>;
    addItemToCart: (variantId: string, quantity: number, options?: { openCart?: boolean }) => Promise<boolean>;
    updateItemQuantity: (cartItemId: string, newQuantity: number) => Promise<void>;
    removeItem: (cartItemId: string) => Promise<void>;
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
        if (cartObj && cartObj.cartSessionId) {
            localStorage.setItem('fallback_cart_id', cartObj.cartSessionId);
        }
    }, []);

    const fetchCart = useCallback(async () => {
        setIsCartLoading(true);
        try {
            const fetchedCart = await getCart();
            setCart(fetchedCart);
            syncSessionId(fetchedCart);
        } catch (error: unknown) {
            console.error("Failed to fetch cart:", error);
            // On failure, keep an empty object but preserve the session ID if it exists
            const existingId = localStorage.getItem('fallback_cart_id') || '';
            setCart({ cartSessionId: existingId, items: [], summary: { ...emptyCartSummary } });
        } finally {
            setIsCartLoading(false);
        }
    }, [syncSessionId]);

    useEffect(() => {
        setIsHydrated(true);
        fetchCart();
    }, [fetchCart]);

    const addItemToCart = async (variantId: string, quantity: number, options?: { openCart?: boolean }): Promise<boolean> => {
        try {
            const updatedCart = await apiAddItemToCart(variantId, quantity);
            setCart(updatedCart);
            syncSessionId(updatedCart);
            toast.success("Item added to your bag!");
            if (options?.openCart !== false) setIsCartOpen(true);
            return true;
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, "Could not add item."));
            return false;
        }
    };

    const updateItemQuantity = async (cartItemId: string, newQuantity: number) => {
        if (newQuantity <= 0) return removeItem(cartItemId);
        const originalCart = cart;
        try {
            const updatedCartFromServer = await apiUpdateItemQuantity(cartItemId, newQuantity);
            setCart(updatedCartFromServer);
            syncSessionId(updatedCartFromServer);
        } catch {
            toast.error("Could not update quantity.");
            setCart(originalCart);
        }
    };

    const removeItem = async (cartItemId: string) => {
        const originalCart = cart;
        try {
            const updatedCartFromServer = await apiRemoveItemFromCart(cartItemId);
            toast.info("Item removed.");
            setCart(updatedCartFromServer);
            syncSessionId(updatedCartFromServer);
        } catch {
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