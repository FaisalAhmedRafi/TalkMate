import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { LearnerDto } from '../ai/dto';

export class PhotoJudgeDto extends LearnerDto {
  @IsString() @MaxLength(60) photoId: string;
  /** the photo itself, resized in the browser (the backend cannot read the frontend's files) */
  @Matches(/^data:image\/(png|jpe?g|webp);base64,/, { message: 'image must be a png, jpeg or webp data URL' })
  @MaxLength(5_000_000)
  image: string;
  @IsString() @MinLength(2) @MaxLength(1000) description: string;
}
