import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import AdminLayout, { AdminProtectedRoute } from './Layout/AdminLayout';
import LoginPage from './auth/LoginPage';
import DashboardPage from './Dashboard/DashboardPage';
import BrandListPage from './Catalog/BrandListPage';
import CategoryListPage from './Catalog/CategoryListPage';
import CollectionListPage from './Catalog/CollectionListPage';
import ProductListPage from './Products/ProductListPage';
import ProductFormPage from './Products/ProductFormPage';
import OrderListPage from './Orders/OrderListPage';
import OrderDetailPage from './Orders/OrderDetailPage';
import DiscountListPage from './Discounts/DiscountListPage';
import StoryManagementPage from './Stories/StoryManagementPage';
import HeroSectionListPage from './HeroSection/HeroSectionListPage';
import HeroSectionForm from './HeroSection/HeroSectionForm';
import UserListPage from './Users/UserListPage';
import AnalyticsPage from './Analytics/AnalyticsPage';
import CustomersPage from './Crm/CustomersPage';
import CustomerDetailPage from './Crm/CustomerDetailPage';

const App = () => (
    <BrowserRouter>
        <AdminAuthProvider>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/admin" element={<AdminProtectedRoute />}>
                    <Route element={<AdminLayout />}>
                        <Route index element={<DashboardPage />} />
                        <Route path="products" element={<ProductListPage />} />
                        <Route path="products/new" element={<ProductFormPage />} />
                        <Route path="products/edit/:productId" element={<ProductFormPage />} />
                        <Route path="categories" element={<CategoryListPage />} />
                        <Route path="brands" element={<BrandListPage />} />
                        <Route path="collections" element={<CollectionListPage />} />
                        <Route path="orders" element={<OrderListPage />} />
                        <Route path="orders/:orderId" element={<OrderDetailPage />} />
                        <Route path="discounts" element={<DiscountListPage />} />
                        <Route path="stories" element={<StoryManagementPage />} />
                        <Route path="hero-sections" element={<HeroSectionListPage />} />
                        <Route path="hero-sections/new" element={<HeroSectionForm />} />
                        <Route path="hero-sections/edit/:heroSectionId" element={<HeroSectionForm />} />
                        <Route path="admins" element={<UserListPage />} />
                        <Route path="analytics" element={<AnalyticsPage />} />
                        <Route path="customers" element={<CustomersPage />} />
                        <Route path="customers/:customerId" element={<CustomerDetailPage />} />
                        <Route path="*" element={<Navigate to="/admin" replace />} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
            <ToastContainer
                position="top-center"
                autoClose={3200}
                newestOnTop
                closeOnClick
                pauseOnHover
                theme="colored"
                limit={3}
            />
        </AdminAuthProvider>
    </BrowserRouter>
);

export default App;