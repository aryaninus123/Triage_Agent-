import fs from "fs";
import path from "path";
import type { Condition, Rule, RuleAction } from "./schema";
import { RulesFileSchema } from "./schema";
import type { RuleContext } from "./rule-context";

export interface AppliedRule {
  ruleId: string;
  ruleName: string;
  actions: RuleAction;
}

export interface RuleEngineResult {
  appliedRules: AppliedRule[];
  forceTeam?: RuleAction["forceTeam"];
  forceEscalate?: boolean;
  tags: string[];
  notifyChannels: string[];
}

let cachedRules: Rule[] | null = null;

export function loadRules(rulesPath?: string): Rule[] {
  if (cachedRules) return cachedRules;

  const resolvedPath =
    rulesPath ?? path.join(process.cwd(), "config", "rules.json");

  if (!fs.existsSync(resolvedPath)) {
    cachedRules = [];
    return cachedRules;
  }

  const raw = JSON.parse(fs.readFileSync(resolvedPath, "utf-8"));
  const parsed = RulesFileSchema.safeParse(raw);

  if (!parsed.success) {
    console.warn("[RuleEngine] Invalid rules.json:", parsed.error.flatten().fieldErrors);
    cachedRules = [];
    return cachedRules;
  }

  cachedRules = parsed.data
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  return cachedRules;
}

// For testing or hot-reload
export function clearRulesCache(): void {
  cachedRules = null;
}

function evaluateCondition(condition: Condition, ctx: RuleContext): boolean {
  const ctxValue = ctx[condition.field as keyof RuleContext];

  switch (condition.operator) {
    case "eq":
      return ctxValue == condition.value; // eslint-disable-line eqeqeq
    case "neq":
      return ctxValue != condition.value; // eslint-disable-line eqeqeq
    case "gte":
      return Number(ctxValue) >= Number(condition.value);
    case "lte":
      return Number(ctxValue) <= Number(condition.value);
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(String(ctxValue));
    case "notIn":
      return Array.isArray(condition.value) && !condition.value.includes(String(ctxValue));
    default:
      return false;
  }
}

function evaluateRule(rule: Rule, ctx: RuleContext): boolean {
  if (rule.conditionMode === "OR") {
    return rule.conditions.some((c) => evaluateCondition(c, ctx));
  }
  return rule.conditions.every((c) => evaluateCondition(c, ctx));
}

export function evaluateRules(ctx: RuleContext, rules?: Rule[]): RuleEngineResult {
  const ruleset = rules ?? loadRules();
  const appliedRules: AppliedRule[] = [];
  const tags: string[] = [];
  const notifyChannels: string[] = [];
  let forceTeam: RuleAction["forceTeam"] | undefined;
  let forceEscalate: boolean | undefined;

  for (const rule of ruleset) {
    if (!evaluateRule(rule, ctx)) continue;

    appliedRules.push({ ruleId: rule.id, ruleName: rule.name, actions: rule.actions });

    if (rule.actions.forceTeam) forceTeam = rule.actions.forceTeam;
    if (rule.actions.forceEscalate !== undefined) forceEscalate = rule.actions.forceEscalate;
    if (rule.actions.addTag) tags.push(rule.actions.addTag);
    if (rule.actions.notifyChannel) notifyChannels.push(rule.actions.notifyChannel);
  }

  return { appliedRules, forceTeam, forceEscalate, tags, notifyChannels };
}
