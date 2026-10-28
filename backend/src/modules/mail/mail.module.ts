import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';

/**
 * O correio da loja.
 *
 * Um serviço só, sem schema e sem rota: quem manda e-mail e outro módulo, e o
 * que mora aqui e o transporte. Global não e — quem precisa importa, e hoje e
 * só a conta de cliente, pela recuperação de senha.
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
