import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString,
  Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export const CHAT_MODES = ['chat', 'call', 'roleplay', 'characters', 'debate'] as const;
export const GENERATE_TYPES = ['sentence', 'word', 'dialogue', 'flashcards'] as const;
export type ChatMode = (typeof CHAT_MODES)[number];
export type GenerateType = (typeof GENERATE_TYPES)[number];

class LearnerDto {
  @IsOptional() @IsString() @MaxLength(40) targetLanguage?: string;
  @IsOptional() @IsString() @MaxLength(40) nativeLanguage?: string;
  @IsOptional() @IsIn(['Beginner', 'Intermediate', 'Advanced']) level?: string;
}

export class MessageDto {
  @IsIn(['user', 'assistant']) role: 'user' | 'assistant';
  @IsString() @MaxLength(2000) content: string;
}

export class ContextDto {
  @IsOptional() @IsString() @MaxLength(120) scenario?: string;
  @IsOptional() @IsString() @MaxLength(80) character?: string;
  @IsOptional() @IsString() @MaxLength(160) topic?: string;
  @IsOptional() @IsIn(['for', 'against']) stance?: 'for' | 'against';
}

export class ChatDto extends LearnerDto {
  @IsIn(CHAT_MODES as unknown as string[]) mode: ChatMode;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
  @IsOptional() @ValidateNested() @Type(() => ContextDto) context?: ContextDto;
}

export class GenerateDto extends LearnerDto {
  @IsIn(GENERATE_TYPES as unknown as string[]) type: GenerateType;
  @IsString() @MaxLength(120) topic: string;
  @IsOptional() @IsInt() @Min(3) @Max(12) count?: number;
}

export class PhotoDto extends LearnerDto {
  @Matches(/^data:image\/(png|jpe?g|webp);base64,/, { message: 'image must be a png, jpeg or webp data URL' })
  @MaxLength(5_000_000)
  image: string;
  @IsOptional() @IsString() @MaxLength(1500) description?: string;
}

export class FeedbackDto extends LearnerDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(40) @IsString({ each: true }) @MaxLength(1000, { each: true })
  texts: string[];
}
