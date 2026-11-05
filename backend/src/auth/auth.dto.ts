import { IsBoolean, IsEmail, IsOptional, IsString, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string; // bcrypt ignores bytes past 72
  @IsOptional() @IsString() @MaxLength(60) name?: string;
  @IsOptional() @Matches(/^[A-Za-z0-9]{4,12}$/) referralCode?: string; // from an invite link
  @IsOptional() @IsBoolean() remember?: boolean; // "Remember this device": 30-day session instead of 1 day
}

export class LoginDto {
  @IsEmail() email: string;
  @IsString() @MaxLength(72) password: string;
  @IsOptional() @IsBoolean() remember?: boolean;
}

export class GoogleDto {
  @IsString() @MaxLength(4096) credential: string; // the Google ID token from Google Identity Services
  @IsOptional() @Matches(/^[A-Za-z0-9]{4,12}$/) referralCode?: string; // only used when this creates a new account
  @IsOptional() @IsBoolean() remember?: boolean;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254) email: string;
}

export class ResetPasswordDto {
  @IsString() @Length(32, 128) token: string;
  @IsString() @MinLength(8) @MaxLength(72) password: string;
}
