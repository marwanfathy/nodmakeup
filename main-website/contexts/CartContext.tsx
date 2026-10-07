"use client";

import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import {
    getCart,
    addItemToCart as apiAddItemToCart,
    updateItemQuantityInCart as apiUpdateItemQuantity,
    removeItemFromCart as apiRemoveItemFromCart,
    CartObject,
} from '../lib/api';
import { useI18n } from '../lib/i18n/client';

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

/** Which cart operation produced a failure, so the surface that started it can
 *  render the message itself instead of a shared popup. */
export type CartAction = 'add' | 'update' | 'remove';

export interface CartMutationError {
    action: CartAction;
    message: string;
    /** The cart line the failure belongs to. Absent for `add`, which happens
     *  before any line exists. */
    itemId?: string;
}

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
    /** The last failed mutation, or null. Held here rather than popped up so the
     *  control that was pressed can show the reason next to itself, where the
     *  shopper is already looking. */
    mutationError: CartMutationError | null;
    dismissMutationError: () => void;
    /** Cart lines with a request in flight. The controls for a busy line are
     *  disabled, so a second tap cannot queue a quantity change against a
     *  response that has not arrived yet. */
    busyItemIds: ReadonlySet<string>;
    /** Increments on every successful add. The bag badge animates off this
     *  instead of a popup — the badge moving is the confirmation, and it is
     *  confirmation the shopper was already looking at. */
    addSequence: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = (): CartContextType => {
    const context = useContext(CartContext);
    if (context === undefined) throw new Error('useCart must be used within a CartProvider');
    return context;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
    const { t } = useI18n();
    const [cart, setCart] = useState<CartObject | null>(null);
    const [isCartLoading, setIsCartLoading] = useState(true);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [mutationError, setMutationError] = useState<CartMutationError | null>(null);
    const [busyItemIds, setBusyItemIds] = useState<ReadonlySet<string>>(() => new Set());
    const [addSequence, setAddSequence] = useState(0);

    const syncSessionId = useCallback((cartObj: CartObject) => {
        if (cartObj && cartObj.cartSessionId) {
            localStorage.setItem('fallback_cart_id', cartObj.cartSessionId);
        }
    }, []);

    const markBusy = useCallback((itemId: string, busy: boolean) => {
        setBusyItemIds((prev) => {
            const next = new Set(prev);
            if (busy) next.add(itemId);
            else next.delete(itemId);
            return next;
        });
    }, []);

    const dismissMutationError = useCallback(() => setMutationError(null), []);

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
        fetchCart();
    }, [fetchCart]);

    const addItemToCart = async (variantId: string, quantity: number, options?: { openCart?: boolean }): Promise<boolean> => {
        // A new attempt clears the previous complaint, so a shopper who fixed the
        // problem and pressed again is not still looking at the old reason.
        setMutationError(null);
        try {
            const updatedCart = await apiAddItemToCart(variantId, quantity);
            setCart(updatedCart);
            syncSessionId(updatedCart);
            setAddSequence((n) => n + 1);
            if (options?.openCart !== false) setIsCartOpen(true);
            return true;
        } catch (error: unknown) {
            // No popup: the product page renders this beside the button that was
            // pressed, which is also the control the shopper needs to retry with.
            setMutationError({ action: 'add', message: getApiErrorMessage(error, t('cart.addFailed')) });
            return false;
        }
    };

    const updateItemQuantity = async (cartItemId: string, newQuantity: number) => {
        if (newQuantity <= 0) return removeItem(cartItemId);
        const originalCart = cart;
        setMutationError(null);
        markBusy(cartItemId, true);
        try {
            const updatedCartFromServer = await apiUpdateItemQuantity(cartItemId, newQuantity);
            setCart(updatedCartFromServer);
            syncSessionId(updatedCartFromServer);
        } catch {
            // The quantity is rolled back to what the server still believes, and
            // the row says why — the pair matters, because a number that silently
            // springs back is indistinguishable from a number that never moved.
            setCart(originalCart);
            setMutationError({ action: 'update', itemId: cartItemId, message: t('cart.updateFailed') });
        } finally {
            markBusy(cartItemId, false);
        }
    };

    const removeItem = async (cartItemId: string) => {
        const originalCart = cart;
        setMutationError(null);
        markBusy(cartItemId, true);
        try {
            const updatedCartFromServer = await apiRemoveItemFromCart(cartItemId);
            setCart(updatedCartFromServer);
            syncSessionId(updatedCartFromServer);
        } catch {
            setCart(originalCart);
            setMutationError({ action: 'remove', itemId: cartItemId, message: t('cart.removeFailed') });
        } finally {
            markBusy(cartItemId, false);
        }
    };

    // NOTE: this component used to `return null` until an effect had set
    // isHydrated, i.e. until after the client had hydrated. Effects never run on
    // the server, so that guard made the provider render NOTHING during SSR —
    // and because the provider wraps <Nav />, <main>{children}</main> and
    // <Footer /> in the root layout, it made the entire body of every route
    // render as an empty <div hidden>. The site shipped zero server-rendered
    // markup, so first paint always waited for the JS bundle to download,
    // parse and hydrate no matter how much data was fetched on the server.
    //
    // Nothing actually needs the guard. The cart starts as null and stays null
    // until the effect above resolves it, so `itemCount` is 0 on the server and
    // on the first client render alike — the markup matches and hydration is
    // clean. Nothing reads localStorage during render either: sessionHeaders()
    // in lib/api.ts guards on `typeof window`, and syncSessionId only runs from
    // effects and event handlers.
    return (
        <CartContext.Provider value={{
            cart, isCartLoading, isCartOpen, setIsCartOpen,
            itemCount: cart?.summary?.itemCount || 0,
            fetchCart, addItemToCart, updateItemQuantity, removeItem,
            mutationError, dismissMutationError, busyItemIds, addSequence
        }}>
            {children}
        </CartContext.Provider>
    );
};
