import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Category } from '../../generated/prisma/client.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';

export type CategoryTreeNode = Category & {
  subCategory: CategoryTreeNode[];
};

@Injectable()
export class CategoryService {
  constructor(private readonly prismaService: PrismaService) {}

  async findAll() {
    const categories = await this.prismaService.category.findMany({});

    return this.buildTree(categories);
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) {
      await this.ensureCategoryExists(
        dto.parentId,
        'Danh mục cha không tồn tại',
      );
    }

    return this.prismaService.category.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim(),
        parentId: dto.parentId,
      },
      include: {
        parent: true,
      },
    });
  }

  private async ensureCategoryExists(id: number, errorMessage: string) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!category) {
      throw new NotFoundException(errorMessage);
    }

    return category;
  }

  private buildTree(categories: Category[]): CategoryTreeNode[] {
    const categoryMap = new Map<number, CategoryTreeNode>();
    const roots: CategoryTreeNode[] = [];
    for (const category of categories) {
      categoryMap.set(category.id, { ...category, subCategory: [] });
    }

    for (const category of categories) {
      const node = categoryMap.get(category.id);
      if (!node) continue;

      if (category.parentId === null) roots.push(node);
      else {
        const parentNode = categoryMap.get(category.parentId);
        if (parentNode) parentNode.subCategory.push(node);
        else roots.push(node);
      }
    }

    return roots;
  }
}
