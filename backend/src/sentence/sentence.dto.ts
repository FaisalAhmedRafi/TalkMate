import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { LearnerDto } from '../ai/dto';

export class SessionDto extends LearnerDto {
  @IsString() @MaxLength(80) skillId: string;
}

export class EvaluateDto extends LearnerDto {
  @IsString() @MaxLength(300) sentence: string;
  /** What the browser's speech recogniser heard the learner say */
  @IsString() @MaxLength(300) transcript: string;
  /** 0-1, when the browser provides one */
  @IsOptional() @IsNumber() @Min(0) @Max(1) confidence?: number;
}

export class CompleteDto {
  @IsString() @MaxLength(80) skillId: string;
  /** One 1-5 score per sentence the learner actually spoke (skipped sentences are left out) */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5)
  @IsInt({ each: true }) @Min(1, { each: true }) @Max(5, { each: true })
  scores: number[];
}
