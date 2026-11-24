import type { JSX } from "@solidjs/web";
import { For } from "solid-js";
import { GROUPS, type IssueTotals, KINDS } from "../analysis/kinds.ts";
import { displayGrade, gradeBand, meterCells, type MeterCell } from "../analysis/readability.ts";
import type { IssueKind, Stats } from "../analysis/schema.ts";
import { Tip } from "./Tip.tsx";

/** Props for {@link Sidebar}. */
export interface SidebarProps {
  readonly stats: Stats;
  readonly totals: IssueTotals;
  readonly hiddenKinds: ReadonlySet<IssueKind>;
  readonly target: number;
  onToggleKind(kind: IssueKind): void;
  onFocusKind(kind: IssueKind | null): void;
}

function TipTitle(props: { children: JSX.Element }) {
  return <b class="mb-1 block font-bold text-fg">{props.children}</b>;
}

function BandRow(props: { band: string; children: JSX.Element }) {
  return (
    <span class="grid grid-cols-[7ch_1fr] gap-x-[1ch]">
      <span class="text-accent">{props.band}</span>
      <span>{props.children}</span>
    </span>
  );
}

function GradeTip(props: { target: number }) {
  return (
    <>
      <TipTitle>Grade level</TipTitle>
      Roughly the years of US schooling a reader needs to follow the text on the first read. Lower
      is easier. It measures sentence and word length, not quality.
      <span class="mt-1.5 block">
        <BandRow band="good">
          at or under your target (≤ {props.target}). Most adults read it without effort.
        </BandRow>
        <BandRow band="ok">
          {props.target + 1}–{props.target + 3}. Fine for an engaged reader, but it takes work.
        </BandRow>
        <BandRow band="dense">
          {props.target + 4}+. Academic or legal territory. Readers skim or quit.
        </BandRow>
      </span>
      <span class="mt-1.5 block">
        For reference: newspapers aim for about 8. Technical docs often sit at 10–12.
      </span>
    </>
  );
}

const METRIC_TIPS: Record<"ari" | "fk" | "cl" | "avg", () => JSX.Element> = {
  ari: () => (
    <>
      <TipTitle>Automated Readability Index</TipTitle>
      Uses characters per word and words per sentence. It counts letters, not syllables, so the same
      text always gets the same score. Steinbeck uses ARI for the headline grade and for the hard /
      very hard sentence marks, so the marks and the score always agree.
    </>
  ),
  fk: () => (
    <>
      <TipTitle>Flesch–Kincaid grade</TipTitle>
      Uses syllables per word and words per sentence. The most common metric, but English syllable
      counts are estimates, so it can drift by a grade on technical words. Shown for comparison.
    </>
  ),
  cl: () => (
    <>
      <TipTitle>Coleman–Liau index</TipTitle>
      Uses letters and sentences per 100 words. Tends to score text with long words higher than the
      others do. Shown for comparison.
    </>
  ),
  avg: () => (
    <>
      <TipTitle>Average sentence length</TipTitle>
      Plain-language guides suggest 15–20 words on average. The average is not everything: a mix of
      short and long sentences reads better than all medium ones.
    </>
  ),
};

const KIND_TIPS: Partial<Record<IssueKind, () => JSX.Element>> = {
  hard: () => (
    <>
      <TipTitle>Hard sentence</TipTitle>
      This sentence alone scores grade 10–13. Readers can follow it, but they slow down. Look for a
      place to split it.
    </>
  ),
  veryHard: () => (
    <>
      <TipTitle>Very hard sentence</TipTitle>
      This sentence alone scores grade 14 or higher. Readers often lose the subject before they
      reach the verb. Split it.
    </>
  ),
};

const CELL_CLASS: Record<MeterCell, string> = {
  filled: "text-accent",
  empty: "text-bg-4",
  target: "text-fg",
  targetFilled: "text-fg",
};

const CELL_GLYPH: Record<MeterCell, string> = {
  filled: "█",
  empty: "█",
  target: "▏",
  targetFilled: "█",
};

function SectionHeader(props: { left: string; right: string }) {
  return (
    <div class="mb-3 flex items-baseline justify-between border-b border-rule pb-1.5 text-[11px] tracking-[0.12em] text-fg-faint uppercase">
      <span>{props.left}</span>
      <span>{props.right}</span>
    </div>
  );
}

function Readability(props: { stats: Stats; target: number }) {
  const grade = () => displayGrade(props.stats.ari);
  const metrics = () =>
    [
      ["ari", "automated readability (ARI)", props.stats.ari, true],
      ["fk", "flesch–kincaid grade", props.stats.fleschKincaid, false],
      ["cl", "coleman–liau", props.stats.colemanLiau, false],
      ["avg", "avg words / sentence", props.stats.wordsPerSentence, false],
    ] as const;

  return (
    <section class="mb-7">
      <SectionHeader left="Readability" right="ARI" />
      <Tip content={<GradeTip target={props.target} />} class="flex items-baseline gap-3">
        <span class="text-[44px] leading-none font-bold text-accent">{grade()}</span>
        <span class="text-fg-dim">
          <span class="block text-fg">
            Grade {grade()} · {gradeBand(grade(), props.target)}
          </span>
          target ≤ {props.target}
        </span>
      </Tip>
      <Tip
        class="mt-3 mb-1 block text-[13px] tracking-[1px] whitespace-pre"
        content={
          <>
            <TipTitle>Grade meter</TipTitle>
            Filled cells are the current grade. The bright bar is your target ({props.target}).
          </>
        }
      >
        <For each={meterCells(grade(), props.target)}>
          {(cell) => <span class={CELL_CLASS[cell]}>{CELL_GLYPH[cell]}</span>}
        </For>
      </Tip>
      <div class="flex justify-between text-[10.5px] text-fg-faint">
        <span>1</span>
        <span>{props.target}</span>
        <span>16+</span>
      </div>
      <div class="mt-3 grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-fg-dim">
        <For each={metrics()}>
          {(metric) => (
            <>
              <Tip
                content={METRIC_TIPS[metric[0]]()}
                class="hover:underline hover:decoration-dotted"
              >
                {metric[1]}
              </Tip>
              <span class={["text-right", metric[3] ? "text-accent" : "text-fg"]}>
                {metric[2].toFixed(1)}
              </span>
            </>
          )}
        </For>
      </div>
    </section>
  );
}

function KindLabel(props: { kind: IssueKind; label: string }) {
  const tip = () => KIND_TIPS[props.kind];
  const label = () => <span class={["mark", `mark-${props.kind}`, "px-px"]}>{props.label}</span>;
  return <>{tip() ? <Tip content={tip()?.()}>{label()}</Tip> : label()}</>;
}

/**
 * The analysis sidebar for edit mode: the readability score and the lint categories. Hover a
 * category to show only its marks. Click it to turn it off.
 *
 * @example
 * ```tsx
 * <Sidebar stats={stats()} totals={totals()} hiddenKinds={hidden()} target={8}
 *   onToggleKind={toggle} onFocusKind={setFocus} />
 * ```
 */
export function Sidebar(props: SidebarProps) {
  return (
    <div class="h-full w-[340px] overflow-y-auto px-[22px] pt-5 pb-10 text-[12.5px]">
      <Readability stats={props.stats} target={props.target} />
      <section>
        <SectionHeader left="Lint" right="deterministic" />
        <For each={GROUPS}>
          {(group) => (
            <>
              <div class="mt-2.5 mb-0.5 text-[10.5px] text-fg-faint first:mt-0">{group}</div>
              <For each={KINDS.filter((k) => k.group === group)}>
                {(info) => (
                  <button
                    type="button"
                    class="flex w-full items-baseline gap-2 py-1 text-left"
                    onMouseEnter={() => props.onFocusKind(info.kind)}
                    onMouseLeave={() => props.onFocusKind(null)}
                    onClick={() => props.onToggleKind(info.kind)}
                  >
                    <span class="w-[3ch] text-fg-faint">
                      {props.hiddenKinds.has(info.kind) ? "[ ]" : "[x]"}
                    </span>
                    <span
                      class={{
                        "line-through opacity-35": props.hiddenKinds.has(info.kind),
                      }}
                    >
                      <KindLabel kind={info.kind} label={info.label} />
                    </span>
                    <span class="flex-1 overflow-hidden whitespace-nowrap text-bg-4">
                      {" ".padEnd(80, ".")}
                    </span>
                    <span
                      class={[
                        "min-w-[2ch] text-right text-fg",
                        { "opacity-35": props.hiddenKinds.has(info.kind) },
                      ]}
                    >
                      {props.totals.byKind[info.kind]}
                    </span>
                  </button>
                )}
              </For>
            </>
          )}
        </For>
      </section>
    </div>
  );
}
