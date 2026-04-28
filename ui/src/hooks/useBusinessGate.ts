import { useCompany } from "../context/CompanyContext";
import { MODULE_GATES } from "@paperclipai/shared";
import type { BusinessType } from "@paperclipai/shared";

/**
 * Returns whether the current company has access to a given module.
 *
 * - If the module key is NOT in MODULE_GATES, it is visible for everyone.
 * - If the module key IS in MODULE_GATES, it is only visible when the
 *   company's businessType is in the allowed list.
 * - A company with no businessType (null) only sees modules that are not gated.
 */
export function useBusinessGate(moduleKey: string): boolean {
  const { selectedCompany } = useCompany();
  const gate = MODULE_GATES[moduleKey];
  if (!gate) return true; // not gated — always visible
  const businessType = (selectedCompany?.businessType ?? null) as BusinessType | null;
  if (!businessType) return false;
  return (gate as readonly string[]).includes(businessType);
}
