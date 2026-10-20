import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { LearnerDto, MessageDto } from '../ai/dto';

export class RoleplayStartDto extends LearnerDto {
  @IsString() @MaxLength(80) scenarioId: string;
}

export class RoleplayReplyDto extends RoleplayStartDto {
  /** The conversation so far, starting with the partner's opening line and ending with the learner's new message */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
}

export class RoleplayFeedbackDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(1000) message: string;
}

export class RoleplayTranslateDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}

/** Which saved chat: the scenario (the language is the learner's current one, read on the server). */
export class RoleplaySessionQueryDto {
  @IsString() @MaxLength(80) scenarioId: string;
}

export class RoleplaySaveDto extends RoleplaySessionQueryDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
  /** keyed by message index; rebuilt and trimmed by the service */
  @IsObject() reviews: Record<string, unknown>;
  @IsObject() translations: Record<string, unknown>;
}
