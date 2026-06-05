import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import databaseConfig from './config/database.config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { BilleterasModule } from './modules/billeteras/billeteras.module';
import { CategoriasModule } from './modules/categorias/categorias.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MovimientosModule } from './modules/movimientos/movimientos.module';
import { PerfilModule } from './modules/perfil/perfil.module';
import { ReportesModule } from './modules/reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [databaseConfig],
    }),
    DatabaseModule,
    AuthModule,
    BilleterasModule,
    CategoriasModule,
    MovimientosModule,
    DashboardModule,
    PerfilModule,
    ReportesModule,
  ],
})
export class AppModule {}
