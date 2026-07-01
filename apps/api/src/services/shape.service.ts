import { prisma } from '../db/prisma.js';

export interface CreateShapeInput {
  type: 'RECTANGLE' | 'LINE' | 'TEXT';
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  color?: string;
  label?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: string;
  zIndex?: number;
}

export interface UpdateShapeInput {
  type?: 'RECTANGLE' | 'LINE' | 'TEXT';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  points?: { x: number; y: number }[];
  color?: string;
  label?: string;
  fontFamily?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: string;
  zIndex?: number;
}

export class ShapeService {
  static async getAllShapes() {
    return prisma.shape.findMany({
      orderBy: { zIndex: 'asc' },
    });
  }

  static async createShape(input: CreateShapeInput) {
    return prisma.shape.create({
      data: {
        type: input.type,
        x: input.x,
        y: input.y,
        width: input.width ?? 0,
        height: input.height ?? 0,
        rotation: input.rotation ?? 0,
        points: input.points ?? undefined,
        color: input.color ?? '#ffffff',
        label: input.label ?? undefined,
        fontFamily: input.fontFamily ?? 'Arial',
        fontSize: input.fontSize ?? 16,
        bold: input.bold ?? false,
        italic: input.italic ?? false,
        underline: input.underline ?? false,
        strikethrough: input.strikethrough ?? false,
        textAlign: input.textAlign ?? 'left',
        zIndex: input.zIndex ?? 0,
      },
    });
  }

  static async updateShape(id: string, input: UpdateShapeInput) {
    return prisma.shape.update({
      where: { id },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.x !== undefined && { x: input.x }),
        ...(input.y !== undefined && { y: input.y }),
        ...(input.width !== undefined && { width: input.width }),
        ...(input.height !== undefined && { height: input.height }),
        ...(input.rotation !== undefined && { rotation: input.rotation }),
        ...(input.points !== undefined && { points: input.points }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.label !== undefined && { label: input.label }),
        ...(input.fontFamily !== undefined && { fontFamily: input.fontFamily }),
        ...(input.fontSize !== undefined && { fontSize: input.fontSize }),
        ...(input.bold !== undefined && { bold: input.bold }),
        ...(input.italic !== undefined && { italic: input.italic }),
        ...(input.underline !== undefined && { underline: input.underline }),
        ...(input.strikethrough !== undefined && { strikethrough: input.strikethrough }),
        ...(input.textAlign !== undefined && { textAlign: input.textAlign }),
        ...(input.zIndex !== undefined && { zIndex: input.zIndex }),
      },
    });
  }

  static async deleteShape(id: string) {
    return prisma.shape.delete({ where: { id } });
  }
}
