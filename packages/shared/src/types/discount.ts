export enum DiscountType {
  NONE = 'NONE',
  FIXED = 'FIXED',
  PERCENT = 'PERCENT',
}

export interface DiscountResult {
  subtotal: number;
  itemDiscounts: number;
  afterItemDiscounts: number;
  accountDiscount: number;
  total: number;
}

export interface CalculateAccountTotalInput {
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountType: DiscountType;
    discountValue: number;
  }>;
  accountDiscountType: DiscountType;
  accountDiscountValue: number;
}

export function calculateAccountTotal(input: CalculateAccountTotalInput): DiscountResult {
  const subtotal = input.items.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  const itemDiscounts = input.items.reduce((sum, item) => {
    if (item.discountType === DiscountType.FIXED) {
      return sum + item.discountValue;
    }
    if (item.discountType === DiscountType.PERCENT) {
      return sum + (item.unitPrice * item.quantity * item.discountValue) / 100;
    }
    return sum;
  }, 0);

  const afterItemDiscounts = subtotal - itemDiscounts;

  let accountDiscount = 0;
  if (input.accountDiscountType === DiscountType.FIXED) {
    accountDiscount = input.accountDiscountValue;
  } else if (input.accountDiscountType === DiscountType.PERCENT) {
    accountDiscount = (afterItemDiscounts * input.accountDiscountValue) / 100;
  }

  const total = afterItemDiscounts - accountDiscount;

  return {
    subtotal,
    itemDiscounts,
    afterItemDiscounts,
    accountDiscount,
    total,
  };
}
