import {InMemoryRepository} from '@tryghost/in-memory-repository';
import {Collection} from './Collection';

export class CollectionsRepositoryInMemory extends InMemoryRepository<string, Collection> {
    protected toPrimitive(entity: Collection): object {
        return entity.toJSON();
    }

    async getBySlug(slug: string): Promise<Collection | null> {
        return this.store.find(item => item.slug === slug) || null;
    }
}
