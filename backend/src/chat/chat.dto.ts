import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsObject, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { LearnerDto, MessageDto } from '../ai/dto';

export const TUTORS = ['Emma', 'Kai', 'Nina', 'Niko'] as const;

export class ChatStartDto extends LearnerDto {
  @IsIn(TUTORS as unknown as string[]) tutor: string;
}

export class ChatReplyDto extends ChatStartDto {
  /** The conversation so far, starting with the tutor's greeting and ending with the learner's new message */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
}

/** Same shape as a reply, but the last message is the tutor's. */
export class ChatSuggestDto extends ChatReplyDto {}

export class ChatFeedbackDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(1000) message: string;
}

export class ChatTranslateDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}

export class ChatSaveDto {
  @IsIn(TUTORS as unknown as string[]) tutor: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
  /** keyed by message index; rebuilt and trimmed by the service */
  @IsObject() reviews: Record<string, unknown>;
  @IsObject() translations: Record<string, unknown>;
}
