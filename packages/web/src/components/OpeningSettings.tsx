import type { Book, ChapterOpening, Diagnosis, ProjectSettings } from '@graficai/core';
import { OPENING_EXTRA_KINDS, PRESET_LABELS, chapterNumeral, dropCapSizePt, openingPreset, splitOpening } from '@graficai/core';

interface Props {
  book: Book;
  diag: Diagnosis;
  settings: ProjectSettings;
  onCommit: (s: ProjectSettings, label: string) => void;
}

type Preset = Exclude<ChapterOpening['preset'], 'personalizada'>;
const PRESETS: Preset[] = ['classica', 'moderna', 'sobria'];

/** Seção "Abertura de capítulo" do painel de Ajustes, com prévia ao vivo. */
export function OpeningSettings({ book, diag, settings, onCommit }: Props) {
  const d = settings.design;
  const o = d.chapterOpening;

  const set = (patch: Partial<ChapterOpening>, label: string) =>
    onCommit({ ...settings, design: { ...d, chapterOpening: { ...o, ...patch, preset: 'personalizada' } } }, label);
  const applyPreset = (p: Preset) => onCommit({ ...settings, design: { ...d, chapterOpening: openingPreset(p) } }, `abertura ${PRESET_LABELS[p].toLowerCase()}`);

  const affected = diag.layout.elements.filter((e) => e.opening);
  const extra = affected.reduce((a, e) => a + (e.opening?.extraLines ?? 0), 0);
  const extrasOn = OPENING_EXTRA_KINDS.every((k) => o.appliesTo.includes(k));
  const leadValue = o.leadIn.style === 'normal' ? 'normal' : o.leadIn.scope;

  return (
    <>
      <p className="section-title">Abertura de capítulo</p>
      <div className="seg" role="radiogroup" aria-label="Estilo de abertura">
        {PRESETS.map((p) => (
          <button key={p} role="radio" aria-checked={o.preset === p} className={o.preset === p ? 'on' : ''} onClick={() => applyPreset(p)}>
            {PRESET_LABELS[p]}
          </button>
        ))}
      </div>
      {o.preset === 'personalizada' && <p className="small muted" style={{ margin: 0 }}>Personalizada — escolha um estilo acima para voltar ao padrão.</p>}

      <OpeningPreview book={book} settings={settings} />

      <div className="row">
        <div className="field">
          <label htmlFor="op-cap">Capitular</label>
          <select id="op-cap" value={o.dropCap.mode} onChange={(e) => set({ dropCap: { ...o.dropCap, mode: e.target.value as ChapterOpening['dropCap']['mode'] } }, 'capitular')}>
            <option value="nenhuma">Nenhuma</option>
            <option value="rebaixada">Rebaixada</option>
            <option value="elevada">Elevada</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="op-lines">Altura</label>
          <select id="op-lines" disabled={o.dropCap.mode === 'nenhuma'} value={o.dropCap.lines} onChange={(e) => set({ dropCap: { ...o.dropCap, lines: Number(e.target.value) } }, 'altura da capitular')}>
            {[2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n} linhas
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="op-lead">Versalete</label>
          <select
            id="op-lead"
            value={leadValue}
            onChange={(e) => {
              const v = e.target.value;
              set({ leadIn: v === 'normal' ? { ...o.leadIn, style: 'normal' } : { ...o.leadIn, style: 'versalete', scope: v as 'linha' | 'palavras' } }, 'versalete');
            }}
          >
            <option value="normal">Nenhum</option>
            <option value="linha">Primeira linha</option>
            <option value="palavras">Primeiras palavras</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="op-words">Palavras</label>
          <input
            id="op-words"
            type="number"
            min={1}
            max={8}
            disabled={leadValue !== 'palavras'}
            value={o.leadIn.words}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (n >= 1 && n <= 8) set({ leadIn: { ...o.leadIn, words: n } }, 'palavras em versalete');
            }}
          />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="op-num">Numeral</label>
          <select id="op-num" value={o.number} onChange={(e) => set({ number: e.target.value as ChapterOpening['number'] }, 'numeral do capítulo')}>
            <option value="nenhum">Nenhum</option>
            <option value="arabico">Arábico (1, 2)</option>
            <option value="romano">Romano (I, II)</option>
            <option value="extenso">Por extenso (Um)</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="op-orn">Ornamento</label>
          <select id="op-orn" value={o.ornament} onChange={(e) => set({ ornament: e.target.value as ChapterOpening['ornament'] }, 'ornamento')}>
            <option value="nenhum">Nenhum</option>
            <option value="fio">Fio</option>
            <option value="vinheta">Vinheta</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="op-dlg">Começo com diálogo ou aspas</label>
        <select id="op-dlg" value={o.dialogue} onChange={(e) => set({ dialogue: e.target.value as ChapterOpening['dialogue'] }, 'regra de diálogo')}>
          <option value="pendurar">Pendurar a pontuação e capitular a letra</option>
          <option value="sem_capitular">Não usar capitular</option>
        </select>
      </div>
      <label className="check small">
        <input type="checkbox" checked={o.capOnDigits} onChange={(e) => set({ capOnDigits: e.target.checked }, 'capitular em algarismos')} />
        Capitular também em algarismos
      </label>
      <label className="check small">
        <input
          type="checkbox"
          checked={extrasOn}
          onChange={(e) =>
            set({ appliesTo: e.target.checked ? ['capitulo', ...OPENING_EXTRA_KINDS] : ['capitulo'] }, 'elementos com abertura')
          }
        />
        Aplicar também a prefácio, introdução, conclusão e posfácio
      </label>
      <p className="small muted num" style={{ margin: 0 }}>
        {affected.length === 0
          ? 'Nenhum elemento recebe este tratamento.'
          : `Efeito no livro: ${extra === 0 ? 'nenhuma linha' : `${extra > 0 ? '+' : ''}${extra} ${Math.abs(extra) === 1 ? 'linha' : 'linhas'}`} em ${affected.length} ${affected.length === 1 ? 'abertura' : 'aberturas'}. Prévia indicativa; a prova fiel vem da composição final.`}
      </p>
    </>
  );
}

const PREVIEW_BODY_PX = 9;

/** Prévia da primeira página de capítulo em HTML/CSS, na escala do painel. */
export function OpeningPreview({ book, settings }: { book: Book; settings: ProjectSettings }) {
  const d = settings.design;
  const o = d.chapterOpening;
  const targets = book.elements.filter((e) => o.appliesTo.includes(e.kind));
  const el = targets.find((e) => e.blocks.some((b) => b.type === 'paragrafo')) ?? book.elements.find((e) => e.kind === 'capitulo');
  if (!el) return null;

  const chapterIndex = book.elements.filter((e) => e.kind === 'capitulo').indexOf(el) + 1;
  const numeral = el.kind === 'capitulo' && chapterIndex > 0 ? chapterNumeral(chapterIndex, o.number) : '';
  const para = el.blocks.find((b) => b.type === 'paragrafo')?.text ?? '';
  const sp = splitOpening(para.slice(0, 700), o);

  const lh = PREVIEW_BODY_PX * (d.leadingPt / d.bodySizePt);
  const n = Math.max(2, Math.min(4, o.dropCap.lines));
  const capPx = (dropCapSizePt(d, n) / d.bodySizePt) * PREVIEW_BODY_PX;
  const scope = o.leadIn.style === 'versalete' ? o.leadIn.scope : null;

  return (
    <div className="opening-preview" aria-label="Prévia da abertura" style={{ fontSize: PREVIEW_BODY_PX, lineHeight: `${lh}px` }}>
      <div className="op-head">
        {numeral && <div className={`op-num ${o.number}`}>{numeral}</div>}
        <div className="op-title">{el.title}</div>
        {o.ornament === 'vinheta' && <div className="op-orn" aria-hidden>❦</div>}
        {o.ornament === 'fio' && <hr className="op-rule" aria-hidden />}
      </div>
      <p className={`op-text${scope === 'linha' ? ' sc-line' : ''}`}>
        {sp.cap && o.dropCap.mode === 'rebaixada' && (
          <span className="op-drop" style={{ fontSize: capPx, height: n * lh - (lh - PREVIEW_BODY_PX) / 2 }}>
            {sp.hanging && <span className="op-hang">{sp.hanging.trim()}</span>}
            {sp.cap}
          </span>
        )}
        {sp.cap && o.dropCap.mode === 'elevada' && (
          <span className="op-raised" style={{ fontSize: capPx }}>
            {sp.hanging && <span className="op-hang">{sp.hanging.trim()}</span>}
            {sp.cap}
          </span>
        )}
        {!sp.cap && sp.hanging}
        {sp.spaceAfterCap && ' '}
        {sp.leadIn && <span className="sc">{sp.leadIn}</span>}
        {sp.rest}
      </p>
    </div>
  );
}
