const KEY = "vtg_cart";

export function getCart(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function setCart(ids: string[]) {
  localStorage.setItem(KEY, JSON.stringify(ids));
}

export function addToCart(productId: string) {
  const cart = getCart();
  if (!cart.includes(productId)) {
    setCart([...cart, productId]);
  }
}

export function removeFromCart(productId: string) {
  setCart(getCart().filter((id) => id !== productId));
}

export function clearCart() {
  localStorage.removeItem(KEY);
}

export function cartCount() {
  return getCart().length;
}
