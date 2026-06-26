export interface ICategory {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProduct {
  id: string;
  name: string;
  price: number;
  categoryId?: string;
  photoUrl?: string;
  active: boolean;
  category?: ICategory;
  createdAt: Date;
  updatedAt: Date;
}
