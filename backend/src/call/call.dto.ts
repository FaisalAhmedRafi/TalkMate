import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { LearnerDto, MessageDto } from '../ai/dto';
import { TUTORS } from '../chat/chat.dto';

/** The tutor who is on the phone. Optional so an older client that never sends one still gets Kai. */
export class CallStartDto extends LearnerDto {
  @IsOptional() @IsIn(TUTORS as unknown as string[]) tutor?: string;
}

export class CallReplyDto extends CallStartDto {
  /** The call so far, starting with the tutor's greeting and ending with the learner's new message */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
}

/** The same shape, for the review of the whole call: it must contain at least one learner message (checked in the service). */
export class CallAdvancedDto extends CallReplyDto {}

export class CallFeedbackDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(1000) message: string;
}

export class CallTranslateDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}

export class CallSaveDto {
  @IsIn(TUTORS as unknown as string[]) tutor: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
  /** keyed by message index; rebuilt and trimmed by the service */
  @IsObject() reviews: Record<string, unknown>;
  @IsObject() translations: Record<string, unknown>;
  /** the length of the call */
  @IsInt() @Min(0) @Max(86_400) seconds: number;
}
