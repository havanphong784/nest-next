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

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) {
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
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    const secret: string = this.configService.getOrThrow('JWT_REFRESH_SECRET');
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret,
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc không tồn tại',
      );
    }

    const refreshTokenMatches = await argon2.verify(
      user.refreshTokenHash,
      refreshToken,
    );
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      this.signAccessToken(newPayload),
      this.signRefreshToken(newPayload),
    ]);
    const newRefreshTokenHash = await argon2.hash(newRefreshToken);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshTokenHash: newRefreshTokenHash },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
    };
  }

  async getMe(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullname: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }

    return user;
  }

  async logout(refreshToken: string) {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret,
      });
    } catch {
      return;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, refreshTokenHash: true },
    });

    if (!user?.refreshTokenHash) {
      return;
    }

    const refreshTokenMatches = await argon2.verify(
      user.refreshTokenHash,
      refreshToken,
    );
    if (!refreshTokenMatches) {
      return;
    }

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        refreshTokenHash: null,
      },
    });
  }

  private async signRefreshToken(payload: JwtPayload) {
    const secret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const expiresIn = this.configService.getOrThrow<SignOptions['expiresIn']>(
      'JWT_REFRESH_EXPIRES_IN',
    );
    return this.jwtService.signAsync(payload, {
      secret: secret,
      expiresIn: expiresIn,
    });
  }

  private async signAccessToken(payload: JwtPayload) {
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const expiresIn = this.configService.getOrThrow<SignOptions['expiresIn']>(
      'JWT_ACCESS_EXPIRES_IN',
    );
    return this.jwtService.signAsync(payload, {
      secret,
      expiresIn,
    });
  }
}
