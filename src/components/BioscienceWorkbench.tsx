import React, { useState, useEffect } from 'react';
import {
  Dna,
  Search,
  ExternalLink,
  Sparkles,
  AlertCircle,
  Layers
} from 'lucide-react';

interface BioscienceWorkbenchProps {
  theme: 'dark' | 'light';
  onRecordUsage: (type: 'textRequests') => void;
}

const QUICK_EXAMPLES = [
  { symbol: 'TP53', accession: 'P04637', label: 'TP53 · Tumor Suppressor p53' },
  { symbol: 'BRCA1', accession: 'P38398', label: 'BRCA1 · DNA Repair Ligase' },
  { symbol: 'EGFR', accession: 'P00533', label: 'EGFR · Receptor Tyrosine Kinase' },
  { symbol: 'INS', accession: 'P01308', label: 'INS · Human Insulin' }
];

export const BioscienceWorkbench: React.FC<BioscienceWorkbenchProps> = ({
  theme,
  onRecordUsage
}) => {
  const [queryInput, setQueryInput] = useState('TP53');
  const [proteinData, setProteinData] = useState<any | null>(null);
  const [selectedDomainIdx, setSelectedDomainIdx] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSynthesis, setAiSynthesis] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  const isDark = theme === 'dark';

  const fetchProteinRecord = async (symbolOrAcc: string) => {
    setIsLoading(true);
    setError(null);
    setAiSynthesis(null);
    try {
      const res = await fetch(
        `/api/science/protein/${encodeURIComponent(symbolOrAcc.trim())}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to retrieve protein structure record.');
      }
      setProteinData(data);
      setSelectedDomainIdx(0);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Error querying protein databases.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProteinRecord('TP53');
  }, []);

  const handleRunAiSynthesis = async () => {
    if (!proteinData) return;
    setIsSynthesizing(true);
    setError(null);
    try {
      const res = await fetch('/api/master-prompt/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterPrompt:
            'Act as a Principal Structural Biologist and Bioinformatics Scientist. Given the protein metadata, synthesize: 1) Structural fold and pLDDT confidence interpretation, 2) Key catalytic/binding domain mechanics, and 3) Clinical significance and therapeutic tractability.',
          newIdea: `${proteinData.gene} (${proteinData.accession}) — ${proteinData.proteinName}. Function: ${proteinData.functionSummary}. Domains: ${JSON.stringify(
            proteinData.domains
          )}`,
          model: 'gemini-4-argon',
          enableThinking: true
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to run Gemini 4 Argon synthesis.');
      }
      setAiSynthesis(data.output);
      onRecordUsage('textRequests');
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'AI synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const alphaGenomeUrl = proteinData
    ? `https://deepmind.google.com/science/alphagenome/atlas?${new URLSearchParams({
        q: proteinData.gene
      }).toString()}`
    : '#';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Bioscience &amp; Structural Biology Workbench
          </h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Inspect AlphaFold DB 3D structure predictions, canonical pLDDT confidence
            bands, UniProtKB functional domains, and Gemini 4 Argon biomedical synthesis.
          </p>
        </div>

        {/* Search Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (queryInput.trim()) fetchProteinRecord(queryInput);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="Gene or UniProt ID (e.g. TP53, P04637)"
            aria-label="Search Gene or UniProt Accession"
            className={`rounded-lg border px-3 py-2 text-xs font-mono w-56 ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-300'
            }`}
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Load Target</span>
          </button>
        </form>
      </div>

      {/* Top Quick-Try Example Selector Bar */}
      <div
        className={`p-3.5 rounded-xl border flex flex-wrap items-center gap-2 ${
          isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
        }`}
      >
        <span className="text-xs font-medium mr-1">Reference Targets:</span>
        {QUICK_EXAMPLES.map((ex) => {
          const active = proteinData?.gene === ex.symbol;
          return (
            <button
              key={ex.symbol}
              type="button"
              onClick={() => {
                setQueryInput(ex.symbol);
                fetchProteinRecord(ex.symbol);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors border cursor-pointer ${
                active
                  ? 'bg-teal-600 text-white border-teal-600'
                  : isDark
                  ? 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              {ex.label} ({ex.accession})
            </button>
          );
        })}
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl border border-red-500/40 bg-red-500/10 text-xs text-red-600 dark:text-red-300 flex items-center gap-2.5"
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {proteinData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Pane: Interactive Structural Confidence & Sequence Canvas */}
          <div className="lg:col-span-7 space-y-5">
            <div
              className={`p-5 rounded-xl border space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b pb-3 border-slate-200 dark:border-slate-800">
                <div>
                  <div className="text-xs font-mono text-teal-600 dark:text-teal-400">
                    {proteinData.gene} · UniProtKB {proteinData.accession} ·{' '}
                    {proteinData.length} aa
                  </div>
                  <h3 className="font-display text-lg font-bold mt-0.5">
                    {proteinData.proteinName}
                  </h3>
                  <p className="text-xs opacity-70">
                    {proteinData.organism} · [Predicted by AlphaFold] · [UniProtKB Curated]
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleRunAiSynthesis}
                  disabled={isSynthesizing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium cursor-pointer disabled:opacity-60"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {isSynthesizing ? 'Synthesizing...' : 'Gemini 4 Argon Brief'}
                  </span>
                </button>
              </div>

              <p className="text-xs leading-relaxed opacity-90">
                {proteinData.functionSummary}
              </p>

              {/* Canonical 4-Band AlphaFold pLDDT Confidence Scale */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                  <span>AlphaFold Per-Residue pLDDT Confidence Distribution</span>
                  <span>Mean pLDDT: {proteinData.plddtSummary.meanScore}</span>
                </div>
                <div className="h-3.5 w-full rounded-md overflow-hidden flex border border-slate-700/30">
                  <div
                    style={{
                      width: `${proteinData.plddtSummary.veryHigh}%`,
                      backgroundColor: '#0053D6'
                    }}
                    title="Very High (>90)"
                  />
                  <div
                    style={{
                      width: `${proteinData.plddtSummary.confident}%`,
                      backgroundColor: '#65CBF3'
                    }}
                    title="Confident (70-90)"
                  />
                  <div
                    style={{
                      width: `${proteinData.plddtSummary.low}%`,
                      backgroundColor: '#FFDB13'
                    }}
                    title="Low (50-70)"
                  />
                  <div
                    style={{
                      width: `${proteinData.plddtSummary.veryLow}%`,
                      backgroundColor: '#FF7D45'
                    }}
                    title="Very Low (<50)"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono tabular-nums pt-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: '#0053D6' }}
                    />
                    <span>&gt;90 Very High: {proteinData.plddtSummary.veryHigh}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: '#65CBF3' }}
                    />
                    <span>70-90 Confident: {proteinData.plddtSummary.confident}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: '#FFDB13' }}
                    />
                    <span>50-70 Low: {proteinData.plddtSummary.low}%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: '#FF7D45' }}
                    />
                    <span>&lt;50 Disordered: {proteinData.plddtSummary.veryLow}%</span>
                  </div>
                </div>
              </div>

              {/* Synchronized Linear Domain Map SVG */}
              <div className="pt-3 space-y-2">
                <div className="text-xs font-medium flex items-center justify-between">
                  <span>Interactive Sequence &amp; Domain Topology Map (1 – {proteinData.length} aa)</span>
                  <span className="font-mono text-[11px] opacity-70">
                    Click a segment below to inspect
                  </span>
                </div>
                <div
                  className={`p-4 rounded-lg border ${
                    isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <svg viewBox="0 0 600 70" className="w-full h-16">
                    <line
                      x1="15"
                      y1="35"
                      x2="585"
                      y2="35"
                      stroke="#64748B"
                      strokeWidth="4"
                      strokeLinecap="round"
                    />
                    {(proteinData.domains || []).map((dom: any, idx: number) => {
                      const totalLen = Math.max(proteinData.length || 400, 1);
                      const xStart = 15 + Math.round((dom.start / totalLen) * 570);
                      const width = Math.max(
                        18,
                        Math.round(((dom.end - dom.start + 1) / totalLen) * 570)
                      );
                      const isSel = selectedDomainIdx === idx;
                      const fill =
                        dom.type === 'Natural variant'
                          ? '#DC2626'
                          : isSel
                          ? '#0D9488'
                          : '#0B57D0';
                      return (
                        <g
                          key={idx}
                          onClick={() => setSelectedDomainIdx(idx)}
                          className="cursor-pointer"
                        >
                          <rect
                            x={xStart}
                            y={isSel ? 14 : 18}
                            width={width}
                            height={isSel ? 42 : 34}
                            rx="5"
                            fill={fill}
                            opacity={isSel ? 1 : 0.8}
                          />
                        </g>
                      );
                    })}
                  </svg>
                  {proteinData.domains?.[selectedDomainIdx] && (
                    <div className="mt-2 pt-2 border-t border-slate-700/30 flex items-center justify-between text-xs font-mono tabular-nums">
                      <span>
                        Selected: <strong>{proteinData.domains[selectedDomainIdx].description}</strong>
                      </span>
                      <span>
                        Residues {proteinData.domains[selectedDomainIdx].start}–
                        {proteinData.domains[selectedDomainIdx].end}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Authoritative Source Citation Links */}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap gap-3 text-xs">
                <a
                  href={`https://alphafold.ebi.ac.uk/entry/${proteinData.accession}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-medium"
                >
                  <span>AlphaFold DB ({proteinData.accession})</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={proteinData.cifUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-medium"
                >
                  <span>Download mmCIF (.cif)</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://www.uniprot.org/uniprotkb/${proteinData.accession}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-medium"
                >
                  <span>UniProtKB Record</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={alphaGenomeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 hover:underline font-medium"
                >
                  <span>AlphaGenome Atlas</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {aiSynthesis && (
              <div
                className={`p-5 rounded-xl border space-y-2 ${
                  isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                }`}
              >
                <div className="text-xs font-mono text-teal-500">
                  Gemini 4 Argon Structural &amp; Clinical Synthesis
                </div>
                <div className="text-xs leading-relaxed whitespace-pre-wrap">
                  {aiSynthesis}
                </div>
              </div>
            )}
          </div>

          {/* Right Pane: Synchronized Domain & Variant Table Inspector */}
          <div className="lg:col-span-5">
            <div
              className={`p-5 rounded-xl border space-y-4 ${
                isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-teal-500" />
                  <h3 className="font-display text-sm font-semibold">
                    Functional Domains &amp; Clinical Variants
                  </h3>
                </div>
                <span className="font-mono text-xs opacity-70 tabular-nums">
                  {(proteinData.domains || []).length} Features
                </span>
              </div>

              <div className="space-y-2">
                {(proteinData.domains || []).map((dom: any, idx: number) => {
                  const isSel = selectedDomainIdx === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedDomainIdx(idx)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                        isSel
                          ? 'border-teal-500 bg-teal-500/10'
                          : isDark
                          ? 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                          : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                        <span className="font-semibold text-teal-600 dark:text-teal-400">
                          {dom.type}
                        </span>
                        <span>
                          aa {dom.start}–{dom.end} · {dom.confidence}
                        </span>
                      </div>
                      <p className="text-xs mt-1 opacity-90">{dom.description}</p>
                    </button>
                  );
                })}
              </div>

              {proteinData.pdbEntries?.length > 0 && (
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-xs space-y-1.5">
                  <span className="font-medium block">
                    Experimental RCSB PDB Structures [Experimentally determined]:
                  </span>
                  <div className="flex flex-wrap gap-2 font-mono">
                    {proteinData.pdbEntries.map((pdb: string) => (
                      <a
                        key={pdb}
                        href={`https://www.rcsb.org/structure/${pdb}`}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded border border-slate-500/30 hover:border-teal-500 inline-flex items-center gap-1"
                      >
                        <span>PDB {pdb}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
