export type ShapeType = 'RECTANGLE' | 'LINE';

export interface IShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  points?: { x: number; y: number }[];
  color: string;
  label?: string;
  zIndex: number;
  createdAt: Date;
  updatedAt: Date;
}
