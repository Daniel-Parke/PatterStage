/** @jest-environment node */
jest.mock('@/lib/templates-handlers/shared', () => ({
  saveTemplate: jest.fn(), invalidateTemplatesCache: jest.fn(),
  enrichCustomTemplateFromDisk: (template: unknown) => template,
}));
jest.mock('@/lib/missions/mission-category-repository', () => ({ resolveTemplateCategoryId: () => 'general' }));
jest.mock('@/lib/analytics/record-event', () => ({ recordEvent: jest.fn() }));

import { handleCreateTemplate } from '@/lib/templates-handlers/create';
import { saveTemplate } from '@/lib/templates-handlers/shared';
import { recordEvent } from '@/lib/analytics/record-event';

afterEach(() => { jest.restoreAllMocks(); jest.clearAllMocks(); });

describe('new template identifiers preserve independent creations', () => {
  it('does not collide when clock and ordinary random values repeat', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1800000000000);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const ids: string[] = [];
    for (const name of ['First', 'Second', 'Third']) {
      const response = handleCreateTemplate({ name });
      expect(response.status).toBe(200);
      const { data } = await response.json() as { data: { id: string; name: string } };
      expect(data.name).toBe(name);
      expect(saveTemplate).toHaveBeenLastCalledWith(expect.objectContaining({ id: data.id, name }));
      expect(recordEvent).toHaveBeenLastCalledWith('template.saved', expect.objectContaining({ entityId: data.id }));
      ids.push(data.id);
    }
    expect(new Set(ids).size).toBe(3);
  });

  it('uses the retained custom-template prefix followed by a UUID for new records', async () => {
    const response = handleCreateTemplate({ name: 'New identifier' });
    const { data } = await response.json() as { data: { id: string } };
    expect(data.id).toMatch(/^ct_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
