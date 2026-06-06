import { Global, Module } from '@nestjs/common';
import { DefaultUserService } from './default-user.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, DefaultUserService],
  exports: [PrismaService, DefaultUserService],
})
export class CoreModule {}
