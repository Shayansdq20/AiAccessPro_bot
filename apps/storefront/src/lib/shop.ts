import { apiFetch } from './api';
import type { Category, ProductLite, ShopProduct } from './shop-types';

export * from './shop-types';

export async function getCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/store/categories');
}

export async function getCategoryProducts(categoryId: string): Promise<ProductLite[]> {
  return apiFetch<ProductLite[]>(`/store/categories/${categoryId}/products`);
}

export async function getProduct(productId: string): Promise<ShopProduct> {
  return apiFetch<ShopProduct>(`/store/products/${productId}`);
}
