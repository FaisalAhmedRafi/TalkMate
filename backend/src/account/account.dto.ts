import { IsIn, IsOptional } from 'class-validator';
import { optionsFor } from './account.options';
import { PLAN_MONTHS } from './subscription.util';

export class PersonalizationDto {
  @IsOptional() @IsIn(optionsFor('reason')) reason?: string;
  @IsOptional() @IsIn(optionsFor('frequency')) frequency?: string;
  @IsOptional() @IsIn(optionsFor('goal')) goal?: string;
  @IsOptional() @IsIn(optionsFor('style')) style?: string;
  @IsOptional() @IsIn(optionsFor('ageRange')) ageRange?: string;
}

export class PlanDto {
  @IsIn(PLAN_MONTHS) months: number;
}
