import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LearnerDto } from '../ai/dto';

export class FlashDeckDto extends LearnerDto {
  @IsString() @MaxLength(60) topicId: string;
  /** throw away the saved deck and write new cards ("New words") */
  @IsOptional() @IsBoolean() restart?: boolean;
}

export class FlashMarkDto {
  @IsString() @MaxLength(60) topicId: string;
  /** the language being learned: the same topic is a separate deck in each language */
  @IsString() @MaxLength(40) language: string;
  @IsInt() @Min(0) @Max(49) index: number;
  /** "Learning" or "I know it" */
  @IsOptional() @IsIn(['learning', 'known']) status?: 'learning' | 'known';
  /** the flag button: keeps the card in the Daily review */
  @IsOptional() @IsBoolean() flagged?: boolean;
}

export class FlashCompleteDto {
  /** a topic id, or "review" for the Daily review */
  @IsString() @MaxLength(60) topicId: string;
  @IsInt() @Min(0) @Max(50) known: number;
  @IsInt() @Min(1) @Max(50) total: number;
}
