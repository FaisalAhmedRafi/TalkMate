import { IsBoolean, IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PASSWORD_MESSAGE, PASSWORD_RULE } from './password.rule';
import { COUNTRY_MESSAGE, PHONE_MESSAGE } from './phone.rule';

export class RegisterDto {
  @IsEmail() @MaxLength(254) email: string;
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) @MaxLength(72) password: string; // bcrypt ignores bytes past 72
  @IsString() @Matches(/\S/, { message: 'First name is required' }) @MaxLength(60) firstName: string;
  @IsString() @Matches(/\S/, { message: 'Last name is required' }) @MaxLength(60) lastName: string;
  @IsString() @Matches(/^[A-Za-z]{2}$/, { message: COUNTRY_MESSAGE }) country: string; // ISO 3166-1 alpha-2, e.g. "BD"
  @IsString() @Matches(/\S/, { message: PHONE_MESSAGE }) @MaxLength(25, { message: PHONE_MESSAGE }) phone: string; // international form, e.g. +8801712345678
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

export class VerifyEmailDto {
  @IsEmail() @MaxLength(254) email: string;
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from the email.' }) code: string;
  @IsOptional() @IsBoolean() remember?: boolean;
}

export class ResendVerificationDto {
  @IsEmail() @MaxLength(254) email: string;
}

export class ForgotPasswordDto {
  @IsEmail() @MaxLength(254) email: string;
}

export class ResetPasswordDto {
  @IsString() @Length(32, 128) token: string;
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) @MaxLength(72) password: string;
}
