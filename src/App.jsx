import { useMemo, useState } from 'react';
import ControlPanel from './components/ControlPanel';
import PingPongDrawMachine from './components/PingPongDrawMachine';
import { clampDrawCount, parseOptions } from './utils/draw';

const PRESETS = {
  iceCream: [
    'Vanilla Bean',
    'Chocolate Fudge',
    'Salted Caramel',
    'Strawberry Swirl',
    'Mint Choc Chip',
    'Honeycomb Crunch',
    'Cookies and Cream',
    'Coffee Ripple',
  ],
  initials: ['GF', 'JB', 'AP', 'JH', 'SN', 'MI', 'HK', 'MM', 'SG', 'SW', 'DZ'],
};

function App() {
  const [presetKey, setPresetKey] = useState('iceCream');
  const [optionsText, setOptionsText] = useState(PRESETS.iceCream.join('\n'));
  const [selectedPresetOptions, setSelectedPresetOptions] = useState(PRESETS.iceCream);
  const [drawCount, setDrawCount] = useState(3);
  const [status, setStatus] = useState('Ready');
  const [results, setResults] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [runSeed, setRunSeed] = useState(0);
  const [resetToken, setResetToken] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  const parsedOptions = useMemo(() => parseOptions(optionsText), [optionsText]);
  const optionCount = parsedOptions.length;
  const safeDrawCount = clampDrawCount(drawCount, optionCount);

  const validationMessage = useMemo(() => {
    if (optionCount === 0) {
      return 'Please enter at least one option.';
    }
    if (Number.isNaN(Number(drawCount)) || Number(drawCount) < 1) {
      return 'Draw count must be at least 1.';
    }
    if (Number(drawCount) > optionCount) {
      return 'Draw count cannot exceed option count.';
    }
    return '';
  }, [drawCount, optionCount]);

  const canStart = !isDrawing && !validationMessage && optionCount > 0;

  const handleOptionsChange = (value) => {
    setOptionsText(value);

    const nextCount = parseOptions(value).length;
    setDrawCount((current) => clampDrawCount(current, nextCount));
  };

  const handleDrawCountChange = (value) => {
    if (value === '') {
      setDrawCount('');
      return;
    }

    setDrawCount(Number(value));
  };

  const handlePresetChange = (nextPresetKey) => {
    setPresetKey(nextPresetKey);
    if (nextPresetKey !== 'custom') {
      const nextPresetOptions = PRESETS[nextPresetKey];
      const presetText = nextPresetOptions.join('\n');
      setSelectedPresetOptions(nextPresetOptions);
      setOptionsText(presetText);
      setDrawCount((current) => clampDrawCount(current, nextPresetOptions.length));
    }
  };

  const handlePresetOptionToggle = (option) => {
    setSelectedPresetOptions((current) => {
      const nextSelection = current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option].sort(
            (a, b) => PRESETS[presetKey].indexOf(a) - PRESETS[presetKey].indexOf(b),
          );

      setOptionsText(nextSelection.join('\n'));
      setDrawCount((drawValue) => clampDrawCount(drawValue, nextSelection.length));
      return nextSelection;
    });
  };

  const handleStart = () => {
    if (!canStart) {
      return;
    }

    setResults([]);
    setIsDrawing(true);
    setStatus('Mixing balls...');
    setRunSeed((current) => current + 1);
    setIsDrawerOpen(false);
    setIsResultsModalOpen(false);
  };

  const handleReset = () => {
    setIsDrawing(false);
    setResults([]);
    setStatus('Ready');
    setResetToken((current) => current + 1);
    setIsResultsModalOpen(false);
  };

  return (
    <main className="app-shell">
      <button
        type="button"
        className="drawer-toggle"
        onClick={() => setIsDrawerOpen((current) => !current)}
        aria-expanded={isDrawerOpen}
        aria-controls="controls-drawer"
      >
        {isDrawerOpen ? 'Close Controls' : 'Open Controls'}
      </button>

      <div
        className={`drawer-scrim ${isDrawerOpen ? 'is-open' : ''}`}
        onClick={() => setIsDrawerOpen(false)}
        aria-hidden={!isDrawerOpen}
      />

      <aside id="controls-drawer" className={`controls-drawer ${isDrawerOpen ? 'is-open' : ''}`}>
        <ControlPanel
          presetKey={presetKey}
          optionsText={optionsText}
          presetOptions={PRESETS[presetKey] || []}
          selectedPresetOptions={selectedPresetOptions}
          drawCount={drawCount}
          maxDrawCount={optionCount}
          validationMessage={validationMessage}
          isDrawing={isDrawing}
          onPresetChange={handlePresetChange}
          onPresetOptionToggle={handlePresetOptionToggle}
          onOptionsChange={handleOptionsChange}
          onDrawCountChange={handleDrawCountChange}
          onReset={handleReset}
        />
      </aside>

      <section className="content-grid">
        <div className="machine-column">
          <PingPongDrawMachine
            options={parsedOptions}
            drawCount={safeDrawCount}
            runSeed={runSeed}
            resetToken={resetToken}
            isDrawing={isDrawing}
            onStatusChange={setStatus}
            onResultsChange={setResults}
            onDrawComplete={() => {
              setIsDrawing(false);
              setIsResultsModalOpen(true);
            }}
          />
          <button
            type="button"
            className="machine-draw-button"
            onClick={handleStart}
            disabled={!canStart}
          >
            Start Draw
          </button>
        </div>
      </section>

      {isResultsModalOpen ? (
        <div className="results-modal-backdrop" onClick={() => setIsResultsModalOpen(false)}>
          <section className="results-modal panel" onClick={(event) => event.stopPropagation()}>
            <div className="results-modal-header">
              <div>
                <h2>Results</h2>
                <p>{status}</p>
              </div>
              <button
                type="button"
                className="results-modal-close"
                onClick={() => setIsResultsModalOpen(false)}
              >
                Close
              </button>
            </div>

            <ol className="results-list">
              {results.map((result, index) => (
                <li key={`${result}-${index}`} className="result-item">
                  <span className="result-order">{index + 1}</span>
                  <span className="result-value">{result}</span>
                </li>
              ))}
            </ol>

            {!results.length ? (
              <div className="results-empty">No balls reached the rail yet.</div>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
