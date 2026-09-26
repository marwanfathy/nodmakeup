import { Suspense } from 'react';
import ShopPage from './ShopPage';

export const metadata = {
    title: 'Shop | NOD Makeup',
    description: 'Browse the full NOD Makeup catalog — lipsticks, foundations, kits and more across every category.',
};

// ShopPage calls useSearchParams() to read the initial ?category= filter. That
// is request-time state, so the component cannot be rendered on the server and
// Next.js requires a Suspense boundary above it — without one the build fails
// outright with "useSearchParams() should be wrapped in a suspense boundary".
//
// The fallback is null, not a spinner or a "Loading..." label: the shop page
// renders nothing at all until its catalogue arrives, and it already draws its
// own skeleton grid for that wait. A label here would only add a second,
// differently-shaped loading state to the same page.
export default function ShopRoute() {
    return (
        <Suspense fallback={null}>
            <ShopPage />
        </Suspense>
    );
}
