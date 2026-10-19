import { ArrayMaxSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LearnerDto } from '../ai/dto';

export class WordStartDto extends LearnerDto {
  @IsString() @MaxLength(60) wordId: string;
  /** throw away unfinished progress and make a fresh lesson ("Start over") */
  @IsOptional() @IsBoolean() restart?: boolean;
}

export class WordSaveDto {
  @IsString() @MaxLength(60) wordId: string;
  /** the language being learned: the same word is a separate lesson in each language */
  @IsString() @MaxLength(40) language: string;
  /** 0 = word card, 1..N = the sentence being practised */
  @IsInt() @Min(0) @Max(5) step: number;
  /** one entry per sentence: 1-5, or null when skipped or not reached yet (cleaned up in the service) */
  @IsArray() @ArrayMaxSize(5) scores: (number | null)[];
}

export class WordCompleteDto {
  @IsString() @MaxLength(60) wordId: string;
  @IsString() @MaxLength(40) language: string;
  @IsArray() @ArrayMaxSize(5) scores: (number | null)[];
}
