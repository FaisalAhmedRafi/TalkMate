import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LearnerDto } from '../ai/dto';

export class DialogueSessionDto extends LearnerDto {
  @IsString() @MaxLength(80) topicId: string;
  /** ignore the saved script and write a new dialogue ("New dialogue") */
  @IsOptional() @IsBoolean() fresh?: boolean;
}

export class DialogueCompleteDto {
  @IsString() @MaxLength(80) topicId: string;
  /** One 1-5 score per line the learner actually spoke (skipped lines are left out) */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8)
  @IsInt({ each: true }) @Min(1, { each: true }) @Max(5, { each: true })
  scores: number[];
}
