#!/usr/bin/env npx tsx
/**
 * Validation Script: Weight Profile Comparison
 *
 * Compares scoring behavior across all three weight profiles using defined test cases.
 * Tests whether the inverted profile correctly rewards specific tasting notes over generic terms.
 *
 * Usage:
 *   npm run validate-scoring
 *   npx tsx scripts/validate-scoring.ts
 *
 * Purpose:
 * - Verify inverted profile rewards specific descriptors (berry, oak, spice names)
 * - Verify inverted profile penalizes generic terms (balanced, fresh, elegant)
 * - Compare behavior across all three profiles (inverted, moderate, data-driven)
 * - Provide systematic validation before deploying profile changes
 */

interface ValidationTestCase {
  id: string;
  description: string;
  text1: string;
  text2: string;
  expectation: 'text1_higher' | 'text2_higher' | 'similar';
  category: 'specific_vs_generic' | 'same_category' | 'edge_case';
}

interface TestResult {
  testCase: ValidationTestCase;
  profiles: {
    inverted: ProfileResult;
    moderate: ProfileResult;
    'data-driven': ProfileResult;
  };
}

interface ProfileResult {
  text1Weight: number;
  text2Weight: number;
  ratio: number;
  pass: boolean;
}

// Test cases contrasting specific vs generic tasting notes
const testCases: ValidationTestCase[] = [
  // Berry terms (specific) vs structure terms (generic)
  {
    id: 'berry-vs-structure-1',
    description: 'Specific berry notes should score higher than generic structure terms',
    text1: 'solbær og kirsebær',
    text2: 'balansert og frisk',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'berry-vs-structure-2',
    description: 'Multiple berries vs quality adjectives',
    text1: 'bringebær, blåbær og jordbær',
    text2: 'elegant, kompleks og dyp',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'berry-vs-structure-3',
    description: 'Dark berries vs tannin structure',
    text1: 'moreller og bjørnebær',
    text2: 'tanniner og struktur',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'berry-vs-texture-1',
    description: 'Berries vs texture descriptors',
    text1: 'solbær og plomme',
    text2: 'myk og rund',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'berry-vs-body-1',
    description: 'Berry specifics vs generic body terms',
    text1: 'kirsebær og bringebær',
    text2: 'fyldig og rik',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },

  // Oak/barrel terms (specific) vs quality adjectives (generic)
  {
    id: 'oak-vs-quality-1',
    description: 'Barrel aging descriptors vs quality terms',
    text1: 'eik, vanilje og toast',
    text2: 'god, fin og behagelig',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'oak-vs-quality-2',
    description: 'Fatlagring terms vs generic praise',
    text1: 'fatpreg og ristet eik',
    text2: 'elegant og pen',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'oak-vs-finish-1',
    description: 'Oak specifics vs finish generics',
    text1: 'vanilje og fatpreg',
    text2: 'lang avslutning',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },

  // Spice terms (specific) vs acidity terms (generic)
  {
    id: 'spice-vs-acidity-1',
    description: 'Named spices vs generic acidity',
    text1: 'pepper, nellik og kanel',
    text2: 'frisk og syrlig',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'spice-vs-acidity-2',
    description: 'Spice complexity vs simple freshness',
    text1: 'krydder og anis',
    text2: 'syre og friskhet',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'spice-vs-sweetness-1',
    description: 'Specific spices vs generic sweetness',
    text1: 'kanel og nellik',
    text2: 'søt og behagelig',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },

  // Herb/flower terms (specific) vs texture terms (generic)
  {
    id: 'herb-vs-texture-1',
    description: 'Named herbs vs texture generics',
    text1: 'timian og rosmarin',
    text2: 'myk og silkemyk',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },
  {
    id: 'flower-vs-texture-1',
    description: 'Floral specifics vs texture generics',
    text1: 'roser og fioler',
    text2: 'rund og bløt',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },

  // Edge cases: mixed specific + generic
  {
    id: 'edge-mixed-1',
    description: 'Mixed specific and generic (both texts)',
    text1: 'kirsebær, balansert og elegant',
    text2: 'frisk, god og fyldig',
    expectation: 'text1_higher',
    category: 'edge_case'
  },
  {
    id: 'edge-mixed-2',
    description: 'More specific terms win even with some generic',
    text1: 'solbær, vanilje, pepper og balansert',
    text2: 'kompleks, elegant og god',
    expectation: 'text1_higher',
    category: 'edge_case'
  },

  // Same category comparisons (should be similar)
  {
    id: 'same-berries-1',
    description: 'Different berries (same weight category)',
    text1: 'solbær og kirsebær',
    text2: 'bringebær og blåbær',
    expectation: 'similar',
    category: 'same_category'
  },
  {
    id: 'same-generic-1',
    description: 'Different generic terms (same weight)',
    text1: 'balansert og elegant',
    text2: 'god og behagelig',
    expectation: 'similar',
    category: 'same_category'
  },

  // Mineral vs generic
  {
    id: 'mineral-vs-generic-1',
    description: 'Mineral specifics vs generic quality',
    text1: 'mineralsk og stein',
    text2: 'kompleks og dyp',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },

  // Citrus vs generic
  {
    id: 'citrus-vs-generic-1',
    description: 'Citrus specifics vs acidity generics',
    text1: 'sitron og lime',
    text2: 'frisk og syrlig',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  },

  // Stone fruit vs generic
  {
    id: 'stone-fruit-vs-generic-1',
    description: 'Stone fruit specifics vs body generics',
    text1: 'fersken og aprikos',
    text2: 'fyldig og rik',
    expectation: 'text1_higher',
    category: 'specific_vs_generic'
  }
];

async function runValidation(generateReport: boolean = false): Promise<void> {
  console.log('='.repeat(70));
  console.log('WEIGHT PROFILE VALIDATION: SCORING COMPARISON');
  console.log('='.repeat(70));
  console.log();
  console.log(`Total test cases: ${testCases.length}`);
  console.log(`  - specific_vs_generic: ${testCases.filter(t => t.category === 'specific_vs_generic').length}`);
  console.log(`  - same_category: ${testCases.filter(t => t.category === 'same_category').length}`);
  console.log(`  - edge_case: ${testCases.filter(t => t.category === 'edge_case').length}`);
  console.log();

  const results: TestResult[] = [];
  const profileNames = ['inverted', 'moderate', 'data-driven'] as const;

  for (const testCase of testCases) {
    const testResult: TestResult = {
      testCase,
      profiles: {
        inverted: { text1Weight: 0, text2Weight: 0, ratio: 0, pass: false },
        moderate: { text1Weight: 0, text2Weight: 0, ratio: 0, pass: false },
        'data-driven': { text1Weight: 0, text2Weight: 0, ratio: 0, pass: false }
      }
    };

    for (const profileName of profileNames) {
      // Set environment variable
      process.env.NEXT_PUBLIC_WEIGHT_PROFILE = profileName;

      // Clear module cache to force fresh import with new profile
      const modulePath = require.resolve('../src/lib/lemmatizeAndWeight');
      delete require.cache[modulePath];

      // Also clear profile config cache
      const profileConfigPath = require.resolve('../src/lib/profiles/config');
      delete require.cache[profileConfigPath];

      // Dynamic import to get fresh weights
      const { lemmatizeAndWeight } = await import('../src/lib/lemmatizeAndWeight');

      // Analyze both texts
      const analysis1 = lemmatizeAndWeight(testCase.text1);
      const analysis2 = lemmatizeAndWeight(testCase.text2);

      const text1Weight = analysis1.weightSum;
      const text2Weight = analysis2.weightSum;
      const ratio = text2Weight > 0 ? text1Weight / text2Weight : 0;

      // Determine pass/fail based on expectation
      let pass = false;
      if (testCase.expectation === 'text1_higher') {
        pass = ratio > 1.1; // text1 should be at least 10% higher
      } else if (testCase.expectation === 'text2_higher') {
        pass = ratio < 0.9; // text2 should be at least 10% higher
      } else if (testCase.expectation === 'similar') {
        pass = ratio >= 0.9 && ratio <= 1.1; // within 10% of each other
      }

      testResult.profiles[profileName] = {
        text1Weight,
        text2Weight,
        ratio,
        pass
      };
    }

    results.push(testResult);
  }

  // Display results
  console.log('='.repeat(70));
  console.log('TEST RESULTS');
  console.log('='.repeat(70));
  console.log();

  // Summary by profile
  const summaries = {
    inverted: { total: 0, passed: 0 },
    moderate: { total: 0, passed: 0 },
    'data-driven': { total: 0, passed: 0 }
  };

  for (const result of results) {
    console.log(`Test: ${result.testCase.id}`);
    console.log(`  ${result.testCase.description}`);
    console.log(`  Text 1: "${result.testCase.text1}"`);
    console.log(`  Text 2: "${result.testCase.text2}"`);
    console.log(`  Expectation: ${result.testCase.expectation}`);
    console.log();

    // Table header
    console.log('  Profile      | Text1 Wt | Text2 Wt | Ratio | Pass');
    console.log('  ' + '-'.repeat(60));

    for (const profileName of profileNames) {
      const pr = result.profiles[profileName];
      const passStr = pr.pass ? '✓' : '✗';
      console.log(
        `  ${profileName.padEnd(12)} | ${pr.text1Weight.toFixed(2).padStart(8)} | ${pr.text2Weight.toFixed(2).padStart(8)} | ${pr.ratio.toFixed(2).padStart(5)} | ${passStr}`
      );

      summaries[profileName].total++;
      if (pr.pass) summaries[profileName].passed++;
    }

    console.log();
  }

  // Overall summary
  console.log('='.repeat(70));
  console.log('SUMMARY: PASS RATES BY PROFILE');
  console.log('='.repeat(70));
  console.log();

  for (const profileName of profileNames) {
    const s = summaries[profileName];
    const passRate = ((s.passed / s.total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(s.passed / s.total * 50));
    console.log(`${profileName.padEnd(12)}: ${s.passed}/${s.total} (${passRate}%) ${bar}`);
  }

  console.log();

  // Category breakdown for inverted profile
  console.log('='.repeat(70));
  console.log('INVERTED PROFILE: PASS RATE BY CATEGORY');
  console.log('='.repeat(70));
  console.log();

  const categories = ['specific_vs_generic', 'same_category', 'edge_case'] as const;
  for (const category of categories) {
    const categoryTests = results.filter(r => r.testCase.category === category);
    const passed = categoryTests.filter(r => r.profiles.inverted.pass).length;
    const total = categoryTests.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    console.log(`${category.padEnd(20)}: ${passed}/${total} (${passRate}%)`);
  }

  console.log();
  console.log('='.repeat(70));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(70));
  console.log();
  console.log('Interpretation:');
  console.log('  - INVERTED profile should pass most specific_vs_generic tests');
  console.log('  - DATA-DRIVEN profile should fail most (rewards generic terms)');
  console.log('  - MODERATE profile should be in between');
  console.log();

  // Generate markdown report if requested
  if (generateReport) {
    await generateMarkdownReport(results, summaries);
  }
}

async function generateMarkdownReport(
  results: TestResult[],
  summaries: Record<'inverted' | 'moderate' | 'data-driven', { total: number; passed: number }>
): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const reportPath = path.join(__dirname, 'validation-results', 'validation-report.md');
  const today = new Date().toISOString().split('T')[0];

  let markdown = `# Scoring Validation Report

Generated: ${today}

## Summary

| Profile | Pass Rate | Passed | Failed | Total |
|---------|-----------|--------|--------|-------|
`;

  const profileNames = ['inverted', 'moderate', 'data-driven'] as const;
  for (const profileName of profileNames) {
    const s = summaries[profileName];
    const passRate = ((s.passed / s.total) * 100).toFixed(1);
    const failed = s.total - s.passed;
    markdown += `| ${profileName} | ${passRate}% | ${s.passed} | ${failed} | ${s.total} |\n`;
  }

  markdown += `\n## Category Breakdown (Inverted Profile)

| Category | Pass Rate | Passed | Total |
|----------|-----------|--------|-------|
`;

  const categories = ['specific_vs_generic', 'same_category', 'edge_case'] as const;
  for (const category of categories) {
    const categoryTests = results.filter(r => r.testCase.category === category);
    const passed = categoryTests.filter(r => r.profiles.inverted.pass).length;
    const total = categoryTests.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
    markdown += `| ${category} | ${passRate}% | ${passed} | ${total} |\n`;
  }

  markdown += `\n## Detailed Test Results

`;

  for (const result of results) {
    markdown += `### ${result.testCase.id}\n\n`;
    markdown += `**Description:** ${result.testCase.description}\n\n`;
    markdown += `**Text 1 (${result.testCase.expectation === 'text1_higher' ? 'should score higher' : result.testCase.expectation === 'similar' ? 'similar' : 'should score lower'}):**\n`;
    markdown += `"${result.testCase.text1}"\n\n`;
    markdown += `**Text 2:**\n`;
    markdown += `"${result.testCase.text2}"\n\n`;
    markdown += `**Expectation:** ${result.testCase.expectation}\n\n`;

    markdown += `| Profile | Text 1 Weight | Text 2 Weight | Ratio | Pass? |\n`;
    markdown += `|---------|---------------|---------------|-------|-------|\n`;

    for (const profileName of profileNames) {
      const pr = result.profiles[profileName];
      const passStr = pr.pass ? '✓ YES' : '✗ NO';
      markdown += `| ${profileName} | ${pr.text1Weight.toFixed(2)} | ${pr.text2Weight.toFixed(2)} | ${pr.ratio.toFixed(2)}x | ${passStr} |\n`;
    }

    markdown += `\n`;
  }

  markdown += `## Interpretation

### Inverted Profile (${summaries.inverted.passed}/${summaries.inverted.total} = ${((summaries.inverted.passed / summaries.inverted.total) * 100).toFixed(1)}% pass rate)

`;

  if (summaries.inverted.passed / summaries.inverted.total >= 0.8) {
    markdown += `✓ **PASS**: The inverted profile successfully rewards specific tasting descriptors over generic terms.

`;
  } else {
    markdown += `✗ **FAIL**: The inverted profile does not consistently reward specific descriptors.

`;
  }

  const specificTests = results.filter(r => r.testCase.category === 'specific_vs_generic');
  const specificPassed = specificTests.filter(r => r.profiles.inverted.pass).length;

  markdown += `**Specific vs Generic Tests:** ${specificPassed}/${specificTests.length} passed\n`;
  markdown += `- Specific berry terms (e.g., "solbær", "kirsebær") receive higher weights than generic structure terms (e.g., "balansert", "frisk")\n`;
  markdown += `- Specific oak/barrel terms (e.g., "eik", "vanilje") score higher than quality adjectives (e.g., "elegant", "god")\n`;
  markdown += `- Named spices and herbs score higher than generic texture/acidity terms\n\n`;

  markdown += `### Data-Driven Profile (${summaries['data-driven'].passed}/${summaries['data-driven'].total} = ${((summaries['data-driven'].passed / summaries['data-driven'].total) * 100).toFixed(1)}% pass rate)

`;

  if (summaries['data-driven'].passed / summaries['data-driven'].total <= 0.2) {
    markdown += `✓ **Expected Behavior**: The data-driven profile inverts the logic, rewarding common/generic terms.

This demonstrates that the weight profile system is working correctly - different profiles produce different scoring behavior.

`;
  } else {
    markdown += `✗ **Unexpected**: Data-driven profile should fail most tests (it should reward generic terms).

`;
  }

  markdown += `### Moderate Profile (${summaries.moderate.passed}/${summaries.moderate.total} = ${((summaries.moderate.passed / summaries.moderate.total) * 100).toFixed(1)}% pass rate)

The moderate profile provides a middle ground between inverted and data-driven, with some weight differentiation but less extreme than the inverted profile.

## Conclusion

`;

  if (summaries.inverted.passed / summaries.inverted.total >= 0.8) {
    markdown += `**Validation successful.** The weight profile system correctly implements the core requirement: specific tasting descriptors contribute more to similarity scores than generic wine structure terms.

The inverted profile is ready for production use to reward actual tasting skill.
`;
  } else {
    markdown += `**Validation requires attention.** Some test cases are failing. Review the detailed results above to identify which specific terms are not being weighted correctly.
`;
  }

  await fs.writeFile(reportPath, markdown, 'utf-8');
  console.log();
  console.log('='.repeat(70));
  console.log(`Markdown report written to: ${reportPath}`);
  console.log('='.repeat(70));
}

// Execute
const args = process.argv.slice(2);
const generateReport = args.includes('--report');

runValidation(generateReport).catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
