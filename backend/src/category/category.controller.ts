import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CategoryService } from './category.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { RolesGuard } from '../auth/strategies/roles.guard.js';
import { Role } from '../auth/enums/role.enum.js';
import { JwtAuthGuard } from '../auth/strategies/jwt-auth.guard.js';
import { Roles } from '../auth/decorator/roles.decorator.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Controller('category')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Body() dto: UpdateCategoryDto,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.remove(id);
  }
}
