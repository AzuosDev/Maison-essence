import { Module } from '@nestjs/common';
import { SystemController } from './system.controller.js';
import { SystemService } from './system.service.js';

/**
 * Diagnóstico da instalação pelo painel.
 *
 * Não importa nada: a conexão do Mongoose vem do módulo global que o
 * `DatabaseModule` sobe, e o serviço fala com ela direto, sem model nenhum —
 * registrar um `forFeature` aqui seria pedir de volta o que já esta na mão e,
 * pior, sugerir que este módulo tem um domínio, que ele não tem.
 */
@Module({
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
