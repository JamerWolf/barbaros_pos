import { IProduct } from './product.js';

export interface IOrderItem {
  id: string;
  accountId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  product?: IProduct;
  createdAt: Date;
  updatedAt: Date;
}
