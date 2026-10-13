import { IsInt, IsIn, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class PracticeDto {
  @IsString() @MinLength(1) @MaxLength(1000) text: string;
}

export class SettingsDto {
  @IsOptional() @IsString() @MaxLength(40) language?: string;
  @IsOptional() @IsIn(['Beginner', 'Intermediate', 'Advanced']) level?: string;
}

export class TimeDto {
  @IsInt() @Min(1) @Max(60) seconds: number;
  @Matches(/^\d{4}-\d{2}-\d{2}$/) day: string; // the user's local date
}