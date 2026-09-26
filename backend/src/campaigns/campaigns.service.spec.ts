import { Prisma } from '@prisma/client';
import { summarise } from './campaigns.service';

const metric = (over: Partial<Record<string, number>> = {}) => ({
  spend: new Prisma.Decimal(over.spend ?? 0),
  impressions: over.impressions ?? 0,
  clicks: over.clicks ?? 0,
  leads: over.leads ?? 0,
  conversions: over.conversions ?? 0,
  revenue: new Prisma.Decimal(over.revenue ?? 0),
});

describe('summarise', () => {
  it('adds up every period rather than reading only the latest', () => {
    const result = summarise([
      metric({ spend: 100, impressions: 1000, clicks: 50, revenue: 400 }),
      metric({ spend: 300, impressions: 3000, clicks: 150, revenue: 1200 }),
    ]);

    expect(result.spend).toBe(400);
    expect(result.impressions).toBe(4000);
    expect(result.clicks).toBe(200);
    expect(result.revenue).toBe(1600);
  });

  it('derives the documented ratios', () => {
    const result = summarise([
      metric({
        spend: 500,
        impressions: 10_000,
        clicks: 250,
        leads: 50,
        revenue: 2000,
      }),
    ]);

    expect(result.clickThroughRate).toBeCloseTo(0.025); // 250 / 10000
    expect(result.costPerClick).toBeCloseTo(2); // 500 / 250
    expect(result.costPerLead).toBeCloseTo(10); // 500 / 50
    expect(result.returnOnAdSpend).toBeCloseTo(4); // 2000 / 500
  });

  it('reports null, not zero, when a campaign has no data to divide by', () => {
    const result = summarise([]);

    expect(result.spend).toBe(0);
    expect(result.clickThroughRate).toBeNull();
    expect(result.costPerClick).toBeNull();
    expect(result.costPerLead).toBeNull();
    expect(result.returnOnAdSpend).toBeNull();
  });

  it('does not divide by zero when a campaign ran but converted nobody', () => {
    const result = summarise([
      metric({ spend: 900, impressions: 5000, clicks: 100 }),
    ]);

    expect(result.costPerClick).toBeCloseTo(9);
    // No leads at all, so a cost per lead does not exist...
    expect(result.costPerLead).toBeNull();
    // ...but spending 900 and earning nothing is a real ROAS of zero, not missing data.
    expect(result.returnOnAdSpend).toBe(0);
  });
});
