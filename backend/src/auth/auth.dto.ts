import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string; // bcrypt ignores bytes past 72
  @IsOptional() @IsString() @MaxLength(60) name?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9]{4,12}$/) referralCode?: string; // from an invite link
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(72) password: string;
}
