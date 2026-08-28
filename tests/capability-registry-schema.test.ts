import { describe, it, expect } from 'vitest';
import { CapabilityProviderSchema, CapabilityTypeSchema, CapabilityCostModelSchema, CapabilityStatusSchema } from '@/lib/schemas';

/**
 * The Capability / Tool Registry's core record: "some way to do a thing" —
 * an MCP server, an API, a CLI, an SDK, a SKILL.md, a GitHub repo, a hosted
 * AI service, a local model/tool, browser automation, a media-generation
 * service, a 3D/web animation library, a design-automation tool. Every field
 * the user's spec asked for is required or has an explicit default so a
 * registry row is never ambiguous about whether it costs money or is ready
 * to use.
 */
describe('CapabilityProviderSchema', () => {
  const base = {
    id: 'brave-search',
    name: 'Brave Search API',
    capability: 'web-search',
    type: 'api' as const,
    connector: 'lib/connectors/web-search.ts',
    authRequired: true,
    costModel: 'freemium' as const,
    freeTier: 'Yes — 2,000 queries/month free',
    status: 'available' as const,
    installed: true,
    configured: true,
    approvedByUser: true,
    allowedAgents: ['product-competitor-research'],
    notes: 'Already wired and live.',
  };

  it('parses a fully-specified provider', () => {
    const parsed = CapabilityProviderSchema.parse(base);
    expect(parsed.id).toBe('brave-search');
    expect(parsed.lastVerifiedAt).toBeNull(); // defaults null, set by a verification pass
  });

  it('CapabilityTypeSchema covers every kind the audit calls for', () => {
    expect(CapabilityTypeSchema.options).toEqual([
      'mcp_server',
      'api',
      'cli',
      'sdk',
      'skill',
      'github_repo',
      'hosted_service',
      'local_model',
      'browser_automation',
      'media_generation',
      'animation_library',
      'design_tool',
    ]);
  });

  it('CapabilityCostModelSchema covers free/freemium/paid/unknown', () => {
    expect(CapabilityCostModelSchema.options).toEqual(['free', 'freemium', 'paid', 'unknown']);
  });

  it('CapabilityStatusSchema tracks the discovery-to-activation lifecycle', () => {
    expect(CapabilityStatusSchema.options).toEqual(['candidate', 'available', 'active', 'rejected']);
  });

  it('a newly-discovered candidate defaults to safe, inactive values', () => {
    const parsed = CapabilityProviderSchema.parse({
      id: 'runway-gen4',
      name: 'Runway Gen-4',
      capability: 'video-generation',
      type: 'hosted_service',
      costModel: 'paid',
    });
    expect(parsed.status).toBe('candidate');
    expect(parsed.installed).toBe(false);
    expect(parsed.configured).toBe(false);
    // the whole point: discovering a paid tool NEVER auto-approves it
    expect(parsed.approvedByUser).toBe(false);
    expect(parsed.authRequired).toBe(false);
    expect(parsed.allowedAgents).toEqual([]);
    expect(parsed.freeTier).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it('rejects a provider missing capability or type', () => {
    expect(() => CapabilityProviderSchema.parse({ id: 'x', name: 'X' })).toThrow();
  });
});
