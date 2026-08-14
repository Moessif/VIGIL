import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3, { message: '用户名至少 3 个字符' })
  @MaxLength(20)
  username!: string;

  @IsString()
  @MinLength(6, { message: '密码至少 6 位' })
  @MaxLength(64)
  password!: string;

  @IsOptional()
  @IsString()
  school?: string;

  @IsOptional()
  @IsString()
  education?: string;
}

export class LoginDto {
  @IsString()
  username!: string;

  @IsString()
  password!: string;
}
