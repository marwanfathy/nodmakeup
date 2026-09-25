import OrderSuccessView from './OrderSuccessView';

export const metadata = {
    title: 'Order Confirmed | NOD Makeup',
    description: 'Your NOD Makeup order was placed successfully — track it right here.',
};

export default function OrderSuccessRoute() {
    return <OrderSuccessView />;
}