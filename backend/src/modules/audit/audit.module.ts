import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditEntry, AuditEntrySchema } from '../../schemas.js';
import { AuditService } from './audit.service.js';

/**
 * A trilha de auditoria, disponível em todo lugar.
 *
 * `@Global()` e a exceção que este módulo justifica: cinco domínios escrevem
 * na trilha — sessão, usuários, configurações, pagamento, catálogo e pedidos —
 * e nenhum deles tem relação com os outros além dessa. Declarar o import em
 * cada um seria seis linhas repetidas e uma sexta chance de alguém criar um
 * segundo serviço de auditoria por não achar o primeiro.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditEntry.name, schema: AuditEntrySchema }]),
  ],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
