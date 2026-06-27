import { IProduct } from './product.js';
import { DiscountType } from './discount.js';

export interface IOrderItem {
  id: string;
  accountId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discountType: DiscountType;
  discountValue: number;
  product?: IProduct;
  createdAt: Date;
  updatedAt: Date;
}
