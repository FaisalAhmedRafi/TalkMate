import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsObject, IsString, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { LearnerDto, MessageDto } from '../ai/dto';

export class CharacterStartDto extends LearnerDto {
  @IsString() @MaxLength(80) characterId: string;
}

export class CharacterReplyDto extends CharacterStartDto {
  /** The conversation so far, starting with the character's opening message and ending with the learner's new message */
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
}

export class CharacterFeedbackDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(1000) message: string;
}

export class CharacterTranslateDto extends LearnerDto {
  @IsString() @MinLength(1) @MaxLength(2000) text: string;
}

/** Which saved conversation: the character (the language is the learner's current one, read on the server). */
export class CharacterSessionQueryDto {
  @IsString() @MaxLength(80) characterId: string;
}

export class CharacterSaveDto extends CharacterSessionQueryDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200)
  @ValidateNested({ each: true }) @Type(() => MessageDto)
  messages: MessageDto[];
  /** keyed by message index; rebuilt and trimmed by the service */
  @IsObject() reviews: Record<string, unknown>;
  @IsObject() translations: Record<string, unknown>;
}
