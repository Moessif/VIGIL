import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto';
import type { AuthResponse, UserInfo } from '@police/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  register(dto: RegisterDto): AuthResponse {
    if (this.users.findByUsername(dto.username)) {
      throw new ConflictException('用户名已存在');
    }
    const passwordHash = bcrypt.hashSync(dto.password, 10);
    const user = this.users.create({
      username: dto.username,
      passwordHash,
      school: dto.school,
      education: dto.education,
    });
    return this.buildAuth(user);
  }

  login(username: string, password: string): AuthResponse {
    const row = this.users.findByUsername(username);
    if (!row || !bcrypt.compareSync(password, row.password_hash)) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    return this.buildAuth(this.users.toInfo(row));
  }

  me(userId: string): UserInfo {
    const row = this.users.findById(userId);
    if (!row) throw new UnauthorizedException('用户不存在');
    return this.users.toInfo(row);
  }

  private buildAuth(user: UserInfo): AuthResponse {
    const token = this.jwt.sign({ sub: user.id, username: user.username, role: user.role });
    return { token, user };
  }
}
