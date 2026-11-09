import { Global, Module } from '@nestjs/common';
import { ContentStore } from './content.store';

/** Loads the content of the eight modes from the database into the live catalogs (global: the admin panel uses the store). */
@Global()
@Module({ providers: [ContentStore], exports: [ContentStore] })
export class ContentModule {}
