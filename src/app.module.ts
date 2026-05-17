import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { MovimientosModule } from './modules/movimientos/movimientos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [databaseConfig],
    }),
    DatabaseModule,
    MovimientosModule,
  ],
})
export class AppModule {}
