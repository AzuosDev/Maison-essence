import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditEntry, AuditEntrySchema } from '../../schemas.js';
import { AuditService } from './audit.service.js';

/**
 * A trilha de auditoria, disponivel em todo lugar.
 *
 * `@Global()` e a excecao que este modulo justifica: cinco dominios escrevem
 * na trilha — sessao, usuarios, configuracoes, pagamento, catalogo e pedidos —
 * e nenhum deles tem relacao com os outros alem dessa. Declarar o import em
 * cada um seria seis linhas repetidas e uma sexta chance de alguem criar um
 * segundo servico de auditoria por nao achar o primeiro.
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
