import { maskPhone, redactSensitive } from './log-redaction.js';

describe('maskPhone', () => {
  it('guarda o DDD e os dois ultimos digitos', () => {
    expect(maskPhone('88999991234')).toBe('88*******34');
  });

  it('ignora a pontuacao do numero digitado', () => {
    expect(maskPhone('(88) 99999-1234')).toBe('88*******34');
  });

  it('some inteiro com o que nao chega a ser um telefone', () => {
    expect(maskPhone('123')).toBe('[redigido]');
  });
});

describe('redactSensitive', () => {
  it('esconde o access token inteiro', () => {
    const token =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYmMxMjMiLCJyb2xlIjoiT1dORVIifQ.' +
      'ZmFrZS1zaWduYXR1cmUtcGFyYQ';

    const line = redactSensitive(`Authorization: Bearer ${token}`);

    expect(line).toBe('Authorization: Bearer [token]');
    expect(line).not.toContain('eyJ');
  });

  it('esconde a senha que alguem colocou no objeto logado', () => {
    expect(redactSensitive('{"email":"a@b.com","password":"senha-secreta-2026"}')).toBe(
      '{"email":"a@b.com","password":"[redigido]"}',
    );
  });

  it('esconde a credencial dentro da URI de conexao', () => {
    expect(
      redactSensitive('falha ao conectar em mongodb+srv://dona:s3nh4@cluster.mongodb.net'),
    ).toBe('falha ao conectar em mongodb+srv://[redigido]@cluster.mongodb.net');
  });

  it('esconde hash de sessao e chave de rate limit', () => {
    const hash = 'a'.repeat(64);

    expect(redactSensitive(`token revogado ${hash}`)).toBe('token revogado [hash]');
  });

  it('mascara o telefone escrito de qualquer jeito', () => {
    expect(redactSensitive('pedido de (88) 99999-1234')).toBe('pedido de 88*******34');
    // O codigo do pais sai fora da conta; o que resta e o numero local.
    expect(redactSensitive('whatsapp 5588999991234')).toBe('whatsapp 88*******34');
  });

  it('deixa em paz o que nao e segredo', () => {
    const line = '{"code":"ME-260921-4KP1","orderId":"6ab16cee8e4c6a7c5be79b96"}';

    // O id do Mongo tem 24 caracteres: curto demais para a regra do hash, que
    // so pega 32 ou mais. Fosse o contrario, todo log de pedido viraria
    // "[hash]" e a trilha perderia justamente o que serve para procurar.
    expect(redactSensitive(line)).toBe(line);
  });
});
