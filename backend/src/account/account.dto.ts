import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { optionsFor, SUPPORT_TYPES } from './account.options';
import { PLAN_MONTHS } from './subscription.util';

export class PersonalizationDto {
  @IsOptional() @IsIn(optionsFor('reason')) reason?: string;
  @IsOptional() @IsIn(optionsFor('frequency')) frequency?: string;
  @IsOptional() @IsIn(optionsFor('goal')) goal?: string;
  @IsOptional() @IsIn(optionsFor('style')) style?: string;
  @IsOptional() @IsIn(optionsFor('ageRange')) ageRange?: string;
}

export class PlanDto {
  @IsIn(PLAN_MONTHS) months: number;
}

export class ProfileDto {
  @IsOptional() @IsString() @MaxLength(60) firstName?: string;
  @IsOptional() @IsString() @MaxLength(60) lastName?: string;
  @IsOptional() @Matches(/^UTC[+-](0\d|1[0-4]):[0-5]\d$/, { message: 'Pick a valid time zone.' }) timeZone?: string;
}

export class PasswordDto {
  @IsString() @MaxLength(72) currentPassword: string;
  @IsString() @MinLength(8, { message: 'New password must be at least 8 characters.' }) @MaxLength(72) newPassword: string; // bcrypt ignores bytes past 72
}

export class NotificationsDto {
  @IsOptional() @IsBoolean() emailSpecialOffers?: boolean;
  @IsOptional() @IsBoolean() emailLearning?: boolean;
  @IsOptional() @IsBoolean() appSpecialOffers?: boolean;
  @IsOptional() @IsBoolean() appLearning?: boolean;
}

export class PrivacyDto {
  @IsOptional() @IsBoolean() optOutAiTraining?: boolean;
  @IsOptional() @IsBoolean() optOutProfiling?: boolean;
}

export class AvatarDto {
  // a resized picture sent as a data URL; the browser keeps it around 20-60 KB
  @IsString() @MaxLength(400_000) @Matches(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, { message: 'Upload a JPG, PNG or WebP picture.' }) image: string;
}

export class SupportDto {
  @IsIn(SUPPORT_TYPES) type: string;
  @IsString() @MaxLength(3000) message: string;
}
