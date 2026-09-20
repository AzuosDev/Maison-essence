import { MongoMemoryServer } from 'mongodb-memory-server';

// Precisa rodar no corpo do modulo, e nao dentro de um beforeAll: o vitest
// importa os setupFiles antes do arquivo de teste, e `ConfigModule.forRoot()`
// ja valida o ambiente na avaliacao do `@Module` do AppConfigModule — ou seja,
// no import do AppModule, antes de qualquer hook.
const mongo = await MongoMemoryServer.create();

// Definir em process.env basta: o ConfigModule da precedencia a ele sobre o
// .env do disco.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = mongo.getUri();
process.env.MONGODB_DB_NAME = 'maison-essence-test';
process.env.CORS_ORIGINS ??= 'http://localhost:5173';
// Valores fixos e distintos: o schema exige 32 caracteres em cada e recusa
// os dois iguais.
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789-abcdefgh';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-0123456789-abcdefgh';

afterAll(async () => {
  await mongo.stop();
});
