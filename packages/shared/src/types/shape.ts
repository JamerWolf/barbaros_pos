export type ShapeType = 'RECTANGLE' | 'LINE' | 'TEXT';

export type TextAlign = 'left' | 'center' | 'right';

export interface IShape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  color: string;
  label?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: TextAlign;
  zIndex: number;
  createdAt: Date;
  updatedAt: Date;
}
