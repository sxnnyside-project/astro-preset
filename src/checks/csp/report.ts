/**
 * report.ts
 * The one thing every check script actually shares: "print a summary, then
 * exit 1 if anything failed, exit 0 otherwise." Deliberately minimal — each
 * check's violation shape is different enough (CSP violations vs. broken
 * links vs. budget overruns) that forcing a single generic "Violation" type
 * across all of them would be exactly the premature abstraction this
 * refactor should avoid introducing.
 */

export interface CheckSummary {
  title: string;
  failureCount: number;
}

/** Prints a pass/fail line for the whole check and exits with the right code. */
export function finish({ title, failureCount }: CheckSummary): never {
  if (failureCount > 0) {
    console.error(`\n✗ ${title}: ${failureCount} issue(s) found.`);
    process.exit(1);
  }
  console.log(`\n✓ ${title}: no issues found.`);
  process.exit(0);
}
