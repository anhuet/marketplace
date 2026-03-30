export interface CategoryConstant {
  name: string;
  slug: string;
}

export const CATEGORIES: CategoryConstant[] = [
  { name: 'Electronics', slug: 'electronics' },
  { name: 'Clothing', slug: 'clothing' },
  { name: 'Furniture', slug: 'furniture' },
  { name: 'Books', slug: 'books' },
  { name: 'Sports', slug: 'sports' },
  { name: 'Toys', slug: 'toys' },
  { name: 'Vehicles', slug: 'vehicles' },
  { name: 'Home & Garden', slug: 'home-garden' },
  { name: 'Other', slug: 'other' },
];
