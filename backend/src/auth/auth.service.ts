import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client.js';
import type { JwtPayload } from './entities/jwt-payload.entity.js';
import type { SignOptions } from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

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
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email đã tồn tại');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const passwordMattcher = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMattcher) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(payload),
      this.signRefreshToken(payload),
    ]);
    const refreshTokenHash = await argon2.hash(refreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash },
    });

    return {
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
      accessToken: accessToken,
      refreshToken: refreshToken,
    };
  }

  private async signRefreshToken(payload: JwtPayload) {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const expriresIn = this.configService.getOrThrow<SignOptions['expiresIn']>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    return this.jwtService.signAsync(payload as object, {
      secret: secret,
      expiresIn: expriresIn,
    });
  }

  private async signAccessToken(payload: JwtPayload) {
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const expriresIn = this.configService.getOrThrow<SignOptions['expiresIn']>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    return this.jwtService.signAsync(payload as object, {
      secret: secret,
      expiresIn: expriresIn,
    });
  }
}
