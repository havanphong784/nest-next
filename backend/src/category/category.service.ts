import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Category } from '../../generated/prisma/client.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

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

  async findOne(id: number) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
      include: {
        parent: true,
        subCategory: true,
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Danh mục với ID ${id} không tồn tại`);
    }

    return category;
  }

  async update(id: number, dto: UpdateCategoryDto) {
    await this.ensureCategoryExists(id, `Danh mục với ID ${id} không tồn tại`);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('Danh mục không thể là cha của chính nó');
      }

      if (dto.parentId !== null) {
        await this.ensureCategoryExists(
          dto.parentId,
          'Danh mục cha không tồn tại',
        );
      }
    }

    return this.prismaService.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim(),
        }),
        ...(dto.parentId !== undefined && { parentId: dto.parentId }),
      },
      include: {
        parent: true,
      },
    });
  }

  async remove(id: number) {
    const category = await this.prismaService.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subCategory: true,
            products: true,
          },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Danh mục với ID ${id} không tồn tại`);
    }

    if (category._count.subCategory > 0) {
      throw new BadRequestException(
        'Không thể xóa danh mục đang chứa danh mục con. Hãy xóa hoặc điều chuyển danh mục con trước.',
      );
    }

    if (category._count.products > 0) {
      throw new BadRequestException(
        'Không thể xóa danh mục đang có sản phẩm liên kết. Hãy xóa hoặc gỡ sản phẩm trước.',
      );
    }

    return this.prismaService.category.delete({
      where: { id },
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
