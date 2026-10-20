import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { LearnerDto, MessageDto } from '../ai/dto';
import { DEBATE_SIDES, DebateSide } from './debate.catalog';

export class DebateStartDto extends LearnerDto {
  @IsString() @MaxLength(80) topicId: string;
  /** the learner's side; the teacher takes the other one */
  @IsIn(DEBATE_SIDES as unknown as string[]) side: DebateSide;
}

export class DebateReplyDto extends DebateStartDto {
  /** The conversation so far, starting with the teacher's opening message and ending with the learner's new message */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
}

export class DebateFeedbackDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(1000) message: string;
}

export class DebateTranslateDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}

/** Which saved debate: the topic and the learner's side (the language is the learner's current one, read on the server). */
export class DebateSessionQueryDto {
  @IsString() @MaxLength(80) topicId: string;
  @IsIn(DEBATE_SIDES as unknown as string[]) side: DebateSide;
}

export class DebateSaveDto extends DebateSessionQueryDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
  /** keyed by message index; rebuilt and trimmed by the service */
  @IsObject() reviews: Record<string, unknown>;
  @IsObject() translations: Record<string, unknown>;
}
