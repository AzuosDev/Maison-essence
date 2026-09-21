import { Transform } from 'class-transformer';
import { IsString, MaxLength } from 'class-validator';

/** A anotacao interna do pedido. Nunca sai em rota publica. */
export class UpdateOrderNotesDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'anotacao invalida' })
  @MaxLength(2000)
  notes: string;
}
