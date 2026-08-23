import { ConflictException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existUser = await this.prisma.user.findUnique({
      where: { email },
      select: { email: true },
    });
    if (existUser) {
      throw new ConflictException('Email đã tồn tại');
    }

    const passwordHash = await argon2.hash(dto.password);
    try {
      return await this.prisma.user.create({
        data: {
          fullname: dto.fullname.trim(),
          email,
          passwordHash,
          phone: dto.phone?.trim(),
        },
        select: {
          id: true,
          fullname: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
        },
      });
    } catch {
      throw new ConflictException('Lỗi khi tạo người dùng');
    }
  }
}
