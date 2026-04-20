import React, { Suspense } from 'react'; 
import { CartProvider } from './contexts/CartContext';
import Nav from './navbar/NavBar'; 
import Footer from './Footer/Footer'; // Ensure this path is correct based on your folder structure
import './globals.css';
import { PageTracker } from './PageTracker'; 
import TitleUpdater from "./TitleUpdater/TitleUpdater";

export const metadata = {
  description: 'Welcome!',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>     
        {/* Logic components wrapped in Suspense to prevent useSearchParams errors */}
        <Suspense fallback={null}>
            <TitleUpdater /> 
            <PageTracker />
        </Suspense>

        {/* Main Application */}
        <Suspense fallback={<div className="loader-center" />}>
            <CartProvider>
                <Nav />
                
                <main style={{ minHeight: '80vh' }}>
                    {children}
                </main>

                <Footer /> {/* <--- Footer added here */}
                
            </CartProvider>
        </Suspense>
      </body>
    </html>
  );
}