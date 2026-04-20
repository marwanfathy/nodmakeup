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
// @ts-ignore
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
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};


export const CartProvider = ({ children }: { children: ReactNode }) => {
    const [cart, setCart] = useState<CartObject | null>(null);
    const [isCartLoading, setIsCartLoading] = useState(true);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    // Save cart session ID whenever cart changes

    const fetchCart = useCallback(async () => {
        setIsCartLoading(true);
        try {
            const fetchedCart = await getCart();
            setCart(fetchedCart);
        } catch (error: any) {
            console.error("Failed to fetch cart:", error);
            if (error.response?.status !== 404) {
                toast.error("Could not load your shopping bag.");
            }
            setCart({ cart_session_id: '', items: [], summary: { subtotal: 0, itemCount: 0 } });
        } finally {
            setIsCartLoading(false);
        }
    }, []);

    // Initialize cart on mount
    useEffect(() => {
        setIsHydrated(true);
        fetchCart();
    }, [fetchCart]);

    const addItemToCart = async (variantId: number, quantity: number, options?: { openCart?: boolean }): Promise<boolean> => {
        try {
            const updatedCart = await apiAddItemToCart(variantId, quantity);
            setCart(updatedCart);
            toast.success("Item added to your bag!");
            const shouldOpenCart = options?.openCart ?? true;
            if (shouldOpenCart) {
                setIsCartOpen(true);
            }
            return true;
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || "Could not add item to bag.";
            toast.error(errorMessage);
            console.error("Add to cart error:", error);
            return false;
        }
    };

    const updateItemQuantity = async (cartItemId: number, newQuantity: number) => {
        if (newQuantity <= 0) {
            return removeItem(cartItemId);
        }
        const originalCart = cart;
        if (cart) {
            const updatedItems = cart.items.map((item: CartItemPublic) =>
                item.cart_item_id === cartItemId ? { ...item, quantity: newQuantity } : item
            );
            const optimisticCart = { ...cart, items: updatedItems };
            setCart(optimisticCart);
        }
        try {
            const updatedCartFromServer = await apiUpdateItemQuantity(cartItemId, newQuantity);
            setCart(updatedCartFromServer);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Could not update item quantity.");
            setCart(originalCart);
        }
    };

    const removeItem = async (cartItemId: number) => {
        const originalCart = cart;
        if (cart) {
            const updatedItems = cart.items.filter((item: CartItemPublic) => item.cart_item_id !== cartItemId);
            const optimisticCart = { ...cart, items: updatedItems };
            setCart(optimisticCart);
        }
        try {
            const updatedCartFromServer = await apiRemoveItemFromCart(cartItemId);
            toast.info("Item removed from your bag.");
            setCart(updatedCartFromServer);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Could not remove item.");
            setCart(originalCart);
        }
    };

    const contextValue: CartContextType = {
        cart,
        isCartLoading,
        isCartOpen,
        setIsCartOpen,
        itemCount: cart?.summary?.itemCount || 0,
        fetchCart,
        addItemToCart,
        updateItemQuantity,
        removeItem,
    };

    return (
        <CartContext.Provider value={contextValue}>
            <ToastContainer
                position="bottom-right"
                autoClose={4000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
            />
            {children}
        </CartContext.Provider>
    );
};
