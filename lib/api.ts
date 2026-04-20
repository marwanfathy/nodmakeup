// Fixed cart persistence code

function saveCart(cart) {
    localStorage.setItem('shoppingCart', JSON.stringify(cart));
}

function loadCart() {
    return JSON.parse(localStorage.getItem('shoppingCart')) || [];
}

export { saveCart, loadCart };