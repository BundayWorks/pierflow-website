"use server";

import { checkEligibility, type EligibilityResult } from "../actions";

export async function checkEligibilityAction(
  identifier: string,
): Promise<EligibilityResult> {
  return checkEligibility(identifier.trim());
}
