'use client';

import React from 'react';
import Link from 'next/link';
import './Footer.css';

const Footer = () => {
    const currentYear = new Date().getFullYear();

    const handleSubscribe = (e: React.FormEvent) => {
        e.preventDefault();
        // Add your newsletter subscription logic here later
        alert("Thanks for subscribing!");
    };

    return (
        <footer className="site-footer">

            {/* --- Main Section: Navigation Grid --- */}
            <div className="footer-main">
                <div className="container footer-grid">
                    
                    {/* Column 1: Shop */}
                    <div className="footer-col">
                        <h4 className="col-title">Shop</h4>
                        <ul>
                            <li><Link href="/shop">Makeup</Link></li>
                        </ul>
                    </div>

                    {/* Column 2: Help */}
                    <div className="footer-col">
                        <h4 className="col-title">Help & Information</h4>
                        <ul>
                            <li><Link href="/shipping">Shipping & Delivery</Link></li>
                            <li><Link href="/returns">Returns & Refunds</Link></li>
                        </ul>
                    </div>

                    {/* Column 3: Legal */}
                    <div className="footer-col">
                        <h4 className="col-title">Legal</h4>
                        <ul>
                            <li><Link href="/privacy-policy">Privacy Policy</Link></li>
                            <li><Link href="/terms">Terms of Service</Link></li>
                        </ul>
                    </div>

                    {/* Column 4: Social & Contact */}
                    <div className="footer-col contact-col">
                        <h4 className="col-title">Stay Connected</h4>
                        <div className="social-links">
                            {/* External links should use <a>, not <Link> */}
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                            </a>
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
                            </a>
                            <a href="https://tiktok.com" target="_blank" rel="noopener noreferrer" aria-label="TikTok">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"></path></svg>
                            </a>
                        </div>
                        {/* <div className="contact-details">
                            <p>Call us: 19999</p>
                            <p>Email: support@kikomilano.com</p>
                        </div> */}
                    </div>
                </div>
            </div>

            {/* --- Bottom Section: Copyright --- */}
            <div className="footer-bottom">
                <div className="container bottom-flex">
                    <p className="copyright">&copy; {currentYear} NOD. All rights reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;