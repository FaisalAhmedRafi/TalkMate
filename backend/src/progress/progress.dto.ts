import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class PracticeDto {
  @IsString() @MinLength(1) @MaxLength(1000) text: string;
}

export class SettingsDto {
  @IsOptional() @IsString() @MaxLength(40) language?: string;
  @IsOptional() @IsIn(['Beginner', 'Intermediate', 'Advanced']) level?: string;
}
